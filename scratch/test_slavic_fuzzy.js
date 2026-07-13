import fs from 'fs';
import XLSX from 'xlsx';

const translationDict = {
  'обувь': 'взуття', 'одежда': 'одяг', 'игрушки': 'іграшки', 'игрушка': 'іграшка',
  'посуда': 'посуд', 'кухня': 'кухня', 'кухонная': 'кухонна', 'кухонной': 'кухонна',
  'бытовая': 'побутова', 'бытовые': 'побутові', 'техника': 'техніка',
  'аксессуары': 'аксесуари', 'чехол': 'чохол', 'чехлы': 'чохли',
  'сумка': 'сумка', 'рюкзак': 'рюкзак', 'часы': 'годинники',
  'косметика': 'косметика', 'инструмент': 'інструмент', 'инструменты': 'інструменти',
  'дом': 'дім', 'сад': 'сад', 'авто': 'авто', 'вело': 'вело', 'спорт': 'спорт',
  'детские': 'дитячі', 'детская': 'дитяча', 'детей': 'дітей', 'детский': 'дитячий',
  'постельное': 'постільна', 'белье': 'білизна', 'одеяло': 'ковдра',
  'подушка': 'подушка', 'коврик': 'килимок', 'полотенце': 'рушник',
  'освещение': 'освітлення', 'лампа': 'лампа', 'люстра': 'люстра',
  'гирлянда': 'гірлянда', 'электрический': 'електричний', 'электрические': 'електричні',
  'мелкая': 'дрібна', 'крупная': 'велика', 'пылесос': 'пилосос',
  'утюг': 'праска', 'фен': 'фен', 'бритва': 'бритва', 'плойка': 'плойка',
  'эпилятор': 'епілятор', 'весы': 'ваги', 'кофе': 'кава', 'чай': 'чай',
  'кофемашина': 'кавомашина', 'кофеварка': 'кавоварка', 'электрочайник': 'електрочайник',
  'блендер': 'блендер', 'миксер': 'міксер', 'мясорубка': 'м\'ясорубка',
  'тостер': 'тостер', 'духовка': 'духовка', 'плита': 'плита',
  'вытяжка': 'витяжка', 'холодильник': 'холодильник', 'телевизор': 'телевізор',
  'смартфон': 'смартфон', 'телефон': 'телефон', 'планшет': 'планшет',
  'ноутбук': 'ноутбук', 'наушники': 'навушники', 'колонка': 'колонка',
  'клавиатура': 'клавіатура', 'мышь': 'мишка', 'кабель': 'кабель',
  'зарядка': 'зарядка', 'накопитель': 'накопичувач', 'чемодан': 'валізи',
  'дорожная': 'дорожня', 'зонт': 'парасоля', 'ремень': 'ремінь',
  'кошелек': 'гаманець', 'портмоне': 'портмоне', 'очки': 'окуляри',
  'украшения': 'прикраси', 'кольцо': 'кільце', 'серьги': 'сережки',
  'браслет': 'браслет', 'кулон': 'кулон', 'чашка': 'чашка',
  'кружка': 'кружка', 'стакан': 'склянка', 'бокал': 'келих',
  'тарелка': 'тарілка', 'салатник': 'салатник', 'блюдо': 'блюдо',
  'кастрюля': 'каструля', 'сковорода': 'сковорідка', 'нож': 'ніж',
  'вилка': 'вилка', 'ложка': 'ложка', 'чайник': 'чайник',
  'кофемолка': 'кавомолка', 'термос': 'термос', 'доска': 'дошка',
  'терка': 'терка', 'сито': 'сито', ' штопор': 'штопор', 'ведро': 'відро',
  'швабра': 'швабра', 'зеркало': 'дзеркало', 'картина': 'картина',
  'свеча': 'свічка', 'плед': 'плед', 'покрывало': 'покривало',
  'наволочка': 'наволочка', 'матрас': 'матрац', 'штора': 'штора',
  'скатерть': 'скатертина', 'халат': 'халат', 'носки': 'шкарпетки',
  'колготки': 'колготки', 'трусы': 'труси', 'футболка': 'футболка',
  'рубашка': 'сорочка', 'платье': 'сукня', 'юбка': 'спідниця',
  'брюки': 'штани', 'джинсы': 'джинси', 'шорты': 'шорти',
  'костюм': 'костюм', 'свитер': 'светр', 'куртка': 'куртка',
  'пальто': 'пальто', 'шапка': 'шапка', 'шарф': 'шарф',
  'перчатки': 'рукавички', 'кепка': 'кепка', 'панама': 'панама'
};

const stopwords = new Set([
  'для', 'та', 'і', 'в', 'на', 'и', 'с', 'під', 'по', 'за', 'из', 'от', 'до',
  'об', 'при', 'у', 'о', 'со', 'же', 'бы', 'ли', 'все', 'для', 'всі', 'все',
  'или', 'або', 'как', 'як', 'без', 'через'
]);

function getSlavicRoot(word) {
  let w = word.toLowerCase();
  // Translate common words directly
  if (translationDict[w]) {
    w = translationDict[w];
  }
  w = w
    .replace(/э/g, 'е')
    .replace(/и/g, 'і')
    .replace(/ы/g, 'и')
    .replace(/ё/g, 'е')
    .replace(/ь/g, '')
    .replace(/ъ/g, '')
    .replace(/й/g, 'й')
    .replace(/я/g, 'а')
    .replace(/ю/g, 'у');
  
  // Return prefix of length 4 for long words
  return w.length >= 4 ? w.substring(0, 4) : w;
}

function tokenizeAndRoot(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopwords.has(w))
    .map(getSlavicRoot);
}

function findBestMatch(srcRoots, targetList) {
  if (srcRoots.length === 0) return null;
  
  let bestItem = null;
  let maxOverlap = 0;
  let bestScore = 0;
  
  for (const target of targetList) {
    const targetRoots = target.normalizedRoots;
    const overlap = srcRoots.filter(r => targetRoots.includes(r)).length;
    
    if (overlap > 0) {
      const score = overlap / (srcRoots.length + targetRoots.length - overlap);
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
      normalizedRoots: tokenizeAndRoot(fullName)
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
    const srcRoots = tokenizeAndRoot(cat.name);
    const res = findBestMatch(srcRoots, promCategories);
    if (res && res.score >= 0.15) { // Threshold to prevent garbage matches
      matchedCount++;
      if (sampleMatches.length < 50) {
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
  
  console.log('\n--- SAMPLE MATCHES (Top 50) ---');
  sampleMatches.forEach((m, idx) => {
    console.log(`${idx + 1}. [${m.source}]  ===>  [${m.target}]  (score: ${m.score}, overlap: ${m.overlap})`);
  });
}

main().catch(console.error);
