import fs from 'fs';
import XLSX from 'xlsx';

const stopwords = new Set([
  'для', 'та', 'і', 'в', 'на', 'и', 'с', 'під', 'по', 'за', 'из', 'от', 'до',
  'об', 'при', 'у', 'о', 'со', 'же', 'бы', 'ли', 'все', 'для', 'всі', 'все'
]);

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopwords.has(w));
}

function findBestMatch(srcWords, targetList) {
  if (srcWords.length === 0) return null;
  
  let bestItem = null;
  let maxOverlap = 0;
  let bestScore = 0;
  
  for (const target of targetList) {
    const targetWords = target.normalizedWords;
    const overlap = srcWords.filter(w => targetWords.includes(w)).length;
    
    if (overlap > 0) {
      const score = overlap / (srcWords.length + targetWords.length - overlap);
      if (overlap > maxOverlap || (overlap === maxOverlap && score > bestScore)) {
        maxOverlap = overlap;
        bestScore = score;
        bestItem = target;
      }
    }
  }
  
  return bestItem ? { match: bestItem, score: bestScore, overlap: maxOverlap } : null;
}

async function main() {
  console.log('Loading Prom categories XLS...');
  const wb = XLSX.readFile('./Prom.ua_categories_13_07_2026.xls');
  const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  
  const promCategories = [];
  for (let i = 1; i < sheetRows.length; i++) {
    const r = sheetRows[i];
    if (!r || r.length < 6) continue;
    const hierarchy = [r[0], r[1], r[2], r[3]].map(s => String(s || '').trim()).filter(Boolean);
    if (hierarchy.length === 0) continue;
    const fullName = hierarchy.join(' > ');
    promCategories.push({
      id: String(r[5]),
      name: fullName,
      normalizedWords: normalize(fullName)
    });
  }
  
  console.log('Loading supplier categories...');
  const catsData = JSON.parse(fs.readFileSync('./frontend/public/data/categories.json', 'utf8'));
  const supplierCategories = catsData.categories || [];
  
  let matchedCount = 0;
  const sampleMatches = [];
  
  console.log('Matching...');
  const start = Date.now();
  
  for (const cat of supplierCategories) {
    const srcWords = normalize(cat.name);
    const res = findBestMatch(srcWords, promCategories);
    if (res) {
      matchedCount++;
      if (sampleMatches.length < 30) {
        sampleMatches.push({
          source: cat.name,
          target: res.match.name,
          score: res.score.toFixed(2),
          overlap: res.overlap
        });
      }
    }
  }
  
  console.log(`Matching completed in ${((Date.now() - start) / 1000).toFixed(2)}s.`);
  console.log('\n--- MATCH STATISTICS ---');
  console.log(`Total Supplier Categories: ${supplierCategories.length}`);
  console.log(`Matched Categories: ${matchedCount} (${((matchedCount / supplierCategories.length) * 100).toFixed(1)}%)`);
  console.log(`Unmatched Categories: ${supplierCategories.length - matchedCount}`);
  
  console.log('\n--- SAMPLE MATCHES (Top 30) ---');
  sampleMatches.forEach((m, idx) => {
    console.log(`${idx + 1}. [${m.source}]  ===>  [${m.target}]  (score: ${m.score}, overlap: ${m.overlap})`);
  });
}

main().catch(console.error);
