import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Sliders, 
  Loader2, 
  Save 
} from 'lucide-react';
import type { CustomFeed, FeedSupplier, FeedRule } from './CabinetTypes';

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
  
  // Category parsing states
  const [parsedCategories, setParsedCategories] = useState<any[]>([]);
  const [isParsingXml, setIsParsingXml] = useState(false);
  const [activeRuleTab, setActiveRuleTab] = useState<'markup' | 'filter' | 'mapping' | 'other'>('markup');

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
        const res = await fetch(`${window.location.origin}${import.meta.env.BASE_URL}presets/user-feed-${feed.token}.json?_=${timestamp}`);
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
                      {feedRules.filter(r => r.type === 'filter_exclude' || r.type === 'filter_include').map((r, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-[var(--surface2)] border border-[var(--border)] p-3 rounded-xl text-[10px] font-bold">
                          <div>
                            <span className={`inline-flex px-1.5 py-0.5 rounded ${
                              r.type === 'filter_exclude' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                            } mr-2 font-black`}>
                              {r.type === 'filter_exclude' ? '🚫 ВИКЛЮЧИТИ' : '✅ ВКЛЮЧИТИ'}
                            </span>
                            <span className="text-[var(--text2)]">Діє на:</span> <span className="text-[var(--text)] mr-3 uppercase">{r.scope === 'global' ? '🌐 Глобально' : r.scope === 'category' ? `📂 Категорія ${r.scope_value}` : `🏭 Постачальник ${r.scope_value}`}</span>
                            <span className="text-red-500 font-extrabold">
                              {r.config.keywords ? `Ключові слова: ${r.config.keywords.join(', ')}` : 'Всі товари'}
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
                        <div className="col-span-2">
                          <label className="font-bold text-[var(--text2)] mb-1 block">Дія правила</label>
                          <select 
                            onChange={(e) => {
                              setNewRuleConfig({
                                ...newRuleConfig,
                                filter_action: e.target.value
                              });
                            }}
                            className="input-field w-full text-xs py-1"
                          >
                            <option value="exclude">Видалити товари за ключовими словами</option>
                            <option value="include">Залишити ТІЛЬКИ товари за ключовими словами</option>
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="font-bold text-[var(--text2)] mb-1 block">Ключові слова (через кому, напр. Б/У, копія, уцінка)</label>
                          <input type="text" placeholder="уцінка, брак, дефект" id="flt_keywords" className="input-field w-full text-xs py-1" />
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          const text = (document.getElementById("flt_keywords") as HTMLInputElement)?.value || '';
                          const keywords = text.split(',').map(s => s.trim()).filter(Boolean);
                          if (!keywords.length) {
                            showToast("⚠️ Будь ласка, введіть ключові слова");
                            return;
                          }

                          const type = (newRuleConfig.filter_action || 'exclude') === 'exclude' ? 'filter_exclude' : 'filter_include';
                          setFeedRules([...feedRules, {
                            type,
                            scope: newRuleScope,
                            scope_value: newRuleScopeValue,
                            config: { keywords }
                          }]);
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
                      <span className="text-[10px] font-bold text-[var(--text2)]">Категорій постачальників: {parsedCategories.length}</span>
                    </div>
                    
                    {!parsedCategories.length ? (
                      <p className="text-center text-[10px] text-[var(--text2)] py-8 font-semibold">
                        Категорії ще не зчитано. Додайте джерела прайсів та натисніть кнопку «Зчитати категорії прайсів» зліва.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1 noscroll border border-[var(--border)] p-3 rounded-2xl bg-[var(--surface2)]/20">
                        {parsedCategories.map((cat) => {
                          const origFullId = cat.id;
                          const currentMap = feedCatMapping[origFullId] || { id: '', name: '' };
                          return (
                            <div key={origFullId} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 items-center bg-[var(--surface)] border border-[var(--border)] p-2.5 rounded-xl text-[10px] font-bold">
                              <div className="md:col-span-2 min-w-0">
                                <span className="inline-block px-1 py-0.5 rounded bg-[var(--surface2)] border border-[var(--border)] text-[var(--text2)] text-[9px] mr-1.5 font-bold uppercase truncate max-w-[80px]">{cat.srcName}</span>
                                <span className="text-[var(--text)] font-extrabold">{cat.name}</span>
                                <span className="block text-[var(--text2)] text-[9px]">ID: {cat.id}</span>
                              </div>
                              <div className="md:col-span-3 grid grid-cols-2 gap-2">
                                <input 
                                  type="text" 
                                  placeholder="Цільовий ID"
                                  value={currentMap.id}
                                  onChange={(e) => {
                                    setFeedCatMapping({
                                      ...feedCatMapping,
                                      [origFullId]: { ...currentMap, id: e.target.value }
                                    });
                                  }}
                                  className="input-field text-[10px] py-1 px-2 w-full"
                                />
                                <input 
                                  type="text" 
                                  placeholder="Цільова Назва"
                                  value={currentMap.name}
                                  onChange={(e) => {
                                    setFeedCatMapping({
                                      ...feedCatMapping,
                                      [origFullId]: { ...currentMap, name: e.target.value }
                                    });
                                  }}
                                  className="input-field text-[10px] py-1 px-2 w-full"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Other settings tab */}
                {activeRuleTab === 'other' && (
                  <div className="flex flex-col gap-4">
                    <h4 className="font-extrabold text-xs text-[var(--text)]">Пошук та заміна тексту в назвах / описах товарів</h4>
                    
                    <div className="flex flex-col gap-2">
                      {feedRules.filter(r => r.type === 'replace_text' || r.type === 'stopwords').map((rule, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-[var(--surface2)] border border-[var(--border)] py-2 px-3 rounded-xl text-[10px] font-semibold">
                          {rule.type === 'replace_text' ? (
                            <span>Замінити <strong className="text-[var(--text)]">"{rule.config.search_text}"</strong> на <strong className="text-[var(--text)]">"{rule.config.replace_text}"</strong></span>
                          ) : (
                            <span>Стоп-слова для видалення: <strong className="text-[var(--text)]">{(rule.config.keywords || []).join(', ')}</strong></span>
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
                          <input type="text" placeholder="Текст для пошуку (напр. 'купити оптом')" id="oth_search_text" className="input-field text-xs py-1 w-full" />
                          <input type="text" placeholder="Замінити на (напр. 'UTRADE')" id="oth_replace_text" className="input-field text-xs py-1 w-full" />
                        </div>
                        <button
                          onClick={() => {
                            const search = (document.getElementById("oth_search_text") as HTMLInputElement)?.value || '';
                            const replace = (document.getElementById("oth_replace_text") as HTMLInputElement)?.value || '';
                            if (!search.trim()) {
                              showToast("⚠️ Введіть текст для пошуку");
                              return;
                            }
                            setFeedRules([...feedRules, {
                              type: 'replace_text',
                              scope: 'global',
                              config: { search_text: search, replace_text: replace }
                            }]);
                            showToast("✅ Заміна тексту додана");
                          }}
                          className="gbtn bg-[var(--accent)] text-white text-[10px] font-black py-1.5 px-3 rounded-lg mt-1"
                        >
                          Додати заміну
                        </button>
                      </div>

                      {/* Stopwords Box */}
                      <div className="bg-[var(--surface2)]/30 border border-[var(--border)] p-4 rounded-2xl flex flex-col gap-3 text-xs font-bold justify-between">
                        <div>
                          <span className="text-[var(--text)] block font-extrabold">🚫 Глобальні стоп-слова</span>
                          <p className="text-[9px] text-[var(--text2)] mt-0.5">Будь-які товари, назва яких містить ці слова, будуть автоматично видалені.</p>
                          <input type="text" placeholder="напр. б/у, брак, копія (через кому)" id="oth_stopwords" className="input-field text-xs py-1 w-full mt-2" />
                        </div>
                        <button
                          onClick={() => {
                            const text = (document.getElementById("oth_stopwords") as HTMLInputElement)?.value || '';
                            const list = text.split(',').map(s => s.trim()).filter(Boolean);
                            if (!list.length) {
                              showToast("⚠️ Введіть стоп-слова");
                              return;
                            }
                            setFeedRules([...feedRules, {
                              type: 'stopwords',
                              scope: 'global',
                              config: { keywords: list }
                            }]);
                            showToast("✅ Стоп-слова додані");
                          }}
                          className="gbtn bg-[var(--accent)] text-white text-[10px] font-black py-1.5 px-3 rounded-lg mt-2"
                        >
                          Впровадити стоп-слова
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
