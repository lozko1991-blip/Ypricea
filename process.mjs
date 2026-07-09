// ═══════════════════════════════════════════════════════════════
// Ypricea — обробка прайсу постачальника
// Завантажує великий XML (gzip), потоково парсить, фільтрує,
// рахує націнку, ріже на JSON по категоріях, пише звіт.
// Нічого не тримає в памʼяті цілком окрім самих товарів (lite+full).
// ═══════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { SaxesParser } from 'saxes';

// ──────────── CONFIG (тут міняй правила) ────────────
const CONFIG = {
  XML_URL: 'https://crm.yavshoke.ua/media/export/all_drop_opt_price.xml',
  MIN_DROP: 150,        // видаляти товари з price_drop < 150
  MARKUP_PCT: 20,       // дефолт націнки % (НЕ застосовується в базі; лише підказка для пресетів)
  MARKUP_GRN: 70,       // дефолт націнки грн (НЕ застосовується в базі; рахується при генерації)
  MIN_CAT_PRODUCTS: 5,  // листову категорію з < 5 (тобто ≤4) товарів — видалити
  OUT_DIR: 'frontend/public',      // куди писати сайт+дані (звідси деплоїться Pages)
  IMG_PREFIX: 'https://crm.yavshoke.ua/media/shop//', // спільний префікс фото
  SITE_URL: 'https://lozko1991-blip.github.io/Ypricea',

  // ── ШАРДИНГ КАТАЛОГУ (модель «як інтернет-магазин») ──
  // Замість одного гігантського JSON пишемо:
  //   data/index.json          — легкий пошуковий індекс (id, артикул, назва ua/ru, ціна, cat, src)
  //   data/categories.json     — дерево категорій з лічильниками
  //   data/shards/p-NNNN.json.gz — повні товари (фото, параметри) пачками по SHARD_SIZE
  //   data/desc/d-NNNN.json.gz  — описи (ru+ua) тих самих товарів, окремо
  // Сайт качає тільки index+categories (≤5 МБ gzip). Шарди — на льоту при відкритті.
  SHARD_SIZE: 1000,     // товарів у шарді
  SHARDS_DIR: 'shards',
  DESC_DIR: 'desc',

  // ── MASTEREVA (другий постачальник) ──
  // Її товари йдуть у спільні шарди разом з ЯВШОКЕ. У генератор/експорт
  // ЯВШОКЕ-XML вони НЕ потрапляють (генератор бере тільки src=yavshoke).
  MASTEREVA_ENABLED: true,
  MASTEREVA_XML_URL: 'https://lozko1991-blip.github.io/xmlprice/Masterevanew.xml',
  MASTEREVA_MIN_PRICE: 0,
  // Префікси categoryId → ключ постачальника (узгоджено з assets/suppliers.js)
  MASTEREVA_PREFIXES: [
    { prefix: '1000', src: 'ev_dropt' },
    { prefix: '1100', src: 'ev_forus' },
    { prefix: '1111', src: 'ev_shkatulka' },
    { prefix: '2222', src: 'ev_optdrop' },
    { prefix: '3333', src: 'ev_lugi' },
    { prefix: '4444', src: 'ev_dropom' },
    { prefix: '5555', src: 'ev_royaltoys' },
    { prefix: '7777', src: 'ev_posudograd' },
    { prefix: '8888', src: 'ev_iposud' },
    { prefix: '9999', src: 'ev_websklad' },
  ],
  MASTEREVA_DEFAULT_SRC: 'ev_kievopt',
  // Описи Mastereva потрапляють у desc-шарди (а не в основний індекс),
  // тож їх можна сміливо лишати — пам'ять сайту вони не їдять.
  MASTEREVA_INCLUDE_DESC: true,
  MASTEREVA_DESC_MAX: 4000,
  MASTEREVA_MAX_PICS: 8,
};
// ─────────────────────────────────────────────────────

const DATA_DIR = path.join(CONFIG.OUT_DIR, 'data');
const FULL_DIR = path.join(DATA_DIR, 'full');
const TMP_XML = 'price.xml';

const warnings = [];
function warn(msg) { if (warnings.length < 500) warnings.push(msg); }

// ──────────── 1. Завантаження XML (з gzip) ────────────
async function download(retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`📥 Завантаження XML (спроба ${i}/${retries}):`, CONFIG.XML_URL);
      const res = await fetch(CONFIG.XML_URL, { headers: { 'Accept-Encoding': 'gzip, deflate, br' } });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' при завантаженні XML');
      await pipeline(res.body, fs.createWriteStream(TMP_XML));
      const mb = (fs.statSync(TMP_XML).size / 1048576).toFixed(1);
      console.log(`✅ Завантажено ${mb} МБ`);
      return;
    } catch (e) {
      console.warn(`⚠️ Помилка завантаження (спроба ${i}):`, e.message);
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// ──────────── 2. Потоковий парс ────────────
function parse() {
  return new Promise((resolve, reject) => {
    const parser = new SaxesParser();
    const categories = []; // {id,name,parentId}
    const catById = {};
    const offersByCat = new Map(); // catId -> [offer]
    let totalOffers = 0, removedByPrice = 0;
    const seenIds = new Set(); // захист від дублів id у вхідному XML

    // стан парсингу
    let inOffer = false, offer = null;
    let tag = '', textBuf = '', cdataBuf = '';
    let curCat = null;       // для <category>
    let curParam = null;     // для <param>
    let inDesc = false;      // чи зараз всередині <description>
    let inDescUa = false;    // чи зараз всередині <description_ua>
    let descBuf = '';        // буфер опису RU
    let descUaBuf = '';      // буфер опису UA
    let descDepth = 0;       // глибина вкладеності (для HTML-тегів всередині опису)

    parser.on('error', reject);

    parser.on('opentag', (node) => {
      const n = node.name;
      // якщо ми всередині опису — накопичуємо HTML-тег
      if (inDesc) { descDepth++; descBuf += `<${n}`; for (const [k,v] of Object.entries(node.attributes)) descBuf += ` ${k}="${v}"`; descBuf += '>'; tag='';textBuf='';cdataBuf=''; return; }
      if (inDescUa) { descDepth++; descUaBuf += `<${n}`; for (const [k,v] of Object.entries(node.attributes)) descUaBuf += ` ${k}="${v}"`; descUaBuf += '>'; tag='';textBuf='';cdataBuf=''; return; }
      if (n === 'category') {
        curCat = { id: node.attributes.id || '', parentId: node.attributes.parentId || '', name: '' };
      } else if (n === 'offer') {
        inOffer = true;
        offer = {
          id: node.attributes.id || '', available: node.attributes.available !== 'false',
          groupId: node.attributes.group_id || '',
          price: '', drop: '', currencyId: '', catId: '',
          pics: [], name: '', name_ua: '', desc: '', desc_ua: '',
          vendor: '', vendorCode: '', barcode: '', params: [],
        };
      } else if (inOffer && n === 'param') {
        curParam = { name: node.attributes.name || '', value: '' };
      } else if (inOffer && n === 'description') {
        inDesc = true; descBuf = ''; descDepth = 0;
      } else if (inOffer && n === 'description_ua') {
        inDescUa = true; descUaBuf = ''; descDepth = 0;
      }
      tag = n; textBuf = ''; cdataBuf = '';
    });

    parser.on('text', (t) => { if (inDesc) { descBuf += t; } else if (inDescUa) { descUaBuf += t; } else textBuf += t; });
    parser.on('cdata', (t) => { if (inDesc) { descBuf += t; } else if (inDescUa) { descUaBuf += t; } else cdataBuf += t; });

    parser.on('closetag', (node) => {
      const n = node.name;
      // якщо ми в буфері опису — накопичуємо HTML закриваючий тег
      if (inDesc) {
        if (n === 'description') { offer.desc = descBuf.trim(); inDesc = false; }
        else { descBuf += `</${n}>`; }
        textBuf = ''; cdataBuf = ''; return;
      }
      if (inDescUa) {
        if (n === 'description_ua') { offer.desc_ua = descUaBuf.trim(); inDescUa = false; }
        else { descUaBuf += `</${n}>`; }
        textBuf = ''; cdataBuf = ''; return;
      }

      const rawVal = (cdataBuf || textBuf).trim();
      // Декодуємо HTML-ентіті які можуть зустрітись у незахищених текстових вузлах
      const val = rawVal.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&nbsp;/g,' ');

      if (n === 'category') {
        if (curCat && curCat.id) { curCat.name = textBuf.trim(); categories.push(curCat); catById[curCat.id] = curCat; }
        curCat = null;
      } else if (inOffer) {
        if (n === 'param') {
          if (curParam && curParam.name) {
            curParam.value = val;
            if (curParam.value) {
              // EAN/barcode може йти як param name="Ean" або "EAN" — витягуємо окремо
              if (/^ean$/i.test(curParam.name.trim())) {
                offer.barcode = offer.barcode || curParam.value;
              }
              offer.params.push({ name: curParam.name, value: curParam.value });
            }
          }
          curParam = null;
        }
        else if (n === 'picture') { if (val) offer.pics.push(val); }
        else if (n === 'price') offer.price = val;
        else if (n === 'price_drop') offer.drop = val;
        else if (n === 'currencyId') offer.currencyId = val;
        else if (n === 'categoryId') offer.catId = val;
        else if (n === 'name') offer.name = val;
        else if (n === 'name_ua') offer.name_ua = val;
        else if (n === 'vendor') offer.vendor = val;
        else if (n === 'vendorCode') offer.vendorCode = val;
        else if (n === 'barcode') offer.barcode = val;
        else if (n === 'offer') {
          inOffer = false; totalOffers++;
          finalizeOffer(offer);
          offer = null;
        }
      }
      textBuf = ''; cdataBuf = '';
    });

    function finalizeOffer(o) {
      // Закупівля (дроп): пріоритет у <price_drop>, фолбек на <price>.
      // У реальному XML обидва теги присутні (часто рівні), тому беремо саме price_drop.
      const dropSrc = (o.drop !== '' && o.drop != null) ? o.drop : o.price;
      const drop = Math.round(parseFloat(String(dropSrc).replace(',', '.')) || 0);
      if (!drop || drop <= 0) { warn(`offer ${o.id}: немає ціни (<price>)`); }
      // фільтр по ціні
      if (drop < CONFIG.MIN_DROP) { removedByPrice++; return; }
      if (!o.catId) { warn(`offer ${o.id}: немає categoryId — пропущено`); return; }
      if (o.id && seenIds.has(o.id)) { warn(`offer ${o.id}: дубль id — пропущено`); return; }
      if (o.id) seenIds.add(o.id);
      // Націнку в базі НЕ рахуємо. Зберігаємо лише закупівлю (drop).
      // Ціна продажу формується тільки при генерації XML (% + грн з пресету/генератора).
      const rec = {
        id: o.id, cat: o.catId, available: o.available, groupId: o.groupId || undefined,
        drop,
        name: o.name || o.name_ua || 'Без назви',
        name_ua: o.name_ua || o.name || 'Без назви',
        vendorCode: o.vendorCode || '', barcode: o.barcode || '',
        pics: o.pics, params: o.params,
        desc: o.desc || '', desc_ua: o.desc_ua || '',
        img: o.pics[0] || '',
      };
      if (!offersByCat.has(o.catId)) offersByCat.set(o.catId, []);
      offersByCat.get(o.catId).push(rec);
    }

    const stream = fs.createReadStream(TMP_XML, { encoding: 'utf8' });
    stream.on('data', (chunk) => parser.write(chunk));
    stream.on('error', reject);
    stream.on('end', () => { parser.close(); resolve({ categories, catById, offersByCat, totalOffers, removedByPrice }); });
  });
}

// ──────────── 2.5 Повний JSON (один файл) + gzip ────────────
// Структура повторює XML постачальника: ті самі поля, нічого не перейменовуємо по суті.
// Фільтри: ціна < MIN_DROP, малі листові категорії (≤4), порожні батьки.
// Категорії несуть лічильники (count/total) — щоб сайт малював дерево без сканування.
// Збирає всі товари ЯВШОКЕ у плаский масив у форматі для шардингу.
// Не пише жодного файлу — лише повертає дані. Файли пише writeShardedCatalog().
function collectYavshokeProducts(offersByCat) {
  const out = [];
  for (const [, arr] of offersByCat) {
    for (const o of arr) {
      out.push({
        id: o.id,
        available: o.available,
        catId: o.cat,
        price_drop: o.drop,
        name: o.name || '',
        name_ua: o.name_ua || '',
        vendorCode: o.vendorCode || '',
        groupId: o.groupId || '',
        barcode: o.barcode || '',
        pics: o.pics || [],
        params: o.params || [],
        desc: o.desc || '',
        desc_ua: o.desc_ua || '',
        src: 'yavshoke',
      });
    }
  }
  return out;
}

