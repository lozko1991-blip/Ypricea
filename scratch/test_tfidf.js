import fs from 'fs';
import XLSX from 'xlsx';

// Standard Levenshtein distance
function levenshtein(a, b) {
  const tmp = [];
  let i, j, alen = a.length, blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;
  for (i = 0; i <= alen; i++) tmp[i] = [i];
  for (j = 0; j <= blen; j++) tmp[0][j] = j;
  for (i = 1; i <= alen; i++) {
    for (j = 1; j <= blen; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[alen][blen];
}

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
  'терка': 'терка', 'сито': 'сито', 'штопор': 'штопор', 'ведро': 'відро',
  'швабра': 'швабра', 'зеркало': 'дзеркало', 'картина': 'картина',
  'свеча': 'свічка', 'плед': 'плед', 'покрывало': 'покривало',
  'наволочка': 'наволочка', 'матрас': 'матрац', 'штора': 'штора',
  'скатерть': 'скатертина', 'халат': 'халат', 'носки': 'шкарпетки',
  'колготки': 'колготки', 'трусы': 'труси', 'футболка': 'футболка',
  'рубашка': 'сорочка', 'платье': 'сукня', 'юбка': 'спідниця',
  'брюки': 'штани', 'джинсы': 'джинси', 'шорты': 'шорти',
  'костюм': 'костюм', 'свитер': 'светр', 'куртка': 'куртка',
  'пальто': 'пальто', 'шапка': 'шапка', 'шарф': 'шарф',
  'перчатки': 'рукавички', 'кепка': 'кепка', 'панама': 'панама',
  
  // Semantic synonyms mapped as equal roots
  'микроволновые': 'мікрохвильові', 'микроволновая': 'мікрохвильова',
  'пылесосы': 'пилососи', 'утюги': 'праски', 'сушилка': 'сушарка',
  'сушилки': 'сушарки', 'электродуховка': 'електропіч', 'электродуховки': 'електропечі',
  'электромясорубка': 'електром\'ясорубка', 'электромясорубки': 'електром\'ясорубки',
  'электрочайники': 'електрочайники', 'ванночки': 'ванночки',
  'плойки': 'плойки', 'выпрямители': 'випрямлячі', 'фени': 'фени',
  'электробритвы': 'електробритви', 'обогреватели': 'обігрівачі',
  'конвекторы': 'конвектори', 'тепловентиляторы': 'тепловентилятори',
  'крышки': 'кришки', 'ковши': 'ковші', 'чайники': 'чайники',
  'прихватки': 'прихватки', 'простыни': 'простирадла', 'пододеяльники': 'підковдри',
  'одеяла': 'ковдри', 'полотенца': 'рушники'
};

const stopwords = new Set([
  'для', 'та', 'і', 'в', 'на', 'и', 'с', 'під', 'по', 'за', 'из', 'от', 'до',
  'об', 'при', 'у', 'о', 'со', 'же', 'бы', 'ли', 'все', 'для', 'всі', 'все',
  'или', 'або', 'как', 'як', 'без', 'через'
]);

// Strip common noun and adjective suffixes
function stripSuffix(word) {
  return word
    .replace(/(овые|ові|ые|іе|ие|ий|ый|ое|ая|яя|ічні|ичные|ичная|ічна|ные|ні|ний|ний|ація|ация|еские|еские|ські|ские|ська|ская|ивные|ивні|ова|ово|ево|єво|иця|ица|ка|ки|ики|ики|и|ы|a|я|е|о|у|ю|і|и|ь|я)$/g, '');
}

function cleanWord(word) {
  let w = word.toLowerCase();
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
  return stripSuffix(w);
}

function areWordsSimilar(norm1, norm2) {
  if (norm1 === norm2) return true;
  if (norm1.length === 0 || norm2.length === 0) return false;
  if (norm1.substring(0, 2) !== norm2.substring(0, 2)) return false;
  
  const len1 = norm1.length;
  const len2 = norm2.length;
  if (len1 > len2) {
    if (len2 >= 3 && norm1.startsWith(norm2)) return true;
  } else {
    if (len1 >= 3 && norm2.startsWith(norm1)) return true;
  }
  
  const dist = levenshtein(norm1, norm2);
  const minLen = Math.min(len1, len2);
  
  if (minLen <= 3 && dist <= 1) return true;
  if (minLen > 3 && dist <= 2) return true;
  
  return false;
}

function tokenizeAndClean(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopwords.has(w))
    .map(cleanWord)
    .filter(w => w.length >= 2);
}

