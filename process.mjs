// ═══════════════════════════════════════════════════════════════
// Ypricea — головний оркестратор каталогу товарів
// Завантажує XML ЯВШОКЕ, парсить, поєднує з іншими постачальниками,
// будує легкий індекс пошуку, нарізає на шарди для сайту.
// ═══════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { SaxesParser } from 'saxes';
import iconv from 'iconv-lite';

// Модульні імпорти конфігурації та утиліт
import { CONFIG, DATA_DIR, FULL_DIR, TMP_XML } from './config.mjs';
import {
  warnings, warn, safeFetch, escX, cdX, deEsc,
  getOfferBrand, ancestorsOf
} from './utils.mjs';
import { buildUserCustomExports, buildPromXml } from './customExports.mjs';

// Імпорти постачальників
import { runMastereva } from './suppliers/mastereva.mjs';
import { runIposud2 } from './suppliers/iposud2.mjs';
import { runAger } from './suppliers/ager.mjs';
import { runIssa } from './suppliers/issa.mjs';
import { runDraap } from './suppliers/draap.mjs';

// Функція запису логу синхронізації в Supabase
async function saveSyncLog(supplierName, status, importedCount, message = '') {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return;
  try {
    const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/sync_logs`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        supplier_name: supplierName,
        user_email: 'системний крон',
        status: status,
        imported_count: importedCount,
        message: message
      })
    });
  } catch (e) {
    console.warn('⚠️ Не вдалося записати лог синхронізації в Supabase:', e.message);
  }
}

// ──────────── 1. Завантаження XML ЯВШОКЕ ────────────
async function download(retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`📥 Завантаження XML (спроба ${i}/${retries}):`, CONFIG.XML_URL);
      const res = await safeFetch(CONFIG.XML_URL, { headers: { 'Accept-Encoding': 'gzip, deflate, br' } });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' при завантаженні XML');
      await pipeline(res.body, fs.createWriteStream(TMP_XML));
      const mb = (fs.statSync(TMP_XML).size / 1048576).toFixed(1);
      console.log(`✅ Завантажено ${mb} МБ`);
      return;
    } catch (e) {
      console.log(`   ⚠️ Помилка завантаження (спроба ${i}): ${e.message}. Повтор за 5с...`);
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// ──────────── 2. Потоковий парс ЯВШОКЕ ────────────
function parse() {
  return new Promise((resolve, reject) => {
    const parser = new SaxesParser();
    const categories = []; // {id,name,parentId}
    const catById = {};
    const parsedOffers = new Map(); // id -> offer record
    let totalOffers = 0, removedByPrice = 0;

    let inOffer = false, offer = null;
    let tag = '', textBuf = '', cdataBuf = '';
    let curCat = null;
    let curParam = null;
    let inDesc = false;
    let inDescUa = false;
    let descBuf = '';
    let descUaBuf = '';
    let descDepth = 0;

    parser.on('error', reject);

    parser.on('opentag', (node) => {
      const n = node.name;
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
      } else if (inOffer && (n === 'param' || n === 'property' || n === 'attribute' || n === 'characteristic')) {
        curParam = { name: node.attributes.name || '', value: '', tagName: n };
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
      const val = rawVal.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&nbsp;/g,' ');

      if (n === 'category') {
        if (curCat && curCat.id) { curCat.name = textBuf.trim(); categories.push(curCat); catById[curCat.id] = curCat; }
        curCat = null;
      } else if (inOffer) {
        if (n === 'param' || n === 'property' || n === 'attribute' || n === 'characteristic') {
          if (curParam && curParam.tagName === n && curParam.name) {
            curParam.value = val;
            if (curParam.value) {
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
      const dropSrc = (o.drop !== '' && o.drop != null) ? o.drop : o.price;
      const drop = Math.round(parseFloat(String(dropSrc).replace(',', '.')) || 0);
      if (!drop || drop <= 0) { warn(`offer ${o.id}: немає ціни (<price>)`); }
      if (drop < CONFIG.MIN_DROP) { removedByPrice++; return; }
      if (!o.catId) { warn(`offer ${o.id}: немає categoryId — пропущено`); return; }
      
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
      if (o.id) {
        if (parsedOffers.has(o.id)) {
          warn(`offer ${o.id}: дубликат ID — перезаписано новішою версією`);
        }
        parsedOffers.set(o.id, rec);
      }
    }

    let encoding = 'utf8';
    try {
      const fd = fs.openSync(TMP_XML, 'r');
      const buffer = Buffer.alloc(2048);
      const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
      fs.closeSync(fd);
      const sample = buffer.toString('ascii', 0, bytesRead);
      if (/encoding=["'](windows-1251|cp1251)["']/i.test(sample)) {
        encoding = 'win1251';
        console.log("ℹ️ Виявлено кодування Windows-1251, виконується декодування...");
      }
    } catch (e) {
      console.warn("⚠️ Помилка автовизначення кодування:", e.message);
    }

    const stream = encoding === 'win1251'
      ? fs.createReadStream(TMP_XML).pipe(iconv.decodeStream('win1251'))
      : fs.createReadStream(TMP_XML, { encoding: 'utf8' });

    stream.on('data', (chunk) => {
      const cleanChunk = chunk.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      parser.write(cleanChunk);
    });
    stream.on('error', reject);
    stream.on('end', () => {
      parser.close();

      const groupDescriptions = new Map();
      for (const rec of parsedOffers.values()) {
        if (rec.groupId) {
          const stored = groupDescriptions.get(rec.groupId) || { desc: '', desc_ua: '' };
          if (rec.desc && !stored.desc) stored.desc = rec.desc;
          if (rec.desc_ua && !stored.desc_ua) stored.desc_ua = rec.desc_ua;
          groupDescriptions.set(rec.groupId, stored);
        }
      }
      for (const rec of parsedOffers.values()) {
        if (rec.groupId) {
          const stored = groupDescriptions.get(rec.groupId);
          if (stored) {
            if (!rec.desc && stored.desc) rec.desc = stored.desc;
            if (!rec.desc_ua && stored.desc_ua) rec.desc_ua = stored.desc_ua;
          }
        }
      }

      const offersByCat = new Map();
      for (const rec of parsedOffers.values()) {
        if (!offersByCat.has(rec.cat)) offersByCat.set(rec.cat, []);
        offersByCat.get(rec.cat).push(rec);
      }

      resolve({ categories, catById, offersByCat, totalOffers, removedByPrice });
    });
  });
}

// ──────────── 2.5 Повний JSON (один файл) + фільтри ────────────
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

function build({ categories, catById, offersByCat, totalOffers, removedByPrice }) {
  let noDesc = 0;
  for (const [, offers] of offersByCat) for (const o of offers) if (!o.desc && !o.desc_ua) noDesc++;
  if (noDesc) console.log(`   ℹ️ Товарів без опису (джерело не містить): ${noDesc}`);
  
  const childrenOf = {};
  categories.forEach(c => { const p = c.parentId || ''; (childrenOf[p] = childrenOf[p] || []).push(c.id); });
  const isLeaf = (id) => !(childrenOf[id] && childrenOf[id].length);

  let removedSmallCats = 0, removedSmallOffers = 0;
  for (const [catId, offers] of offersByCat) {
    if (isLeaf(catId) && offers.length < CONFIG.MIN_CAT_PRODUCTS) {
      removedSmallOffers += offers.length; removedSmallCats++;
      offersByCat.delete(catId);
    }
  }

  const directCount = {}; let kept = 0;
  for (const [catId, offers] of offersByCat) { directCount[catId] = offers.length; kept += offers.length; }
  const totalCount = {};
  function aggregate(id) {
    let sum = directCount[id] || 0;
    (childrenOf[id] || []).forEach(ch => { sum += aggregate(ch); });
    totalCount[id] = sum; return sum;
  }
  categories.filter(c => !(c.parentId && catById[c.parentId])).forEach(c => aggregate(c.id));
  categories.forEach(c => { if (totalCount[c.id] == null) totalCount[c.id] = directCount[c.id] || 0; });

  let removedEmptyCats = 0;
  const keptCats = categories.filter(c => {
    if ((totalCount[c.id] || 0) > 0) return true;
    removedEmptyCats++; return false;
  });

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const meta = {
    updated: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
    imgPrefix: CONFIG.IMG_PREFIX,
    totalOffers, kept, removedByPrice, removedSmallCats, removedSmallOffers,
    removedEmptyCats, categories: keptCats.length, warnings: warnings.length,
  };

  fs.writeFileSync(path.join(DATA_DIR, 'report.json'), JSON.stringify({ meta, warnings }, null, 2));

  return { meta, offersByCat, catById, childrenOf, keptCats, directCount, totalCount };
}

// ──────────── 3. Статичні експорти з пресетів (ЯВШОКЕ) ────────────
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
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'exports.json'), JSON.stringify({ updated: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC', exports: made }));
  } catch (e) { /* ignore */ }
  return made;
}

// ──────────── 3.5 Автопрайси MASTEREVA ────────────
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

  const catById = {};
  me.keptCats.forEach(c => { catById[c.id] = { id: c.id, name: c.name, parentId: c.parentId || null }; });
  const childrenOf = {};
  me.keptCats.forEach(c => { const p = c.parentId || ''; (childrenOf[p] = childrenOf[p] || []).push(c.id); });

  const byCat = new Map();
  me.products.forEach(p => { if (!byCat.has(p.catId)) byCat.set(p.catId, []); byCat.get(p.catId).push(p); });

  fs.mkdirSync(path.join(CONFIG.OUT_DIR, 'exports'), { recursive: true });
  const made = [];
  for (const f of files) {
    let preset;
    try { preset = JSON.parse(fs.readFileSync(path.join(presetDir, f), 'utf8')); }
    catch (e) { warn(`Пресет ${f}: помилка JSON`); continue; }
    let name = String(preset.name || f.replace(/\.json$/i, '')).replace(/[^a-zA-Z0-9_-]/g, '') || 'export';
    if (!/^me-/i.test(name)) name = 'me-' + name;
    const pct = +preset.pct || 0, grn = +preset.grn || 0, min = +preset.min || 0, avail = !!preset.avail;

    const sel = new Set();
    (function () { const stack = (preset.cats || []).map(String); while (stack.length) { const id = stack.pop(); if (sel.has(id)) continue; sel.add(id); (childrenOf[id] || []).forEach(ch => stack.push(ch)); } })();

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
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'exports-me.json'), JSON.stringify({ updated: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC', exports: made }));
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

// ──────────── 5. Пише шардований каталог для сайту ────────────
function writeShardedCatalog({ meta, keptCats, directCount, totalCount, products }) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const shardsDir = path.join(DATA_DIR, CONFIG.SHARDS_DIR);
  const descDir = path.join(DATA_DIR, CONFIG.DESC_DIR);
  for (const dir of [shardsDir, descDir]) {
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    fs.mkdirSync(dir, { recursive: true });
  }

  const categories = keptCats.map(c => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId || null,
    count: directCount[c.id] || 0,
    total: totalCount[c.id] || 0,
    src: c.src || 'yavshoke',
  }));
  fs.writeFileSync(path.join(DATA_DIR, 'categories.json'), JSON.stringify({ meta, categories }));

  products.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const indexProducts = [];
  const productLocation = {};
  const SHARD = CONFIG.SHARD_SIZE;
  const totalShards = Math.ceil(products.length / SHARD);
  let shardBytes = 0, descBytes = 0;

  for (let s = 0; s < totalShards; s++) {
    const slice = products.slice(s * SHARD, (s + 1) * SHARD);
    const shardName = 'p-' + String(s + 1).padStart(4, '0');
    const descName = 'd-' + String(s + 1).padStart(4, '0');

    const fullArr = [];
    const descArr = [];

    for (const p of slice) {
      const lite = {
        id: p.id,
        a: p.available ? 1 : 0,
        c: p.catId,
        pr: p.price_drop,
        n: p.name_ua || p.name || '',
        s: p.src,
      };
      const brandParam = p.params && p.params.find(pm => pm.name === 'Бренд' || pm.name === 'Бренд:' || pm.name === 'Производитель' || pm.name === 'Виробник');
      if (brandParam && brandParam.value) {
        lite.b = brandParam.value.trim();
      }
      if (p.vendorCode) lite.v = p.vendorCode;
      if (p.name && p.name !== lite.n) lite.nr = p.name;
      if (p.pics && p.pics[0]) lite.i = p.pics[0];
      indexProducts.push(lite);

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

      const hasDesc = !!(p.desc || p.desc_ua);
      if (hasDesc) {
        const d = { id: p.id };
        if (p.desc) d.description = p.desc;
        if (p.desc_ua) d.description_ua = p.desc_ua;
        descArr.push(d);
      }

      productLocation[p.id] = s + 1;
    }

    const shardJson = JSON.stringify(fullArr);
    const shardGz = zlib.gzipSync(shardJson, { level: 9 });
    fs.writeFileSync(path.join(shardsDir, shardName + '.json.gz'), shardGz);
    shardBytes += shardGz.length;

    if (descArr.length) {
      const descJson = JSON.stringify(descArr);
      const descGz = zlib.gzipSync(descJson, { level: 9 });
      fs.writeFileSync(path.join(descDir, descName + '.json.gz'), descGz);
      descBytes += descGz.length;
    }
  }

  const index = {
    meta: { ...meta, shardSize: SHARD, totalShards, shards: CONFIG.SHARDS_DIR, descs: CONFIG.DESC_DIR },
    imgPrefix: CONFIG.IMG_PREFIX,
    products: indexProducts,
  };
  const indexJson = JSON.stringify(index);
  fs.writeFileSync(path.join(DATA_DIR, 'index.json'), indexJson);
  const indexGz = zlib.gzipSync(indexJson, { level: 9 });
  fs.writeFileSync(path.join(DATA_DIR, 'index.json.gz'), indexGz);

  fs.writeFileSync(path.join(DATA_DIR, 'shard-map.json'), JSON.stringify(productLocation));

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

// ──────────── main ────────────
(async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  await download();
  console.log('⚙️ Парсинг...');
  const parsed = await parse();
  console.log(`   offers=${parsed.totalOffers}, categories=${parsed.categories.length}`);
  console.log('🔪 Фільтри + нарізка...');
  const built = build(parsed);

  console.log('📦 Генерація автопрайсів...');
  const exportsMade = buildExports(built);
  writeSummary(built.meta, exportsMade);
  try { fs.unlinkSync(TMP_XML); } catch {}

  console.log('🧩 Обробка Mastereva...');
  const me = await runMastereva();

  console.log('📦 Генерація автопрайсів Mastereva...');
  const meExportsMade = buildMasterevaExports(me);
  if (meExportsMade.length) console.log(`   ✅ Mastereva-експортів: ${meExportsMade.length}`);

  console.log('🧩 Обробка Iposud2...');
  const ip2 = await runIposud2();

  console.log('🧩 Обробка AGER...');
  const ager = await runAger();

  console.log('🧩 Обробка ISSA Plus...');
  const issa = await runIssa();

  console.log('🧩 Обробка Draap...');
  const draap = await runDraap();

  console.log('📦 Генерація користувацьких автопрайсів...');
  try {
    const userFeeds = await buildUserCustomExports();
    if (userFeeds.length) console.log(`   ✅ Створено користувацьких фідів: ${userFeeds.length}`);
  } catch (err) {
    console.error('⚠️ Помилка генерації користувацьких фідів:', err.message);
  }

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

  // Записуємо успішні сесії синхронізації в Supabase
  await saveSyncLog('ЯВШОКЕ', 'success', yavProducts.length);
  if (me) await saveSyncLog('Mastereva', 'success', me.products.length);
  if (ip2) await saveSyncLog('Iposud2', 'success', ip2.products.length);
  if (ager) await saveSyncLog('AGER', 'success', ager.products.length);
  if (issa) await saveSyncLog('ISSA Plus', 'success', issa.products.length);
  if (draap) await saveSyncLog('Draap', 'success', draap.products.length);

})().catch(async (e) => { 
  console.error('💥', e); 
  await saveSyncLog('Системний імпорт', 'failed', 0, e.message);
  process.exit(1); 
});