// ── ШАРДИНГ ─────────────────────────────────────────────────────────
// Пише data/index.json (легкий пошуковий індекс), data/categories.json,
// data/shards/p-NNNN.json.gz (товари по SHARD_SIZE), data/desc/d-NNNN.json.gz (описи).
// Жодного гігантського файлу — сайт відкривається з ≤5 МБ gzip.
function writeShardedCatalog({ meta, keptCats, directCount, totalCount, products }) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const shardsDir = path.join(DATA_DIR, CONFIG.SHARDS_DIR);
  const descDir = path.join(DATA_DIR, CONFIG.DESC_DIR);
  // якщо лишилися старі шарди з попереднього запуску — прибираємо
  for (const dir of [shardsDir, descDir]) {
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    fs.mkdirSync(dir, { recursive: true });
  }

  // categories.json — дерево з лічильниками + src
  const categories = keptCats.map(c => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId || null,
    count: directCount[c.id] || 0,
    total: totalCount[c.id] || 0,
    src: c.src || 'yavshoke',
  }));
  fs.writeFileSync(path.join(DATA_DIR, 'categories.json'), JSON.stringify({ meta, categories }));

  // Сортуємо товари детерміновано (id), щоб шарди не «гуляли» між запусками.
  // Це робить кеш браузера ефективнішим (один і той самий товар попадає
  // в один і той самий шард). Сортування рядкове — швидко й стабільно.
  products.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Будуємо index.json + шарди по SHARD_SIZE
  const indexProducts = [];           // легкі записи для пошуку
  const productLocation = {};         // id товару → номер шарда (для браузера)
  const SHARD = CONFIG.SHARD_SIZE;
  const totalShards = Math.ceil(products.length / SHARD);
  let shardBytes = 0, descBytes = 0;

  for (let s = 0; s < totalShards; s++) {
    const slice = products.slice(s * SHARD, (s + 1) * SHARD);
    const shardName = 'p-' + String(s + 1).padStart(4, '0');
    const descName = 'd-' + String(s + 1).padStart(4, '0');

    // повні записи (без описів) — для картки/модалки/генератора
    const fullArr = [];
    // описи — окремий файл
    const descArr = [];

    for (const p of slice) {
      // легкий запис у індекс (для пошуку, дерева, картки-плитки)
      const lite = {
        id: p.id,
        a: p.available ? 1 : 0,
        c: p.catId,
        pr: p.price_drop,
        n: p.name_ua || p.name || '',  // одна назва — UA в пріоритеті (картка показує UA)
        s: p.src,
      };
      const brandParam = p.params && p.params.find(pm => pm.name === 'Бренд' || pm.name === 'Бренд:' || pm.name === 'Производитель' || pm.name === 'Виробник');
      if (brandParam && brandParam.value) {
        lite.b = brandParam.value.trim();
      }
      if (p.vendorCode) lite.v = p.vendorCode;
      // друга мова та RU-назва — лише якщо відрізняється (економія розміру)
      if (p.name && p.name !== lite.n) lite.nr = p.name;
      // перше фото для плитки (тільки одне!)
      if (p.pics && p.pics[0]) lite.i = p.pics[0];
      indexProducts.push(lite);

      // повний запис у шард (з фото й параметрами, без опису)
      const full = {
        id: p.id,
        name: p.name || p.name_ua || '',
        name_ua: p.name_ua || p.name || '',
        pictures: p.pics || [],
        params: p.params || [],
      };
      if (p.vendorCode) full.vendorCode = p.vendorCode;
      if (p.groupId) full.group_id = p.groupId;
      if (p.barcode) full.barcode = p.barcode;
      fullArr.push(full);

      // опис — окремо (часто найважчий блок)
      const hasDesc = !!(p.desc || p.desc_ua);
      if (hasDesc) {
        const d = { id: p.id };
        if (p.desc) d.description = p.desc;
        if (p.desc_ua) d.description_ua = p.desc_ua;
        descArr.push(d);
      }

      productLocation[p.id] = s + 1;
    }

    // запис шарда товарів (gzip)
    const shardJson = JSON.stringify(fullArr);
    const shardGz = zlib.gzipSync(shardJson, { level: 9 });
    fs.writeFileSync(path.join(shardsDir, shardName + '.json.gz'), shardGz);
    shardBytes += shardGz.length;

    // запис шарда описів (gzip), лише якщо є хоча б один опис
    if (descArr.length) {
      const descJson = JSON.stringify(descArr);
      const descGz = zlib.gzipSync(descJson, { level: 9 });
      fs.writeFileSync(path.join(descDir, descName + '.json.gz'), descGz);
      descBytes += descGz.length;
    }
  }

  // index.json — головний файл, який вантажить сайт першим
  const index = {
    meta: { ...meta, shardSize: SHARD, totalShards, shards: CONFIG.SHARDS_DIR, descs: CONFIG.DESC_DIR },
    imgPrefix: CONFIG.IMG_PREFIX,
    products: indexProducts,
    // мапа id→shard кладеться окремим файлом нижче (щоб індекс лишався компактним),
    // але якщо мапа маленька — кладемо в index. Тут робимо окремий файл завжди.
  };
  const indexJson = JSON.stringify(index);
  fs.writeFileSync(path.join(DATA_DIR, 'index.json'), indexJson);
  const indexGz = zlib.gzipSync(indexJson, { level: 9 });
  fs.writeFileSync(path.join(DATA_DIR, 'index.json.gz'), indexGz);

  // shard-map.json — id→номер шарда (для швидкого пошуку шарда конкретного товару)
  fs.writeFileSync(path.join(DATA_DIR, 'shard-map.json'), JSON.stringify(productLocation));

  // звіт у консоль
  const idxMb = (Buffer.byteLength(indexJson) / 1048576).toFixed(1);
  const idxGzMb = (indexGz.length / 1048576).toFixed(2);
  const shardsMb = (shardBytes / 1048576).toFixed(1);
  const descMb = (descBytes / 1048576).toFixed(1);
  console.log(`   📚 Шардинг готовий:`);
  console.log(`      index.json:    ${indexProducts.length} товарів  (${idxMb} МБ, gzip ${idxGzMb} МБ)`);
  console.log(`      shards/:       ${totalShards} файлів × ~${SHARD}  (${shardsMb} МБ загалом, gzip)`);
  console.log(`      desc/:         з описами  (${descMb} МБ загалом, gzip)`);
  return { totalProducts: indexProducts.length, totalShards };
}

function build({ categories, catById, offersByCat, totalOffers, removedByPrice }) {
  // Лічильник для звіту: скільки товарів без опису (постачальник не надав)
  let noDesc = 0;
  for (const [, offers] of offersByCat) for (const o of offers) if (!o.desc && !o.desc_ua) noDesc++;
  if (noDesc) console.log(`   ℹ️ Товарів без опису (джерело не містить): ${noDesc}`);
  // визначаємо "листові" (категорія без дочірніх категорій)
  const childrenOf = {};
  categories.forEach(c => { const p = c.parentId || ''; (childrenOf[p] = childrenOf[p] || []).push(c.id); });
  const isLeaf = (id) => !(childrenOf[id] && childrenOf[id].length);

  // правило: листову категорію з < 5 (тобто ≤4) товарів — видалити разом з товарами
  let removedSmallCats = 0, removedSmallOffers = 0;
  for (const [catId, offers] of offersByCat) {
    if (isLeaf(catId) && offers.length < CONFIG.MIN_CAT_PRODUCTS) {
      removedSmallOffers += offers.length; removedSmallCats++;
      offersByCat.delete(catId);
    }
  }

  // агрегати по дереву (скільки товарів у піддереві кожної категорії)
  const directCount = {}; let kept = 0;
  for (const [catId, offers] of offersByCat) { directCount[catId] = offers.length; kept += offers.length; }
  const totalCount = {}; // direct + нащадки
  function aggregate(id) {
    let sum = directCount[id] || 0;
    (childrenOf[id] || []).forEach(ch => { sum += aggregate(ch); });
    totalCount[id] = sum; return sum;
  }
  categories.filter(c => !(c.parentId && catById[c.parentId])).forEach(c => aggregate(c.id));
  categories.forEach(c => { if (totalCount[c.id] == null) totalCount[c.id] = directCount[c.id] || 0; });

  // прибираємо порожні категорії (нуль у піддереві)
  let removedEmptyCats = 0;
  const keptCats = categories.filter(c => {
    if ((totalCount[c.id] || 0) > 0) return true;
    removedEmptyCats++; return false;
  });

  // ── запис ──
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const meta = {
    updated: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
    imgPrefix: CONFIG.IMG_PREFIX,
    totalOffers, kept, removedByPrice, removedSmallCats, removedSmallOffers,
    removedEmptyCats, categories: keptCats.length, warnings: warnings.length,
  };

  // report.json (як було)
  fs.writeFileSync(path.join(DATA_DIR, 'report.json'), JSON.stringify({ meta, warnings }, null, 2));

  // ВАЖЛИВО: шарди пише головна функція (main) ПІСЛЯ того, як домішає
  // товари Mastereva. Сюди вони не пишуться, бо ЯВШОКЕ-експорт у XML
  // (buildPromXml) бере дані безпосередньо з offersByCat, а не з шардів.
  return { meta, offersByCat, catById, childrenOf, keptCats, directCount, totalCount };
}

// ──────────── 3.5 Статичні експорти з пресетів (Етап 2) ────────────
function escX(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function cdX(s) { return '<![CDATA[' + String(s == null ? '' : s).replace(/]]>/g, ']]&gt;') + ']]>'; }
function ancestorsOf(id, catById) { const out = []; let c = catById[id]; while (c && c.parentId) { const p = catById[c.parentId]; if (!p) break; out.push(p); c = p; } return out; }

// ── Назви params що можуть містити бренд ──
const BRAND_PARAM_NAMES_SRV = new Set(['бренд','brand','торгова марка','торговая марка','виробник','производитель','марка']);
function getOfferBrand(o, defaultBrand) {
  const bp = (o.params || []).find(pm => BRAND_PARAM_NAMES_SRV.has((pm.name || '').toLowerCase()));
  return (bp && bp.value) || defaultBrand || '';
}
function withBrandSrv(name, brand) {
  if (!brand || !name) return name;
  if (name.toLowerCase().includes(brand.toLowerCase())) return name;
  return name + ' ' + brand;
}

// ── Доповнення характеристик для товарів з <3 параметрів ──
const DEFAULT_FILL_SRV = [
  { name: 'Розмір', value: '-' },
  { name: 'Колір', value: 'Комбінований' },
  { name: 'Вага', value: '-' },
  { name: 'Стан', value: 'Новий' },
];
function fillDefaultParamsSrv(params) {
  if ((params || []).length >= 3) return params;
  const result = [...(params || [])];
  const existing = new Set(result.map(p => (p.name || '').toLowerCase()));
  for (const dp of DEFAULT_FILL_SRV) {
    if (result.length >= 4) break;
    if (!existing.has(dp.name.toLowerCase())) { result.push({ ...dp }); existing.add(dp.name.toLowerCase()); }
  }
  return result;
}