// Dynamically compute IDF weights based on word occurrence frequencies
function computeIDFWeights(categoriesList) {
  const documentCount = categoriesList.length;
  const wordFrequency = {};
  
  categoriesList.forEach(cat => {
    // Unique words in this category path
    const uniqueWords = new Set(cat.tokenizedCleaned);
    uniqueWords.forEach(w => {
      wordFrequency[w] = (wordFrequency[w] || 0) + 1;
    });
  });
  
  const idfWeights = {};
  for (const [word, count] of Object.entries(wordFrequency)) {
    // Standard IDF formula: log(totalDocs / docFreq) + 1
    idfWeights[word] = Math.log(documentCount / count) + 1.0;
  }
  return idfWeights;
}

function findBestMatch(srcWords, targetList, idfWeights) {
  if (srcWords.length === 0) return null;
  
  let bestItem = null;
  let maxScore = 0;
  
  // Pre-calculate sum of IDF weights for source words
  const srcWeightsSum = srcWords.reduce((sum, w) => sum + (idfWeights[w] || 2.0), 0);
  
  for (const target of targetList) {
    const targetWords = target.tokenizedCleaned;
    const leafWords = target.leafTokenizedCleaned;
    
    let overlapWeight = 0;
    let targetWeightsSum = 0;
    
    // Calculate Jaccard-like similarity weighted by word IDF values
    for (const tw of targetWords) {
      const weight = idfWeights[tw] || 2.0;
      targetWeightsSum += weight;
      
      // Check if source word matches this target word
      const matches = srcWords.some(sw => areWordsSimilar(sw, tw));
      if (matches) {
        // Boost matches if the word is part of the leaf components
        const isLeaf = leafWords.some(lw => areWordsSimilar(lw, tw));
        overlapWeight += weight * (isLeaf ? 1.5 : 1.0);
      }
    }
    
    if (overlapWeight > 0) {
      // Weighted similarity score
      const unionWeight = srcWeightsSum + targetWeightsSum - overlapWeight;
      const score = overlapWeight / unionWeight;
      
      if (score > maxScore) {
        maxScore = score;
        bestItem = target;
      }
    }
  }
  
  return bestItem && maxScore >= 0.12 ? { match: bestItem, score: maxScore } : null;
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
    const leafName = hierarchy[hierarchy.length - 1]; // Leaf node
    
    promCategories.push({
      id: String(r[5]),
      name: fullName,
      tokenizedCleaned: tokenizeAndClean(fullName),
      leafTokenizedCleaned: tokenizeAndClean(leafName)
    });
  }
  
  console.log('Computing IDF weights across 5809 Prom categories...');
  const idfWeights = computeIDFWeights(promCategories);
  
  console.log('Loading supplier categories...');
  const catsData = JSON.parse(fs.readFileSync('./frontend/public/data/categories.json', 'utf8'));
  const supplierCategories = catsData.categories || [];
  
  let matchedCount = 0;
  const sampleMatches = [];
  
  console.log('Matching with TF-IDF and Leaf-Node Boost...');
  const start = Date.now();
  
  for (const cat of supplierCategories) {
    const srcWords = tokenizeAndClean(cat.name);
    const res = findBestMatch(srcWords, promCategories, idfWeights);
    if (res) {
      matchedCount++;
      if (sampleMatches.length < 40) {
        sampleMatches.push({
          source: cat.name,
          target: res.match.name,
          score: res.score.toFixed(2)
        });
      }
    }
  }
  
  console.log(`Matching completed in ${((Date.now() - start) / 1000).toFixed(2)}s.`);
  console.log('\n--- MATCH STATISTICS ---');
  console.log(`Total Supplier Categories: ${supplierCategories.length}`);
  console.log(`Matched Categories: ${matchedCount} (${((matchedCount / supplierCategories.length) * 100).toFixed(1)}%)`);
  console.log(`Unmatched Categories: ${supplierCategories.length - matchedCount}`);
  
  console.log('\n--- SAMPLE MATCHES (Top 40) ---');
  sampleMatches.forEach((m, idx) => {
    console.log(`${idx + 1}. [${m.source}]  ===>  [${m.target}]  (score: ${m.score})`);
  });
}

main().catch(console.error);
