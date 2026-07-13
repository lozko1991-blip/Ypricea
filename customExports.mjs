import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { SaxesParser } from 'saxes';
import { CONFIG, DATA_DIR } from './config.mjs';
import {
  escX, cdX, deEsc, withBrandSrv, getOfferBrand,
  fillDefaultParamsSrv, safeFetch, warn, ancestorsOf
} from './utils.mjs';

class SupabaseTranslator {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.localCache = new Map();
    this.hasSupabase = !!(this.supabaseUrl && this.supabaseKey);
    this.tableOk = true;
    this.stats = { cache: 0, api: 0, errors: 0 };
    
    // Load local cache file if exists
    this.cacheFilePath = path.join('presets', 'translation-cache.json');
    if (fs.existsSync(this.cacheFilePath)) {
      try {
        const fileContent = fs.readFileSync(this.cacheFilePath, 'utf8');
        const parsed = JSON.parse(fileContent);
        for (const [k, v] of Object.entries(parsed)) {
          this.localCache.set(k, v);
        }
      } catch (e) {
        // ignore
      }
    }
  }

  getHash(text) {
    return crypto.createHash('md5').update(String(text || '')).digest('hex');
  }

  saveLocalCache() {
    try {
      const obj = {};
      for (const [k, v] of this.localCache.entries()) {
        obj[k] = v;
      }
      fs.mkdirSync(path.dirname(this.cacheFilePath), { recursive: true });
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {
      // ignore
    }
  }

  async translate(text, from = 'ru', to = 'uk') {
    if (!text || !text.trim()) return '';
    const cleanText = text.trim();
    const hash = this.getHash(cleanText);

    // 1. Check local memory/file cache
    if (this.localCache.has(hash)) {
      this.stats.cache++;
      return this.localCache.get(hash);
    }

    // 2. Check Supabase DB
    if (this.hasSupabase && this.tableOk) {
      try {
        const url = `${this.supabaseUrl.replace(/\/$/, '')}/rest/v1/translation_cache?hash=eq.${hash}&select=uk_text`;
        const res = await fetch(url, {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0 && data[0].uk_text) {
            const ukText = data[0].uk_text;
            this.localCache.set(hash, ukText);
            this.stats.cache++;
            return ukText;
          }
        } else if (res.status === 404) {
          this.tableOk = false;
          console.warn('⚠️ Таблиця translation_cache не знайдена в Supabase. Використовуємо локальний режим.');
        }
      } catch (err) {
        console.warn('⚠️ Помилка звернення до Supabase для перекладу:', err.message);
      }
    }

    // 3. Call Google Translate API
    let ukText = '';
    try {
      // Small delay to prevent HTTP 429
      await new Promise(r => setTimeout(r, 200));
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(cleanText)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
      const data = await res.json();
      ukText = data[0].map(x => x[0]).join('');
      this.stats.api++;
    } catch (err) {
      console.warn(`⚠️ Помилка автоматичного перекладу для "${cleanText.slice(0, 30)}...":`, err.message);
      this.stats.errors++;
      return text;
    }

    if (ukText) {
      this.localCache.set(hash, ukText);
      
      // Save to Supabase
      if (this.hasSupabase && this.tableOk) {
        try {
          const url = `${this.supabaseUrl.replace(/\/$/, '')}/rest/v1/translation_cache`;
          await fetch(url, {
            method: 'POST',
            headers: {
              'apikey': this.supabaseKey,
              'Authorization': `Bearer ${this.supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ hash, ru_text: cleanText, uk_text: ukText })
          });
        } catch (err) {
          // ignore
        }
      } else {
        // Save to local file cache
        this.saveLocalCache();
      }
    }

    return ukText || text;
  }
}

export async function downloadUrlWithRetry(url, destPath) {
  let attempts = 3;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await safeFetch(url);
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

export function parseCustomXml(filePath, supplierPrefix) {
  return new Promise((resolve, reject) => {
    const parser = new SaxesParser();
    const categories = [];
    const offers = [];

    let currentCategory = null;
    let offer = null;
    let inOffer = false;
    let tag = '';
    let textBuf = '';
    let cdataBuf = '';

    let inDesc = false;
    let descBuf = '';
    let descDepth = 0;

    parser.on('opentag', (node) => {
      const n = node.name;
      if (n === 'category') {
        currentCategory = {
          id: supplierPrefix + String(node.attributes.id || ''),
          parentId: node.attributes.parentId ? (supplierPrefix + String(node.attributes.parentId)) : null,
          name: ''
        };
      } else if (n === 'offer') {
        inOffer = true;
        offer = {
          id: supplierPrefix + String(node.attributes.id || ''),
          available: node.attributes.available !== 'false',
          categoryId: '',
          price: '0',
          price_opt: '0',
          price_old: null,
          vendorCode: '',
          vendor: '',
          name: '',
          name_ua: '',
          pictures: [],
          params: [],
          description: '',
          description_ua: '',
          rawFields: {}
        };
      } else if (inOffer && (n === 'description' || n === 'description_ua' || n === 'descriptionUa' || n === 'desc')) {
        inDesc = true; descBuf = ''; descDepth = 0;
      } else if (inOffer && (n === 'param' || n === 'property' || n === 'attribute' || n === 'characteristic')) {
        offer.curParam = {
          name: node.attributes.name || '',
          paramid: node.attributes.paramid || null,
          valueid: node.attributes.valueid || null,
          value: ''
        };
      }
      tag = n; textBuf = ''; cdataBuf = '';
    });

    parser.on('text', (t) => { if (inDesc) descBuf += t; else textBuf += t; });
    parser.on('cdata', (t) => { if (inDesc) descBuf += t; else cdataBuf += t; });

    parser.on('closetag', (node) => {
      const n = node.name;
      if (inDesc) {
        if (n === 'description' || n === 'description_ua' || n === 'descriptionUa' || n === 'desc') {
          const val = descBuf.trim();
          if (n === 'description' || n === 'desc') offer.description = val;
          else offer.description_ua = val;
          inDesc = false;
        } else {
          // nested tag in description, keep it as string
          descBuf += `</${n}>`;
        }
        return;
      }

      const val = (cdataBuf || textBuf).trim();

      if (n === 'category' && currentCategory) {
        currentCategory.name = val;
        categories.push(currentCategory);
        currentCategory = null;
      } else if (n === 'offer' && offer) {
        inOffer = false;
        const rf = offer.rawFields || {};

        offer.name = offer.name || rf.name || rf.title || '';
        offer.name_ua = offer.name_ua || rf.name_ua || rf.nameUa || rf.title_ua || offer.name;

        const priceVal = rf.priceRUAH || rf.price_uah || rf.retail_price || rf.retailprice || rf.price;
        offer.price = priceVal || '0';

        const costVal = rf.price_drop || rf['price-drop'] || rf.pricedrop || rf.purchasing_price || rf.cost_price || rf.price_opt || rf.wholesale_price || rf.wholesaleprice || rf.in_price || priceVal;
        offer.price_opt = costVal || priceVal || '0';

        offer.price_old = rf.price_old || rf.old_price || rf.priceOld || rf.oldPrice || null;

        offer.description = offer.description || rf.description || rf.desc || '';
        offer.description_ua = offer.description_ua || rf.description_ua || rf.descriptionUa || offer.description;

        const catIdVal = rf.categoryId || rf.category_id;
        offer.categoryId = catIdVal ? (supplierPrefix + String(catIdVal)) : '';

        offer.vendorCode = rf.vendorCode || rf.article || rf.sku || '';
        offer.vendor = rf.vendor || rf.brand || '';
        
        const stockVal = rf.stock_quantity || rf.quantity_in_stock || rf.stock;
        if (stockVal !== undefined) {
          const stockNum = parseInt(stockVal);
          offer.stock_quantity = isNaN(stockNum) ? 100 : stockNum;
          if (!isNaN(stockNum) && stockNum <= 0) {
            offer.available = false;
          }
        } else {
          offer.stock_quantity = offer.available ? 100 : 0;
        }

        delete offer.rawFields;

        if (offer.id && offer.name_ua) {
          offers.push(offer);
        }
        offer = null;
      } else if (inOffer && offer) {
        if (n === 'picture') {
          if (val) offer.pictures.push(val);
        } else if (n === 'param' || n === 'property' || n === 'attribute' || n === 'characteristic') {
          if (offer.curParam) {
            offer.curParam.value = val;
            offer.params.push(offer.curParam);
            offer.curParam = null;
          }
        } else if (n === 'vendorCode' || n === 'article' || n === 'sku') {
          offer.vendorCode = val;
        } else if (n === 'vendor' || n === 'brand') {
          offer.vendor = val;
        } else if (n === 'name') {
          offer.name = val;
        } else if (n === 'name_ua' || n === 'nameUa') {
          offer.name_ua = val;
        } else {
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

export function cleanDescriptionForEva(text, nameUa, vendor) {
  const fallback = `<p>${nameUa || 'Товар'} від виробника ${vendor || 'NoName'}.</p>`;
  if (!text || !text.trim()) return fallback;

  // 1. Decode HTML entities (double unescape)
  let clean = deEsc(deEsc(text));

  // 2. Remove script, style, iframe, video, audio tags with content
  clean = clean.replace(/<(script|style|iframe|video|audio)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Self-closing video, audio, iframe tags
  clean = clean.replace(/<(video|audio|iframe)[^>]*\/>/gi, '');
  // HTML comments
  clean = clean.replace(/<!--[\s\S]*?-->/g, '');
  // Remove img tags (EVA doesn't accept images in descriptions)
  clean = clean.replace(/<img[^>]*\/?>/gi, '');

  // Strip <a> tags completely but keep their text content
  clean = clean.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1');

  // 3. Remove URLs
  clean = clean.replace(/https?:\/\/[^\s<]+|www\.[^\s<]+/gi, '');

  // 4. Remove inline styles
  clean = clean.replace(/\s+style=["'][^"']*["']/gi, '');

  // 5. Remove empty HTML tags
  clean = clean.replace(/<(\w+)[^>]*>\s*<\/\1>/g, '');

  // 6. Limit description length (safe cut to avoid cutting tags)
  const DESC_LIMIT = 2800;
  if (clean.length > DESC_LIMIT) {
    const cutPos = clean.lastIndexOf('>', DESC_LIMIT);
    if (cutPos > 0) {
      clean = clean.slice(0, cutPos + 1) + '...';
    } else {
      clean = clean.slice(0, DESC_LIMIT) + '...';
    }
  }

  clean = clean.trim();

  // 7. Ensure at least 30 characters of plain text
  const plainText = clean.replace(/<[^>]+>/g, '').trim();
  if (plainText.length < 30) {
    return fallback;
  }

  // 8. Prevent breaking CDATA
  clean = clean.replace(/]]>/g, ']] >');

  return clean;
}

export function cleanDescriptionForRozetka(text) {
  if (!text || !text.trim()) return '';

  let clean = deEsc(deEsc(text));

  // 1. Strip script, style, iframe, video, audio tags with content
  clean = clean.replace(/<(script|style|iframe|video|audio)[^>]*>[\s\S]*?<\/\1>/gi, '');
  clean = clean.replace(/<(video|audio|iframe)[^>]*\/>/gi, '');
  clean = clean.replace(/<!--[\s\S]*?-->/g, '');

  // 2. Strip inline attributes (style, class, id)
  clean = clean.replace(/\s+style=["'][^"']*["']/gi, '');
  clean = clean.replace(/\s+class=["'][^"']*["']/gi, '');
  clean = clean.replace(/\s+id=["'][^"']*["']/gi, '');

  // 3. Remove non-whitelisted tags but keep content
  const whitelist = /<\/?(p|br|ul|li|ol|b|strong|i|em|table|tr|td|th|thead|tbody)\b[^>]*>/gi;
  clean = clean.replace(/<[^>]+>/g, (match) => {
    if (match.match(whitelist)) {
      const isClosing = match.startsWith('</');
      const tagName = match.replace(/[<>\/]/g, '').split(' ')[0];
      return isClosing ? `</${tagName}>` : `<${tagName}>`;
    }
    return '';
  });

  // 4. Prevent breaking CDATA
  clean = clean.replace(/]]>/g, ']] >');

  return clean.trim();
}

export function buildPromXml(offers, catById, opts = {}) {
  const idPfx   = String(opts.idPrefix  || '');
  const catPfx  = String(opts.catPrefix || '');
  const addBrand    = !!opts.addBrand;
  const defaultBrand = String(opts.defaultBrand || '');
  const doFillParams = !!opts.fillParams;

  const usedIds = new Set();
  offers.forEach(o => {
    usedIds.add(o.cat);
    ancestorsOf(o.cat, catById).forEach(a => usedIds.add(a.id));
  });

  const sorted = [...offers].sort((a, b) => {
    const ga = a.groupId || '', gb = b.groupId || '';
    if (ga && gb) { if (ga !== gb) return ga < gb ? -1 : 1; return 0; }
    if (ga) return -1; if (gb) return 1; return 0;
  });

  const date = new Date().toISOString().slice(0, 19).replace('T', ' ');

  let x = `<?xml version="1.0" encoding="UTF-8"?>\n<yml_catalog date="${date}">\n<shop>\n`;
  x += `<name>UTRADE</name>\n<company>UTRADE</company>\n<url>${CONFIG.SITE_URL}/</url>\n`;
  x += `<currencies><currency id="UAH" rate="1"/></currencies>\n`;

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
    let attrs = `id="${escX(pfxId)}"`;
    if (pfxParent) attrs += ` parentId="${escX(pfxParent)}"`;
    if (c.eva_id) attrs += ` eva_id="${escX(c.eva_id)}"`;
    x += `  <category ${attrs}>${escX(c.name)}</category>\n`;
  });
  x += `</categories>\n<offers>\n`;

  sorted.forEach(o => {
    const offerId  = idPfx + o.id;
    const catId    = catPfx + o.cat;
    const groupId  = o.groupId ? (idPfx + o.groupId) : '';
    let params = o.params || [];
    if (doFillParams) params = fillDefaultParamsSrv(params);
    if (opts.format === 'rozetka') {
      const seenParamNames = new Set();
      const uniqueParams = [];
      params.forEach(pm => {
        if (!pm || !pm.name) return;
        const normName = pm.name.trim().toLowerCase();
        if (!seenParamNames.has(normName)) {
          seenParamNames.add(normName);
          uniqueParams.push(pm);
        }
      });
      params = uniqueParams;
    }

    const brand  = addBrand ? getOfferBrand(o, defaultBrand) : '';
    const nameRu = brand ? withBrandSrv(o.name || o.name_ua || 'Без назви', brand) : (o.name || o.name_ua || 'Без назви');
    const nameUa = brand ? withBrandSrv(o.name_ua || o.name || 'Без назви', brand) : (o.name_ua || o.name || 'Без назви');

    let attrs = `id="${escX(offerId)}" available="${o.available !== false ? 'true' : 'false'}"`;
    if (groupId) attrs += ` group_id="${escX(groupId)}"`;
    x += `<offer ${attrs}>\n`;

    const outPrice = (o.finalPrice != null) ? o.finalPrice : o.drop;
    x += `  <price>${outPrice}</price>\n`;

    if (o.priceOld) {
      const pOld = parseFloat(o.priceOld);
      if (!isNaN(pOld) && pOld > outPrice) {
        x += `  <price_old>${Math.round(pOld)}</price_old>\n`;
      }
    }

    if (opts.format === 'eva' || (o.stockQuantity !== null && o.stockQuantity !== undefined)) {
      let stockVal = 0;
      if (o.stockQuantity !== null && o.stockQuantity !== undefined) {
        stockVal = o.stockQuantity;
      } else {
        stockVal = (o.available !== false) ? 4 : 0;
      }
      x += `  <stock_quantity>${stockVal}</stock_quantity>\n`;
    }

    x += `  <currencyId>UAH</currencyId>\n`;
    x += `  <categoryId>${escX(catId)}</categoryId>\n`;
    (o.pics || []).forEach(p => { if (p) x += `  <picture>${escX(p)}</picture>\n`; });
    if (o.vendorCode) x += `  <vendorCode>${escX(o.vendorCode)}</vendorCode>\n`;
    if (o.barcode)    x += `  <barcode>${escX(o.barcode)}</barcode>\n`;
    if (brand)        x += `  <vendor>${escX(brand)}</vendor>\n`;
    x += `  <name>${cdX(nameRu)}</name>\n`;
    x += `  <name_ua>${cdX(nameUa)}</name_ua>\n`;
    let dRu = o.desc || '';
    let dUa = o.desc_ua || '';
    if (opts.format === 'eva') {
      dRu = cleanDescriptionForEva(dRu, nameRu, brand || o.vendor || 'NoName');
      dUa = cleanDescriptionForEva(dUa, nameUa, brand || o.vendor || 'NoName');
    } else if (opts.format === 'rozetka') {
      dRu = cleanDescriptionForRozetka(dRu);
      dUa = cleanDescriptionForRozetka(dUa);
    }
    if (dRu) x += `  <description>${cdX(dRu)}</description>\n`;
    if (dUa) x += `  <description_ua>${cdX(dUa)}</description_ua>\n`;
    params.forEach(pm => {
      if (!pm || !pm.name) return;
      const pName  = escX(deEsc(pm.name));
      const pValue = escX(deEsc(String(pm.value ?? '')));
      let pAttrs = `name="${pName}"`;
      if (pm.paramid) pAttrs += ` paramid="${escX(pm.paramid)}"`;
      if (pm.valueid) pAttrs += ` valueid="${escX(pm.valueid)}"`;
      if (pValue) x += `  <param ${pAttrs}>${pValue}</param>\n`;
    });
    x += `</offer>\n`;
  });

  x += `</offers>\n</shop>\n</yml_catalog>`;
  return x;
}

export async function buildUserCustomExports() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const translator = new SupabaseTranslator();

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
      catById[c.id] = { id: c.id, name: c.name, parentId: c.parentId || null, eva_id: c.eva_id || null };
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
        if (mapped.eva_id) {
          c.eva_id = String(mapped.eva_id);
        }
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
      mappedCatById[c.id] = { id: c.id, name: c.name, parentId: c.parentId || null, eva_id: c.eva_id || null };
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

        if (cfg.min_cost_price !== undefined && cfg.min_cost_price !== '') {
          if (cost < parseFloat(cfg.min_cost_price)) { keep = false; break; }
        }
        if (cfg.max_cost_price !== undefined && cfg.max_cost_price !== '') {
          if (cost > parseFloat(cfg.max_cost_price)) { keep = false; break; }
        }

        if (cfg.name_exclude && cfg.name_exclude.length > 0) {
          const match = cfg.name_exclude.some(w => w && nameLower.includes(String(w).toLowerCase()));
          if (match) { keep = false; break; }
        }

        if (cfg.desc_exclude && cfg.desc_exclude.length > 0) {
          const match = cfg.desc_exclude.some(w => w && descLower.includes(String(w).toLowerCase()));
          if (match) { keep = false; break; }
        }

        if (cfg.vendor_exclude && cfg.vendor_exclude.length > 0) {
          const match = cfg.vendor_exclude.some(w => w && vendorLower.includes(String(w).toLowerCase()));
          if (match) { keep = false; break; }
        }
      }

      if (keep) {
        filteredOffers.push(o);
      }
    }

    if (rules.some(r => r.type === 'include_categories')) {
      const allowedCats = new Set();
      const includeRules = rules.filter(r => r.type === 'include_categories');
      for (const rule of includeRules) {
        const cfg = rule.config || {};
        const ids = cfg.category_ids || [];
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

    let translatedCount = 0;
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

        if (rule.type === 'translate_to_uk') {
          if (!nameUa || nameUa === name) {
            nameUa = await translator.translate(name, 'ru', 'uk');
          }
          if (!descUa || descUa === desc) {
            descUa = await translator.translate(desc, 'ru', 'uk');
          }
        }

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

      translatedCount++;
      if (translatedCount % 100 === 0 || translatedCount === filteredOffers.length) {
        if (translator.stats.api > 0 || translator.stats.cache > 0) {
          console.log(`   ⏳ [переклад] Оброблено товарів: ${translatedCount}/${filteredOffers.length} (Кеш: ${translator.stats.cache}, API: ${translator.stats.api}, Помилок: ${translator.stats.errors})`);
        }
      }
    }

    const isEmergency = !!preset.emergency_stock_zero;

    const promOffers = filteredOffers.map(o => ({
      id: o.id,
      available: isEmergency ? 'false' : o.available,
      cat: o.categoryId,
      drop: parseFloat(o.price) || 0,
      finalPrice: o.finalPrice,
      priceOld: o.price_old || o.priceOld || null,
      stockQuantity: isEmergency ? 0 : (o.stock_quantity !== undefined ? o.stock_quantity : null),
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
      fillParams: !!preset.fillParams,
      format: preset.format || 'prom'
    };

    const outPath = path.join(CONFIG.OUT_DIR, 'exports', name + '.xml');
    const xmlContent = buildPromXml(promOffers, mappedCatById, xmlOpts);
    fs.writeFileSync(outPath, xmlContent);

    const count = promOffers.length;
    made.push({ name, count, url: `${CONFIG.SITE_URL}/exports/${name}.xml`, token });
    console.log(`   📦 exports/${name}.xml — ${count} товарів (Користувацький фід)`);
  }

  try {
    fs.writeFileSync(path.join(DATA_DIR, 'exports.json'), JSON.stringify({ updated: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC', exports: made }));
  } catch (e) { /* ignore */ }
  return made;
}
