import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { SaxesParser } from 'saxes';
import { safeFetch, warn } from '../utils.mjs';

const IP_TMP_XML = 'iposud2.xml';

async function iposud2Download() {
  const url = 'https://i-posud.com.ua/assets/export/xml/export_dropshipper_ua.xml';
  console.log('📥 [iposud2] Завантаження XML:', url);
  const res = await safeFetch(url);
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
      const val = rawVal.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');

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

export async function runIposud2() {
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