function buildPromXml(offers, catById, opts = {}) {
  const idPfx   = String(opts.idPrefix  || '');
  const catPfx  = String(opts.catPrefix || '');
  const addBrand    = !!opts.addBrand;
  const defaultBrand = String(opts.defaultBrand || '');
  const doFillParams = !!opts.fillParams;

  // ── Збираємо потрібні категорії (листові + всі предки) ──
  const usedIds = new Set();
  offers.forEach(o => {
    usedIds.add(o.cat);
    ancestorsOf(o.cat, catById).forEach(a => usedIds.add(a.id));
  });

  // ── Сортуємо офери: варіанти однієї group_id йдуть підряд ──
  const sorted = [...offers].sort((a, b) => {
    const ga = a.groupId || '', gb = b.groupId || '';
    if (ga && gb) { if (ga !== gb) return ga < gb ? -1 : 1; return 0; }
    if (ga) return -1; if (gb) return 1; return 0;
  });

  const date = new Date().toISOString().slice(0, 19).replace('T', ' ');

  let x = `<?xml version="1.0" encoding="UTF-8"?>\n<yml_catalog date="${date}">\n<shop>\n`;
  x += `<name>UTRADE</name>\n<company>UTRADE</company>\n<url>${CONFIG.SITE_URL}/</url>\n`;
  x += `<currencies><currency id="UAH" rate="1"/></currencies>\n`;

  // ── Категорії з префіксом (топологічний порядок) ──
  x += `<categories>\n`;
  const catList = Object.values(catById).filter(c => usedIds.has(c.id));
  const catSorted = [];
  const catAdded = new Set();
  function addCat(c) {
    if (catAdded.has(c.id)) return;
    if (c.parentId && catById[c.parentId] && usedIds.has(c.parentId)) addCat(catById[c.parentId]);
    catSorted.push(c); catAdded.add(c.id);
  }
  catList.forEach(c => addCat(c));
  catSorted.forEach(c => {
    const pfxId     = catPfx + c.id;
    const pfxParent = c.parentId ? (catPfx + c.parentId) : '';
    x += `  <category id="${escX(pfxId)}"${pfxParent ? ` parentId="${escX(pfxParent)}"` : ''}>${escX(c.name)}</category>\n`;
  });
  x += `</categories>\n<offers>\n`;

  // ── Офери ──
  sorted.forEach(o => {
    const offerId  = idPfx + o.id;
    const catId    = catPfx + o.cat;
    const groupId  = o.groupId ? (idPfx + o.groupId) : '';
    let params = o.params || [];
    if (doFillParams) params = fillDefaultParamsSrv(params);

    const brand  = addBrand ? getOfferBrand(o, defaultBrand) : '';
    const nameRu = brand ? withBrandSrv(o.name || o.name_ua || 'Без назви', brand) : (o.name || o.name_ua || 'Без назви');
    const nameUa = brand ? withBrandSrv(o.name_ua || o.name || 'Без назви', brand) : (o.name_ua || o.name || 'Без назви');

    let attrs = `id="${escX(offerId)}" available="${o.available !== false ? 'true' : 'false'}"`;
    if (groupId) attrs += ` group_id="${escX(groupId)}"`;
    x += `<offer ${attrs}>\n`;

    const outPrice = (o.finalPrice != null) ? o.finalPrice : o.drop;
    x += `  <price>${outPrice}</price>\n  <currencyId>UAH</currencyId>\n`;
    x += `  <categoryId>${escX(catId)}</categoryId>\n`;
    (o.pics || []).forEach(p => { if (p) x += `  <picture>${escX(p)}</picture>\n`; });
    if (o.vendorCode) x += `  <vendorCode>${escX(o.vendorCode)}</vendorCode>\n`;
    if (o.barcode)    x += `  <barcode>${escX(o.barcode)}</barcode>\n`;
    if (brand)        x += `  <vendor>${escX(brand)}</vendor>\n`;
    x += `  <name>${cdX(nameRu)}</name>\n`;
    x += `  <name_ua>${cdX(nameUa)}</name_ua>\n`;
    if (o.desc)    x += `  <description>${cdX(o.desc)}</description>\n`;
    if (o.desc_ua) x += `  <description_ua>${cdX(o.desc_ua)}</description_ua>\n`;
    params.forEach(pm => {
      if (!pm || !pm.name) return;
      const pName  = escX(deEsc(pm.name));
      const pValue = escX(deEsc(String(pm.value ?? '')));
      if (pValue) x += `  <param name="${pName}">${pValue}</param>\n`;
    });
    x += `</offer>\n`;
  });

  x += `</offers>\n</shop>\n</yml_catalog>`;
  return x;
}

// Де-екранування HTML-ентіті перед повторним escX (захист від подвійного &amp;amp;)
function deEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
}

// ──────────── Стоп-лист (presets/stoplist.json) ────────────
function loadStopList() {
  const p = path.join('presets', 'stoplist.json');
  if (!fs.existsSync(p)) return { ids: [], cats: [], brands: [] };
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return { ids: [], cats: [], brands: [] }; }
}
function _expandCatIds(ids, childrenOf) {
  const blocked = new Set();
  const stack = ids.map(String);
  while (stack.length) { const id = stack.pop(); if (blocked.has(id)) continue; blocked.add(id); (childrenOf[id] || []).forEach(ch => stack.push(ch)); }
  return blocked;
}
function applyStopList(offers, sl, childrenOf) {
  if (!sl || (!sl.ids.length && !sl.cats.length && !sl.brands.length)) return offers;
  const idSet   = sl.ids.length   ? new Set(sl.ids.map(String))                        : null;
  const catSet  = sl.cats.length  ? _expandCatIds(sl.cats, childrenOf)                 : null;
  const brandSet= sl.brands.length? new Set(sl.brands.map(b => String(b).toLowerCase())): null;
  const before = offers.length;
  const result = offers.filter(o => {
    if (idSet   && idSet.has(String(o.id))) return false;
    if (catSet  && catSet.has(String(o.cat || o.catId || ''))) return false;
    if (brandSet){ const brand = getOfferBrand(o, '').toLowerCase(); if (brand && brandSet.has(brand)) return false; }
    return true;
  });
  if (result.length < before) console.log(`   🚫 Стоп-лист: видалено ${before - result.length} товарів`);
  return result;
}

function buildExports({ offersByCat, catById, childrenOf }) {
  const presetDir = 'presets';
  if (!fs.existsSync(presetDir)) { console.log('ℹ️ Теки presets/ немає — статичні експорти пропущено'); return []; }
  const files = fs.readdirSync(presetDir).filter(f => /^export-.+\.json$/i.test(f));
  if (!files.length) { console.log('ℹ️ Немає пресетів export-*.json'); return []; }
  fs.mkdirSync(path.join(CONFIG.OUT_DIR, 'exports'), { recursive: true });
  const sl = loadStopList();
  const made = [];
  for (const f of files) {
    let preset;
    try { preset = JSON.parse(fs.readFileSync(path.join(presetDir, f), 'utf8')); }
    catch (e) { warn(`Пресет ${f}: помилка JSON`); continue; }
    const name = String(preset.name || f.replace(/\.json$/i, '')).replace(/[^a-zA-Z0-9_-]/g, '') || 'export';
    const pct = +preset.pct || 0, grn = +preset.grn || 0, min = +preset.min || 0, avail = !!preset.avail;
    // обрані категорії + всі їх нащадки
    const sel = new Set();
    (function () { const stack = (preset.cats || []).map(String); while (stack.length) { const id = stack.pop(); if (sel.has(id)) continue; sel.add(id); (childrenOf[id] || []).forEach(ch => stack.push(ch)); } })();
    let offers = [];
    for (const [catId, arr] of offersByCat) {
      if (!sel.has(catId)) continue;
      for (const o of arr) {
        if (o.drop < min) continue;
        if (avail && !o.available) continue;
        offers.push({ ...o, finalPrice: Math.round(o.drop * (1 + pct / 100) + grn) });
      }
    }
    offers = applyStopList(offers, sl, childrenOf);
    if (!offers.length) warn(`Пресет ${name}: 0 товарів за умовами`);
    const xmlOpts = { idPrefix: preset.idPrefix||'', catPrefix: preset.catPrefix||'', addBrand: !!preset.addBrand, defaultBrand: preset.defaultBrand||'', fillParams: !!preset.fillParams };
    fs.writeFileSync(path.join(CONFIG.OUT_DIR, 'exports', name + '.xml'), buildPromXml(offers, catById, xmlOpts));
    made.push({ name, count: offers.length, url: `${CONFIG.SITE_URL}/exports/${name}.xml` });
    console.log(`   📦 exports/${name}.xml — ${offers.length} товарів`);
  }
  // маніфест для сайту (блок «Мої автопрайси»)
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'exports.json'), JSON.stringify({ updated: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC', exports: made }));
  } catch (e) { /* ignore */ }
  return made;
}

// ──────────── 3b. Автопрайси MASTEREVA (окремо від ЯВШОке) ────────────
// Працює з масивом me.products (повні товари Mastereva), НЕ чіпає offersByCat
// і ЯВШоке-buildExports. Пресети: presets/export-me-*.json. Вихід: exports/me-*.xml.
function buildMasterevaExports(me) {
  if (!me || !me.products || !me.products.length) {
    console.log('ℹ️ [mastereva-export] немає товарів Mastereva — пропуск');
    return [];
  }
  const presetDir = 'presets';
  if (!fs.existsSync(presetDir)) return [];
  const files = fs.readdirSync(presetDir).filter(f => /^export-me-.+\.json$/i.test(f));
  if (!files.length) { console.log('ℹ️ [mastereva-export] немає пресетів export-me-*.json'); return []; }
  const sl = loadStopList();

  // catById з Mastereva-категорій + childrenOf для розгортання дерева
  const catById = {};
  me.keptCats.forEach(c => { catById[c.id] = { id: c.id, name: c.name, parentId: c.parentId || null }; });
  const childrenOf = {};
  me.keptCats.forEach(c => { const p = c.parentId || ''; (childrenOf[p] = childrenOf[p] || []).push(c.id); });

  // індекс товарів по категорії (один прохід, замість сканування на кожен пресет)
  const byCat = new Map();
  me.products.forEach(p => { if (!byCat.has(p.catId)) byCat.set(p.catId, []); byCat.get(p.catId).push(p); });

  fs.mkdirSync(path.join(CONFIG.OUT_DIR, 'exports'), { recursive: true });
  const made = [];
  for (const f of files) {
    let preset;
    try { preset = JSON.parse(fs.readFileSync(path.join(presetDir, f), 'utf8')); }
    catch (e) { warn(`Пресет ${f}: помилка JSON`); continue; }
    let name = String(preset.name || f.replace(/\.json$/i, '')).replace(/[^a-zA-Z0-9_-]/g, '') || 'export';
    if (!/^me-/i.test(name)) name = 'me-' + name; // гарантуємо префікс, щоб не зіткнутись з ЯВШоке
    const pct = +preset.pct || 0, grn = +preset.grn || 0, min = +preset.min || 0, avail = !!preset.avail;

    // обрані категорії + всі нащадки
    const sel = new Set();
    (function () { const stack = (preset.cats || []).map(String); while (stack.length) { const id = stack.pop(); if (sel.has(id)) continue; sel.add(id); (childrenOf[id] || []).forEach(ch => stack.push(ch)); } })();

    // збираємо офери у форматі, який очікує buildPromXml (cat/drop/desc/...)
    let offers = [];
    for (const id of sel) {
      const arr = byCat.get(id); if (!arr) continue;
      for (const p of arr) {
        if ((p.price_drop || 0) < min) continue;
        if (avail && !p.available) continue;
        offers.push({
          id: p.id,
          available: p.available,
          cat: p.catId,
          drop: p.price_drop,
          finalPrice: Math.max(1, Math.round(p.price_drop * (1 + pct / 100) + grn)),
          name: p.name,
          name_ua: p.name_ua,
          vendorCode: p.vendorCode,
          groupId: p.groupId || '',
          barcode: p.barcode || '',
          pics: p.pics || [],
          desc: p.desc || '',
          desc_ua: p.desc_ua || '',
          params: p.params || [],
        });
      }
    }
    offers = applyStopList(offers, sl, childrenOf);
    if (!offers.length) warn(`Пресет Mastereva ${name}: 0 товарів за умовами`);
    const xmlOpts = { idPrefix: preset.idPrefix||'', catPrefix: preset.catPrefix||'', addBrand: !!preset.addBrand, defaultBrand: preset.defaultBrand||'', fillParams: !!preset.fillParams };
    fs.writeFileSync(path.join(CONFIG.OUT_DIR, 'exports', name + '.xml'), buildPromXml(offers, catById, xmlOpts));
    made.push({ name, count: offers.length, url: `${CONFIG.SITE_URL}/exports/${name}.xml`, src: 'mastereva' });
    console.log(`   📦 exports/${name}.xml — ${offers.length} товарів (Mastereva)`);
  }
  // маніфест Mastereva-експортів (окремий файл, щоб не чіпати exports.json ЯВШоке)
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'exports-me.json'), JSON.stringify({ updated: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC', exports: made }));
  } catch (e) { /* ignore */ }
  return made;
}

