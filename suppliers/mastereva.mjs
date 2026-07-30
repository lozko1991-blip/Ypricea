import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { SaxesParser } from 'saxes';
import { CONFIG } from '../config.mjs';
import { safeFetch, warn } from '../utils.mjs';

const ME_TMP_XML = 'mastereva.xml';

export function masterevaSrc(categoryId) {
  const id = String(categoryId == null ? '' : categoryId);
  for (const p of CONFIG.MASTEREVA_PREFIXES) {
    if (id.startsWith(p.prefix) && id.length > p.prefix.length) {
      return p.src;
    }
  }
  return CONFIG.MASTEREVA_DEFAULT_SRC;
}

export function masterevaOfferSrc(offerId, categoryId) {
  const offId = String(offerId || '');
  const catId = String(categoryId || '');
  
  if (offId.startsWith('1000_')) return 'ev_dropt';
  if (offId.startsWith('1100_')) return 'ev_forus';
  if (offId.startsWith('1111_')) return 'ev_shkatulka';
  if (offId.startsWith('2222_')) return 'ev_optdrop';
  if (offId.startsWith('3000_')) return 'ev_dropshipping';
  if (offId.startsWith('3333_')) return 'ev_lugi';
  if (offId.startsWith('4444_')) return 'ev_dropom';
  if (offId.startsWith('7777_')) return 'ev_posudograd';
  if (offId.startsWith('8888_')) return 'ev_iposud';
  if (offId.startsWith('9999_')) return 'ev_websklad';
  if (offId.startsWith('1200_')) return 'ev_aveopt';
  if (offId.startsWith('1300_')) return 'ev_sonechko';
  
  if (catId.startsWith('5555') && catId.length > 4) return 'ev_royaltoys';
  
  return 'ev_new';
}

async function masterevaDownload() {
  console.log('📥 [mastereva] Завантаження XML:', CONFIG.MASTEREVA_XML_URL);
  const res = await safeFetch(CONFIG.MASTEREVA_XML_URL, { headers: { 'Accept-Encoding': 'gzip, deflate, br' } });
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
      } else if (inOffer && (n === 'description_ua' || n === 'description')) {
        inDescUa = true; descUaBuf = ''; descDepth = 0;
      }
      tag = n; textBuf = ''; cdataBuf = '';
    });

    parser.on('text', (t) => { if (inDescUa) descUaBuf += t; else textBuf += t; });
    parser.on('cdata', (t) => { if (inDescUa) descUaBuf += t; else cdataBuf += t; });

    parser.on('closetag', (node) => {
      const n = node.name;
      if (inDescUa) {
        if (n === 'description_ua' || n === 'description') { offer.desc_ua = descUaBuf.trim(); inDescUa = false; }
        else { descUaBuf += `</${n}>`; }
        textBuf = ''; cdataBuf = ''; return;
      }
      const rawVal = (cdataBuf || textBuf).trim();
      const val = rawVal.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');

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
      const rec = {
        id: o.id,
        available: o.available,
        catId: o.catId,
        price_drop: price,
        name: nameUa,
        name_ua: nameUa,
        vendorCode: o.article || '',
        groupId: '',
        barcode: '',
        pics: (o.pics || []).slice(0, CONFIG.MASTEREVA_MAX_PICS),
        params: o.params || [],
        desc: '',
        desc_ua: '',
        src: masterevaOfferSrc(o.id, o.catId),
      };
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

function masterevaEnrichCategories({ categories, catById, products }) {
  const direct = {};
  products.forEach(p => { direct[p.catId] = (direct[p.catId] || 0) + 1; });
  const childrenOf = {};
  categories.forEach(c => { const p = c.parentId || ''; (childrenOf[p] = childrenOf[p] || []).push(c.id); });
  const total = {};
  function agg(id) { let s = direct[id] || 0; (childrenOf[id] || []).forEach(ch => { s += agg(ch); }); total[id] = s; return s; }
  categories.filter(c => !(c.parentId && catById[c.parentId])).forEach(c => agg(c.id));
  categories.forEach(c => { if (total[c.id] == null) total[c.id] = direct[c.id] || 0; });

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

export async function runMastereva() {
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
    console.warn('⚠️ [mastereva] пропущено через помилку:', e.message);
    warn('Mastereva: ' + e.message);
    try { fs.unlinkSync(ME_TMP_XML); } catch {}
    return null;
  }
}
