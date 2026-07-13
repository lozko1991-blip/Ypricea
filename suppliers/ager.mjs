import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { SaxesParser } from 'saxes';
import { safeFetch, warn } from '../utils.mjs';

const AGER_TMP_XML = 'ager_price.xml';

async function agerDownload() {
  const url = 'https://ager.ua/yml_prom?code=multi&param=888';
  console.log('📥 [ager] Завантаження XML:', url);
  const res = await safeFetch(url);
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
      const val = rawVal.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');

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

export async function runAger() {
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