// ──────────── 3c. Користувацькі фіди (user-feed-*.json) ────────────
async function downloadUrlWithRetry(url, destPath) {
  let attempts = 3;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      await pipeline(res.body, fs.createWriteStream(destPath));
      return true;
    } catch (e) {
      if (i === attempts) throw e;
      console.log(`   ⚠️ Помилка завантаження (спроба ${i}/${attempts}): ${e.message}. Повтор за 3с...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

function parseCustomXml(filePath, supplierPrefix) {
  return new Promise((resolve, reject) => {
    const parser = new SaxesParser();
    const categories = [];
    const offers = [];

    let inOffer = false, offer = null;
    let curCat = null;
    let tag = '', textBuf = '', cdataBuf = '';
    let inDesc = false, descBuf = '', descDepth = 0;

    parser.on('error', reject);

    parser.on('opentag', (node) => {
      const n = node.name;
      if (inDesc) {
        descDepth++;
        descBuf += `<${n}`;
        for (const [k, v] of Object.entries(node.attributes)) descBuf += ` ${k}="${v}"`;
        descBuf += '>';
        tag = ''; textBuf = ''; cdataBuf = '';
        return;
      }
      if (n === 'category') {
        curCat = {
          id: supplierPrefix + String(node.attributes.id || ''),
          parentId: node.attributes.parentId ? (supplierPrefix + String(node.attributes.parentId)) : null,
          name: ''
        };
      } else if (n === 'offer' || n === 'item') {
        inOffer = true;
        offer = {
          id: node.attributes.id ? (supplierPrefix + String(node.attributes.id)) : '',
          groupId: node.attributes.group_id ? (supplierPrefix + String(node.attributes.group_id)) : null,
          available: node.attributes.available === 'true',
          categoryId: '',
          price: '',
          name: '',
          name_ua: '',
          vendorCode: '',
          vendor: '',
          pictures: [],
          params: [],
          description: '',
          description_ua: '',
          rawFields: {}
        };
      } else if (inOffer && (n === 'description' || n === 'description_ua' || n === 'descriptionUa' || n === 'desc')) {
        inDesc = true; descBuf = ''; descDepth = 0;
      } else if (inOffer && (n === 'param' || n === 'property' || n === 'attribute' || n === 'characteristic')) {
        offer.curParam = { name: node.attributes.name || '', value: '' };
      }
      tag = n; textBuf = ''; cdataBuf = '';
    });

    parser.on('text', (t) => { if (inDesc) descBuf += t; else textBuf += t; });
    parser.on('cdata', (t) => { if (inDesc) descBuf += t; else cdataBuf += t; });

    parser.on('closetag', (node) => {
      const n = node.name;
      if (inDesc) {
        if (n === 'description' || n === 'description_ua' || n === 'descriptionUa' || n === 'desc') {
          if (n === 'description_ua' || n === 'descriptionUa') offer.description_ua = descBuf.trim();
          else offer.description = descBuf.trim();
          inDesc = false;
        } else {
          descBuf += `</${n}>`;
        }
        textBuf = ''; cdataBuf = ''; return;
      }
      const rawVal = (cdataBuf || textBuf).trim();
      const val = rawVal.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');

      if (curCat) {
        if (n === 'category') {
          curCat.name = val;
          if (curCat.id) categories.push(curCat);
          curCat = null;
        }
      } else if (inOffer) {
        if (n === 'param' || n === 'property' || n === 'attribute' || n === 'characteristic') {
          if (offer.curParam) {
            offer.curParam.value = val;
            offer.params.push(offer.curParam);
            offer.curParam = null;
          }
        } else if (n === 'picture') {
          if (val) offer.pictures.push(val);
        } else if (n === 'offer' || n === 'item') {
          inOffer = false;

          // Normalization of YML / XML elements following Importer.php fallbacks
          const rf = offer.rawFields;
          
          if (!offer.id) {
            const fallbackId = rf.id || rf.sku || rf.vendorCode || rf.article || rf.product_id;
            offer.id = fallbackId ? (supplierPrefix + String(fallbackId)) : '';
          }
          
          let pName = rf.name_ua || rf.nameUa || rf.name || '';
          if (!pName && (rf.vendor || rf.model)) {
            pName = `${rf.vendor || ''} ${rf.model || ''}`.trim();
          }
          offer.name_ua = pName;
          offer.name = rf.name || pName;

          const priceVal = rf.priceRUAH || rf.price_uah || rf.retail_price || rf.retailprice || rf.price;
          offer.price = priceVal || '0';

          const costVal = rf.price_drop || rf['price-drop'] || rf.pricedrop || rf.purchasing_price || rf.cost_price || rf.price_opt || rf.wholesale_price || rf.wholesaleprice || rf.in_price || priceVal;
          // If no optic cost price is specified, default to retail price
          offer.price_opt = costVal || priceVal || '0';

          offer.description = offer.description || rf.description || rf.desc || '';
          offer.description_ua = offer.description_ua || rf.description_ua || rf.descriptionUa || offer.description;

          const catIdVal = rf.categoryId || rf.category_id;
          offer.categoryId = catIdVal ? (supplierPrefix + String(catIdVal)) : '';

          offer.vendorCode = rf.vendorCode || rf.article || rf.sku || '';
          offer.vendor = rf.vendor || rf.brand || '';
          
          const stockVal = rf.stock_quantity || rf.quantity_in_stock || rf.stock;
          if (stockVal !== undefined) {
            const stockNum = parseInt(stockVal);
            if (!isNaN(stockNum) && stockNum <= 0) {
              offer.available = false;
            }
          }

          // Clean up rawFields before storing to optimize memory
          delete offer.rawFields;

          if (offer.id && offer.name_ua) {
            offers.push(offer);
          }
          offer = null;
        } else {
          // Collect all elements inside rawFields
          offer.rawFields[n] = val;
        }
      }
      textBuf = ''; cdataBuf = '';
    });

    parser.on('end', () => {
      resolve({ categories, offers });
    });

    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    stream.on('data', chunk => parser.write(chunk));
    stream.on('error', reject);
    stream.on('end', () => {
      parser.close();
    });
  });
}

async function buildUserCustomExports() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let presets = [];
  if (supabaseUrl && supabaseKey) {
    console.log('🌐 Зчитуємо користувацькі конфіги з Supabase DB...');
    try {
      const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/user_feeds?select=*`;
      const res = await fetch(url, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      if (res.ok) {
        presets = await res.json();
        console.log(`   ✅ Зчитано ${presets.length} конфігів з Supabase!`);
      } else {
        console.warn(`   ⚠️ Не вдалося зчитати з Supabase: status ${res.status}`);
      }
    } catch (e) {
      console.warn('   ⚠️ Помилка зчитування з Supabase, fallback до файлів presets/:', e.message);
    }
  }

  if (!presets.length) {
    const presetDir = 'presets';
    if (fs.existsSync(presetDir)) {
      const files = fs.readdirSync(presetDir).filter(f => /^user-feed-.+\.json$/i.test(f));
      for (const f of files) {
        try {
          const preset = JSON.parse(fs.readFileSync(path.join(presetDir, f), 'utf8'));
          preset.token = preset.token || f.replace(/\.json$/i, '').replace(/^user-feed-/, '');
          presets.push(preset);
        } catch (e) {
          console.warn(`Користувацький пресет ${f}: помилка парсингу JSON`);
        }
      }
    }
  }

  if (!presets.length) {
    console.log('ℹ️ [user-feed-export] немає пресетів для обробки');
    return [];
  }

  console.log(`🧩 Обробка користувацьких пресетів: ${presets.length}`);
  fs.mkdirSync(path.join(CONFIG.OUT_DIR, 'exports'), { recursive: true });

  const parsedXmlCache = new Map();
  const made = [];

  for (const preset of presets) {
    const token = preset.token;
    const name = String(preset.name || token).replace(/[^a-zA-Z0-9_-]/g, '') || 'feed';
    const suppliers = preset.suppliers || [];
    const rules = preset.rules || [];
    const catMapping = preset.category_mapping || {};

    if (!suppliers.length) {
      console.log(`   ⚠️ [user-feed-export] пресет ${name} не має постачальників`);
      continue;
    }

    console.log(`⚙️ [user-feed-export] обробка "${name}" (${suppliers.length} постачальників)...`);

    const mergedCats = [];
    const mergedOffers = [];

    for (let i = 0; i < suppliers.length; i++) {
      const sup = suppliers[i];
      const supUrl = sup.xml_url || sup.url;
      if (!supUrl) continue;

      const supPrefix = `u${i}_`;

      let parsedData;
      if (parsedXmlCache.has(supUrl)) {
        parsedData = parsedXmlCache.get(supUrl);
      } else {
        const tmpPath = `temp_user_xml_${i}_${Date.now()}.xml`;
        console.log(`   📥 Завантаження XML для ${sup.name || 'Постачальник #' + i}...`);
        try {
          await downloadUrlWithRetry(supUrl, tmpPath);
          console.log(`   ⚙️ Парсинг XML...`);
          parsedData = await parseCustomXml(tmpPath, supPrefix);
          parsedXmlCache.set(supUrl, parsedData);
        } catch (err) {
          console.warn(`   ⚠️ Не вдалося завантажити/обробити ${supUrl}:`, err.message);
          warn(`User supplier error: ${err.message}`);
          parsedData = null;
        } finally {
          try { fs.unlinkSync(tmpPath); } catch {}
        }
      }

      if (parsedData) {
        parsedData.categories.forEach(c => {
          mergedCats.push({ ...c });
        });
        parsedData.offers.forEach(o => {
          mergedOffers.push({ ...o });
        });
      }
    }

    if (!mergedOffers.length) {
      console.log(`   ⚠️ [user-feed-export] "${name}": 0 товарів після завантаження постачальників`);
      continue;
    }

    const catById = {};
    mergedCats.forEach(c => {
      catById[c.id] = { id: c.id, name: c.name, parentId: c.parentId || null };
    });

    const childrenOf = {};
    mergedCats.forEach(c => {
      const p = c.parentId || '';
      (childrenOf[p] = childrenOf[p] || []).push(c.id);
    });

    mergedCats.forEach(c => {
      const mapped = catMapping[c.id];
      if (mapped && mapped.id) {
        c.id = String(mapped.id);
        c.name = mapped.name || c.name;
      }
    });

    mergedOffers.forEach(o => {
      const originalCatId = o.categoryId;
      const mapped = catMapping[originalCatId];
      if (mapped && mapped.id) {
        o.categoryId = String(mapped.id);
      }
    });

    const mappedCatById = {};
    mergedCats.forEach(c => {
      mappedCatById[c.id] = { id: c.id, name: c.name, parentId: c.parentId || null };
    });

    const mappedChildrenOf = {};
    mergedCats.forEach(c => {
      const p = c.parentId || '';
      (mappedChildrenOf[p] = mappedChildrenOf[p] || []).push(c.id);
    });

    const isInCategoryBranch = (catId, targetCatId) => {
      if (catId === targetCatId) return true;
      const stack = [targetCatId];
      const visited = new Set();
      while (stack.length) {
        const curr = stack.pop();
        if (visited.has(curr)) continue;
        visited.add(curr);
        if (curr === catId) return true;
        (mappedChildrenOf[curr] || []).forEach(ch => stack.push(ch));
      }
      return false;
    };

    let filteredOffers = [];
    for (const o of mergedOffers) {
      let keep = true;
      const cost = parseFloat(o.price) || 0;
      const nameLower = (o.name || '').toLowerCase() + ' ' + (o.name_ua || '').toLowerCase();
      const descLower = (o.description || '').toLowerCase() + ' ' + (o.description_ua || '').toLowerCase();
      const vendorLower = (o.vendor || '').toLowerCase();

      for (const rule of rules) {
        if (rule.type !== 'filter') continue;

        if (rule.scope === 'category' && !isInCategoryBranch(o.categoryId, rule.scope_value)) continue;
        if (rule.scope === 'supplier' && !o.id.startsWith(rule.scope_value + '_')) continue;

        const cfg = rule.config || {};

        if (cfg.exclude_category) {
          keep = false;
          break;
        }
        if (cfg.exclude_out_of_stock && !o.available) {
          keep = false;
          break;
        }
        if (cfg.exclude_no_picture && (!o.pictures || o.pictures.length === 0)) {
          keep = false;
          break;
        }
        if (cfg.stop_words && cfg.stop_words.length > 0) {
          const hasStopWord = cfg.stop_words.some(word => 
            nameLower.includes(word.toLowerCase()) || descLower.includes(word.toLowerCase())
          );
          if (hasStopWord) {
            keep = false;
            break;
          }
        }
        if (cfg.exclude_brands && cfg.exclude_brands.length > 0) {
          const hasExcludedBrand = cfg.exclude_brands.some(brand => 
            vendorLower.includes(brand.toLowerCase()) || nameLower.includes(brand.toLowerCase())
          );
          if (hasExcludedBrand) {
            keep = false;
            break;
          }
        }
        if (cfg.min_cost_price && cost < parseFloat(cfg.min_cost_price)) {
          keep = false;
          break;
        }
      }

      if (keep) {
        filteredOffers.push(o);
      }
    }

    const whitelistRules = rules.filter(r => r.type === 'include_categories');
    if (whitelistRules.length > 0) {
      const allowedCats = new Set();
      for (const rule of whitelistRules) {
        const ids = rule.config.category_ids || [];
        const stack = [...ids].map(String);
        while (stack.length) {
          const cid = stack.pop();
          if (allowedCats.has(cid)) continue;
          allowedCats.add(cid);
          (mappedChildrenOf[cid] || []).forEach(ch => stack.push(ch));
        }
      }
      filteredOffers = filteredOffers.filter(o => allowedCats.has(o.categoryId));
    }

    for (const o of filteredOffers) {
      let finalPrice = parseFloat(o.price) || 0;

      for (const rule of rules) {
        if (rule.type !== 'markup') continue;

        if (rule.scope === 'category' && !isInCategoryBranch(o.categoryId, rule.scope_value)) continue;
        if (rule.scope === 'supplier' && !o.id.startsWith(rule.scope_value + '_')) continue;

        const cfg = rule.config || {};

        if (cfg.markup_type === 'ranges') {
          const ranges = cfg.ranges || [];
          const matchRange = ranges.find(r => {
            const min = parseFloat(r.min) || 0;
            const max = r.max ? parseFloat(r.max) : Infinity;
            return finalPrice >= min && finalPrice < max;
          });
          if (matchRange) {
            const pct = parseFloat(matchRange.percent) || 0;
            const fxd = parseFloat(matchRange.fixed) || 0;
            finalPrice = finalPrice * (1 + pct / 100) + fxd;
          }
        } else {
          const pct = parseFloat(cfg.percent) || 0;
          const fxd = parseFloat(cfg.fixed) || 0;
          finalPrice = finalPrice * (1 + pct / 100) + fxd;
        }
      }

      o.finalPrice = Math.max(1, Math.round(finalPrice));
    }

    for (const o of filteredOffers) {
      let vendor = o.vendor || '';
      let name = o.name || '';
      let nameUa = o.name_ua || '';
      let desc = o.description || '';
      let descUa = o.description_ua || '';
      let pics = [...(o.pictures || [])];
      let params = [...(o.params || [])];

      for (const rule of rules) {
        if (rule.scope === 'category' && !isInCategoryBranch(o.categoryId, rule.scope_value)) continue;
        if (rule.scope === 'supplier' && !o.id.startsWith(rule.scope_value + '_')) continue;

        const cfg = rule.config || {};

        if (rule.type === 'brand' && !vendor && cfg.default_brand) {
          vendor = cfg.default_brand;
        }

        if (rule.type === 'replace' && cfg.search !== undefined && cfg.replace !== undefined) {
          const rx = new RegExp(cfg.search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
          name = name.replace(rx, cfg.replace);
          nameUa = nameUa.replace(rx, cfg.replace);
          desc = desc.replace(rx, cfg.replace);
          descUa = descUa.replace(rx, cfg.replace);
        }

        if (rule.type === 'custom_params' && cfg.custom_param_name && cfg.custom_param_name.length > 0) {
          cfg.custom_param_name.forEach((pName, idx) => {
            const pVal = cfg.custom_param_value?.[idx] || '';
            if (pName && pVal) {
              params.push({ name: pName, value: pVal });
            }
          });
        }

        if (rule.type === 'photo_order' && pics.length > 1) {
          if (cfg.photo_order_mode === 'reverse') {
            pics.reverse();
          } else if (cfg.photo_order_mode === 'last_to_first') {
            const last = pics.pop();
            pics.unshift(last);
          }
        }

        if (rule.type === 'fallback_params') {
          const minCount = parseInt(cfg.fallback_min_count) || 3;
          if (params.length < minCount && cfg.fallback_param_name && cfg.fallback_param_name.length > 0) {
            cfg.fallback_param_name.forEach((pName, idx) => {
              const pVal = cfg.fallback_param_value?.[idx] || '';
              if (pName && pVal && !params.some(p => p.name === pName)) {
                params.push({ name: pName, value: pVal });
              }
            });
          }
        }

        if (rule.type === 'strip_text' && cfg.strip_text && cfg.strip_text.length > 0) {
          cfg.strip_text.forEach(text => {
            if (text) {
              const regex = new RegExp(text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
              desc = desc.replace(regex, '');
              descUa = descUa.replace(regex, '');
            }
          });
        }
      }

      o.vendor = vendor;
      o.name = name;
      o.name_ua = nameUa;
      o.description = desc;
      o.description_ua = descUa;
      o.pictures = pics;
      o.params = params;
    }

    const promOffers = filteredOffers.map(o => ({
      id: o.id,
      available: o.available,
      cat: o.categoryId,
      drop: parseFloat(o.price) || 0,
      finalPrice: o.finalPrice,
      name: o.name,
      name_ua: o.name_ua,
      vendorCode: o.vendorCode,
      groupId: o.groupId || '',
      barcode: o.barcode || '',
      pics: o.pictures,
      desc: o.description,
      desc_ua: o.description_ua,
      params: o.params
    }));

    const xmlOpts = {
      idPrefix: preset.idPrefix || '',
      catPrefix: preset.catPrefix || '',
      addBrand: !!preset.addBrand,
      defaultBrand: preset.defaultBrand || '',
      fillParams: !!preset.fillParams
    };

    const outPath = path.join(CONFIG.OUT_DIR, 'exports', name + '.xml');
    const xmlContent = buildPromXml(promOffers, mappedCatById, xmlOpts);
    fs.writeFileSync(outPath, xmlContent);

    
    const count = promOffers.length;
    made.push({ name, count, url: `${CONFIG.SITE_URL}/exports/${name}.xml`, token });
    console.log(`   📦 exports/${name}.xml — ${count} товарів (Користувацький фід)`);
  }

  try {
    fs.writeFileSync(
      path.join(DATA_DIR, 'user-exports.json'), 
      JSON.stringify({ updated: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC', exports: made })
    );
  } catch (e) { /* ignore */ }

  return made;
}

// ──────────── 4. Звіт у GitHub Actions Summary ────────────
function writeSummary(meta, exportsMade) {
  const lines = [
    '## 📊 Звіт обробки Ypricea',
    '',
    `- Оновлено: **${meta.updated}**`,
    `- Товарів у вхідному XML: **${meta.totalOffers.toLocaleString('uk')}**`,
    `- Відсіяно по ціні (<${CONFIG.MIN_DROP} ₴): **${meta.removedByPrice.toLocaleString('uk')}**`,
    `- Видалено малих категорій (≤${CONFIG.MIN_CAT_PRODUCTS - 1} товарів): **${meta.removedSmallCats}** (товарів: ${meta.removedSmallOffers})`,
    `- Видалено порожніх категорій: **${meta.removedEmptyCats}**`,
    `- ✅ Залишилось товарів: **${meta.kept.toLocaleString('uk')}**`,
    `- Категорій у каталозі: **${meta.categories}**`,
    `- Попереджень: **${meta.warnings}**`,
    '',
    `Націнка в базі НЕ застосовується. Зберігається лише закупівля (<price>). Ціна продажу формується при генерації прайсу (% + грн).`,
  ];
  if (exportsMade && exportsMade.length) {
    lines.push('', '### 📦 Автопрайси (експорти)');
    exportsMade.forEach(e => lines.push(`- \`exports/${e.name}.xml\` — **${e.count.toLocaleString('uk')}** товарів`));
  }
  const txt = lines.join('\n') + '\n';
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, txt);
  console.log(txt);
}

// ══════════════════════════════════════════════════════════════
// MASTEREVA — другий постачальник
// Завантажує Masterevanew.xml (формат EVA: name_ua, price, price_old,
// stock_quantity, article, description_ua, param), потоково парсить,
// проставляє src по префіксу categoryId і пише легкий mastereva.json
// у тому самому форматі, що читає сайт (categories[] + products[]).
// Помилка тут НЕ валить основний білд ЯВШОКЕ.
// ══════════════════════════════════════════════════════════════
const ME_TMP_XML = 'mastereva.xml';

function masterevaSrc(categoryId) {
  const id = String(categoryId == null ? '' : categoryId);
  for (const p of CONFIG.MASTEREVA_PREFIXES) if (id.indexOf(p.prefix) === 0) return p.src;
  return CONFIG.MASTEREVA_DEFAULT_SRC;
}

async function masterevaDownload() {
  console.log('📥 [mastereva] Завантаження XML:', CONFIG.MASTEREVA_XML_URL);
  const res = await fetch(CONFIG.MASTEREVA_XML_URL, { headers: { 'Accept-Encoding': 'gzip, deflate, br' } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' при завантаженні Mastereva XML');
  await pipeline(res.body, fs.createWriteStream(ME_TMP_XML));
  const mb = (fs.statSync(ME_TMP_XML).size / 1048576).toFixed(1);
  console.log(`✅ [mastereva] Завантажено ${mb} МБ`);
}

function masterevaParse() {
  return new Promise((resolve, reject) => {
    const parser = new SaxesParser();
    const categories = [];      // {id,name,parentId}
    const catById = {};
    const products = [];        // компактні записи для сайту
    let totalOffers = 0, skipped = 0;
    const seenIds = new Set();

    let inOffer = false, offer = null;
    let curCat = null, curParam = null;
    let tag = '', textBuf = '', cdataBuf = '';
    let inDescUa = false, descUaBuf = '', descDepth = 0;

    parser.on('error', reject);

    parser.on('opentag', (node) => {
      const n = node.name;
      if (inDescUa) { descDepth++; descUaBuf += `<${n}`; for (const [k, v] of Object.entries(node.attributes)) descUaBuf += ` ${k}="${v}"`; descUaBuf += '>'; tag = ''; textBuf = ''; cdataBuf = ''; return; }
      if (n === 'category') {
        curCat = { id: node.attributes.id || '', parentId: node.attributes.parentId || '', name: '' };
      } else if (n === 'offer') {
        inOffer = true;
        offer = { id: node.attributes.id || '', available: node.attributes.available !== 'false', price: '', catId: '', pics: [], name_ua: '', desc_ua: '', vendor: '', article: '', params: [] };
      } else if (inOffer && n === 'param') {
        curParam = { name: node.attributes.name || '', value: '' };
      } else if (inOffer && n === 'description_ua') {
        inDescUa = true; descUaBuf = ''; descDepth = 0;
      }
      tag = n; textBuf = ''; cdataBuf = '';
    });

    parser.on('text', (t) => { if (inDescUa) descUaBuf += t; else textBuf += t; });
    parser.on('cdata', (t) => { if (inDescUa) descUaBuf += t; else cdataBuf += t; });

    parser.on('closetag', (node) => {
      const n = node.name;
      if (inDescUa) {
        if (n === 'description_ua') { offer.desc_ua = descUaBuf.trim(); inDescUa = false; }
        else { descUaBuf += `</${n}>`; }
        textBuf = ''; cdataBuf = ''; return;
      }
      const rawVal = (cdataBuf || textBuf).trim();
      const val = rawVal.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');

      if (n === 'category') {
        if (curCat && curCat.id) { curCat.name = textBuf.trim(); categories.push(curCat); catById[curCat.id] = curCat; }
        curCat = null;
      } else if (inOffer) {
        if (n === 'param') {
          if (curParam && curParam.name && val) offer.params.push({ name: curParam.name, value: val });
          curParam = null;
        }
        else if (n === 'picture') { if (val) offer.pics.push(val); }
        else if (n === 'price') offer.price = val;
        else if (n === 'categoryId') offer.catId = val;
        else if (n === 'name_ua') offer.name_ua = val;
        else if (n === 'vendor') offer.vendor = val;
        else if (n === 'article') offer.article = val;
        else if (n === 'offer') {
          inOffer = false; totalOffers++;
          masterevaFinalize(offer);
          offer = null;
        }
      }
      textBuf = ''; cdataBuf = '';
    });

    function masterevaFinalize(o) {
      const price = Math.round(parseFloat(String(o.price).replace(',', '.')) || 0);
      if (CONFIG.MASTEREVA_MIN_PRICE && price < CONFIG.MASTEREVA_MIN_PRICE) { skipped++; return; }
      if (!o.catId) { skipped++; return; }
      if (o.id && seenIds.has(o.id)) { skipped++; return; }
      if (o.id) seenIds.add(o.id);
      const nameUa = o.name_ua || 'Без назви';
      // Узгоджений формат з товарами ЯВШОКЕ (поля catId/pics/desc_ua) — щоб
      // потім обидва постачальники однаково йшли в writeShardedCatalog().
      const rec = {
        id: o.id,
        available: o.available,
        catId: o.catId,
        price_drop: price,
        name: nameUa,        // RU немає — дублюємо UA, щоб картки/пошук працювали однаково
        name_ua: nameUa,
        vendorCode: o.article || '',
        groupId: '',
        barcode: '',
        pics: (o.pics || []).slice(0, CONFIG.MASTEREVA_MAX_PICS),
        params: o.params || [],
        desc: '',
        desc_ua: '',
        src: masterevaSrc(o.catId),
      };
      // Опис іде в окремий desc-шард, тож тут можемо лишати — пам'ять сайту
      // він не їсть. Обрізаємо для захисту від гігантських HTML.
      if (CONFIG.MASTEREVA_INCLUDE_DESC && o.desc_ua) {
        rec.desc_ua = o.desc_ua.length > CONFIG.MASTEREVA_DESC_MAX
          ? o.desc_ua.slice(0, CONFIG.MASTEREVA_DESC_MAX) + '…'
          : o.desc_ua;
      }
      products.push(rec);
    }

    const stream = fs.createReadStream(ME_TMP_XML, { encoding: 'utf8' });
    stream.on('data', (chunk) => parser.write(chunk));
    stream.on('error', reject);
    stream.on('end', () => { parser.close(); resolve({ categories, catById, products, totalOffers, skipped }); });
  });
}

// Готує категорії Mastereva: проставляє src, лічильники, прибирає порожні.
// Не пише файл — лише повертає дані для writeShardedCatalog().
function masterevaEnrichCategories({ categories, catById, products }) {
  // лічильники по дереву
  const direct = {};
  products.forEach(p => { direct[p.catId] = (direct[p.catId] || 0) + 1; });
  const childrenOf = {};
  categories.forEach(c => { const p = c.parentId || ''; (childrenOf[p] = childrenOf[p] || []).push(c.id); });
  const total = {};
  function agg(id) { let s = direct[id] || 0; (childrenOf[id] || []).forEach(ch => { s += agg(ch); }); total[id] = s; return s; }
  categories.filter(c => !(c.parentId && catById[c.parentId])).forEach(c => agg(c.id));
  categories.forEach(c => { if (total[c.id] == null) total[c.id] = direct[c.id] || 0; });

  // лишаємо лише непорожні
  const keptCats = categories.filter(c => (total[c.id] || 0) > 0).map(c => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId || null,
    count: direct[c.id] || 0,
    total: total[c.id] || 0,
    src: masterevaSrc(c.id),
  }));
  return { keptCats, direct, total };
}

async function runMastereva() {
  if (!CONFIG.MASTEREVA_ENABLED) { console.log('ℹ️ [mastereva] вимкнено в CONFIG'); return null; }
  try {
    await masterevaDownload();
    console.log('⚙️ [mastereva] Парсинг...');
    const parsed = await masterevaParse();
    console.log(`   [mastereva] offers=${parsed.totalOffers}, categories=${parsed.categories.length}, skipped=${parsed.skipped}`);
    const enriched = masterevaEnrichCategories(parsed);
    try { fs.unlinkSync(ME_TMP_XML); } catch {}
    console.log(`   ✅ [mastereva]: ${parsed.products.length} товарів, ${enriched.keptCats.length} категорій`);
    return { products: parsed.products, keptCats: enriched.keptCats };
  } catch (e) {
    // НЕ валимо весь білд — ЯВШОКЕ важливіший
    console.warn('⚠️ [mastereva] пропущено через помилку:', e.message);
    warn('Mastereva: ' + e.message);
    try { fs.unlinkSync(ME_TMP_XML); } catch {}
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// IPOSUD2 — третій постачальник
// ══════════════════════════════════════════════════════════════
const IP_TMP_XML = 'iposud2.xml';

async function iposud2Download() {
  const url = 'https://i-posud.com.ua/assets/export/xml/export_dropshipper_ua.xml';
  console.log('📥 [iposud2] Завантаження XML:', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' при завантаженні Iposud2 XML');
  await pipeline(res.body, fs.createWriteStream(IP_TMP_XML));
  const mb = (fs.statSync(IP_TMP_XML).size / 1048576).toFixed(1);
  console.log(`✅ [iposud2] Завантажено ${mb} МБ`);
}

function iposud2Parse() {
  return new Promise((resolve, reject) => {
    const parser = new SaxesParser();
    const categories = [];
    const products = [];
    let totalOffers = 0, skipped = 0;
    const seenIds = new Set();

    let inOffer = false, offer = null;
    let curCat = null;
    let tag = '', textBuf = '', cdataBuf = '';
    let inDesc = false, descBuf = '', descDepth = 0;

    parser.on('error', reject);

    parser.on('opentag', (node) => {
      const n = node.name;
      if (inDesc) {
        descDepth++;
        descBuf += `<${n}`;
        for (const [k, v] of Object.entries(node.attributes)) descBuf += ` ${k}="${v}"`;
        descBuf += '>';
        tag = ''; textBuf = ''; cdataBuf = '';
        return;
      }
      if (n === 'category') {
        curCat = { id: '', name: '' };
      } else if (n === 'item') {
        inOffer = true;
        offer = { categoryId: '', vendor: '', name: '', description: '', sku: '', url: '', image: '', priceRUAH: '', opt_price_uah: '', stock: '' };
      } else if (inOffer && n === 'description') {
        inDesc = true; descBuf = ''; descDepth = 0;
      }
      tag = n; textBuf = ''; cdataBuf = '';
    });

    parser.on('text', (t) => { if (inDesc) descBuf += t; else textBuf += t; });
    parser.on('cdata', (t) => { if (inDesc) descBuf += t; else cdataBuf += t; });

    parser.on('closetag', (node) => {
      const n = node.name;
      if (inDesc) {
        if (n === 'description') { offer.description = descBuf.trim(); inDesc = false; }
        else { descBuf += `</${n}>`; }
        textBuf = ''; cdataBuf = ''; return;
      }
      const rawVal = (cdataBuf || textBuf).trim();
      const val = rawVal.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');

      if (curCat) {
        if (n === 'id') curCat.id = val;
        else if (n === 'name') curCat.name = val;
        else if (n === 'category') {
          if (curCat.id) { categories.push(curCat); }
          curCat = null;
        }
      } else if (inOffer) {
        if (n === 'categoryId') offer.categoryId = val;
        else if (n === 'vendor') offer.vendor = val;
        else if (n === 'name') offer.name = val;
        else if (n === 'sku') offer.sku = val;
        else if (n === 'url') offer.url = val;
        else if (n === 'image') offer.image = val;
        else if (n === 'priceRUAH') offer.priceRUAH = val;
        else if (n === 'opt_price_uah') offer.opt_price_uah = val;
        else if (n === 'stock') offer.stock = val;
        else if (n === 'item') {
          inOffer = false; totalOffers++;
          iposud2Finalize(offer);
          offer = null;
        }
      }
      textBuf = ''; cdataBuf = '';
    });

    function iposud2Finalize(o) {
      const stockStatus = (o.stock || '').trim();
      if (stockStatus === 'Немає у наявності' || !stockStatus) { skipped++; return; }
      
      const rawId = (o.sku || '').trim();
      if (!rawId) { skipped++; return; }
      
      const uniqueOfferId = '82_' + rawId;
      if (seenIds.has(uniqueOfferId)) { skipped++; return; }
      seenIds.add(uniqueOfferId);

      const price = Math.round(parseFloat(String(o.opt_price_uah).replace(',', '.')) || 0);
      const uniqueCatId = o.categoryId ? '82000' + o.categoryId : '';
      if (!uniqueCatId) { skipped++; return; }

      let descUa = o.description || '';
      if (stockStatus === 'На замовлення') {
        descUa = `<p><strong>📌 Товар під замовлення. Відправка протягом 3-4 робочих днів.</strong></p>\n` + descUa;
      }

      const rec = {
        id: uniqueOfferId,
        available: true,
        catId: uniqueCatId,
        price_drop: price,
        name: o.name || 'Без назви',
        name_ua: o.name || 'Без назви',
        vendorCode: rawId,
        groupId: '',
        barcode: '',
        pics: o.image ? [o.image] : [],
        params: o.vendor ? [{ name: 'Бренд', value: o.vendor.trim() }] : [],
        desc: '',
        desc_ua: descUa,
        src: 'ev_iposud2',
      };
      products.push(rec);
    }

    const stream = fs.createReadStream(IP_TMP_XML, { encoding: 'utf8' });
    stream.on('data', (chunk) => parser.write(chunk));
    stream.on('error', reject);
    stream.on('end', () => { parser.close(); resolve({ categories, products, totalOffers, skipped }); });
  });
}

async function runIposud2() {
  try {
    await iposud2Download();
    console.log('⚙️ [iposud2] Парсинг...');
    const parsed = await iposud2Parse();
    console.log(`   [iposud2] offers=${parsed.totalOffers}, categories=${parsed.categories.length}, skipped=${parsed.skipped}`);
    
    const enrichedCats = parsed.categories.map(c => {
      const count = parsed.products.filter(p => p.catId === '82000' + c.id).length;
      return {
        id: '82000' + c.id,
        name: c.name.trim(),
        parentId: null,
        count: count,
        total: count,
        src: 'ev_iposud2'
      };
    }).filter(c => c.count > 0);

    try { fs.unlinkSync(IP_TMP_XML); } catch {}
    console.log(`   ✅ [iposud2]: ${parsed.products.length} товарів, ${enrichedCats.length} категорій`);
    return { products: parsed.products, keptCats: enrichedCats };
  } catch (e) {
    console.warn('⚠️ [iposud2] пропущено через помилку:', e.message);
    warn('Iposud2: ' + e.message);
    try { fs.unlinkSync(IP_TMP_XML); } catch {}
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// AGER — четвертий постачальник (одяг)
// ══════════════════════════════════════════════════════════════
const AGER_TMP_XML = 'ager_price.xml';

async function agerDownload() {
  const url = 'https://ager.ua/yml_prom?code=multi&param=888';
  console.log('📥 [ager] Завантаження XML:', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' при завантаженні AGER XML');
  await pipeline(res.body, fs.createWriteStream(AGER_TMP_XML));
  const mb = (fs.statSync(AGER_TMP_XML).size / 1048576).toFixed(1);
  console.log(`✅ [ager] Завантажено ${mb} МБ`);
}

function agerParse() {
  return new Promise((resolve, reject) => {
    const parser = new SaxesParser();
    const categories = [];
    const grouped = new Map();
    let totalOffers = 0, skipped = 0;

    let inOffer = false, offer = null;
    let curCat = null;
    let tag = '', textBuf = '', cdataBuf = '';
    let inDesc = false, descBuf = '', descDepth = 0;

    parser.on('error', reject);

    parser.on('opentag', (node) => {
      const n = node.name;
      if (inDesc) {
        descDepth++;
        descBuf += `<${n}`;
        for (const [k, v] of Object.entries(node.attributes)) descBuf += ` ${k}="${v}"`;
        descBuf += '>';
        tag = ''; textBuf = ''; cdataBuf = '';
        return;
      }
      if (n === 'category') {
        const id = node.attributes.id;
        const parentId = node.attributes.parentId;
        curCat = { id, parentId, name: '' };
      } else if (n === 'offer') {
        inOffer = true;
        offer = {
          id: node.attributes.id,
          groupId: node.attributes.group_id,
          available: node.attributes.available === 'true',
          categoryId: '',
          price: '',
          name: '',
          name_ua: '',
          vendorCode: '',
          sku: '',
          pictures: [],
          params: [],
          description: '',
          description_ua: ''
        };
      } else if (inOffer && (n === 'description' || n === 'description_ua')) {
        inDesc = true; descBuf = ''; descDepth = 0;
      } else if (inOffer && n === 'param') {
        offer.curParam = { name: node.attributes.name, value: '' };
      }
      tag = n; textBuf = ''; cdataBuf = '';
    });

    parser.on('text', (t) => { if (inDesc) descBuf += t; else textBuf += t; });
    parser.on('cdata', (t) => { if (inDesc) descBuf += t; else cdataBuf += t; });

    parser.on('closetag', (node) => {
      const n = node.name;
      if (inDesc) {
        if (n === 'description' || n === 'description_ua') {
          if (n === 'description_ua') offer.description_ua = descBuf.trim();
          else offer.description = descBuf.trim();
          inDesc = false;
        } else {
          descBuf += `</${n}>`;
        }
        textBuf = ''; cdataBuf = ''; return;
      }
      const rawVal = (cdataBuf || textBuf).trim();
      const val = rawVal.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');

      if (curCat) {
        if (n === 'category') {
          curCat.name = val;
          if (curCat.id) categories.push(curCat);
          curCat = null;
        }
      } else if (inOffer) {
        if (n === 'categoryId') offer.categoryId = val;
        else if (n === 'price') offer.price = val;
        else if (n === 'name') offer.name = val;
        else if (n === 'name_ua') offer.name_ua = val;
        else if (n === 'vendorCode') offer.vendorCode = val;
        else if (n === 'sku') offer.sku = val;
        else if (n === 'picture') offer.pictures.push(val);
        else if (n === 'param') {
          if (offer.curParam) {
            offer.curParam.value = val;
            offer.params.push(offer.curParam);
            offer.curParam = null;
          }
        } else if (n === 'offer') {
          inOffer = false; totalOffers++;
          agerFinalize(offer);
          offer = null;
        }
      }
      textBuf = ''; cdataBuf = '';
    });

    function agerFinalize(o) {
      if (!o.available) { skipped++; return; }
      
      const groupId = o.groupId || o.id;
      if (!groupId) { skipped++; return; }
      
      const sizeVal = (o.params.find(p => p.name === 'Размер' || p.name === 'Розмір')?.value || '').trim();
      
      const uniqueGroupId = '83_' + groupId;
      const uniqueCatId = o.categoryId ? '83000' + o.categoryId : '';
      if (!uniqueCatId) { skipped++; return; }

      const price = Math.round(parseFloat(o.price) || 0);

      if (!grouped.has(uniqueGroupId)) {
        grouped.set(uniqueGroupId, {
          id: uniqueGroupId,
          available: true,
          catId: uniqueCatId,
          price_drop: price,
          name: o.name_ua || o.name || 'Без назви',
          name_ua: o.name_ua || o.name || 'Без назви',
          vendorCode: o.vendorCode || o.sku || groupId,
          groupId: groupId,
          barcode: '',
          pics: o.pictures.slice(0, 8),
          params: o.params.filter(p => p.name !== 'Размер' && p.name !== 'Розмір'),
          desc: '',
          desc_ua: o.description_ua || o.description || '',
          src: 'ev_ager',
          sizes: new Set()
        });
      }

      const g = grouped.get(uniqueGroupId);
      if (sizeVal) g.sizes.add(sizeVal);
    }

    const stream = fs.createReadStream(AGER_TMP_XML, { encoding: 'utf8' });
    stream.on('data', (chunk) => parser.write(chunk));
    stream.on('error', reject);
    stream.on('end', () => {
      parser.close();
      const products = [];
      for (const [gid, g] of grouped) {
        if (g.sizes.size > 0) {
          const sortedSizes = Array.from(g.sizes).sort();
          g.params.push({ name: 'Розмір', value: sortedSizes.join(', ') });
          products.push(g);
        } else {
          skipped++;
        }
      }
      resolve({ categories, products, totalOffers, skipped });
    });
  });
}

async function runAger() {
  try {
    await agerDownload();
    console.log('⚙️ [ager] Парсинг...');
    const parsed = await agerParse();
    console.log(`   [ager] offers=${parsed.totalOffers}, categories=${parsed.categories.length}, products=${parsed.products.length}, skipped=${parsed.skipped}`);
    
    const enrichedCats = parsed.categories.map(c => {
      const count = parsed.products.filter(p => p.catId === '83000' + c.id).length;
      return {
        id: '83000' + c.id,
        name: c.name.trim(),
        parentId: c.parentId ? '83000' + c.parentId : null,
        count: count,
        total: count,
        src: 'ev_ager'
      };
    }).filter(c => c.count > 0);

    try { fs.unlinkSync(AGER_TMP_XML); } catch {}
    console.log(`   ✅ [ager]: ${parsed.products.length} товарів, ${enrichedCats.length} категорій`);
    return { products: parsed.products, keptCats: enrichedCats };
  } catch (e) {
    console.warn('⚠️ [ager] пропущено через помилку:', e.message);
    warn('AGER: ' + e.message);
    try { fs.unlinkSync(AGER_TMP_XML); } catch {}
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// ISSA Plus — п'ятий постачальник (одяг)
// ══════════════════════════════════════════════════════════════
const ISSA_TMP_XML = 'issa_price.xml';

async function issaDownload() {
  const url = 'https://issaplus.com/load/export_rozetka_ua.xml';
  console.log('📥 [issa] Завантаження XML:', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' при завантаженні ISSA Plus XML');
  await pipeline(res.body, fs.createWriteStream(ISSA_TMP_XML));
  const mb = (fs.statSync(ISSA_TMP_XML).size / 1048576).toFixed(1);
  console.log(`✅ [issa] Завантажено ${mb} МБ`);
}

function issaParse() {
  return new Promise((resolve, reject) => {
    const parser = new SaxesParser();
    const categories = [];
    const grouped = new Map();
    let totalOffers = 0, skipped = 0;

    let inOffer = false, offer = null;
    let curCat = null;
    let tag = '', textBuf = '', cdataBuf = '';
    let inDesc = false, descBuf = '', descDepth = 0;

    parser.on('error', reject);

    parser.on('opentag', (node) => {
      const n = node.name;
      if (inDesc) {
        descDepth++;
        descBuf += `<${n}`;
        for (const [k, v] of Object.entries(node.attributes)) descBuf += ` ${k}="${v}"`;
        descBuf += '>';
        tag = ''; textBuf = ''; cdataBuf = '';
        return;
      }
      if (n === 'category') {
        const id = node.attributes.id;
        const parentId = node.attributes.parentId;
        curCat = { id, parentId, name: '' };
      } else if (n === 'offer') {
        inOffer = true;
        offer = {
          id: node.attributes.id,
          groupId: node.attributes.group_id,
          available: node.attributes.available === 'true',
          categoryId: '',
          price: '',
          name: '',
          name_ua: '',
          vendorCode: '',
          vendor: '',
          pictures: [],
          params: [],
          description: '',
          description_ua: ''
        };
      } else if (inOffer && (n === 'description' || n === 'description_ua')) {
        inDesc = true; descBuf = ''; descDepth = 0;
      } else if (inOffer && n === 'param') {
        offer.curParam = { name: node.attributes.name, value: '' };
      }
      tag = n; textBuf = ''; cdataBuf = '';
    });

    parser.on('text', (t) => { if (inDesc) descBuf += t; else textBuf += t; });
    parser.on('cdata', (t) => { if (inDesc) descBuf += t; else cdataBuf += t; });

    parser.on('closetag', (node) => {
      const n = node.name;
      if (inDesc) {
        if (n === 'description' || n === 'description_ua') {
          if (n === 'description_ua') offer.description_ua = descBuf.trim();
          else offer.description = descBuf.trim();
          inDesc = false;
        } else {
          descBuf += `</${n}>`;
        }
        textBuf = ''; cdataBuf = ''; return;
      }
      const rawVal = (cdataBuf || textBuf).trim();
      const val = rawVal.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');

      if (curCat) {
        if (n === 'category') {
          curCat.name = val;
          if (curCat.id) categories.push(curCat);
          curCat = null;
        }
      } else if (inOffer) {
        if (n === 'categoryId') offer.categoryId = val;
        else if (n === 'price') offer.price = val;
        else if (n === 'name') offer.name = val;
        else if (n === 'name_ua') offer.name_ua = val;
        else if (n === 'vendorCode') offer.vendorCode = val;
        else if (n === 'vendor') offer.vendor = val;
        else if (n === 'picture') offer.pictures.push(val);
        else if (n === 'param') {
          if (offer.curParam) {
            offer.curParam.value = val;
            offer.params.push(offer.curParam);
            offer.curParam = null;
          }
        } else if (n === 'offer') {
          inOffer = false; totalOffers++;
          issaFinalize(offer);
          offer = null;
        }
      }
      textBuf = ''; cdataBuf = '';
    });

    function issaFinalize(o) {
      if (!o.available) { skipped++; return; }
      
      const groupId = o.groupId || o.id;
      if (!groupId) { skipped++; return; }
      
      const sizeVal = (o.params.find(p => p.name === 'Размер' || p.name === 'Розмір')?.value || '').trim();
      
      const uniqueGroupId = '84_' + groupId;
      const uniqueCatId = o.categoryId ? '84000' + o.categoryId : '';
      if (!uniqueCatId) { skipped++; return; }

      const price = Math.round(parseFloat(o.price) || 0);

      let baseName = o.name_ua || o.name || 'Без назви';
      if (sizeVal) {
        baseName = baseName.replace(new RegExp(`\\s+${sizeVal}\\b`, 'g'), '').replace(/\s+/g, ' ').trim();
      }

      if (!grouped.has(uniqueGroupId)) {
        const productParams = o.params.filter(p => p.name !== 'Размер' && p.name !== 'Розмір');
        const brand = o.vendor ? o.vendor.trim() : 'ISSA PLUS';
        productParams.push({ name: 'Бренд', value: brand });

        grouped.set(uniqueGroupId, {
          id: uniqueGroupId,
          available: true,
          catId: uniqueCatId,
          price_drop: price,
          name: baseName,
          name_ua: baseName,
          vendorCode: o.vendorCode || groupId,
          groupId: groupId,
          barcode: '',
          pics: o.pictures.slice(0, 8),
          params: productParams,
          desc: '',
          desc_ua: o.description_ua || o.description || '',
          src: 'ev_issa',
          sizes: new Set()
        });
      }

      const g = grouped.get(uniqueGroupId);
      if (sizeVal) g.sizes.add(sizeVal);
    }

    const stream = fs.createReadStream(ISSA_TMP_XML, { encoding: 'utf8' });
    stream.on('data', (chunk) => parser.write(chunk));
    stream.on('error', reject);
    stream.on('end', () => {
      parser.close();
      const products = [];
      for (const [gid, g] of grouped) {
        if (g.sizes.size > 0) {
          const sortedSizes = Array.from(g.sizes).sort();
          g.params.push({ name: 'Розмір', value: sortedSizes.join(', ') });
          products.push(g);
        } else {
          skipped++;
        }
      }
      resolve({ categories, products, totalOffers, skipped });
    });
  });
}

async function runIssa() {
  try {
    await issaDownload();
    console.log('⚙️ [issa] Парсинг...');
    const parsed = await issaParse();
    console.log(`   [issa] offers=${parsed.totalOffers}, categories=${parsed.categories.length}, products=${parsed.products.length}, skipped=${parsed.skipped}`);
    
    const enrichedCats = parsed.categories.map(c => {
      const count = parsed.products.filter(p => p.catId === '84000' + c.id).length;
      return {
        id: '84000' + c.id,
        name: c.name.trim(),
        parentId: c.parentId ? '84000' + c.parentId : null,
        count: count,
        total: count,
        src: 'ev_issa'
      };
    }).filter(c => c.count > 0);

    try { fs.unlinkSync(ISSA_TMP_XML); } catch {}
    console.log(`   ✅ [issa]: ${parsed.products.length} товарів, ${enrichedCats.length} категорій`);
    return { products: parsed.products, keptCats: enrichedCats };
  } catch (e) {
    console.warn('⚠️ [issa] пропущено через помилку:', e.message);
    warn('ISSA Plus: ' + e.message);
    try { fs.unlinkSync(ISSA_TMP_XML); } catch {}
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// Draap — шостий постачальник (одяг)
// ══════════════════════════════════════════════════════════════
const DRAAP_TMP_XML = 'draap_price.xml';

async function draapDownload() {
  const url = 'https://gv-top.shop/export/prom/';
  console.log('📥 [draap] Завантаження XML:', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' при завантаженні Draap XML');
  await pipeline(res.body, fs.createWriteStream(DRAAP_TMP_XML));
  const mb = (fs.statSync(DRAAP_TMP_XML).size / 1048576).toFixed(1);
  console.log(`✅ [draap] Завантажено ${mb} МБ`);
}

function draapParse() {
  return new Promise((resolve, reject) => {
    const parser = new SaxesParser();
    const categories = [];
    const grouped = new Map();
    let totalOffers = 0, skipped = 0;

    let inOffer = false, offer = null;
    let curCat = null;
    let tag = '', textBuf = '', cdataBuf = '';
    let inDesc = false, descBuf = '', descDepth = 0;

    parser.on('error', reject);

    parser.on('opentag', (node) => {
      const n = node.name;
      if (inDesc) {
        descDepth++;
        descBuf += `<${n}`;
        for (const [k, v] of Object.entries(node.attributes)) descBuf += ` ${k}="${v}"`;
        descBuf += '>';
        tag = ''; textBuf = ''; cdataBuf = '';
        return;
      }
      if (n === 'category') {
        const id = node.attributes.id;
        const parentId = node.attributes.parentId;
        curCat = { id, parentId, name: '' };
      } else if (n === 'offer') {
        inOffer = true;
        offer = {
          id: node.attributes.id,
          groupId: node.attributes.group_id,
          available: node.attributes.available === 'true',
          categoryId: '',
          price: '',
          name: '',
          name_ua: '',
          vendorCode: '',
          article: '',
          vendor: '',
          pictures: [],
          params: [],
          description: '',
          description_ua: '',
          availableTagVal: ''
        };
      } else if (inOffer && (n === 'description' || n === 'description_ua')) {
        inDesc = true; descBuf = ''; descDepth = 0;
      } else if (inOffer && n === 'param') {
        offer.curParam = { name: node.attributes.name, value: '' };
      }
      tag = n; textBuf = ''; cdataBuf = '';
    });

    parser.on('text', (t) => { if (inDesc) descBuf += t; else textBuf += t; });
    parser.on('cdata', (t) => { if (inDesc) descBuf += t; else cdataBuf += t; });

    parser.on('closetag', (node) => {
      const n = node.name;
      if (inDesc) {
        if (n === 'description' || n === 'description_ua') {
          if (n === 'description_ua') offer.description_ua = descBuf.trim();
          else offer.description = descBuf.trim();
          inDesc = false;
        } else {
          descBuf += `</${n}>`;
        }
        textBuf = ''; cdataBuf = ''; return;
      }
      const rawVal = (cdataBuf || textBuf).trim();
      const val = rawVal.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');

      if (curCat) {
        if (n === 'category') {
          curCat.name = val;
          if (curCat.id) categories.push(curCat);
          curCat = null;
        }
      } else if (inOffer) {
        if (n === 'categoryId') offer.categoryId = val;
        else if (n === 'price') offer.price = val;
        else if (n === 'name') offer.name = val;
        else if (n === 'name_ua') offer.name_ua = val;
        else if (n === 'vendorCode') offer.vendorCode = val;
        else if (n === 'article') offer.article = val;
        else if (n === 'vendor') offer.vendor = val;
        else if (n === 'available') offer.availableTagVal = val;
        else if (n === 'picture') offer.pictures.push(val);
        else if (n === 'param') {
          if (offer.curParam) {
            offer.curParam.value = val;
            offer.params.push(offer.curParam);
            offer.curParam = null;
          }
        } else if (n === 'offer') {
          inOffer = false; totalOffers++;
          draapFinalize(offer);
          offer = null;
        }
      }
      textBuf = ''; cdataBuf = '';
    });

    function draapFinalize(o) {
      const isAvailable = o.available || o.availableTagVal === 'true';
      if (!isAvailable) { skipped++; return; }
      
      const groupId = o.groupId || o.id;
      if (!groupId) { skipped++; return; }
      
      const sizeVal = (o.params.find(p => p.name === 'Размер' || p.name === 'Розмір')?.value || '').trim();
      
      const uniqueGroupId = '85_' + groupId;
      const uniqueCatId = o.categoryId ? '85000' + o.categoryId : '';
      if (!uniqueCatId) { skipped++; return; }

      const price = Math.round(parseFloat(o.price) || 0);

      if (!grouped.has(uniqueGroupId)) {
        const productParams = o.params.filter(p => p.name !== 'Размер' && p.name !== 'Розмір');
        const brand = o.vendor ? o.vendor.trim() : 'Draap';
        productParams.push({ name: 'Бренд', value: brand });

        grouped.set(uniqueGroupId, {
          id: uniqueGroupId,
          available: true,
          catId: uniqueCatId,
          price_drop: price,
          name: o.name_ua || o.name || 'Без назви',
          name_ua: o.name_ua || o.name || 'Без назви',
          vendorCode: o.vendorCode || o.article || groupId,
          groupId: groupId,
          barcode: '',
          pics: o.pictures.slice(0, 8),
          params: productParams,
          desc: '',
          desc_ua: o.description_ua || o.description || '',
          src: 'ev_draap',
          sizes: new Set()
        });
      }

      const g = grouped.get(uniqueGroupId);
      if (sizeVal) g.sizes.add(sizeVal);
    }

    const stream = fs.createReadStream(DRAAP_TMP_XML, { encoding: 'utf8' });
    stream.on('data', (chunk) => parser.write(chunk));
    stream.on('error', reject);
    stream.on('end', () => {
      parser.close();
      const products = [];
      for (const [gid, g] of grouped) {
        if (g.sizes.size > 0) {
          const sortedSizes = Array.from(g.sizes).sort();
          g.params.push({ name: 'Розмір', value: sortedSizes.join(', ') });
          products.push(g);
        } else {
          skipped++;
        }
      }
      resolve({ categories, products, totalOffers, skipped });
    });
  });
}

async function runDraap() {
  try {
    await draapDownload();
    console.log('⚙️ [draap] Парсинг...');
    const parsed = await draapParse();
    console.log(`   [draap] offers=${parsed.totalOffers}, categories=${parsed.categories.length}, products=${parsed.products.length}, skipped=${parsed.skipped}`);
    
    const enrichedCats = parsed.categories.map(c => {
      const count = parsed.products.filter(p => p.catId === '85000' + c.id).length;
      return {
        id: '85000' + c.id,
        name: c.name.trim(),
        parentId: c.parentId ? '85000' + c.parentId : null,
        count: count,
        total: count,
        src: 'ev_draap'
      };
    }).filter(c => c.count > 0);

    try { fs.unlinkSync(DRAAP_TMP_XML); } catch {}
    console.log(`   ✅ [draap]: ${parsed.products.length} товарів, ${enrichedCats.length} категорій`);
    return { products: parsed.products, keptCats: enrichedCats };
  } catch (e) {
    console.warn('⚠️ [draap] пропущено через помилку:', e.message);
    warn('Draap: ' + e.message);
    try { fs.unlinkSync(DRAAP_TMP_XML); } catch {}
    return null;
  }
}

// ──────────── main ────────────
(async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  await download();
  console.log('⚙️ Парсинг...');
  const parsed = await parse();
  console.log(`   offers=${parsed.totalOffers}, categories=${parsed.categories.length}`);
  console.log('🔪 Фільтри + нарізка...');
  const built = build(parsed);

  // Експорт ЯВШОКЕ-XML для Prom (автопрайси) — НЕ ЗАЧІПАЄМО.
  // Працює з оригінальною offersByCat, не залежить від шардингу/Mastereva.
  console.log('📦 Генерація автопрайсів...');
  const exportsMade = buildExports(built);
  writeSummary(built.meta, exportsMade);
  try { fs.unlinkSync(TMP_XML); } catch {}

  // ── Mastereva ──
  console.log('🧩 Обробка Mastereva...');
  const me = await runMastereva();

  // Presets exports
  console.log('📦 Генерація автопрайсів Mastereva...');
  const meExportsMade = buildMasterevaExports(me);
  if (meExportsMade.length) console.log(`   ✅ Mastereva-експортів: ${meExportsMade.length}`);

  // ── Iposud2 ──
  console.log('🧩 Обробка Iposud2...');
  const ip2 = await runIposud2();

  // ── AGER ──
  console.log('🧩 Обробка AGER...');
  const ager = await runAger();

  // ── ISSA Plus ──
  console.log('🧩 Обробка ISSA Plus...');
  const issa = await runIssa();

  // ── Draap ──
  console.log('🧩 Обробка Draap...');
  const draap = await runDraap();

  // ── Користувацькі фіди ──
  console.log('📦 Генерація користувацьких автопрайсів...');
  try {
    const userFeeds = await buildUserCustomExports();
    if (userFeeds.length) console.log(`   ✅ Створено користувацьких фідів: ${userFeeds.length}`);
  } catch (err) {
    console.error('⚠️ Помилка генерації користувацьких фідів:', err.message);
  }

  // ── ШАРДИНГ: об'єднуємо всі джерела й пишемо для сайту ──
  console.log('🧩 Збираємо шарди (ЯВШОКЕ + Mastereva + Iposud2 + AGER + ISSA Plus + Draap)...');
  const yavProducts = collectYavshokeProducts(built.offersByCat);
  const yavCats = built.keptCats.map(c => ({ ...c, src: 'yavshoke' }));
  
  const allProducts = yavProducts
    .concat(me ? me.products : [])
    .concat(ip2 ? ip2.products : [])
    .concat(ager ? ager.products : [])
    .concat(issa ? issa.products : [])
    .concat(draap ? draap.products : []);
    
  const allCats = yavCats
    .concat(me ? me.keptCats : [])
    .concat(ip2 ? ip2.keptCats : [])
    .concat(ager ? ager.keptCats : [])
    .concat(issa ? issa.keptCats : [])
    .concat(draap ? draap.keptCats : []);

  const directCount = { ...built.directCount };
  const totalCount = { ...built.totalCount };
  if (me) {
    me.keptCats.forEach(c => { directCount[c.id] = c.count; totalCount[c.id] = c.total; });
  }
  if (ip2) {
    ip2.keptCats.forEach(c => { directCount[c.id] = c.count; totalCount[c.id] = c.total; });
  }
  if (ager) {
    ager.keptCats.forEach(c => { directCount[c.id] = c.count; totalCount[c.id] = c.total; });
  }
  if (issa) {
    issa.keptCats.forEach(c => { directCount[c.id] = c.count; totalCount[c.id] = c.total; });
  }
  if (draap) {
    draap.keptCats.forEach(c => { directCount[c.id] = c.count; totalCount[c.id] = c.total; });
  }

  const shardMeta = {
    ...built.meta,
    sources: { 
      yavshoke: yavProducts.length, 
      mastereva: me ? me.products.length : 0,
      iposud2: ip2 ? ip2.products.length : 0,
      ager: ager ? ager.products.length : 0,
      issa: issa ? issa.products.length : 0,
      draap: draap ? draap.products.length : 0
    },
    totalProducts: allProducts.length,
  };

  writeShardedCatalog({
    meta: shardMeta,
    keptCats: allCats,
    directCount, totalCount,
    products: allProducts,
  });
  console.log(`🎉 Готово. Загалом ${allProducts.length} товарів у каталозі.`);
})().catch(e => { console.error('💥', e); process.exit(1); });
