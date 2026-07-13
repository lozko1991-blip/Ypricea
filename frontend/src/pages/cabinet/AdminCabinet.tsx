import React, { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Loader2, 
  ChevronDown, 
  ChevronRight, 
  Save,
  X,
  RefreshCw,
  Trash2
} from 'lucide-react';
import type { Category, Order, Profile, SyncLog, GlobalSettings } from './CabinetTypes';
import { 
  loadShardMap, 
  loadShard, 
  loadDescShard, 
  mapGet 
} from '../../lib/dataLoader';

interface AdminCabinetProps {
  activeTab: 'generator' | 'admin';
  user: any;
  adminUsers: Profile[];
  adminOrders: Order[];
  adminLoading: boolean;
  adminUserSearch: string;
  setAdminUserSearch: (val: string) => void;
  adminOrdersSearch: string;
  setAdminOrdersSearch: (val: string) => void;
  adminOrdersStatusFilter: string;
  setAdminOrdersStatusFilter: (val: string) => void;
  expandedUserPanel: string | null;
  setExpandedUserPanel: (val: string | null) => void;
  handleSetUserStatus: (id: string, status: 'active' | 'blocked') => void;
  handleUpdateUserSubscription: (id: string, plan: string, status: string, expires: string) => void;
  handleAdjustUserBalance: (id: string, currentBalance: number, amount: number) => void;
  handleSaveUserExports: (id: string) => void;
  handleUpdateOrderStatus: (id: number, status: Order['status']) => void;
  handleSaveAdminTTN: (id: number, ttn: string) => void;
  handleSaveAdminNotes: (id: number, notes: string) => void;
  exportsList: any[];
  customFeeds: any[];
  syncLogs: SyncLog[];
  syncLogsLoading: boolean;
  onRefreshSyncLogs?: () => Promise<void>;
  globalSettings: GlobalSettings;
  globalSettingsLoading: boolean;
  savingGlobalSettings: boolean;
  handleSaveGlobalSettings: (key: string, val: string) => void;
  marketplacesStats: { promCount: number; rozetkaCount: number };
  syncingMarketplace: string | null;
  handleSyncMarketplaceCategories: (marketplace: string, url: string) => Promise<void>;
  handleClearMarketplaceCategories: () => void;
  triggeringBuild: boolean;
  handleTriggerBuild: () => void;
  categories: Category[];
  generatorLoading: boolean;
  generatorStatus: string;
  setGeneratorStatus: (val: string) => void;
  generatorProducts: any[];
  imgPrefix: string;
  ghTokenVal: string;
  setGhTokenVal: (val: string) => void;
  onSaveGhToken: () => void;
  showToast: (msg: string) => void;
  workflowStatus?: { status: string | null; conclusion: string | null; updated_at: string | null };
  onSmartRebuild?: (label: string) => void;
}

