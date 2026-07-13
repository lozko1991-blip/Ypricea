import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Sliders, 
  Loader2, 
  Save,
  Sparkles
} from 'lucide-react';
import type { CustomFeed, FeedSupplier, FeedRule } from './CabinetTypes';

// Standard Levenshtein distance
function levenshtein(a: string, b: string): number {
  const tmp: number[][] = [];
  let i: number, j: number, alen = a.length, blen = b.length;
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

const translationDict: Record<string, string> = {
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
  'утюг': 'праска', 'fен': 'фен', 'фен': 'фен', 'бритва': 'бритва', 'плойка': 'плойка',
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
  'кастрюля': 'каструля', 'scoreворода': 'сковорідка', 'сковорода': 'сковорідка',
  'нож': 'ніж', 'вилка': 'вилка', 'ложка': 'ложка', 'чайник': 'чайник',
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
  
  // Plurals and specific categories
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

function cleanWord(word: string): string {
  let w = word.toLowerCase();
  if (translationDict[w]) {
    w = translationDict[w];
  }
  return w
    .replace(/э/g, 'е')
    .replace(/и/g, 'і')
    .replace(/ы/g, 'и')
    .replace(/ё/g, 'е')
    .replace(/ь/g, '')
    .replace(/ъ/g, '')
    .replace(/й/g, 'й')
    .replace(/я/g, 'а')
    .replace(/ю/g, 'у');
}

function areWordsSimilar(norm1: string, norm2: string): boolean {
  if (norm1 === norm2) return true;
  if (norm1.substring(0, 2) !== norm2.substring(0, 2)) return false;
  
  const len1 = norm1.length;
  const len2 = norm2.length;
  if (len1 > len2) {
    if (len2 >= 4 && norm1.startsWith(norm2)) return true;
  } else {
    if (len1 >= 4 && norm2.startsWith(norm1)) return true;
  }
  
  const dist = levenshtein(norm1, norm2);
  const minLen = Math.min(len1, len2);
  
  if (minLen <= 4 && dist <= 1) return true;
  if (minLen > 4 && dist <= 2) return true;
  
  return false;
}

function tokenizeAndClean(str: string): string[] {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopwords.has(w))
    .map(cleanWord);
}

interface ClientFeedsProps {
  customFeeds: CustomFeed[];
  customFeedsLoading: boolean;
  onSaveFeed: (feed: CustomFeed) => Promise<void>;
  onDeleteFeed: (token: string) => Promise<void>;
  savingFeed: boolean;
  ghTokenVal: string;
  user: any;
  showToast: (msg: string) => void;
}

export const ClientFeeds: React.FC<ClientFeedsProps> = ({
  customFeeds,
  customFeedsLoading,
  onSaveFeed,
  onDeleteFeed,
  savingFeed,
  ghTokenVal,
  user,
  showToast
}) => {
  const [isEditingFeed, setIsEditingFeed] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<CustomFeed | null>(null);

  // Local editor states
  const [feedName, setFeedName] = useState('');
  const [feedFormat, setFeedFormat] = useState<'prom' | 'rozetka'>('prom');
  const [feedSuppliers, setFeedSuppliers] = useState<FeedSupplier[]>([]);
  const [feedRules, setFeedRules] = useState<FeedRule[]>([]);
  const [feedCatMapping, setFeedCatMapping] = useState<Record<string, { id: string; name: string }>>({});
  
  // Reference marketplace categories database
  const [marketplaceCategories, setMarketplaceCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingMktCategories, setLoadingMktCategories] = useState(false);
  const [activeRowSuggestions, setActiveRowSuggestions] = useState<string | null>(null);
  const [suggestionSearchQuery, setSuggestionSearchQuery] = useState('');
  const [activeRuleTab, setActiveRuleTab] = useState<'markup' | 'filter' | 'mapping' | 'other'>('markup');
  const [mappingFilter, setMappingFilter] = useState<'all' | 'unmapped' | 'mapped'>('all');

  useEffect(() => {
    if (isEditingFeed && activeRuleTab === 'mapping') {
      const loadMarketplaceCategories = async () => {
        setLoadingMktCategories(true);
        try {
          const { data, error } = await supabase
            .from('marketplace_categories')
            .select('id, name')
            .eq('marketplace', feedFormat);
          if (error) throw error;
          setMarketplaceCategories(data || []);
        } catch (e: any) {
          console.warn('Failed to load marketplace categories:', e.message);
        } finally {
          setLoadingMktCategories(false);
        }
      };
      loadMarketplaceCategories();
    }
  }, [isEditingFeed, activeRuleTab, feedFormat]);
  
  // Category parsing states
  const [parsedCategories, setParsedCategories] = useState<any[]>([]);
  const [isParsingXml, setIsParsingXml] = useState(false);

  // New Rule Temporary States
  const [newRuleScope, setNewRuleScope] = useState<'global' | 'category' | 'supplier'>('global');
  const [newRuleScopeValue, setNewRuleScopeValue] = useState('');
  const [newRuleConfig, setNewRuleConfig] = useState<any>({});

  // Helper to parse XML categories locally in the browser
  const handleParseSupplierCategories = async (urls: string[]) => {
    setIsParsingXml(true);
    const cats: Array<{ id: string; name: string; parentId?: string; srcName: string }> = [];
    try {
      for (const url of urls) {
        if (!url) continue;
        const res = await fetch(url);
        if (!res.ok) continue;
        const xmlText = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, "text/xml");
        const categoriesNodes = doc.getElementsByTagName("category");
        const srcName = url.split('/').pop() || 'Supplier';
        for (let i = 0; i < categoriesNodes.length; i++) {
          const node = categoriesNodes[i];
          const id = node.getAttribute("id") || "";
          const parentId = node.getAttribute("parentId") || node.getAttribute("parent_id") || undefined;
          const name = node.textContent || "";
          if (id && name) {
            cats.push({ id, name, parentId, srcName });
          }
        }
      }
      setParsedCategories(cats);
    } catch (err) {
      console.error("Error parsing categories:", err);
    } finally {
      setIsParsingXml(false);
    }
  };

  const handleSelectFeedForEditing = async (feed: CustomFeed) => {
    setSelectedFeed(feed);
    setIsEditingFeed(true);
    setFeedName(feed.name);
    setFeedFormat(feed.format || 'prom');

    if (feed.suppliers && feed.suppliers.length > 0) {
      setFeedSuppliers(feed.suppliers);
      setFeedRules(feed.rules || []);
      setFeedCatMapping(feed.category_mapping || {});
      handleParseSupplierCategories(feed.suppliers.map(s => s.xml_url));
    } else {
      // fallback to loading JSON preset from GitHub Pages
      try {
        const timestamp = Date.now();
        const res = await fetch(`presets/user-feed-${feed.token}.json?_=${timestamp}`);
        if (res.ok) {
          const config = await res.json();
          setFeedSuppliers(config.suppliers || []);
          setFeedRules(config.rules || []);
          setFeedCatMapping(config.category_mapping || {});
          if (config.suppliers && config.suppliers.length > 0) {
            handleParseSupplierCategories(config.suppliers.map((s: any) => s.xml_url));
          }
        } else {
          setFeedSuppliers([]);
          setFeedRules([]);
          setFeedCatMapping({});
          setParsedCategories([]);
        }
      } catch (err) {
        console.error("Error fetching feed preset details:", err);
        setFeedSuppliers([]);
        setFeedRules([]);
        setFeedCatMapping({});
        setParsedCategories([]);
      }
    }
  };

  const filteredCategories = parsedCategories.filter(cat => {
    const isMapped = !!feedCatMapping[cat.id]?.id;
    if (mappingFilter === 'unmapped') return !isMapped;
    if (mappingFilter === 'mapped') return isMapped;
    return true;
  });

  const handleMapSelect = (origFullId: string, targetId: string, targetName: string) => {
    setFeedCatMapping(prev => ({
      ...prev,
      [origFullId]: { id: targetId, name: targetName }
    }));

    // Auto-advance suggestions to the next row in our current filteredCategories view
    const currentIndex = filteredCategories.findIndex(c => c.id === origFullId);
    if (currentIndex !== -1 && currentIndex < filteredCategories.length - 1) {
      const nextCat = filteredCategories[currentIndex + 1];
      setActiveRowSuggestions(nextCat.id);
    } else {
      setActiveRowSuggestions(null);
    }
    setSuggestionSearchQuery('');
  };

  const handleClientAutoMap = () => {
    if (!parsedCategories.length) return;
    if (!marketplaceCategories.length) {
      showToast('⚠️ База категорій маркетплейсу порожня або завантажується...');
      return;
    }

    const newMapping = { ...feedCatMapping };

    // Pre-tokenize and clean marketplace categories for high performance
    const tokenizedMkt = marketplaceCategories.map(cat => ({
      ...cat,
      tokens: tokenizeAndClean(cat.name)
    }));

    let mappedCount = 0;

    parsedCategories.forEach(cat => {
      if (!newMapping[cat.id] || !newMapping[cat.id].id) {
        const srcWords = tokenizeAndClean(cat.name);
        if (srcWords.length === 0) return;

        let bestItem: any = null;
        let maxOverlap = 0;
        let bestScore = 0;

        for (const target of tokenizedMkt) {
          let overlap = 0;
          for (const sw of srcWords) {
            if (target.tokens.some(tw => areWordsSimilar(sw, tw))) {
              overlap++;
            }
          }

          if (overlap > 0) {
            const score = overlap / (srcWords.length + target.tokens.length - overlap);
            if (overlap > maxOverlap || (overlap === maxOverlap && score > bestScore)) {
              maxOverlap = overlap;
              bestScore = score;
              bestItem = target;
            }
          }
        }

        if (bestItem && bestScore >= 0.15) {
          newMapping[cat.id] = { id: bestItem.id, name: bestItem.name };
          mappedCount++;
        }
      }
    });

    setFeedCatMapping(newMapping);
    showToast(`🪄 Автоматично співставлено ${mappedCount} категорій!`);
  };

  const onSaveClick = async () => {
    if (!feedName.trim()) {
      showToast("⚠️ Будь ласка, введіть назву фіду");
      return;
    }
    if (!feedSuppliers.length) {
      showToast("⚠️ Потрібно додати хоча б одного постачальника");
      return;
    }
    if (!ghTokenVal.trim()) {
      showToast("🔑 Потрібно підключити токен GitHub у вкладці Профіль");
      return;
    }

    const token = selectedFeed?.token || Math.random().toString(36).substring(2, 15);
    const config: CustomFeed = {
      token,
      name: feedName.trim(),
      format: feedFormat,
      user_id: user?.id,
      suppliers: feedSuppliers,
      rules: feedRules,
      category_mapping: feedCatMapping
    };

    await onSaveFeed(config);
    setIsEditingFeed(false);
    setSelectedFeed(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {!isEditingFeed ? (
        // ── Feeds list view ──
        <div className="card">
          <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-black text-[var(--text)]">Мої об'єднані XML фіди</h2>
              <p className="text-[10px] text-[var(--text2)] mt-0.5 font-semibold">
                Ви можете об'єднувати прайси різних постачальників, застосовувати націнки за діапазонами та налаштовувати фільтри.
              </p>
            </div>
            <button 
              onClick={() => {
                setSelectedFeed(null);
                setFeedName("Новий фід");
                setFeedFormat("prom");
                setFeedSuppliers([]);
                setFeedRules([]);
                setFeedCatMapping({});
                setParsedCategories([]);
                setIsEditingFeed(true);
              }}
              className="gbtn flex items-center gap-1 bg-[var(--accent)] text-white text-xs font-black py-1.5 px-3 rounded-xl hover:opacity-90 animate-pulse"
            >
              <Plus size={14} />
              Створити фід
            </button>
          </div>

          {customFeedsLoading ? (
            <div className="flex items-center justify-center py-10 text-[var(--text2)] text-xs">
              <Loader2 className="animate-spin mr-2" size={16} />
              Завантаження списку фідів...
            </div>
          ) : !customFeeds.length ? (
            <div className="text-center py-12 text-[var(--text2)] text-xs font-semibold">
              <Sliders size={32} className="mx-auto text-[var(--border)] mb-3" />
              У вас поки немає створених фідів. Натисніть кнопку «Створити фід», щоб додати.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text2)] uppercase text-[10px]">
                    <th className="py-2.5 px-3">Назва фіду</th>
                    <th className="py-2.5 px-3">Формат</th>
                    <th className="py-2.5 px-3">Посилання на фід (XML)</th>
                    <th className="py-2.5 px-3 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {customFeeds.map((feed) => {
                    const downloadUrl = `https://lozko1991-blip.github.io/Ypricea/exports/${feed.name}.xml`;
                    return (
                      <tr key={feed.token} className="hover:bg-[var(--surface2)]/50">
                        <td className="py-3 px-3 font-extrabold text-[var(--text)]">{feed.name}</td>
                        <td className="py-3 px-3 uppercase text-[10px] text-[var(--text2)] font-black">{feed.format || 'prom'}</td>
                        <td className="py-3 px-3 text-[var(--text2)]">
                          <div className="flex items-center gap-1.5 max-w-[280px]">
                            <span className="truncate text-[10px] bg-[var(--surface2)] py-1 px-2 rounded-lg border border-[var(--border)]">{downloadUrl}</span>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(downloadUrl);
                                showToast("📋 Посилання скопійовано!");
                              }}
                              className="p-1 hover:text-[var(--accent)]"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleSelectFeedForEditing(feed)}
                              className="gbtn flex items-center gap-1 border border-[var(--border)] py-1 px-2.5 rounded-lg hover:bg-[var(--surface2)]"
                            >
                              <Edit3 size={11} />Редагувати
                            </button>
                            <button 
                              onClick={async () => {
                                if (confirm(`Ви дійсно хочете видалити фід "${feed.name}"?`)) {
                                  await onDeleteFeed(feed.token);
                                }
                              }}
                              className="gbtn flex items-center gap-1 border border-red-500/20 text-red-500 py-1 px-2.5 rounded-lg hover:bg-red-500/5"
                            >
                              <Trash2 size={11} />Видалити
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        // ── Feed edit view ──
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left col: Suppliers list and feed name */}
          <div className="xl:col-span-1 flex flex-col gap-6">
            {/* General Config Card */}
            <div className="card">
              <h3 className="text-sm font-black mb-3">Загальні налаштування фіду</h3>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="font-bold text-xs text-[var(--text2)] mb-1 block">Назва вивантаження</label>
                  <input 
                    type="text" 
                    value={feedName}
                    onChange={(e) => setFeedName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    className="input-field w-full text-xs font-mono" 
                    placeholder="Наприклад: prom_shoes"
                  />
                  <span className="text-[9px] text-[var(--text2)] mt-0.5 block font-semibold">* Тільки малі латинські літери, цифри, дефіс та підкреслення.</span>
                </div>
                <div>
                  <label className="font-bold text-xs text-[var(--text2)] mb-1 block">Формат файлу</label>
                  <select 
                    value={feedFormat}
                    onChange={(e) => setFeedFormat(e.target.value as any)}
                    className="input-field w-full text-xs bg-[var(--surface2)]"
                  >
                    <option value="prom">YML каталог (Prom.ua)</option>
                    <option value="rozetka">Rozetka XML</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Suppliers List Card */}
            <div className="card flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
                <h3 className="text-xs font-black">Джерела прайсів (XML)</h3>
                <button 
                  onClick={() => {
                    const name = prompt("Введіть назву постачальника:");
                    const url = prompt("Введіть URL посилання на XML прайс:");
                    if (name && url) {
                      const updated = [...feedSuppliers, { name, xml_url: url }];
                      setFeedSuppliers(updated);
                      handleParseSupplierCategories(updated.map(s => s.xml_url));
                    }
                  }}
                  className="p-1 hover:text-[var(--accent)] flex items-center gap-0.5 text-[10px] font-black"
                >
                  <Plus size={12} /> Додати
                </button>
              </div>

              {!feedSuppliers.length ? (
                <p className="text-center text-[10px] text-[var(--text2)] py-4">Не додано жодного постачальника</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto noscroll">
                  {feedSuppliers.map((sup, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-[var(--surface2)] border border-[var(--border)] p-2.5 rounded-xl text-[10px] font-bold">
                      <div className="min-w-0 flex-1 mr-2">
                        <span className="block font-extrabold text-[var(--text)] truncate">{sup.name}</span>
                        <span className="block text-[var(--text2)] truncate">{sup.xml_url}</span>
                      </div>
                      <button 
                        onClick={() => {
                          const updated = feedSuppliers.filter((_, i) => i !== idx);
                          setFeedSuppliers(updated);
                          handleParseSupplierCategories(updated.map(s => s.xml_url));
                        }}
                        className="text-red-500 hover:opacity-85 p-1 shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {feedSuppliers.length > 0 && (
                <button 
                  onClick={() => handleParseSupplierCategories(feedSuppliers.map(s => s.xml_url))}
                  disabled={isParsingXml}
                  className="gbtn w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] text-[10px] py-1.5 rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  {isParsingXml && <Loader2 size={12} className="animate-spin" />}
                  Зчитати категорії прайсів
                </button>
              )}
            </div>
          </div>

          {/* Right col: Tabs with category mapping & rules */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            <div className="card flex flex-col gap-4">
              {/* Inner tab selector */}
              <div className="flex border-b border-[var(--border)] gap-4 text-[11px] font-extrabold">
                <button 
                  onClick={() => setActiveRuleTab('markup')}
                  className={`pb-2 border-b-2 transition-colors ${activeRuleTab === 'markup' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)]'}`}
                >
                  Націнки
                </button>
                <button 
                  onClick={() => setActiveRuleTab('filter')}
                  className={`pb-2 border-b-2 transition-colors ${activeRuleTab === 'filter' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)]'}`}
                >
                  Фільтри
                </button>
                <button 
                  onClick={() => setActiveRuleTab('mapping')}
                  className={`pb-2 border-b-2 transition-colors ${activeRuleTab === 'mapping' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)]'}`}
                >
                  Мапінг категорій ({parsedCategories.length})
                </button>
                <button 
                  onClick={() => setActiveRuleTab('other')}
                  className={`pb-2 border-b-2 transition-colors ${activeRuleTab === 'other' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)]'}`}
                >
                  Інші модифікації
                </button>
              </div>

              {/* Rule Panel Views */}
              <div className="min-h-72">
                {/* Markups Rule Builder */}
                {activeRuleTab === 'markup' && (
                  <div className="flex flex-col gap-4">
                    <h4 className="font-extrabold text-xs text-[var(--text)]">Налаштування правил націнки</h4>
                    
                    {/* Active markups list */}
                    <div className="flex flex-col gap-2">
                      {feedRules.filter(r => r.type === 'markup').map((r, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-[var(--surface2)] border border-[var(--border)] p-3 rounded-xl text-[10px] font-bold">
                          <div>
                            <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 mr-2 font-black">📈 НАЦІНКА</span>
                            <span className="text-[var(--text2)]">Діє на:</span> <span className="text-[var(--text)] font-extrabold mr-3 uppercase">{r.scope === 'global' ? '🌐 Глобально' : r.scope === 'category' ? `📂 Категорія ${r.scope_value}` : `🏭 Постачальник ${r.scope_value}`}</span>
                            {r.config.percent !== undefined ? (
                              <span className="text-[var(--text)]">+{r.config.percent}% та +{r.config.fixed || 0} ₴</span>
                            ) : (
                              <span className="text-[var(--text2)]">За діапазонами</span>
                            )}
                          </div>
                          <button 
                            onClick={() => setFeedRules(feedRules.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:opacity-85 p-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Form to add markup rule */}
                    <div className="border border-[var(--border)] p-4 rounded-2xl flex flex-col gap-3 bg-[var(--surface2)]/30 text-xs">
                      <span className="font-extrabold text-[var(--text)] block mb-1">Додати нове правило націнки</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-[var(--text2)] mb-1 block">Область дії</label>
                          <select 
                            onChange={(e) => setNewRuleScope(e.target.value as any)}
                            className="input-field w-full text-xs py-1"
                          >
                            <option value="global">🌐 До всіх товарів фіду</option>
                            <option value="category">📂 Тільки до категорії</option>
                            <option value="supplier">🏭 Тільки до постачальника</option>
                          </select>
                        </div>
                        {newRuleScope !== 'global' && (
                          <div>
                            <label className="font-bold text-[var(--text2)] mb-1 block">Значення області (ID категорії / назва постачальника)</label>
                            <input 
                              type="text" 
                              placeholder={newRuleScope === 'category' ? "напр. u0_12" : "напр. Supplier.xml"}
                              onChange={(e) => setNewRuleScopeValue(e.target.value)}
                              className="input-field w-full text-xs py-1"
                            />
                          </div>
                        )}
                        <div className="col-span-2">
                          <label className="font-bold text-[var(--text2)] mb-1 block">Метод націнки</label>
                          <select 
                            onChange={(e) => {
                              setNewRuleConfig({
                                ...newRuleConfig,
                                markup_type: e.target.value
                              });
                            }}
                            className="input-field w-full text-xs py-1"
                          >
                            <option value="simple">Проста націнка (відсоток + фіксована)</option>
                            <option value="ranges">За ціновими діапазонами</option>
                          </select>
                        </div>

                        {newRuleConfig.markup_type === 'ranges' ? (
                          <div className="col-span-2 border border-[var(--border)] p-3 rounded-xl bg-[var(--surface2)] flex flex-col gap-2">
                            <span className="font-bold text-[var(--text2)] block">Діапазони націнки (собівартість)</span>
                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                              <div className="bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)]">
                                <span className="block font-extrabold text-[var(--text)] mb-1">До 200 ₴</span>
                                <input type="number" placeholder="Націнка %" className="input-field w-full py-1 text-[10px] mb-1" id="r1_pct" />
                                <input type="number" placeholder="Націнка ₴" className="input-field w-full py-1 text-[10px]" id="r1_fxd" />
                              </div>
                              <div className="bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)]">
                                <span className="block font-extrabold text-[var(--text)] mb-1">200 - 1000 ₴</span>
                                <input type="number" placeholder="Націнка %" className="input-field w-full py-1 text-[10px] mb-1" id="r2_pct" />
                                <input type="number" placeholder="Націнка ₴" className="input-field w-full py-1 text-[10px]" id="r2_fxd" />
                              </div>
                              <div className="bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)]">
                                <span className="block font-extrabold text-[var(--text)] mb-1">Понад 1000 ₴</span>
                                <input type="number" placeholder="Націнка %" className="input-field w-full py-1 text-[10px] mb-1" id="r3_pct" />
                                <input type="number" placeholder="Націнка ₴" className="input-field w-full py-1 text-[10px]" id="r3_fxd" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="font-bold text-[var(--text2)] mb-1 block">Націнка %</label>
                              <input type="number" placeholder="напр. 20" className="input-field w-full text-xs py-1" id="sim_pct" />
                            </div>
                            <div>
                              <label className="font-bold text-[var(--text2)] mb-1 block">Націнка ₴</label>
                              <input type="number" placeholder="напр. 50" className="input-field w-full text-xs py-1" id="sim_fxd" />
                            </div>
                          </>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          let configData: any = {};
                          const mType = newRuleConfig.markup_type || 'simple';
                          if (mType === 'ranges') {
                            const r1_pct = Number((document.getElementById("r1_pct") as HTMLInputElement)?.value || 0);
                            const r1_fxd = Number((document.getElementById("r1_fxd") as HTMLInputElement)?.value || 0);
                            const r2_pct = Number((document.getElementById("r2_pct") as HTMLInputElement)?.value || 0);
                            const r2_fxd = Number((document.getElementById("r2_fxd") as HTMLInputElement)?.value || 0);
                            const r3_pct = Number((document.getElementById("r3_pct") as HTMLInputElement)?.value || 0);
                            const r3_fxd = Number((document.getElementById("r3_fxd") as HTMLInputElement)?.value || 0);
                            configData.ranges = [
                              { min: 0, max: 200, percent: r1_pct, fixed: r1_fxd },
                              { min: 200, max: 1000, percent: r2_pct, fixed: r2_fxd },
                              { min: 1000, max: null, percent: r3_pct, fixed: r3_fxd }
                            ];
                          } else {
                            configData.percent = Number((document.getElementById("sim_pct") as HTMLInputElement)?.value || 0);
                            configData.fixed = Number((document.getElementById("sim_fxd") as HTMLInputElement)?.value || 0);
                          }
                          
                          setFeedRules([...feedRules, {
                            type: 'markup',
                            scope: newRuleScope,
                            scope_value: newRuleScopeValue,
                            config: configData
                          }]);
                        }}
                        className="gbtn bg-[var(--accent)] text-white text-[10px] font-black py-1.5 px-3 rounded-xl mt-2 flex items-center justify-center gap-1"
                      >
                        <Plus size={12} /> Додати націнку
                      </button>
                    </div>
                  </div>
                )}

                {/* Filters Rule Builder */}
                {activeRuleTab === 'filter' && (
                  <div className="flex flex-col gap-4">
                    <h4 className="font-extrabold text-xs text-[var(--text)]">Налаштування правил фільтрації товарів</h4>
                    
                    <div className="flex flex-col gap-2">
                      {feedRules.filter(r => r.type === 'filter').map((r, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-[var(--surface2)] border border-[var(--border)] p-3 rounded-xl text-[10px] font-bold">
                          <div>
                            <span className="inline-flex px-1.5 py-0.5 rounded bg-red-50 text-red-600 mr-2 font-black">
                              🚫 ФІЛЬТР
                            </span>
                            <span className="text-[var(--text2)]">Діє на:</span> <span className="text-[var(--text)] mr-3 uppercase">{r.scope === 'global' ? '🌐 Глобально' : r.scope === 'category' ? `📂 Категорія ${r.scope_value}` : `🏭 Постачальник ${r.scope_value}`}</span>
                            <span className="text-slate-700 dark:text-slate-300">
                              {r.config.exclude_out_of_stock && ' [Без наявності]'}
                              {r.config.exclude_no_picture && ' [Без фото]'}
                              {r.config.min_cost_price && ` [Мін.ціна: ${r.config.min_cost_price}₴]`}
                              {r.config.exclude_brands && r.config.exclude_brands.length > 0 && ` [Викл.бренди: ${r.config.exclude_brands.join(', ')}]`}
                              {r.config.stop_words && r.config.stop_words.length > 0 && ` [Стоп-слова: ${r.config.stop_words.join(', ')}]`}
                            </span>
                          </div>
                          <button 
                            onClick={() => setFeedRules(feedRules.filter(rules => rules !== r))}
                            className="text-red-500 hover:opacity-85 p-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="border border-[var(--border)] p-4 rounded-2xl flex flex-col gap-3 bg-[var(--surface2)]/30 text-xs">
                      <span className="font-extrabold text-[var(--text)] block mb-1">Додати нове правило фільтрації</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-[var(--text2)] mb-1 block">Область дії</label>
                          <select onChange={(e) => setNewRuleScope(e.target.value as any)} className="input-field w-full text-xs py-1">
                            <option value="global">🌐 До всіх товарів фіду</option>
                            <option value="category">📂 Тільки до категорії</option>
                            <option value="supplier">🏭 Тільки до постачальника</option>
                          </select>
                        </div>
                        {newRuleScope !== 'global' && (
                          <div>
                            <label className="font-bold text-[var(--text2)] mb-1 block">Значення області (ID категорії / назва постачальника)</label>
                            <input type="text" placeholder={newRuleScope === 'category' ? "напр. u0_12" : "напр. Supplier.xml"} onChange={(e) => setNewRuleScopeValue(e.target.value)} className="input-field w-full text-xs py-1" />
                          </div>
                        )}

                        <div className="col-span-2 grid grid-cols-2 gap-2 mt-2">
                          <label className="flex items-center gap-2 font-bold text-[var(--text)]">
                            <input type="checkbox" id="flt_out_of_stock" className="rounded border-[var(--border)] accent-[var(--accent)]" />
                            Виключити товари не в наявності
                          </label>
                          <label className="flex items-center gap-2 font-bold text-[var(--text)]">
                            <input type="checkbox" id="flt_no_picture" className="rounded border-[var(--border)] accent-[var(--accent)]" />
                            Виключити товари без фото
                          </label>
                        </div>

                        <div className="col-span-2">
                          <label className="font-bold text-[var(--text2)] mb-1 block">Виключити наступні бренди (через кому)</label>
                          <input type="text" placeholder="напр. Nike, Adidas" id="flt_exclude_brands" className="input-field w-full text-xs py-1" />
                        </div>

                        <div>
                          <label className="font-bold text-[var(--text2)] mb-1 block">Виключити товари дешевші за (₴)</label>
                          <input type="number" placeholder="напр. 150" id="flt_min_price" className="input-field w-full text-xs py-1" />
                        </div>
                        <div>
                          <label className="font-bold text-[var(--text2)] mb-1 block">Виключити за стоп-словами у назві/описі (через кому)</label>
                          <input type="text" placeholder="напр. брак, дефект" id="flt_stop_words" className="input-field w-full text-xs py-1" />
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          const exclude_out_of_stock = (document.getElementById("flt_out_of_stock") as HTMLInputElement)?.checked || false;
                          const exclude_no_picture = (document.getElementById("flt_no_picture") as HTMLInputElement)?.checked || false;
                          const min_cost_price = (document.getElementById("flt_min_price") as HTMLInputElement)?.value || '';
                          
                          const brandsText = (document.getElementById("flt_exclude_brands") as HTMLInputElement)?.value || '';
                          const exclude_brands = brandsText.split(',').map(s => s.trim()).filter(Boolean);

                          const stopText = (document.getElementById("flt_stop_words") as HTMLInputElement)?.value || '';
                          const stop_words = stopText.split(',').map(s => s.trim()).filter(Boolean);

                          setFeedRules([...feedRules, {
                            type: 'filter',
                            scope: newRuleScope,
                            scope_value: newRuleScopeValue,
                            config: {
                              exclude_out_of_stock,
                              exclude_no_picture,
                              exclude_brands,
                              min_cost_price,
                              stop_words
                            }
                          }]);
                          showToast("✅ Правило фільтрації додано");
                        }}
                        className="gbtn bg-[var(--accent)] text-white text-[10px] font-black py-1.5 px-3 rounded-xl mt-2 flex items-center justify-center gap-1"
                      >
                        <Plus size={12} /> Додати фільтр
                      </button>
                    </div>
                  </div>
                )}

                {/* Category Mapping Editor */}
                {activeRuleTab === 'mapping' && (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <h4 className="font-extrabold text-xs text-[var(--text)]">Мапінг оригінальних категорій на Prom.ua / Rozetka</h4>
                      <div className="flex items-center gap-3">
                        {parsedCategories.length > 0 && (
                          <button 
                            disabled={loadingMktCategories}
                            onClick={handleClientAutoMap}
                            className="gbtn border border-[var(--accent)] text-[var(--accent)] text-[9px] font-black py-1 px-3.5 rounded-lg hover:bg-[var(--accent)] hover:text-white transition-all flex items-center gap-1.5"
                          >
                            {loadingMktCategories ? (
                              <>
                                <Loader2 className="animate-spin" size={10} />
                                Завантаження бази...
                              </>
                            ) : (
                              '🪄 Автомапінг (Fuzzy)'
                            )}
                          </button>
                        )}
                        <span className="text-[10px] font-bold text-[var(--text2)]">Категорій постачальників: {parsedCategories.length}</span>
                      </div>
                    </div>

                    {/* Categories Filter Tabs for Super Fast Matching */}
                    {parsedCategories.length > 0 && (
                      <div className="flex gap-1 bg-[var(--surface2)]/60 p-1 rounded-xl border border-[var(--border)] max-w-sm text-[10px] font-bold mt-2">
                        <button 
                          type="button"
                          onClick={() => setMappingFilter('all')}
                          className={`px-3 py-1 rounded-lg font-black transition-all ${mappingFilter === 'all' ? 'bg-purple-600 text-white shadow shadow-purple-600/10' : 'text-[var(--text2)] hover:text-[var(--text)]'}`}
                        >
                          Всі ({parsedCategories.length})
                        </button>
                        <button 
                          type="button"
                          onClick={() => setMappingFilter('unmapped')}
                          className={`px-3 py-1 rounded-lg font-black transition-all ${mappingFilter === 'unmapped' ? 'bg-orange-600 text-white shadow shadow-orange-600/10' : 'text-[var(--text2)] hover:text-[var(--text)]'}`}
                        >
                          Не співставлені ({parsedCategories.filter(c => !feedCatMapping[c.id]?.id).length})
                        </button>
                        <button 
                          type="button"
                          onClick={() => setMappingFilter('mapped')}
                          className={`px-3 py-1 rounded-lg font-black transition-all ${mappingFilter === 'mapped' ? 'bg-green-600 text-white shadow shadow-green-600/10' : 'text-[var(--text2)] hover:text-[var(--text)]'}`}
                        >
                          Співставлені ({parsedCategories.filter(c => !!feedCatMapping[c.id]?.id).length})
                        </button>
                      </div>
                    )}
                    
                    {!filteredCategories.length ? (
                      <p className="text-center text-[10px] text-[var(--text2)] py-8 font-semibold">
                        {parsedCategories.length 
                          ? 'Немає категорій, що відповідають вибраному фільтру.' 
                          : 'Категорії ще не зчитано. Додайте джерела прайсів та натисніть кнопку «Зчитати категорії прайсів» зліва.'}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1 noscroll border border-[var(--border)] p-3 rounded-2xl bg-[var(--surface2)]/20">
                        {filteredCategories.map((cat) => {
                          const origFullId = cat.id;
                          const currentMap = feedCatMapping[origFullId] || { id: '', name: '' };
                          const isShowingSuggestions = activeRowSuggestions === origFullId;
                          
                          return (
                            <div key={origFullId} className="flex flex-col gap-2 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[10px] font-bold transition-all hover:border-[var(--border-hover)]">
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                                <div className="md:col-span-2 min-w-0">
                                  <span className="inline-block px-1 py-0.5 rounded bg-[var(--surface2)] border border-[var(--border)] text-[var(--text2)] text-[9px] mr-1.5 font-bold uppercase truncate max-w-[80px]">{cat.srcName}</span>
                                  <span className="text-[var(--text)] font-extrabold">{cat.name}</span>
                                  <span className="block text-[var(--text2)] text-[9px] mt-0.5">
                                    ID: {cat.id} • {currentMap.id ? (
                                      <span className="text-green-500 font-extrabold uppercase text-[8px] bg-green-500/10 px-1 py-0.5 rounded ml-1">✓ Співставлено</span>
                                    ) : (
                                      <span className="text-orange-500 font-extrabold uppercase text-[8px] bg-orange-500/10 px-1 py-0.5 rounded ml-1">⚠️ Потрібен вибір</span>
                                    )}
                                  </span>
                                </div>
                                <div className="md:col-span-3 flex gap-2 items-center">
                                  <input 
                                    type="text" 
                                    placeholder="ID"
                                    value={currentMap.id}
                                    onChange={(e) => {
                                      setFeedCatMapping({
                                        ...feedCatMapping,
                                        [origFullId]: { ...currentMap, id: e.target.value }
                                      });
                                    }}
                                    className="input-field text-[10px] py-1.5 px-2 w-[70px] text-center"
                                  />
                                  <input 
                                    type="text" 
                                    list="mkt-cats-list"
                                    placeholder="Цільова Назва 🔍"
                                    value={currentMap.name}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const found = marketplaceCategories.find(c => c.name === val);
                                      setFeedCatMapping({
                                        ...feedCatMapping,
                                        [origFullId]: { 
                                          id: found ? found.id : currentMap.id, 
                                          name: val 
                                        }
                                      });
                                    }}
                                    className="input-field text-[10px] py-1.5 px-2 flex-1"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveRowSuggestions(isShowingSuggestions ? null : origFullId);
                                      setSuggestionSearchQuery('');
                                    }}
                                    className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                                      isShowingSuggestions 
                                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20' 
                                        : 'bg-[var(--surface2)] border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] hover:border-[var(--border-hover)]'
                                    }`}
                                    title="Підібрати категорію з бази"
                                  >
                                    <Sparkles size={12} className={isShowingSuggestions ? 'animate-pulse' : ''} />
                                  </button>
                                </div>
                              </div>

                              {/* Suggestions Box */}
                              {isShowingSuggestions && (
                                <div className="mt-2 p-3 bg-[var(--surface2)] border border-purple-500/20 rounded-lg flex flex-col gap-3">
                                  {/* Top 5 Recommendations */}
                                  <div>
                                    <span className="text-[10px] text-[var(--text2)] uppercase font-extrabold flex items-center gap-1">
                                      ✨ Рекомендовані відповідності
                                    </span>
                                    <div className="grid grid-cols-1 gap-1.5 mt-1.5">
                                      {(() => {
                                        const srcWords = tokenizeAndClean(cat.name);
                                        const recs: Array<{ id: string; name: string; score: number }> = [];
                                        
                                        if (srcWords.length > 0) {
                                          for (const target of marketplaceCategories) {
                                            const targetWords = tokenizeAndClean(target.name);
                                            let overlap = 0;
                                            for (const sw of srcWords) {
                                              if (targetWords.some(tw => areWordsSimilar(sw, tw))) {
                                                overlap++;
                                              }
                                            }
                                            if (overlap > 0) {
                                              const score = overlap / (srcWords.length + targetWords.length - overlap);
                                              recs.push({ id: target.id, name: target.name, score });
                                            }
                                          }
                                        }
                                        
                                        const topRecs = recs
                                          .sort((a, b) => b.score - a.score)
                                          .slice(0, 5);
                                          
                                        if (topRecs.length === 0) {
                                          return <span className="text-[10px] text-[var(--text3)] italic p-1">Немає автоматичних рекомендацій. Скористайтеся швидким пошуком нижче.</span>;
                                        }
                                        
                                        return topRecs.map(rec => (
                                          <button
                                            type="button"
                                            key={rec.id}
                                            onClick={() => {
                                              handleMapSelect(origFullId, rec.id, rec.name);
                                            }}
                                            className="w-full text-left p-1.5 hover:bg-[var(--surface)] border border-[var(--border)] rounded text-[10px] flex justify-between items-center transition-all hover:border-purple-500/30"
                                          >
                                            <span className="text-[11px] text-[var(--text)] font-semibold">{rec.name}</span>
                                            <span className="text-[9px] text-purple-400 font-extrabold uppercase bg-purple-500/10 px-1.5 py-0.5 rounded">
                                              {(rec.score * 100).toFixed(0)}% збіг
                                            </span>
                                          </button>
                                        ));
                                      })()}
                                    </div>
                                  </div>
                                  
                                  {/* Quick Manual Search */}
                                  <div className="border-t border-[var(--border)] pt-2">
                                    <span className="text-[10px] text-[var(--text2)] uppercase font-extrabold flex items-center gap-1">
                                      🔍 Швидкий пошук у всій базі
                                    </span>
                                    <input
                                      type="text"
                                      placeholder="Введіть назву категорії для пошуку..."
                                      value={suggestionSearchQuery}
                                      onChange={(e) => setSuggestionSearchQuery(e.target.value)}
                                      className="input-field text-[11px] py-1.5 px-3 w-full mt-1.5 bg-[var(--surface)] border-[var(--border)]"
                                    />
                                    {suggestionSearchQuery.trim().length >= 2 && (
                                      <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto mt-1.5 border border-[var(--border)] rounded-md bg-[var(--surface)]">
                                        {(() => {
                                          const query = suggestionSearchQuery.toLowerCase();
                                          const results = marketplaceCategories.filter(c => 
                                            c.name.toLowerCase().includes(query) || c.id.includes(query)
                                          ).slice(0, 10);
                                          
                                          if (results.length === 0) {
                                            return <span className="text-[10px] p-2 text-[var(--text3)] italic">Нічого не знайдено</span>;
                                          }
                                          
                                          return results.map(res => (
                                            <button
                                              type="button"
                                              key={res.id}
                                              onClick={() => {
                                                handleMapSelect(origFullId, res.id, res.name);
                                              }}
                                              className="w-full text-left p-1.5 hover:bg-[var(--surface-hover)] text-[10px] border-b border-[var(--border)] last:border-b-0 flex justify-between items-center transition-all"
                                            >
                                              <span className="text-[11px] text-[var(--text)]">{res.name}</span>
                                              <span className="text-[9px] text-[var(--text2)] font-mono">ID: {res.id}</span>
                                            </button>
                                          ));
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        {/* Reference Marketplace Categories Autocomplete DataList */}
                        <datalist id="mkt-cats-list">
                          {marketplaceCategories.map(c => (
                            <option key={`${c.id}-${c.name}`} value={c.name}>
                              {c.name} (ID: {c.id})
                            </option>
                          ))}
                        </datalist>
                      </div>
                    )}
                  </div>
                )}

                {/* Other settings tab */}
                {activeRuleTab === 'other' && (
                  <div className="flex flex-col gap-4">
                    <h4 className="font-extrabold text-xs text-[var(--text)]">Додаткові налаштування та модифікації товарів</h4>
                    
                    <div className="flex flex-col gap-2">
                      {feedRules.filter(r => ['replace', 'brand', 'custom_params', 'photo_order', 'fallback_params'].includes(r.type)).map((rule, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-[var(--surface2)] border border-[var(--border)] py-2 px-3 rounded-xl text-[10px] font-semibold">
                          {rule.type === 'replace' && (
                            <span>Замінити <strong className="text-[var(--text)]">"{rule.config.search}"</strong> на <strong className="text-[var(--text)]">"{rule.config.replace}"</strong></span>
                          )}
                          {rule.type === 'brand' && (
                            <span>Заміна пустого бренду на: <strong className="text-[var(--text)]">{rule.config.default_brand}</strong></span>
                          )}
                          {rule.type === 'photo_order' && (
                            <span>Сортування фото: <strong className="text-[var(--text)]">{rule.config.photo_order_mode === 'reverse' ? 'Зворотне' : 'Останнє першим'}</strong></span>
                          )}
                          {rule.type === 'custom_params' && (
                            <span>Свої параметри: <strong className="text-[var(--text)]">{(rule.config.custom_param_name || []).join(', ')}</strong></span>
                          )}
                          {rule.type === 'fallback_params' && (
                            <span>Резервні параметри якщо менше {rule.config.fallback_min_count} шт.</span>
                          )}
                          <button 
                            onClick={() => {
                              setFeedRules(feedRules.filter(r => r !== rule));
                            }}
                            className="text-red-500 hover:opacity-75"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Search and Replace Box */}
                      <div className="bg-[var(--surface2)]/30 border border-[var(--border)] p-4 rounded-2xl flex flex-col gap-3 text-xs font-bold">
                        <span className="text-[var(--text)] block font-extrabold">🔍 Пошук та заміна тексту</span>
                        <div className="flex flex-col gap-2">
                          <input type="text" placeholder="Текст для пошуку (напр. 'купити оптом')" id="oth_search" className="input-field text-xs py-1 w-full" />
                          <input type="text" placeholder="Замінити на (напр. 'UTRADE')" id="oth_replace" className="input-field text-xs py-1 w-full" />
                        </div>
                        <button
                          onClick={() => {
                            const search = (document.getElementById("oth_search") as HTMLInputElement)?.value || '';
                            const replace = (document.getElementById("oth_replace") as HTMLInputElement)?.value || '';
                            if (!search.trim()) {
                              showToast("⚠️ Введіть текст для пошуку");
                              return;
                            }
                            setFeedRules([...feedRules, {
                              type: 'replace',
                              scope: 'global',
                              config: { search, replace }
                            }]);
                            showToast("✅ Заміна тексту додана");
                          }}
                          className="gbtn bg-[var(--accent)] text-white text-[10px] font-black py-1.5 px-3 rounded-lg mt-1"
                        >
                          Додати заміну
                        </button>
                      </div>

                      {/* Brand settings */}
                      <div className="bg-[var(--surface2)]/30 border border-[var(--border)] p-4 rounded-2xl flex flex-col gap-3 text-xs font-bold">
                        <span className="text-[var(--text)] block font-extrabold">🏷️ Бренд за замовчуванням</span>
                        <input type="text" placeholder="Назва бренду (якщо пустий)" id="oth_default_brand" className="input-field text-xs py-1 w-full" />
                        <button
                          onClick={() => {
                            const default_brand = (document.getElementById("oth_default_brand") as HTMLInputElement)?.value || '';
                            if (!default_brand.trim()) {
                              showToast("⚠️ Вкажіть назву бренду");
                              return;
                            }
                            setFeedRules([...feedRules, {
                              type: 'brand',
                              scope: 'global',
                              config: { default_brand }
                            }]);
                            showToast("✅ Бренд за замовчуванням додано");
                          }}
                          className="gbtn bg-[var(--accent)] text-white text-[10px] font-black py-1.5 px-3 rounded-lg mt-1"
                        >
                          Впровадити бренд
                        </button>
                      </div>

                      {/* Photo sorting */}
                      <div className="bg-[var(--surface2)]/30 border border-[var(--border)] p-4 rounded-2xl flex flex-col gap-3 text-xs font-bold">
                        <span className="text-[var(--text)] block font-extrabold">📷 Порядок фотографій</span>
                        <select id="oth_photo_order_mode" className="input-field text-xs py-1 w-full">
                          <option value="reverse">Зворотний порядок фото</option>
                          <option value="last_to_first">Останнє фото зробити головним (першим)</option>
                        </select>
                        <button
                          onClick={() => {
                            const photo_order_mode = (document.getElementById("oth_photo_order_mode") as HTMLSelectElement)?.value as any;
                            setFeedRules([...feedRules, {
                              type: 'photo_order',
                              scope: 'global',
                              config: { photo_order_mode }
                            }]);
                            showToast("✅ Правило сортування фото додано");
                          }}
                          className="gbtn bg-[var(--accent)] text-white text-[10px] font-black py-1.5 px-3 rounded-lg mt-1"
                        >
                          Впровадити порядок фото
                        </button>
                      </div>

                      {/* Custom parameter injection */}
                      <div className="bg-[var(--surface2)]/30 border border-[var(--border)] p-4 rounded-2xl flex flex-col gap-3 text-xs font-bold">
                        <span className="text-[var(--text)] block font-extrabold">🛠️ Власні параметри товару</span>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Назва (напр. 'Країна')" id="oth_param_name" className="input-field text-xs py-1" />
                          <input type="text" placeholder="Значення (напр. 'Україна')" id="oth_param_value" className="input-field text-xs py-1" />
                        </div>
                        <button
                          onClick={() => {
                            const name = (document.getElementById("oth_param_name") as HTMLInputElement)?.value || '';
                            const value = (document.getElementById("oth_param_value") as HTMLInputElement)?.value || '';
                            if (!name.trim() || !value.trim()) {
                              showToast("⚠️ Введіть назву та значення параметра");
                              return;
                            }
                            setFeedRules([...feedRules, {
                              type: 'custom_params',
                              scope: 'global',
                              config: {
                                custom_param_name: [name],
                                custom_param_value: [value]
                              }
                            }]);
                            showToast("✅ Параметр додано");
                          }}
                          className="gbtn bg-[var(--accent)] text-white text-[10px] font-black py-1.5 px-3 rounded-lg mt-1"
                        >
                          Додати параметр
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Save bar */}
              <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4 mt-2">
                <button 
                  onClick={() => {
                    setIsEditingFeed(false);
                    setSelectedFeed(null);
                  }}
                  className="gbtn border border-[var(--border)] text-[var(--text)] text-xs font-black py-2 px-5 rounded-xl hover:bg-[var(--surface2)]"
                >
                  Скасувати
                </button>
                <button 
                  onClick={onSaveClick}
                  disabled={savingFeed}
                  className="gbtn bg-[var(--accent)] text-white text-xs font-black py-2 px-6 rounded-xl hover:opacity-90 flex items-center gap-1.5"
                >
                  {savingFeed ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Збереження...
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      Зберегти зміни
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