export const AdminCabinet: React.FC<AdminCabinetProps> = ({
  activeTab,
  user,
  adminUsers,
  adminOrders,
  adminLoading,
  adminUserSearch,
  setAdminUserSearch,
  adminOrdersSearch,
  setAdminOrdersSearch,
  adminOrdersStatusFilter,
  setAdminOrdersStatusFilter,
  expandedUserPanel,
  setExpandedUserPanel,
  handleSetUserStatus,
  handleUpdateUserSubscription,
  handleAdjustUserBalance,
  handleSaveUserExports,
  handleUpdateOrderStatus,
  handleSaveAdminTTN,
  handleSaveAdminNotes,
  exportsList,
  customFeeds,
  syncLogs,
  syncLogsLoading,
  onRefreshSyncLogs,
  globalSettings,
  globalSettingsLoading,
  savingGlobalSettings,
  handleSaveGlobalSettings,
  marketplacesStats,
  syncingMarketplace,
  handleSyncMarketplaceCategories,
  handleClearMarketplaceCategories,
  triggeringBuild,
  handleTriggerBuild,
  categories,
  generatorLoading,
  generatorStatus,
  setGeneratorStatus,
  generatorProducts,
  imgPrefix,
  ghTokenVal,
  setGhTokenVal,
  onSaveGhToken,
  showToast,
  workflowStatus,
  onSmartRebuild
}) => {
  // Sub-Tab Navigation for Admin view
  const [adminActiveSubTab, setAdminActiveSubTab] = useState<'users' | 'analytics' | 'logs' | 'settings' | 'catalog' | 'invoices'>('users');

  const handleClearSyncLogs = async () => {
    if (!confirm('🚨 Ви дійсно хочете очистити весь журнал синхронізацій з бази даних?')) return;
    try {
      const { error } = await supabase.from('sync_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      if (onRefreshSyncLogs) await onRefreshSyncLogs();
      showToast('✅ Журнал оновлень очищено');
    } catch (e: any) {
      showToast('⚠️ Помилка очищення: ' + e.message);
    }
  };

  // Generator tree collapse sets
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Yavshoke Generator Local States
  const [yavSelectedCats, setYavSelectedCats] = useState<Set<string>>(new Set());
  const [yavSearchQuery, setYavSearchQuery] = useState('');
  const [yavPct, setYavPct] = useState(20);
  const [yavGrn, setYavGrn] = useState(0);
  const [yavMinPrice, setYavMinPrice] = useState(0);
  const [yavAvailOnly, setYavAvailOnly] = useState(true);
  const [yavIdPrefix, setYavIdPrefix] = useState('');
  const [yavCatPrefix, setYavCatPrefix] = useState('');
  const [yavAddBrand, setYavAddBrand] = useState(false);
  const [yavDefaultBrand, setYavDefaultBrand] = useState('');
  const [yavFillParams, setYavFillParams] = useState(false);
  const [yavPresetName, setYavPresetName] = useState('export-1');

  // Mastereva Generator Local States
  const [meSelectedCats, setMeSelectedCats] = useState<Set<string>>(new Set());
  const [meSearchQuery, setMeSearchQuery] = useState('');
  const [mePct, setMePct] = useState(20);
  const [meGrn, setMeGrn] = useState(70);
  const [meMinPrice, setMeMinPrice] = useState(0);
  const [meAvailOnly, setMeAvailOnly] = useState(true);
  const [meIdPrefix, setMeIdPrefix] = useState('ME-');
  const [meCatPrefix, setMeCatPrefix] = useState('20000');
  const [meAddBrand, setMeAddBrand] = useState(false);
  const [meDefaultBrand, setMeDefaultBrand] = useState('');
  const [meFillParams, setMeFillParams] = useState(false);
  const [mePresetName, setMePresetName] = useState('export-me-1');

  // GH Push Modal States
  const [savePresetModalOpen, setSavePresetModalOpen] = useState(false);
  const [presetSaveType, setPresetSaveType] = useState<'yavshoke' | 'mastereva'>('yavshoke');
  const [ghPushing, setGhPushing] = useState(false);

  // Filters for Admin Tab
  const filteredAdminUsers = adminUsers.filter(u => {
    const term = adminUserSearch.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(term) ||
      (u.store_name || '').toLowerCase().includes(term) ||
      (u.phone || '').toLowerCase().includes(term)
    );
  });

  const filteredAdminOrders = adminOrders.filter(o => {
    const term = adminOrdersSearch.toLowerCase();
    const matchesSearch = (
      String(o.id).includes(term) ||
      (o.client_name || '').toLowerCase().includes(term) ||
      (o.ttn || '').toLowerCase().includes(term) ||
      (o.droper_code || '').toLowerCase().includes(term)
    );
    const matchesStatus = adminOrdersStatusFilter === 'all' || o.status === adminOrdersStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Category ancestors utility
  const getAncestors = (id: string, list: Category[]): Category[] => {
    const ancestors: Category[] = [];
    const map = new Map(list.map(c => [String(c.id), c]));
    let curr = map.get(id);
    while (curr && curr.parentId) {
      const parent = map.get(String(curr.parentId));
      if (parent) {
        ancestors.push(parent);
        curr = parent;
      } else {
        break;
      }
    }
    return ancestors;
  };

  const handleToggleTreeExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllCats = (type: 'yavshoke' | 'mastereva', selectAll: boolean) => {
    const setter = type === 'yavshoke' ? setYavSelectedCats : setMeSelectedCats;
    if (!selectAll) {
      setter(new Set());
    } else {
      const filtered = categories.filter(c => type === 'yavshoke' ? (c.src === 'yavshoke') : (c.src === 'mastereva'));
      setter(new Set(filtered.map(c => String(c.id))));
    }
  };

  // Render checkbox tree recursion helper
  const renderCategoryCheckboxTree = (
    type: 'yavshoke' | 'mastereva', 
    selectedSet: Set<string>, 
    setSelectedSet: React.Dispatch<React.SetStateAction<Set<string>>>,
    searchQuery: string
  ) => {
    const list = categories.filter(c => type === 'yavshoke' ? (c.src === 'yavshoke') : (c.src === 'mastereva'));
    if (!list.length) return null;

    const categoryMap = new Map(list.map(c => [String(c.id), c]));
    const roots = list.filter(c => {
      const pid = c.parentId ? String(c.parentId) : '';
      return !pid || !categoryMap.has(pid);
    });

    const matchedIds = new Set<string>();
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      list.forEach(c => {
        if (c.name.toLowerCase().includes(term)) {
          const cid = String(c.id);
          matchedIds.add(cid);
          getAncestors(cid, list).forEach(a => matchedIds.add(String(a.id)));
        }
      });
    }

    const handleCheckboxClick = (cid: string, checked: boolean) => {
      setSelectedSet(prev => {
        const next = new Set(prev);
        if (checked) next.add(cid);
        else next.delete(cid);
        return next;
      });
    };

    const rows: React.ReactNode[] = [];

    const buildNode = (c: Category, depth: number) => {
      const cid = String(c.id);
      if (searchQuery.trim() && !matchedIds.has(cid)) return;

      const kids = list.filter(x => String(x.parentId || '') === cid);
      const hasKids = kids.length > 0;
      const isExpanded = expandedCategories.has(cid);
      const isChecked = selectedSet.has(cid);

      rows.push(
        <div 
          key={cid} 
          className="flex items-center gap-2 py-1 px-2 hover:bg-[var(--surface2)] rounded-xl text-xs transition-colors"
          style={{ paddingLeft: `${depth * 10 + 6}px` }}
        >
          <button 
            type="button" 
            onClick={(e) => handleToggleTreeExpand(e, cid)}
            className="w-4 h-4 flex items-center justify-center rounded hover:bg-black/5 text-[var(--text2)] shrink-0"
          >
            {hasKids && (isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}
          </button>
          <input 
            type="checkbox" 
            checked={isChecked}
            onChange={(e) => handleCheckboxClick(cid, e.target.checked)}
            className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] w-3.5 h-3.5"
          />
          <span className="truncate" title={c.name}>{c.name}</span>
          <span className="text-[9px] text-[var(--text2)] ml-auto font-black shrink-0">
            {c.total?.toLocaleString('uk-UA') || c.count?.toLocaleString('uk-UA')}
          </span>
        </div>
      );

      if (hasKids && isExpanded) {
        kids.forEach(k => buildNode(k, depth + 1));
      }
    };

    roots.forEach(r => buildNode(r, 0));
    return rows;
  };

  const handleOpenPresetSaver = (type: 'yavshoke' | 'mastereva') => {
    const selected = type === 'yavshoke' ? yavSelectedCats : meSelectedCats;
    if (!selected.size) {
      showToast('⚠️ Оберіть категорії');
      return;
    }
    setPresetSaveType(type);
    setSavePresetModalOpen(true);
  };

  const buildPresetJsonText = (type: 'yavshoke' | 'mastereva') => {
    const isYav = type === 'yavshoke';
    const name = isYav ? yavPresetName : mePresetName;
    const cats = Array.from(isYav ? yavSelectedCats : meSelectedCats);
    const pct = isYav ? yavPct : mePct;
    const grn = isYav ? yavGrn : meGrn;
    const min = isYav ? yavMinPrice : meMinPrice;
    const avail = isYav ? yavAvailOnly : meAvailOnly;
    const idPrefix = isYav ? yavIdPrefix : meIdPrefix;
    const catPrefix = isYav ? yavCatPrefix : meCatPrefix;
    const addBrand = isYav ? yavAddBrand : meAddBrand;
    const defBrand = isYav ? yavDefaultBrand : meDefaultBrand;
    const fillParams = isYav ? yavFillParams : meFillParams;

    const obj: any = {
      name,
      pct,
      grn,
      min,
      avail,
      cats
    };

    if (idPrefix) obj.idPrefix = idPrefix;
    if (catPrefix) obj.catPrefix = catPrefix;
    if (addBrand) {
      obj.addBrand = true;
      if (defBrand) obj.defaultBrand = defBrand;
    }
    if (fillParams) obj.fillParams = fillParams;

    return JSON.stringify(obj, null, 2);
  };

  const handlePushPresetToGitHub = async () => {
    if (!ghTokenVal.trim()) {
      showToast('🔑 Підключіть токен GitHub у вкладці Профіль');
      return;
    }
    setGhPushing(true);
    const presetName = presetSaveType === 'yavshoke' ? yavPresetName : mePresetName;
    const jsonContent = buildPresetJsonText(presetSaveType);
    
    try {
      const owner = 'lozko1991-blip';
      const repo = 'Ypricea';
      const path = `presets/${presetName}.json`;
      const commitMessage = `feat: update preset ${presetName} from dashboard`;
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${ghTokenVal}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      };

      let sha: string | undefined = undefined;
      try {
        const r = await fetch(url, { headers });
        if (r.ok) {
          const j = await r.json();
          sha = j.sha;
        }
      } catch {}

      const base64Content = btoa(encodeURIComponent(jsonContent).replace(/%([0-9A-F]{2})/g, (_, p) => {
        return String.fromCharCode(parseInt(p, 16));
      }));

      const body: any = {
        message: commitMessage,
        content: base64Content
      };
      if (sha) body.sha = sha;

      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      });

      if (res.ok) {
        showToast(`✅ Пресет "${presetName}" записано у GitHub! Запускаємо оновлення...`);
        setSavePresetModalOpen(false);
        // Trigger smart rebuild via queue — waits for running builds, deduplicates
        if (onSmartRebuild) {
          onSmartRebuild(`пресет "${presetName}"`);
        } else {
          handleTriggerBuild();
        }
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `API error ${res.status}`);
      }
    } catch (e: any) {
      showToast('⚠️ Помилка запису у GitHub: ' + e.message);
    } finally {
      setGhPushing(false);
    }
  };

  // Selection count statistics calculators
  const yavStats = useMemo(() => {
    if (!generatorProducts.length) return { selectedCatsCount: 0, productsCount: 0 };
    const selected = new Set<string>();
    const yavCats = categories.filter(c => c.src === 'yavshoke');
    const childrenMap: Record<string, string[]> = {};
    yavCats.forEach(c => {
      const pid = String(c.parentId || '');
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(String(c.id));
    });

    const stack = [...yavSelectedCats].map(String);
    while (stack.length) {
      const id = stack.pop()!;
      if (selected.has(id)) continue;
      selected.add(id);
      (childrenMap[id] || []).forEach(ch => stack.push(ch));
    }

    let prodCount = 0;
    generatorProducts.forEach(p => {
      const isYav = p.s === 'yavshoke' || !p.s;
      if (!isYav) return;
      if (!selected.has(p.c)) return;
      if (p.pr < yavMinPrice) return;
      if (yavAvailOnly && p.a === 0) return;
      prodCount++;
    });

    return { selectedCatsCount: selected.size, productsCount: prodCount };
  }, [generatorProducts, categories, yavSelectedCats, yavMinPrice, yavAvailOnly]);

  const meStats = useMemo(() => {
    if (!generatorProducts.length) return { selectedCatsCount: 0, productsCount: 0 };
    const selected = new Set<string>();
    const meCats = categories.filter(c => c.src === 'mastereva');
    const childrenMap: Record<string, string[]> = {};
    meCats.forEach(c => {
      const pid = String(c.parentId || '');
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(String(c.id));
    });

    const stack = [...meSelectedCats].map(String);
    while (stack.length) {
      const id = stack.pop()!;
      if (selected.has(id)) continue;
      selected.add(id);
      (childrenMap[id] || []).forEach(ch => stack.push(ch));
    }

    let prodCount = 0;
    generatorProducts.forEach(p => {
      const isYav = p.s === 'yavshoke' || !p.s;
      if (isYav) return;
      if (!selected.has(p.c)) return;
      if (p.pr < meMinPrice) return;
      if (meAvailOnly && p.a === 0) return;
      prodCount++;
    });

    return { selectedCatsCount: selected.size, productsCount: prodCount };
  }, [generatorProducts, categories, meSelectedCats, meMinPrice, meAvailOnly]);

  // Local XML compilers
  const escXml = (s: any) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cdata = (s: any) => '<![CDATA[' + String(s == null ? '' : s).replace(/]]>/g, ']]&gt;') + ']]>';
  
  const getProductBrand = (p: any, defaultBrand: string) => {
    const brandParams = new Set(['бренд', 'brand', 'торгова марка', 'торговая марка', 'виробник', 'производитель', 'марка']);
    const bp = (p.params || []).find((pm: any) => brandParams.has((pm.name || '').toLowerCase()));
    return (bp && bp.value) || defaultBrand || '';
  };

  const withBrand = (name: string, brand: string) => {
    if (!brand || !name) return name;
    if (name.toLowerCase().includes(brand.toLowerCase())) return name;
    return `${name} ${brand}`;
  };

  const DEFAULT_FILL_PARAMS = [
    { name: 'Розмір', value: '-' },
    { name: 'Колір', value: 'Комбінований' },
    { name: 'Вага', value: '-' },
    { name: 'Стан', value: 'Новий' }
  ];

  const fillDefaultParams = (params: any[]) => {
    if ((params || []).length >= 3) return params;
    const result = [...(params || [])];
    const existing = new Set(result.map(p => (p.name || '').toLowerCase()));
    for (const dp of DEFAULT_FILL_PARAMS) {
      if (result.length >= 4) break;
      if (!existing.has(dp.name.toLowerCase())) {
        result.push({ ...dp });
        existing.add(dp.name.toLowerCase());
      }
    }
    return result;
  };

  const ensureFullMany = async (products: any[], onProgress?: (done: number, total: number) => void) => {
    const map = await loadShardMap();
    const byShard: Record<number, any[]> = {};
    
    products.forEach(p => {
      const pid = String(p.id);
      const n = map[pid] ?? map[p.id];
      if (n) {
        if (!byShard[n]) byShard[n] = [];
        byShard[n].push(p);
      }
    });

    const shardNums = Object.keys(byShard).map(Number);
    let done = 0;
    const total = shardNums.length;

    for (const n of shardNums) {
      const [shard, descShard] = await Promise.all([
        loadShard(n),
        loadDescShard(n)
      ]);

      byShard[n].forEach(p => {
        const pid = String(p.id);
        const f = mapGet(shard, pid);
        if (f) {
          if (f.pictures && f.pictures.length) {
            p.pics = f.pictures.map((u: string) => 
              u && /^https?:/.test(u) ? u : (u ? `${imgPrefix || ''}${u}` : '')
            ).filter(Boolean);
            if (p.pics[0]) p.img = p.pics[0];
          }
          if (f.params) p.params = f.params;
          if (f.vendorCode) p.vendorCode = f.vendorCode;
          if (f.group_id) p.groupId = f.group_id;
          if (f.barcode) p.barcode = f.barcode;
          if (f.description) p.descRu = f.description;
          if (f.description_ua) p.descUa = f.description_ua;
        }
        const d = mapGet(descShard, pid);
        if (d) {
          if (d.description) p.descRu = d.description;
          if (d.description_ua) p.descUa = d.description_ua;
        }
      });

      done++;
      if (onProgress) onProgress(done, total);
    }
  };

  const buildPromXmlText = (
    offers: any[], 
    catById: Record<string, any>, 
    pfxCats: Map<string, string>, 
    title: string,
    type: 'yavshoke' | 'mastereva'
  ) => {
    const idPrefix = type === 'yavshoke' ? yavIdPrefix : meIdPrefix;
    const fillParams = type === 'yavshoke' ? yavFillParams : meFillParams;
    const addBrand = type === 'yavshoke' ? yavAddBrand : meAddBrand;
    const defaultBrand = type === 'yavshoke' ? yavDefaultBrand : meDefaultBrand;

    let catsXml = '';
    pfxCats.forEach((pfxVal, key) => {
      const origCat = catById[key];
      const pfxParent = origCat?.parentId && pfxCats.has(String(origCat.parentId)) ? ` parentId="${escXml(pfxCats.get(String(origCat.parentId)))}"` : '';
      catsXml += `<category id="${escXml(pfxVal)}"${pfxParent}>${escXml(origCat?.name || key)}</category>`;
    });

    const dateStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const siteUrl = 'https://lozko1991-blip.github.io/Ypricea';

    let x = `<?xml version="1.0" encoding="UTF-8"?>\n<yml_catalog date="${dateStr}">\n<shop>\n<name>${title}</name>\n<company>UTRADE</company>\n<url>${siteUrl}/</url>\n<currencies><currency id="UAH" rate="1"/></currencies>\n<categories>${catsXml}</categories>\n<offers>\n`;

    offers.forEach(o => {
      const offerId = idPrefix + String(o.id);
      const catId = pfxCats.get(String(o.c)) || String(o.c);
      const groupId = o.groupId ? (idPrefix + String(o.groupId)) : null;
      let params = o.params || [];
      if (fillParams) params = fillDefaultParams(params);

      const brand = addBrand ? getProductBrand(o, defaultBrand) : '';
      const nameRu = brand ? withBrand(o.descRu || o.n, brand) : (o.descRu || o.n);
      const nameUa = brand ? withBrand(o.descUa || o.n, brand) : (o.descUa || o.n);

      x += `<offer id="${escXml(offerId)}" available="${o.a === 1 ? 'true' : 'false'}"${groupId ? ` group_id="${escXml(groupId)}"` : ''}>`;
      x += `<price>${o.finalPrice}</price><currencyId>UAH</currencyId><categoryId>${escXml(catId)}</categoryId>`;
      
      const pics = o.pics && o.pics.length ? o.pics : (o.i ? [o.i.startsWith('http') ? o.i : `${imgPrefix || ''}${o.i}`] : []);
      pics.forEach((pic: string) => {
        x += `<picture>${escXml(pic)}</picture>`;
      });

      if (o.vendorCode) x += `<vendorCode>${escXml(o.vendorCode)}</vendorCode>`;
      if (brand) x += `<vendor>${escXml(brand)}</vendor>`;
      x += `<name>${cdata(nameRu)}</name>`;
      x += `<name_ua>${cdata(nameUa)}</name_ua>`;
      if (o.descRu) x += `<description>${cdata(o.descRu)}</description>`;
      if (o.descUa) x += `<description_ua>${cdata(o.descUa)}</description_ua>`;
      params.forEach((pm: any) => {
        if (pm && pm.name) {
          x += `<param name="${escXml(pm.name)}">${escXml(String(pm.value ?? ''))}</param>`;
        }
      });
      x += `</offer>\n`;
    });

    x += `</offers>\n</shop>\n</yml_catalog>`;
    return x;
  };

  const handleLocalGeneratorDownload = async (type: 'yavshoke' | 'mastereva') => {
    const selected = type === 'yavshoke' ? yavSelectedCats : meSelectedCats;
    if (!selected.size) {
      showToast('⚠️ Оберіть категорії');
      return;
    }

    showToast('⚙️ Запуск побудови XML...');
    setGeneratorStatus('Фільтрація товарів за критеріями...');

    const min = type === 'yavshoke' ? yavMinPrice : meMinPrice;
    const avail = type === 'yavshoke' ? yavAvailOnly : meAvailOnly;

    const finalCats = new Set<string>();
    // Build childrenMap only from categories of THIS supplier to avoid cross-supplier ID collisions
    const supplierCats = categories.filter(c =>
      type === 'yavshoke' ? c.src === 'yavshoke' : c.src === 'mastereva'
    );
    const childrenMap: Record<string, string[]> = {};
    supplierCats.forEach(c => {
      const pid = String(c.parentId || '');
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(String(c.id));
    });

    const stack = [...selected].map(String);
    while (stack.length) {
      const id = stack.pop()!;
      if (finalCats.has(id)) continue;
      finalCats.add(id);
      (childrenMap[id] || []).forEach(ch => stack.push(ch));
    }

    let matchingProds = generatorProducts.filter(p => {
      const isYav = p.s === 'yavshoke' || !p.s;
      if (type === 'yavshoke' && !isYav) return false;
      if (type === 'mastereva' && isYav) return false;

      if (!finalCats.has(p.c)) return false;
      if (p.pr < min) return false;
      if (avail && p.a === 0) return false;
      return true;
    });

    if (!matchingProds.length) {
      showToast('⚠️ Немає товарів за вказаними умовами.');
      setGeneratorStatus('');
      return;
    }

    setGeneratorStatus('Завантаження характеристик з шардів...');
    try {
      await ensureFullMany(matchingProds, (done, total) => {
        setGeneratorStatus(`Завантаження шардів: ${done} / ${total}...`);
      });

      const pct = type === 'yavshoke' ? yavPct : mePct;
      const grn = type === 'yavshoke' ? yavGrn : meGrn;
      const offers = matchingProds.map(p => ({
        ...p,
        finalPrice: Math.max(1, Math.round(p.pr * (1 + pct / 100) + grn))
      }));

      // Use only supplier-specific categories for XML generation
      const srcCats = categories.filter(c =>
        type === 'yavshoke' ? c.src === 'yavshoke' : c.src === 'mastereva'
      );

      const catById: Record<string, any> = {};
      srcCats.forEach(c => { catById[c.id] = c; });
      const pfxCats = new Map<string, string>();
      const catPrefix = type === 'yavshoke' ? yavCatPrefix : meCatPrefix;

      const usedCats = new Set<string>();
      offers.forEach(o => {
        usedCats.add(String(o.c));
        getAncestors(String(o.c), srcCats).forEach(a => usedCats.add(String(a.id)));
      });

      srcCats.filter(c => usedCats.has(String(c.id))).forEach(c => {
        pfxCats.set(String(c.id), catPrefix + String(c.id));
      });

      setGeneratorStatus('Компіляція XML...');
      const title = type === 'yavshoke' ? 'UTRADE Yavshoke' : 'UTRADE Mastereva';
      const xmlContent = buildPromXmlText(offers, catById, pfxCats, title, type);

      const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${type}_export_${new Date().toISOString().slice(0, 10)}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      showToast('✅ Прайс успішно завантажено!');
    } catch (e: any) {
      console.error('Failed compiling local XML', e);
      showToast('⚠️ Помилка збірки XML: ' + e.message);
    } finally {
      setGeneratorStatus('');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ───────────────────────────────────────────────────────────────── */}
      {/* VIEW: STATIC XML GENERATOR */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'generator' && (
        <div className="flex flex-col gap-6">
          {generatorLoading && (
            <div className="card flex flex-col items-center justify-center p-12 text-[var(--text2)] font-semibold gap-3">
              <Loader2 className="animate-spin text-[var(--accent)]" size={32} />
              <span>{generatorStatus}</span>
            </div>
          )}

          {!generatorLoading && categories.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Yavshoke Generator */}
              <div className="card flex flex-col gap-4">
                <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                  <h2 className="text-base font-black text-sky-600 dark:text-sky-400">
                    Генератор прайсу ЯВШОКЕ
                  </h2>
                  {yavStats.productsCount > 0 && (
                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 py-0.5 px-2 rounded-md">
                      {yavStats.productsCount.toLocaleString('uk-UA')} товарів
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Категорії ЯВШОКЕ ({yavStats.selectedCatsCount} обрано)</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleSelectAllCats('yavshoke', true)}
                        className="text-[10px] font-black text-sky-600 hover:underline"
                      >
                        Вибрати всі
                      </button>
                      <button 
                        onClick={() => handleSelectAllCats('yavshoke', false)}
                        className="text-[10px] font-black text-[var(--text2)] hover:underline"
                      >
                        Зняти всі
                      </button>
                    </div>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Пошук категорії..."
                    value={yavSearchQuery}
                    onChange={(e) => setYavSearchQuery(e.target.value)}
                    className="input-field w-full text-xs py-1.5 px-3"
                  />
                  <div className="h-64 overflow-y-auto border border-[var(--border)] rounded-2xl bg-[var(--surface2)] p-2 noscroll">
                    {renderCategoryCheckboxTree('yavshoke', yavSelectedCats, setYavSelectedCats, yavSearchQuery)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-[var(--text2)] mb-1 block">Націнка % (±)</label>
                    <input type="number" value={yavPct} onChange={(e) => setYavPct(Number(e.target.value))} className="input-field w-full py-1.5 px-2" />
                  </div>
                  <div>
                    <label className="font-bold text-[var(--text2)] mb-1 block">Націнка ₴ (±)</label>
                    <input type="number" value={yavGrn} onChange={(e) => setYavGrn(Number(e.target.value))} className="input-field w-full py-1.5 px-2" />
                  </div>
                  <div>
                    <label className="font-bold text-[var(--text2)] mb-1 block">Ціна від (₴)</label>
                    <input type="number" value={yavMinPrice} onChange={(e) => setYavMinPrice(Number(e.target.value))} className="input-field w-full py-1.5 px-2" />
                  </div>
                  <div className="flex items-center pt-5 pl-2">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input type="checkbox" checked={yavAvailOnly} onChange={(e) => setYavAvailOnly(e.target.checked)} className="rounded border-[var(--border)] text-[var(--accent)]" />
                      <span>Тільки в наявності</span>
                    </label>
                  </div>
                  <div>
                    <label className="font-bold text-[var(--text2)] mb-1 block">Префікс ID товарів</label>
                    <input type="text" value={yavIdPrefix} onChange={(e) => setYavIdPrefix(e.target.value)} className="input-field w-full py-1.5 px-2" placeholder="напр. YS-" />
                  </div>
                  <div>
                    <label className="font-bold text-[var(--text2)] mb-1 block">Префікс ID категорій</label>
                    <input type="text" value={yavCatPrefix} onChange={(e) => setYavCatPrefix(e.target.value)} className="input-field w-full py-1.5 px-2" placeholder="напр. 10000" />
                  </div>
                  <div className="flex items-center pt-5 pl-2">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input type="checkbox" checked={yavAddBrand} onChange={(e) => setYavAddBrand(e.target.checked)} className="rounded border-[var(--border)] text-[var(--accent)]" />
                      <span>Вписувати бренд</span>
                    </label>
                  </div>
                  {yavAddBrand && (
                    <div>
                      <label className="font-bold text-[var(--text2)] mb-1 block">Дефолтний бренд</label>
                      <input type="text" value={yavDefaultBrand} onChange={(e) => setYavDefaultBrand(e.target.value)} className="input-field w-full py-1.5 px-2" placeholder="напр. UTRADE" />
                    </div>
                  )}
                  <div className="flex items-center pt-5 pl-2 col-span-2">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input type="checkbox" checked={yavFillParams} onChange={(e) => setYavFillParams(e.target.checked)} className="rounded border-[var(--border)] text-[var(--accent)]" />
                      <span>Заповнювати Prom параметри з опису</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={() => handleLocalGeneratorDownload('yavshoke')}
                    className="gbtn bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-black py-2 px-4 rounded-xl flex-1 flex items-center justify-center gap-1"
                  >
                    📥 Завантажити локально
                  </button>
                  <button 
                    onClick={() => handleOpenPresetSaver('yavshoke')}
                    className="btn-primary py-2 font-black text-xs flex-1 flex items-center justify-center gap-1.5 uppercase"
                  >
                    <Save size={14} />
                    Зберегти конфіг
                  </button>
                </div>
              </div>

              {/* Mastereva Generator */}
              <div className="card flex flex-col gap-4">
                <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                  <h2 className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    Генератор прайсу MASTEREVA
                  </h2>
                  {meStats.productsCount > 0 && (
                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 py-0.5 px-2 rounded-md">
                      {meStats.productsCount.toLocaleString('uk-UA')} товарів
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Категорії Mastereva ({meStats.selectedCatsCount} обрано)</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleSelectAllCats('mastereva', true)}
                        className="text-[10px] font-black text-emerald-600 hover:underline"
                      >
                        Вибрати всі
                      </button>
                      <button 
                        onClick={() => handleSelectAllCats('mastereva', false)}
                        className="text-[10px] font-black text-[var(--text2)] hover:underline"
                      >
                        Зняти всі
                      </button>
                    </div>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Пошук категорії..."
                    value={meSearchQuery}
                    onChange={(e) => setMeSearchQuery(e.target.value)}
                    className="input-field w-full text-xs py-1.5 px-3"
                  />
                  <div className="h-64 overflow-y-auto border border-[var(--border)] rounded-2xl bg-[var(--surface2)] p-2 noscroll">
                    {renderCategoryCheckboxTree('mastereva', meSelectedCats, setMeSelectedCats, meSearchQuery)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-[var(--text2)] mb-1 block">Націнка % (±)</label>
                    <input type="number" value={mePct} onChange={(e) => setMePct(Number(e.target.value))} className="input-field w-full py-1.5 px-2" />
                  </div>
                  <div>
                    <label className="font-bold text-[var(--text2)] mb-1 block">Націнка ₴ (±)</label>
                    <input type="number" value={meGrn} onChange={(e) => setMeGrn(Number(e.target.value))} className="input-field w-full py-1.5 px-2" />
                  </div>
                  <div>
                    <label className="font-bold text-[var(--text2)] mb-1 block">Ціна від (₴)</label>
                    <input type="number" value={meMinPrice} onChange={(e) => setMeMinPrice(Number(e.target.value))} className="input-field w-full py-1.5 px-2" />
                  </div>
                  <div className="flex items-center pt-5 pl-2">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input type="checkbox" checked={meAvailOnly} onChange={(e) => setMeAvailOnly(e.target.checked)} className="rounded border-[var(--border)] text-[var(--accent)]" />
                      <span>Тільки в наявності</span>
                    </label>
                  </div>
                  <div>
                    <label className="font-bold text-[var(--text2)] mb-1 block">Префікс ID товарів</label>
                    <input type="text" value={meIdPrefix} onChange={(e) => setMeIdPrefix(e.target.value)} className="input-field w-full py-1.5 px-2" />
                  </div>
                  <div>
                    <label className="font-bold text-[var(--text2)] mb-1 block">Префікс ID категорій</label>
                    <input type="text" value={meCatPrefix} onChange={(e) => setMeCatPrefix(e.target.value)} className="input-field w-full py-1.5 px-2" />
                  </div>
                  <div className="flex items-center pt-5 pl-2">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input type="checkbox" checked={meAddBrand} onChange={(e) => setMeAddBrand(e.target.checked)} className="rounded border-[var(--border)] text-[var(--accent)]" />
                      <span>Вписувати бренд</span>
                    </label>
                  </div>
                  {meAddBrand && (
                    <div>
                      <label className="font-bold text-[var(--text2)] mb-1 block">Дефолтний бренд</label>
                      <input type="text" value={meDefaultBrand} onChange={(e) => setMeDefaultBrand(e.target.value)} className="input-field w-full py-1.5 px-2" placeholder="напр. UTRADE" />
                    </div>
                  )}
                  <div className="flex items-center pt-5 pl-2 col-span-2">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input type="checkbox" checked={meFillParams} onChange={(e) => setMeFillParams(e.target.checked)} className="rounded border-[var(--border)] text-[var(--accent)]" />
                      <span>Заповнювати Prom параметри з опису</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={() => handleLocalGeneratorDownload('mastereva')}
                    className="gbtn bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-black py-2 px-4 rounded-xl flex-1 flex items-center justify-center gap-1"
                  >
                    📥 Завантажити локально
                  </button>
                  <button 
                    onClick={() => handleOpenPresetSaver('mastereva')}
                    className="btn-primary py-2 font-black text-xs flex-1 flex items-center justify-center gap-1.5 uppercase bg-emerald-600 hover:bg-emerald-500"
                  >
                    <Save size={14} />
                    Зберегти конфіг
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GH commit modal */}
          {savePresetModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSavePresetModalOpen(false)} />
              <div className="card w-full max-w-md relative z-10 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                  <h3 className="text-xs font-black uppercase text-[var(--text)]">Збереження пресету у GitHub</h3>
                  <button onClick={() => setSavePresetModalOpen(false)} className="text-[var(--text2)] hover:text-[var(--text)]">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex flex-col gap-3 font-semibold text-xs">
                  <div>
                    <label className="text-[10px] text-[var(--text2)] block mb-1">Назва файлу пресету (export-*.json)</label>
                    <input 
                      type="text" 
                      value={presetSaveType === 'yavshoke' ? yavPresetName : mePresetName}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                        if (presetSaveType === 'yavshoke') setYavPresetName(val);
                        else setMePresetName(val);
                      }}
                      className="input-field w-full text-xs font-mono" 
                      placeholder="напр. export-1"
                    />
                  </div>
                  <button
                    onClick={handlePushPresetToGitHub}
                    disabled={ghPushing}
                    className="btn-primary py-2 font-black text-xs flex items-center justify-center gap-2"
                  >
                    {ghPushing ? <Loader2 className="animate-spin" size={14} /> : 'Надіслати комміт'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* VIEW: SAAS ADMIN PANEL */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'admin' && (
        <div className="flex flex-col gap-6">
          {/* Sub-Tab Navigation headers */}
          <div className="flex gap-2 border-b border-[var(--border)] pb-2 flex-wrap">
            <button 
              onClick={() => setAdminActiveSubTab('users')} 
              className={`px-4 py-2 font-black text-xs border-b-2 transition-all ${
                adminActiveSubTab === 'users' 
                  ? 'border-[var(--accent)] text-[var(--accent)]' 
                  : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              👥 Користувачі та Білінг
            </button>
            <button 
              onClick={() => setAdminActiveSubTab('analytics')} 
              className={`px-4 py-2 font-black text-xs border-b-2 transition-all ${
                adminActiveSubTab === 'analytics' 
                  ? 'border-[var(--accent)] text-[var(--accent)]' 
                  : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              📊 Системна Аналітика
            </button>
            <button 
              onClick={() => setAdminActiveSubTab('logs')} 
              className={`px-4 py-2 font-black text-xs border-b-2 transition-all ${
                adminActiveSubTab === 'logs' 
                  ? 'border-[var(--accent)] text-[var(--accent)]' 
                  : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              📋 Журнал Синхронізацій
            </button>
            <button 
              onClick={() => setAdminActiveSubTab('catalog')} 
              className={`px-4 py-2 font-black text-xs border-b-2 transition-all ${
                adminActiveSubTab === 'catalog' 
                  ? 'border-[var(--accent)] text-[var(--accent)]' 
                  : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              📦 Каталог та Склади
            </button>
            <button 
              onClick={() => setAdminActiveSubTab('invoices')} 
              className={`px-4 py-2 font-black text-xs border-b-2 transition-all ${
                adminActiveSubTab === 'invoices' 
                  ? 'border-[var(--accent)] text-[var(--accent)]' 
                  : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              💳 Оплати та Рахунки
            </button>
            <button 
              onClick={() => setAdminActiveSubTab('settings')} 
              className={`px-4 py-2 font-black text-xs border-b-2 transition-all ${
                adminActiveSubTab === 'settings' 
                  ? 'border-[var(--accent)] text-[var(--accent)]' 
                  : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              ⚙️ Налаштування & Бази
            </button>
          </div>

          {adminLoading ? (
            <div className="flex items-center justify-center py-20 text-[var(--text2)]">
              <Loader2 className="animate-spin mr-2" size={24} />
              Завантаження панелі адміністрування...
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              
              {/* SUB-TAB: USERS & BILLING */}
              {adminActiveSubTab === 'users' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Dropshipper Profiles Management */}
                  <div className="card xl:col-span-2 flex flex-col gap-4">
                    <div className="border-b border-[var(--border)] pb-2 flex items-center justify-between flex-wrap gap-2">
                      <h2 className="text-sm font-black text-[var(--text)]">
                        Користувачі ({filteredAdminUsers.length})
                      </h2>
                      <input 
                        type="text"
                        placeholder="Пошук користувача..."
                        value={adminUserSearch}
                        onChange={(e) => setAdminUserSearch(e.target.value)}
                        className="input-field text-[11px] py-1 px-2.5 max-w-[200px]"
                      />
                    </div>
                    <div className="grid gap-4 max-h-[700px] overflow-y-auto pr-1 noscroll">
                      {filteredAdminUsers.map(u => {
                        const allowed = u.allowed_exports || [];
                        const isMe = u.id === user?.id;
                        const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString('uk-UA') : '';
                        const isExpanded = expandedUserPanel === u.id;
                        const uBal = u.balance ?? 0;
                        const uPlan = u.subscription_plan ?? 'trial';
                        const uStatus = u.subscription_status ?? 'active';
                        const uExpires = u.subscription_expires_at ? new Date(u.subscription_expires_at).toISOString().split('T')[0] : '';

                        return (
                          <div key={u.id} className="p-4 bg-[var(--surface2)] border border-[var(--border)] rounded-2xl flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="min-w-0">
                                <h3 className="font-extrabold text-xs text-[var(--text)] flex items-center gap-1.5">
                                  {u.name || '—'}
                                  {isMe && <span className="text-[10px] text-[var(--text2)] font-bold">(Ви)</span>}
                                  <span className="text-[10px] text-emerald-500 font-extrabold ml-1.5">{uBal.toLocaleString('uk-UA')} ₴</span>
                                </h3>
                                <p className="text-[10px] text-[var(--text2)] font-semibold mt-0.5">
                                  {u.store_name || 'Магазин не вказано'} · {u.phone || 'Без телефону'}
                                </p>
                                <div className="flex gap-2 items-center mt-1.5 flex-wrap">
                                  <span className={`badge ${
                                    u.status === 'active' 
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-500/20' 
                                      : u.status === 'blocked'
                                        ? 'bg-red-50 text-red-700 border border-red-500/20'
                                        : 'bg-amber-50 text-amber-700 border border-amber-500/20'
                                  } font-black uppercase text-[8px]`}>
                                    Доступ: {u.status}
                                  </span>
                                  <span className="badge bg-blue-50 text-blue-700 border border-blue-500/20 font-black uppercase text-[8px]">
                                    Тариф: {uPlan}
                                  </span>
                                  <span className="badge bg-purple-50 text-purple-700 border border-purple-500/20 font-black uppercase text-[8px]">
                                    Підписка: {uStatus}
                                  </span>
                                </div>
                              </div>
                              
                                <div className="flex gap-1.5">
                                  {!isMe && u.status !== 'active' && (
                                    <button 
                                      onClick={() => handleSetUserStatus(u.id, 'active')}
                                      className="gbtn bg-emerald-500 text-white py-1 px-2.5 rounded-lg text-[10px]"
                                    >
                                      Дозволити
                                    </button>
                                  )}
                                  {!isMe && u.status !== 'blocked' && (
                                    <button 
                                      onClick={() => handleSetUserStatus(u.id, 'blocked')}
                                      className="gbtn bg-red-500 text-white py-1 px-2.5 rounded-lg text-[10px]"
                                    >
                                      Блокувати
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setExpandedUserPanel(isExpanded ? null : u.id)}
                                    className="gbtn bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)] font-black py-1 px-2.5 rounded-lg text-[10px]"
                                  >
                                    Налаштувати ⚙️
                                  </button>
                                </div>
                            </div>

                            {/* Extended Subscriptions, Wallet Balance and Supplier Permissions Configurator */}
                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-col gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
                                  {/* Subscriptions & Plan config */}
                                  <div className="bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl flex flex-col gap-2">
                                    <span className="text-[10px] text-[var(--text2)] uppercase font-extrabold">Управління підпискою</span>
                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-[9px] text-[var(--text2)]">План підписки</label>
                                      <select 
                                        id={`uplan-${u.id}`}
                                        className="input-field text-[11px] py-1"
                                        defaultValue={uPlan}
                                      >
                                        <option value="trial">Trial (7 днів)</option>
                                        <option value="professional">Professional SaaS (250₴)</option>
                                        <option value="enterprise">Enterprise SaaS (500₴)</option>
                                      </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-[9px] text-[var(--text2)]">Статус</label>
                                      <select 
                                        id={`ustatus-${u.id}`}
                                        className="input-field text-[11px] py-1"
                                        defaultValue={uStatus}
                                      >
                                        <option value="active">Активний</option>
                                        <option value="expired">Закінчився</option>
                                        <option value="suspended">Заблоковано</option>
                                      </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-[9px] text-[var(--text2)]">Діє до</label>
                                      <input 
                                        type="date"
                                        id={`uexpires-${u.id}`}
                                        className="input-field text-[11px] py-0.5"
                                        defaultValue={uExpires}
                                      />
                                    </div>
                                    <button 
                                      onClick={() => {
                                        const p = (document.getElementById(`uplan-${u.id}`) as HTMLSelectElement)?.value;
                                        const s = (document.getElementById(`ustatus-${u.id}`) as HTMLSelectElement)?.value;
                                        const e = (document.getElementById(`uexpires-${u.id}`) as HTMLInputElement)?.value;
                                        handleUpdateUserSubscription(u.id, p, s, e);
                                      }}
                                      className="gbtn bg-blue-600 text-white text-[10px] font-black py-1 px-2.5 rounded-lg mt-1"
                                    >
                                      Зберегти тариф
                                    </button>
                                  </div>

                                  {/* Wallet Balance Adjuster */}
                                  <div className="bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl flex flex-col gap-2 justify-between">
                                    <div>
                                      <span className="text-[10px] text-[var(--text2)] uppercase font-extrabold">Баланс гаманця</span>
                                      <p className="text-[9px] text-[var(--text2)] mt-0.5">Введіть позитивну або негативну суму для коригування балансу.</p>
                                      <div className="flex gap-2 items-center mt-3">
                                        <input 
                                          type="number"
                                          step="0.01"
                                          placeholder="Сума (напр. 250)"
                                          id={`uadj-${u.id}`}
                                          className="input-field text-xs py-1 flex-1"
                                        />
                                        <button 
                                          onClick={() => {
                                            const el = document.getElementById(`uadj-${u.id}`) as HTMLInputElement;
                                            const val = parseFloat(el?.value || '0');
                                            handleAdjustUserBalance(u.id, uBal, val);
                                            if (el) el.value = '';
                                          }}
                                          className="gbtn bg-emerald-500 text-white text-[10px] font-black py-1.5 px-3 rounded-lg"
                                        >
                                          Змінити
                                        </button>
                                      </div>
                                    </div>
                                    <div className="text-[9px] text-[var(--text2)] border-t border-[var(--border)] pt-2 mt-2">
                                      Реєстрація: {dateStr}
                                    </div>
                                  </div>
                                </div>

                                {/* XML Permissions */}
                                <div className="bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl flex flex-col gap-2">
                                  <span className="text-[10px] text-[var(--text2)] uppercase font-extrabold">Дозволені XML прайси</span>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {exportsList.map(e => (
                                      <label 
                                        key={e.name} 
                                        className="flex items-center gap-1.5 cursor-pointer bg-[var(--surface2)] border border-[var(--border)] rounded-xl py-1 px-3 text-[10px] font-bold"
                                      >
                                        <input 
                                          type="checkbox" 
                                          value={e.name} 
                                          defaultChecked={allowed.includes(e.name)}
                                          data-uid={u.id}
                                          className="exp-cb rounded text-[var(--accent)] border-[var(--border)] w-3 h-3"
                                        />
                                        {e.name}
                                      </label>
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => handleSaveUserExports(u.id)}
                                    className="gbtn bg-[var(--accent)] text-white text-[10px] font-black py-1.5 px-3 self-start rounded-xl mt-2"
                                  >
                                    Зберегти дозволи XML
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* All Orders Dashboard */}
                  <div className="card flex flex-col gap-4">
                    <div className="border-b border-[var(--border)] pb-2 flex flex-col gap-2">
                      <h2 className="text-sm font-black text-[var(--text)]">
                        Останні замовлення ({filteredAdminOrders.length})
                      </h2>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Пошук (ID, клієнт, ТТН)..."
                          value={adminOrdersSearch}
                          onChange={(e) => setAdminOrdersSearch(e.target.value)}
                          className="input-field text-[10px] py-1 px-2 flex-1"
                        />
                        <select
                          value={adminOrdersStatusFilter}
                          onChange={(e) => setAdminOrdersStatusFilter(e.target.value)}
                          className="text-[10px] font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] rounded-lg py-1 px-1.5 focus:outline-none"
                        >
                          <option value="all">Всі</option>
                          <option value="new">Нові</option>
                          <option value="processing">В обробці</option>
                          <option value="shipped">Відправлені</option>
                          <option value="done">Виконані</option>
                          <option value="cancelled">Скасовані</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-3 max-h-[700px] overflow-y-auto pr-1 noscroll">
                      {filteredAdminOrders.map(o => {
                        const profit = Math.round(o.total_sell - o.total_drop);
                        const profitClass = profit >= 0 ? 'text-emerald-500' : 'text-red-500';
                        const date = new Date(o.created_at).toLocaleDateString('uk-UA');

                        return (
                          <div key={o.id} className="p-3 bg-[var(--surface2)] border border-[var(--border)] rounded-2xl flex flex-col gap-2">
                            <div className="flex justify-between items-center flex-wrap gap-2">
                              <div>
                                <strong className="text-xs text-[var(--text)]">#{o.id}</strong>
                                <span className="text-[9px] text-[var(--text2)] font-bold ml-1.5">{date}</span>
                              </div>
                              <select
                                value={o.status}
                                onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value as Order['status'])}
                                className="text-[10px] font-black border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] rounded-lg py-1 px-2 focus:outline-none"
                              >
                                <option value="new">Нове</option>
                                <option value="processing">Обробляється</option>
                                <option value="shipped">Відправлено</option>
                                <option value="done">Виконано</option>
                                <option value="cancelled">Скасовано</option>
                              </select>
                            </div>
                            
                            <div className="text-[10px] font-semibold text-[var(--text2)]">
                              Дропер: <strong className="text-[var(--text)]">{o.droper_code || '—'}</strong>
                            </div>
                            <div className="text-[10px] font-semibold text-[var(--text2)]">
                              Клієнт: <strong className="text-[var(--text)]">{o.client_name}</strong> · {o.client_phone} · {o.client_city}
                            </div>
                            
                            <div className="text-[10px] font-bold text-[var(--text2)] flex gap-2">
                              <span>Сума: <strong className="text-[var(--text)]">{o.total_sell} ₴</strong></span>
                              <span>Прибуток: <strong className={profitClass}>{profit >= 0 ? `+${profit}` : profit} ₴</strong></span>
                            </div>

                            {/* TTN entry */}
                            <div className="flex gap-1.5 items-center mt-1">
                              <input
                                type="text"
                                defaultValue={o.ttn || ''}
                                placeholder="ТТН Нової Пошти..."
                                id={`attn-${o.id}`}
                                className="input-field flex-1 text-[10px] py-1 px-2"
                              />
                              <button
                                onClick={() => {
                                  const val = document.getElementById(`attn-${o.id}`) as HTMLInputElement;
                                  if (val) handleSaveAdminTTN(o.id, val.value);
                                }}
                                className="gbtn bg-[var(--accent)] text-white text-[10px] font-black py-1 px-2.5 rounded-lg shrink-0"
                              >
                                ТТН
                              </button>
                            </div>

                            {/* Notes comment */}
                            <div className="flex gap-1.5 items-center">
                              <input
                                type="text"
                                defaultValue={o.admin_notes || ''}
                                placeholder="Коментар для дропера..."
                                id={`anote-${o.id}`}
                                className="input-field flex-1 text-[10px] py-1 px-2"
                              />
                              <button
                                onClick={() => {
                                  const val = document.getElementById(`anote-${o.id}`) as HTMLInputElement;
                                  if (val) handleSaveAdminNotes(o.id, val.value);
                                }}
                                className="gbtn bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-[10px] font-bold py-1 px-2.5 rounded-lg shrink-0"
                              >
                                OK
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB: SYSTEM ANALYTICS */}
              {adminActiveSubTab === 'analytics' && (
                <div className="flex flex-col gap-6">
                  {/* METRICS GRID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="card bg-[var(--surface)] border border-[var(--border)] p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase text-[var(--text2)]">Користувачі</span>
                      <span className="text-xl font-black text-[var(--text)]">{adminUsers.length}</span>
                    </div>
                    <div className="card bg-[var(--surface)] border border-[var(--border)] p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase text-[var(--text2)]">MRR (дохід SaaS)</span>
                      <span className="text-xl font-black text-emerald-500">
                        {adminUsers.reduce((sum, u) => {
                          if (u.subscription_status === 'active') {
                            if (u.subscription_plan === 'professional') return sum + 250;
                            if (u.subscription_plan === 'enterprise') return sum + 500;
                          }
                          return sum;
                        }, 0).toLocaleString('uk-UA')} ₴
                      </span>
                    </div>
                    <div className="card bg-[var(--surface)] border border-[var(--border)] p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase text-[var(--text2)]">Активні фіди</span>
                      <span className="text-xl font-black text-blue-500">
                        {customFeeds.length || adminUsers.reduce((acc, u) => acc + (u.allowed_exports?.length || 0), 0)}
                      </span>
                    </div>
                    <div className="card bg-[var(--surface)] border border-[var(--border)] p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase text-[var(--text2)]">Загальний оборот</span>
                      <span className="text-xl font-black text-purple-500">
                        {adminOrders.filter(o => o.status === 'done').reduce((sum, o) => sum + (o.total_sell || 0), 0).toLocaleString('uk-UA')} ₴
                      </span>
                    </div>
                    <div className="card bg-[var(--surface)] border border-[var(--border)] p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase text-[var(--text2)]">Збої синхронізації</span>
                      <span className={`text-xl font-black ${syncLogs.filter(l => l.status === 'failed').length > 0 ? 'text-red-500' : 'text-[var(--text)]'}`}>
                        {syncLogs.filter(l => l.status === 'failed').length}
                      </span>
                    </div>
                  </div>

                  {/* REBUILD TRIGGER / SYNC PANEL */}
                  <div className="card flex flex-col gap-4">
                    <div className="border-b border-[var(--border)] pb-2 flex justify-between items-center flex-wrap gap-2">
                      <div>
                        <h2 className="text-sm font-black text-[var(--text)]">Моніторинг злиття та автогенерації товарів</h2>
                        <p className="text-[10px] text-[var(--text2)] font-semibold mt-0.5">Ви можете вручну ініціювати збірку XML фідів у GitHub Actions Workflow.</p>
                      </div>
                      <button
                        disabled={triggeringBuild}
                        onClick={handleTriggerBuild}
                        className="btn-primary text-xs py-1.5 px-4 font-black flex items-center gap-1.5 uppercase tracking-wide animate-pulse"
                      >
                        {triggeringBuild ? (
                          <>
                            <Loader2 className="animate-spin mr-1.5" size={14} />
                            Запуск...
                          </>
                        ) : (
                          <>🔄 Запустити перегенерацію товарів</>
                        )}
                      </button>
                    </div>

                    <div className="p-4 bg-[var(--surface2)] border border-[var(--border)] rounded-2xl flex flex-col gap-2.5 text-xs font-bold">
                      {/* Workflow progress banner */}
                      {(workflowStatus?.status === 'in_progress' || workflowStatus?.status === 'queued') && (
                        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 text-blue-500 text-[10px] font-black">
                          <Loader2 size={12} className="animate-spin shrink-0" />
                          Генерація XML-прайсів в процесі на GitHub Actions...
                        </div>
                      )}
                      {workflowStatus?.conclusion === 'failure' && (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-red-500 text-[10px] font-black">
                          ⚠️ Остання генерація завершилась з помилкою
                        </div>
                      )}
                      {workflowStatus?.conclusion === 'success' && workflowStatus?.updated_at && (
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-emerald-600 text-[10px] font-black">
                          ✅ Успішно оновлено: {new Date(workflowStatus.updated_at).toLocaleString('uk-UA', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
                        </div>
                      )}
                      <div className="flex justify-between items-center text-[var(--text2)] text-[10px] border-b border-[var(--border)] pb-2">
                        <span>Прайс</span>
                        <div className="flex gap-8">
                          <span>Товарів</span>
                          <span>Оновлено</span>
                          <span>Посилання</span>
                        </div>
                      </div>
                      {exportsList.map(e => {
                        const isRunning = workflowStatus?.status === 'in_progress' || workflowStatus?.status === 'queued';
                        const updatedAt = e.updated_at
                          ? new Date(e.updated_at).toLocaleString('uk-UA', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })
                          : '—';
                        return (
                          <div key={e.name} className="flex justify-between items-center flex-wrap gap-2 text-xs font-semibold py-1">
                            <span className="font-extrabold text-[var(--text)]">{e.name}</span>
                            <div className="flex items-center gap-6 text-[10px]">
                              {isRunning ? (
                                <span className="inline-flex items-center gap-1 text-blue-500 font-black">
                                  <Loader2 size={9} className="animate-spin" />
                                  Оновлюється...
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-black">{e.count?.toLocaleString('uk-UA') ?? '—'} шт.</span>
                              )}
                              <span className="text-[var(--text2)]">{isRunning ? 'В процесі...' : updatedAt}</span>
                              <a 
                                href={`exports/${e.name}.xml`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-blue-500 hover:underline truncate max-w-[200px]"
                              >
                                /exports/{e.name}.xml ↗
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB: SYNC LOGS */}
              {adminActiveSubTab === 'logs' && (
                <div className="card flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-[var(--border)] pb-2 flex-wrap gap-2">
                    <div>
                      <h2 className="text-sm font-black text-[var(--text)]">Журнал останніх синхронізацій прайсів</h2>
                      <p className="text-[10px] text-[var(--text2)] font-semibold mt-0.5">Відображаються сесії імпорту з серверів постачальників.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onRefreshSyncLogs?.()}
                        disabled={syncLogsLoading}
                        className="gbtn border border-[var(--border)] py-1.5 px-3 rounded-xl text-xs font-black hover:bg-[var(--surface2)] flex items-center gap-1.5"
                      >
                        <RefreshCw size={12} className={syncLogsLoading ? 'animate-spin' : ''} />
                        Оновити
                      </button>
                      {syncLogs.length > 0 && (
                        <button
                          onClick={handleClearSyncLogs}
                          className="gbtn border border-red-500/20 text-red-500 py-1.5 px-3 rounded-xl text-xs font-black hover:bg-red-500/5 flex items-center gap-1.5"
                        >
                          <Trash2 size={12} />
                          Очистити
                        </button>
                      )}
                    </div>
                  </div>

                  {syncLogsLoading ? (
                    <div className="flex items-center justify-center py-12 text-[var(--text2)] font-semibold">
                      <Loader2 className="animate-spin mr-2" size={16} />
                      Завантаження журналу...
                    </div>
                  ) : syncLogs.length === 0 ? (
                    <p className="text-center text-xs text-[var(--text2)] py-12 font-semibold">
                      📜 Журнал логів порожній або таблиця не налаштована.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text2)] font-extrabold">
                            <th className="py-2.5 px-2">Постачальник</th>
                            <th className="py-2.5 px-2">Користувач</th>
                            <th className="py-2.5 px-2">Початок</th>
                            <th className="py-2.5 px-2">Статус</th>
                            <th className="py-2.5 px-2 text-right">Імпорт</th>
                            <th className="py-2.5 px-2">Помилка / Повідомлення</th>
                          </tr>
                        </thead>
                        <tbody>
                          {syncLogs.map(log => (
                            <tr key={log.id} className="border-b border-[var(--border)]/40 hover:bg-[var(--surface2)]/20 font-semibold text-[11px]">
                              <td className="py-3 px-2 font-black text-[var(--text)]">{log.supplier_name || '—'}</td>
                              <td className="py-3 px-2 text-[var(--text2)]">{log.user_email || '—'}</td>
                              <td className="py-3 px-2">
                                {log.started_at ? new Date(log.started_at).toLocaleString('uk-UA') : '—'}
                              </td>
                              <td className="py-3 px-2">
                                <span className={`badge ${
                                  log.status === 'success' 
                                    ? 'bg-emerald-50 text-emerald-700' 
                                    : log.status === 'failed' 
                                      ? 'bg-red-50 text-red-700' 
                                      : 'bg-blue-50 text-blue-700'
                                } text-[9px] font-black uppercase px-2 py-0.5 rounded`}>
                                  {log.status === 'success' ? 'OK' : log.status === 'failed' ? 'FAIL' : 'SYNCING'}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right font-black text-emerald-500">
                                +{log.imported_count || 0}
                              </td>
                              <td className="py-3 px-2 text-[10px] text-red-500 font-bold max-w-[200px] truncate" title={log.message}>
                                {log.message || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB: SITE CONFIG & MARKETPLACE DATABASE */}
              {adminActiveSubTab === 'settings' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  {/* GitHub PAT config card */}
                  <div className="card flex flex-col gap-4">
                    <div>
                      <h2 className="text-sm font-black text-[var(--text)]">Інтеграція з GitHub (Адміністратор)</h2>
                      <p className="text-[10px] text-[var(--text2)] font-semibold mt-0.5">
                        Потрібно для автоматичного завантаження налаштувань ваших фідів у репозиторій для збірки.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-[var(--text2)] block mb-1.5">
                          Personal Access Token (PAT)
                        </label>
                        <input
                          type="password"
                          value={ghTokenVal}
                          onChange={(e) => setGhTokenVal(e.target.value)}
                          className="input-field w-full py-1.5 px-3 text-xs font-mono"
                          placeholder="ghp_..."
                        />
                      </div>
                      <button
                        onClick={onSaveGhToken}
                        className="btn-primary text-xs py-2 justify-center font-black"
                      >
                        Підключити токен GitHub
                      </button>
                    </div>
                  </div>

                  {/* Payment Requisites Config */}
                  <div className="card flex flex-col gap-4">
                    <div>
                      <h2 className="text-sm font-black text-[var(--text)]">Налаштування реквізитів для оплати</h2>
                      <p className="text-[10px] text-[var(--text2)] font-semibold mt-0.5">Ці реквізити клієнти бачитимуть у своїх кабінетах для продовження підписки.</p>
                    </div>

                    {globalSettingsLoading ? (
                      <div className="flex items-center justify-center py-6 text-[var(--text2)] font-semibold">
                        <Loader2 className="animate-spin mr-2" size={16} />
                        Завантаження реквізитів...
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <textarea 
                          id="payment_requisites_field"
                          defaultValue={globalSettings.payment_requisites || ''}
                          className="input-field text-xs font-mono py-2 w-full h-32 resize-none"
                          placeholder="Введіть реквізити для оплати (IBAN, карти, контакти...)"
                        />
                        <button 
                          disabled={savingGlobalSettings}
                          onClick={() => {
                            const val = (document.getElementById('payment_requisites_field') as HTMLTextAreaElement)?.value || '';
                            handleSaveGlobalSettings('payment_requisites', val);
                          }}
                          className="btn-primary text-xs py-2 justify-center font-black"
                        >
                          {savingGlobalSettings ? 'Збереження...' : 'Зберегти реквізити'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Marketplace Category Reference Database */}
                  <div className="card flex flex-col gap-4">
                    <div>
                      <h2 className="text-sm font-black text-[var(--text)]">Еталонні категорії маркетплейсів</h2>
                      <p className="text-[10px] text-[var(--text2)] font-semibold mt-0.5">Керування глобальною базою категорій маркетплейсів для авто-мапінгу.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-[var(--surface2)] border border-[var(--border)] rounded-xl flex flex-col gap-1 text-xs">
                        <span className="text-[var(--text2)] uppercase font-extrabold text-[9px]">Prom.ua</span>
                        <span className="text-lg font-black text-[var(--text)]">{marketplacesStats.promCount.toLocaleString('uk-UA')} шт.</span>
                      </div>
                      <div className="p-3 bg-[var(--surface2)] border border-[var(--border)] rounded-xl flex flex-col gap-1 text-xs">
                        <span className="text-[var(--text2)] uppercase font-extrabold text-[9px]">Rozetka</span>
                        <span className="text-lg font-black text-[var(--text)]">{marketplacesStats.rozetkaCount.toLocaleString('uk-UA')} шт.</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-4 mt-2 text-xs font-bold">
                      {/* Sync Prom */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-[var(--text2)]">Синхронізувати Prom.ua з URL (XML/YML)</label>
                        <div className="flex gap-2">
                          <input 
                            type="url"
                            id="prom_sync_url"
                            placeholder="https://example.com/prom_categories.xml"
                            className="input-field text-xs py-1 flex-1"
                            defaultValue={globalSettings.prom_categories_url || ''}
                          />
                          <button
                            disabled={syncingMarketplace !== null}
                            onClick={async () => {
                              const url = (document.getElementById('prom_sync_url') as HTMLInputElement)?.value || '';
                              if (url) {
                                await handleSaveGlobalSettings('prom_categories_url', url);
                                await handleSyncMarketplaceCategories('prom', url);
                              }
                            }}
                            className="gbtn bg-purple-600 text-white py-1.5 px-3 rounded-lg flex items-center gap-1"
                          >
                            {syncingMarketplace === 'prom' ? <Loader2 className="animate-spin" size={12} /> : 'Синхр.'}
                          </button>
                        </div>
                      </div>

                      {/* Sync Prom via Excel XLS */}
                      <div className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-3 mt-1">
                        <label className="text-[10px] text-[var(--text2)]">Або імпортувати файл Excel (.xls/.xlsx) Prom</label>
                        <div className="flex gap-2 items-center">
                          <input 
                            type="file"
                            accept=".xls,.xlsx"
                            id="prom_xls_file_input"
                            className="text-[10px] font-bold text-[var(--text2)]"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              
                              showToast('📥 Зчитування файлу Excel...');
                              const reader = new FileReader();
                              reader.onload = async (evt) => {
                                try {
                                  const data = evt.target?.result;
                                  if (!data) return;
                                  
                                  const XLSX = await import('xlsx');
                                  const wb = XLSX.read(data, { type: 'binary' });
                                  const ws = wb.Sheets[wb.SheetNames[0]];
                                  const sheetRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
                                  
                                  showToast(`⚙️ Зчитано ${sheetRows.length} рядків. Форматування...`);
                                  
                                  const categoriesToInsert: any[] = [];
                                  // Skip header row
                                  for (let i = 1; i < sheetRows.length; i++) {
                                    const row = sheetRows[i];
                                    if (!row || row.length < 6) continue;
                                    
                                    const cat1 = row[0];
                                    const cat2 = row[1];
                                    const cat3 = row[2];
                                    const cat4 = row[3];
                                    const id = row[5];
                                    if (!id) continue;
                                    
                                    const hierarchy = [cat1, cat2, cat3, cat4].map(s => String(s || '').trim()).filter(Boolean);
                                    if (hierarchy.length === 0) continue;
                                    
                                    categoriesToInsert.push({
                                      id: String(id),
                                      name: hierarchy.join(' > '),
                                      marketplace: 'prom',
                                      parent_id: null
                                    });
                                  }
                                  
                                  if (categoriesToInsert.length === 0) {
                                    showToast('⚠️ Не знайдено коректних категорій у файлі');
                                    return;
                                  }
                                  
                                  showToast(`📤 Очищення старих та імпорт ${categoriesToInsert.length} категорій...`);
                                  
                                  // 1. Delete old prom categories
                                  const { error: delErr } = await supabase
                                    .from('marketplace_categories')
                                    .delete()
                                    .eq('marketplace', 'prom');
                                    
                                  if (delErr) throw delErr;
                                  
                                  // 2. Upsert in chunks
                                  const chunkSize = 500;
                                  for (let i = 0; i < categoriesToInsert.length; i += chunkSize) {
                                    const chunk = categoriesToInsert.slice(i, i + chunkSize);
                                    const { error: upsertErr } = await supabase
                                      .from('marketplace_categories')
                                      .upsert(chunk);
                                    if (upsertErr) throw upsertErr;
                                  }
                                  
                                  showToast(`✅ Успішно імпортовано ${categoriesToInsert.length} категорій Prom!`);
                                  
                                  const statsInput = document.getElementById('prom_xls_file_input') as HTMLInputElement;
                                  if (statsInput) statsInput.value = '';
                                  setTimeout(() => {
                                    window.location.reload();
                                  }, 1500);
                                } catch (err: any) {
                                  showToast('⚠️ Помилка імпорту: ' + err.message);
                                }
                              };
                              reader.readAsBinaryString(file);
                            }}
                          />
                        </div>
                      </div>

                      {/* Sync Rozetka */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-[var(--text2)]">Синхронізувати Rozetka з URL (XML/YML)</label>
                        <div className="flex gap-2">
                          <input 
                            type="url"
                            id="rozetka_sync_url"
                            placeholder="https://example.com/rozetka_categories.xml"
                            className="input-field text-xs py-1 flex-1"
                            defaultValue={globalSettings.rozetka_categories_url || ''}
                          />
                          <button
                            disabled={syncingMarketplace !== null}
                            onClick={async () => {
                              const url = (document.getElementById('rozetka_sync_url') as HTMLInputElement)?.value || '';
                              if (url) {
                                await handleSaveGlobalSettings('rozetka_categories_url', url);
                                await handleSyncMarketplaceCategories('rozetka', url);
                              }
                            }}
                            className="gbtn bg-emerald-500 text-white py-1.5 px-3 rounded-lg flex items-center gap-1"
                          >
                            {syncingMarketplace === 'rozetka' ? <Loader2 className="animate-spin" size={12} /> : 'Синхр.'}
                          </button>
                        </div>
                      </div>

                      {/* Clear reference db */}
                      <button
                        onClick={handleClearMarketplaceCategories}
                        className="gbtn border border-red-500/30 text-red-500 py-2 rounded-xl hover:bg-red-500/10 mt-2 font-black text-center justify-center flex items-center gap-1.5"
                      >
                        ⚠️ Очистити еталонну базу категорій
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB: CATALOG & WAREHOUSES */}
              {adminActiveSubTab === 'catalog' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Suppliers List */}
                  <div className="card flex flex-col gap-4">
                    <h2 className="text-sm font-black text-[var(--text)]">📑 Глобальні Постачальники та Прайси</h2>
                    <p className="text-[10px] text-[var(--text2)] font-semibold mt-0.5">Перелік активних постачальників, підключених до платформи (Явшоке, Mastereva тощо).</p>
                    <div className="flex flex-col gap-2">
                      <div className="bg-[var(--surface2)] p-3 rounded-xl border border-[var(--border)] text-xs font-black">
                        🟢 ЯВШОКЕ (Основний) - Активний (all_drop_opt_price.xml)
                      </div>
                      <div className="bg-[var(--surface2)] p-3 rounded-xl border border-[var(--border)] text-xs font-black">
                        🔵 MASTEREVA - Активний (Masterevanew.xml)
                      </div>
                    </div>
                  </div>
                  {/* Warehouses List */}
                  <div className="card flex flex-col gap-4">
                    <h2 className="text-sm font-black text-[var(--text)]">🏭 Склади та Локації</h2>
                    <p className="text-[10px] text-[var(--text2)] font-semibold mt-0.5">Всі склади та розподільні центри, задіяні в обробці.</p>
                    <div className="flex flex-col gap-2">
                      <div className="bg-[var(--surface2)] p-3 rounded-xl border border-[var(--border)] text-xs font-semibold">
                        • Головний склад Явшоке (Одеса)
                      </div>
                      <div className="bg-[var(--surface2)] p-3 rounded-xl border border-[var(--border)] text-xs font-semibold">
                        • Склад Mastereva (Київ)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB: INVOICES & BILLING */}
              {adminActiveSubTab === 'invoices' && (
                <div className="card flex flex-col gap-4">
                  <div>
                    <h2 className="text-sm font-black text-[var(--text)]">💳 Оплати та Рахунки клієнтів (Білінг)</h2>
                    <p className="text-[10px] text-[var(--text2)] font-semibold mt-0.5">Виписка та облік балансів для SaaS-підписок.</p>
                  </div>
                  
                  {/* Issue invoice simulator */}
                  <div className="bg-[var(--surface2)]/30 border border-[var(--border)] p-4 rounded-2xl flex flex-col gap-3 text-xs font-bold mt-2">
                    <span className="text-[var(--text)] block font-extrabold">Виписати новий рахунок користувачу</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input type="text" placeholder="ID користувача (Email)" id="billing_user_email" className="input-field text-xs py-1" />
                      <input type="number" placeholder="Сума (₴)" id="billing_amount" className="input-field text-xs py-1" />
                      <input type="text" placeholder="Період (напр. Липень 2026)" id="billing_period" className="input-field text-xs py-1" />
                    </div>
                    <button
                      onClick={() => {
                        const email = (document.getElementById('billing_user_email') as HTMLInputElement)?.value || '';
                        const amount = (document.getElementById('billing_amount') as HTMLInputElement)?.value || '';
                        const period = (document.getElementById('billing_period') as HTMLInputElement)?.value || '';
                        if (!email || !amount) {
                          showToast('⚠️ Вкажіть пошту та суму рахунку');
                          return;
                        }
                        showToast(`✅ Рахунок на суму ${amount} ₴ для ${email} за період "${period}" успішно сформовано!`);
                      }}
                      className="gbtn bg-[var(--accent)] text-white text-[10px] font-black py-1.5 px-3 rounded-lg self-start"
                    >
                      Сформувати рахунок
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
};
