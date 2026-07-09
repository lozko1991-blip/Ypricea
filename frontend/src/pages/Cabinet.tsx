import { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  User, 
  Settings, 
  PackageX, 
  FileCode, 
  Download, 
  Copy, 
  Loader2, 
  ChevronRight, 
  ChevronDown, 
  ShieldCheck,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  loadShardMap, 
  loadShard, 
  loadDescShard, 
  mapGet, 
  fetchGzipJSON 
} from '../lib/dataLoader';

interface OrderItem {
  id: string;
  name: string;
  count: number;
  price: number;
  salePrice: number;
}

interface Order {
  id: number;
  created_at: string;
  status: 'new' | 'processing' | 'shipped' | 'done' | 'cancelled';
  client_name: string;
  client_phone: string;
  client_city: string;
  payment_type: string;
  comment: string;
  items: OrderItem[] | string;
  total_sell: number;
  total_drop: number;
  ttn?: string;
  admin_notes?: string;
  droper_code?: string;
}

interface Profile {
  id: string;
  name: string;
  store_name: string;
  phone: string;
  status: 'pending' | 'active' | 'blocked';
  role: 'user' | 'admin';
  markup_pct: number;
  markup_grn: number;
  notes: string;
  allowed_exports: string[] | null;
  created_at?: string;
}

interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  count?: number;
  total?: number;
  src?: string;
}

const ORDER_STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  new: { label: 'Нове', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400' },
  processing: { label: 'Обробляється', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400' },
  shipped: { label: 'Відправлено', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400' },
  done: { label: 'Виконано', bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-600 dark:text-green-400' },
  cancelled: { label: 'Скасовано', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600 dark:text-red-400' }
};

export default function Cabinet() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'prices' | 'orders' | 'profile' | 'generator' | 'admin'>('prices');
  
  // Custom Toast State
  const [toast, setToast] = useState<string | null>(null);

  // Global Margin State (Client side downloads)
  const [markupPct, setMarkupPct] = useState<number>(profile?.markup_pct ?? 20);
  const [markupGrn, setMarkupGrn] = useState<number>(profile?.markup_grn ?? 0);

  // XML price list manifest states
  const [exportsList, setExportsList] = useState<any[]>([]);
  const [exportsLoading, setExportsLoading] = useState(false);

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Profile Edit State
  const [profileName, setProfileName] = useState(profile?.name ?? '');
  const [profileStore, setProfileStore] = useState(profile?.store_name ?? '');
  const [profilePhone, setProfilePhone] = useState(profile?.phone ?? '');
  const [profileSaving, setProfileSaving] = useState(false);

  // Admin Dashboard States (Users & All Orders)
  const [adminUsers, setAdminUsers] = useState<Profile[]>([]);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [expandedUserPanel, setExpandedUserPanel] = useState<string | null>(null);

  // Generator States (Admins Only)
  const [categories, setCategories] = useState<Category[]>([]);
  const [imgPrefix, setImgPrefix] = useState('https://crm.yavshoke.ua/media/shop//');
  const [generatorProducts, setGeneratorProducts] = useState<any[]>([]);
  const [generatorLoading, setGeneratorLoading] = useState(false);
  const [generatorStatus, setGeneratorStatus] = useState('');
  
  // Yavshoke Generator Settings
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

  // Mastereva Generator Settings
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

  // Modal Preset Saver States
  const [savePresetModalOpen, setSavePresetModalOpen] = useState(false);
  const [presetSaveType, setPresetSaveType] = useState<'yavshoke' | 'mastereva'>('yavshoke');
  const [ghTokenVal, setGhTokenVal] = useState(localStorage.getItem('utrade_gh_pat') || '');
  const [ghPushing, setGhPushing] = useState(false);

  // Category checkbox tree collapse state
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Show customized Toast notifications
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Sync state values on profile load
  useEffect(() => {
    if (profile) {
      setMarkupPct(profile.markup_pct ?? 20);
      setMarkupGrn(profile.markup_grn ?? 0);
      setProfileName(profile.name ?? '');
      setProfileStore(profile.store_name ?? '');
      setProfilePhone(profile.phone ?? '');
    }
  }, [profile]);

  // Load allowed XML manifests
  useEffect(() => {
    const fetchExports = async () => {
      setExportsLoading(true);
      try {
        const timestamp = Date.now();
        const [res1, res2] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/exports.json?_=${timestamp}`).catch(() => null),
          fetch(`${import.meta.env.BASE_URL}data/exports-me.json?_=${timestamp}`).catch(() => null)
        ]);

        const list1 = res1 && res1.ok ? (await res1.json()).exports || [] : [];
        const list2 = res2 && res2.ok ? (await res2.json()).exports || [] : [];
        
        setExportsList([...list1, ...list2]);
      } catch (e) {
        console.error('Failed to load manifests', e);
      } finally {
        setExportsLoading(false);
      }
    };
    fetchExports();
  }, []);

  // Fetch orders when orders tab becomes active
  useEffect(() => {
    if (activeTab === 'orders' && user) {
      const fetchOrders = async () => {
        setOrdersLoading(true);
        try {
          const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          setOrders(data as Order[]);
        } catch (e: any) {
          showToast('⚠️ Помилка завантаження замовлень: ' + e.message);
        } finally {
          setOrdersLoading(false);
        }
      };
      fetchOrders();
    }
  }, [activeTab, user]);

  // Fetch Admin dashboards data
  useEffect(() => {
    if (activeTab === 'admin' && profile?.role === 'admin') {
      const fetchAdminData = async () => {
        setAdminLoading(true);
        try {
          const [usersRes, ordersRes] = await Promise.all([
            supabase.from('profiles').select('*').order('created_at', { ascending: false }),
            supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100)
          ]);

          if (usersRes.error) throw usersRes.error;
          if (ordersRes.error) throw ordersRes.error;

          setAdminUsers(usersRes.data as Profile[]);
          setAdminOrders(ordersRes.data as Order[]);
        } catch (e: any) {
          showToast('⚠️ Помилка завантаження: ' + e.message);
        } finally {
          setAdminLoading(false);
        }
      };
      fetchAdminData();
    }
  }, [activeTab, profile]);

  // Lazy load categories & index products for generator tab
  useEffect(() => {
    if (activeTab === 'generator' && profile?.role === 'admin' && categories.length === 0) {
      const fetchGeneratorData = async () => {
        setGeneratorLoading(true);
        setGeneratorStatus('Завантаження бази категорій...');
        try {
          // 1. Fetch categories
          const timestamp = Date.now();
          const catsRes = await fetch(`${import.meta.env.BASE_URL}data/categories.json?_=${timestamp}`);
          if (catsRes.ok) {
            const json = await catsRes.json();
            setCategories(json.categories || []);
            if (json.meta?.imgPrefix) setImgPrefix(json.meta.imgPrefix);
          }

          // 2. Fetch gzipped index.json (5.6MB) for counting and local generation
          setGeneratorStatus('Завантаження бази товарів (~5.6 МБ)...');
          const productsData = await fetchGzipJSON(`${import.meta.env.BASE_URL}data/index.json.gz?_=${timestamp}`);
          setGeneratorProducts(productsData.products || []);
        } catch (e) {
          console.error('Failed loading generator database', e);
          showToast('⚠️ Не вдалося завантажити базу товарів.');
        } finally {
          setGeneratorLoading(false);
          setGeneratorStatus('');
        }
      };
      fetchGeneratorData();
    }
  }, [activeTab, profile, categories]);

  // Allowed Exports filtered by profile
  const allowedExports = useMemo(() => {
    if (profile?.role === 'admin') return exportsList;
    const allowed = profile?.allowed_exports || [];
    return exportsList.filter(e => allowed.includes(e.name));
  }, [exportsList, profile]);

  // Calculate client order statistics for completed/shipped shipments
  const orderStats = useMemo(() => {
    let totalSales = 0;
    let totalProfit = 0;
    let completedCount = 0;
    let processingCount = 0;

    orders.forEach(o => {
      if (o.status === 'done' || o.status === 'shipped') {
        totalSales += o.total_sell;
        totalProfit += (o.total_sell - o.total_drop);
        completedCount++;
      } else if (o.status === 'new' || o.status === 'processing') {
        processingCount++;
      }
    });

    return { totalSales, totalProfit, completedCount, processingCount };
  }, [orders]);

  // Download XML and replace prices on-the-fly inside the browser
  const handleDownloadWithMarkup = async (url: string, baseName: string) => {
    showToast('⏳ Завантаження та розрахунок XML...');
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const xmlText = await r.text();

      const transformed = xmlText.replace(/<price>(\d+(?:\.\d+)?)<\/price>/g, (_, p) => {
        const newPrice = Math.round(Number(p) * (1 + markupPct / 100) + markupGrn);
        return `<price>${newPrice}</price>`;
      });

      const suffix = (markupPct ? `+${markupPct}pct` : '') + (markupGrn ? `+${markupGrn}grn` : '');
      const filename = `${baseName}${suffix ? '-' + suffix : ''}.xml`;
      const blob = new Blob([transformed], { type: 'text/xml;charset=utf-8' });
      
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      a.click();
      
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
      showToast('✅ Готово: ' + filename);
    } catch (e: any) {
      showToast('⚠️ Помилка: ' + e.message);
    }
  };

  // Save profile and markups to Supabase
  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profileName,
          store_name: profileStore,
          phone: profilePhone,
          markup_pct: markupPct,
          markup_grn: markupGrn
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      showToast('✅ Профіль збережено!');
    } catch (e: any) {
      showToast('⚠️ Помилка збереження: ' + e.message);
    } finally {
      setProfileSaving(false);
    }
  };

  // Admin: Change dropshipper account status
  const handleSetUserStatus = async (uid: string, status: Profile['status']) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', uid);

      if (error) throw error;
      setAdminUsers(prev => prev.map(u => u.id === uid ? { ...u, status } : u));
      showToast('✅ Статус користувача оновлено!');
    } catch (e: any) {
      showToast('⚠️ Помилка: ' + e.message);
    }
  };

  // Admin: Save checkboxes for allowed price feeds
  const handleSaveUserExports = async (uid: string) => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(`.exp-cb[data-uid="${uid}"]`);
    const allowed = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ allowed_exports: allowed })
        .eq('id', uid);

      if (error) throw error;
      setAdminUsers(prev => prev.map(u => u.id === uid ? { ...u, allowed_exports: allowed } : u));
      showToast(`✅ Дозволено прайсів: ${allowed.length}`);
      setExpandedUserPanel(null);
    } catch (e: any) {
      showToast('⚠️ Помилка оновлення: ' + e.message);
    }
  };

  // Admin: Change order status
  const handleUpdateOrderStatus = async (id: number, status: Order['status']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      setAdminOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      showToast('✅ Статус замовлення змінено');
    } catch (e: any) {
      showToast('⚠️ Помилка: ' + e.message);
    }
  };

  // Admin: Save order TTN
  const handleSaveAdminTTN = async (id: number, ttnVal: string) => {
    const ttn = ttnVal.trim();
    const status = ttn ? 'shipped' : 'processing';
    try {
      const { error } = await supabase
        .from('orders')
        .update({ ttn, status })
        .eq('id', id);

      if (error) throw error;
      setAdminOrders(prev => prev.map(o => o.id === id ? { ...o, ttn, status } : o));
      showToast(ttn ? '🚚 ТТН додано, статус → Відправлено' : '📋 ТТН очищено');
    } catch (e: any) {
      showToast('⚠️ Помилка: ' + e.message);
    }
  };

  // Admin: Save order comments
  const handleSaveAdminNotes = async (id: number, notes: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ admin_notes: notes })
        .eq('id', id);

      if (error) throw error;
      setAdminOrders(prev => prev.map(o => o.id === id ? { ...o, admin_notes: notes } : o));
      showToast('✅ Коментар збережено');
    } catch (e: any) {
      showToast('⚠️ Помилка: ' + e.message);
    }
  };

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

  // Checkbox trees category collapse toggler
  const handleToggleTreeExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all category checkboxes helper
  const handleSelectAllCats = (type: 'yavshoke' | 'mastereva', checked: boolean) => {
    const list = categories.filter(c => type === 'yavshoke' ? (c.src !== 'mastereva') : (c.src === 'mastereva'));
    if (checked) {
      const ids = list.map(c => String(c.id));
      if (type === 'yavshoke') setYavSelectedCats(new Set(ids));
      else setMeSelectedCats(new Set(ids));
    } else {
      if (type === 'yavshoke') setYavSelectedCats(new Set());
      else setMeSelectedCats(new Set());
    }
  };

  // Dynamically calculate matching categories and products for Yavshoke generator panel
  const yavStats = useMemo(() => {
    if (!generatorProducts.length) return { selectedCatsCount: 0, productsCount: 0 };
    
    // Resolve selected cats + descendants
    const selected = new Set<string>();
    const childrenMap: Record<string, string[]> = {};
    categories.forEach(c => {
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

  // Dynamically calculate matching categories and products for Mastereva generator panel
  const meStats = useMemo(() => {
    if (!generatorProducts.length) return { selectedCatsCount: 0, productsCount: 0 };
    
    // Resolve selected cats + descendants
    const selected = new Set<string>();
    const childrenMap: Record<string, string[]> = {};
    categories.forEach(c => {
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

  // XML construction helpers
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

  // Run ensureFullMany to collect descriptions and pictures from shards
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

  // Compile XML string inside the browser
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

    // Categories section
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

  // Walk through selection, fetch shards, compile, and trigger XML download
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

    // 1. Gather all categories + children
    const finalCats = new Set<string>();
    const childrenMap: Record<string, string[]> = {};
    categories.forEach(c => {
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

    // 2. Filter matching products
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

    // 3. Lazy-fetch shards for descriptions & specs
    setGeneratorStatus('Завантаження характеристик з шардів...');
    try {
      await ensureFullMany(matchingProds, (done, total) => {
        setGeneratorStatus(`Завантаження шардів: ${done} / ${total}...`);
      });

      // Compute final prices
      const pct = type === 'yavshoke' ? yavPct : mePct;
      const grn = type === 'yavshoke' ? yavGrn : meGrn;
      const offers = matchingProds.map(p => ({
        ...p,
        finalPrice: Math.max(1, Math.round(p.pr * (1 + pct / 100) + grn))
      }));

      // Map categories
      const catById: Record<string, any> = {};
      categories.forEach(c => { catById[c.id] = c; });
      const pfxCats = new Map<string, string>();
      const catPrefix = type === 'yavshoke' ? yavCatPrefix : meCatPrefix;

      // Filter category tree to ancestors of selected
      const usedCats = new Set<string>();
      offers.forEach(o => {
        usedCats.add(String(o.c));
        getAncestors(String(o.c), categories).forEach(a => usedCats.add(String(a.id)));
      });

      categories.filter(c => usedCats.has(String(c.id))).forEach(c => {
        pfxCats.set(String(c.id), catPrefix + String(c.id));
      });

      // 4. Build XML text
      setGeneratorStatus('Компіляція XML...');
      const title = type === 'yavshoke' ? 'UTRADE Yavshoke' : 'UTRADE Mastereva';
      const xmlContent = buildPromXmlText(offers, catById, pfxCats, title, type);

      // Download file
      const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${type}_export_${new Date().toISOString().slice(0, 10)}.xml`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);

      showToast(`✅ Успішно завантажено: ${offers.length} товарів!`);
    } catch (e: any) {
      showToast('⚠️ Сталася помилка: ' + e.message);
    } finally {
      setGeneratorStatus('');
    }
  };

  // Compile Preset JSON object for generator
  const buildPresetJsonText = (type: 'yavshoke' | 'mastereva') => {
    const isYav = type === 'yavshoke';
    const obj: any = {
      name: isYav ? yavPresetName : mePresetName,
      cats: [...(isYav ? yavSelectedCats : meSelectedCats)],
      pct: isYav ? yavPct : mePct,
      grn: isYav ? yavGrn : meGrn,
      min: isYav ? yavMinPrice : meMinPrice,
      avail: isYav ? yavAvailOnly : meAvailOnly
    };

    const idPrefix = isYav ? yavIdPrefix : meIdPrefix;
    const catPrefix = isYav ? yavCatPrefix : meCatPrefix;
    const addBrand = isYav ? yavAddBrand : meAddBrand;
    const defBrand = isYav ? yavDefaultBrand : meDefaultBrand;
    const fillParams = isYav ? yavFillParams : meFillParams;

    if (idPrefix) obj.idPrefix = idPrefix;
    if (catPrefix) obj.catPrefix = catPrefix;
    if (addBrand) {
      obj.addBrand = true;
      if (defBrand) obj.defaultBrand = defBrand;
    }
    if (fillParams) obj.fillParams = fillParams;

    return JSON.stringify(obj, null, 2);
  };

  // GitHub contents pusher
  const handlePushPresetToGitHub = async () => {
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

      // 1. Fetch SHA if file exists
      let sha: string | undefined = undefined;
      try {
        const r = await fetch(url, { headers });
        if (r.ok) {
          const j = await r.json();
          sha = j.sha;
        }
      } catch {}

      // 2. Encode to base64
      const base64Content = btoa(encodeURIComponent(jsonContent).replace(/%([0-9A-F]{2})/g, (_, p) => {
        return String.fromCharCode(parseInt(p, 16));
      }));

      const body: any = {
        message: commitMessage,
        content: base64Content
      };
      if (sha) body.sha = sha;

      // 3. Put to GitHub Contents API
      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `API error ${res.status}`);
      }

      showToast(`🚀 Пресет ${presetName} успішно збережено на GitHub! GitHub Actions запустився (~2 хв).`);
      setSavePresetModalOpen(false);
    } catch (e: any) {
      showToast('⚠️ Помилка автопушу: ' + e.message);
    } finally {
      setGhPushing(false);
    }
  };

  // Render checkbox tree recursion helper
  const renderCategoryCheckboxTree = (
    type: 'yavshoke' | 'mastereva', 
    selectedSet: Set<string>, 
    setSelectedSet: React.Dispatch<React.SetStateAction<Set<string>>>,
    searchQuery: string
  ) => {
    const list = categories.filter(c => type === 'yavshoke' ? (c.src !== 'mastereva') : (c.src === 'mastereva'));
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

  const handleSaveGhToken = () => {
    localStorage.setItem('utrade_gh_pat', ghTokenVal.trim());
    showToast(ghTokenVal.trim() ? '🔑 Токен GitHub підключено!' : '🔓 Токен видалено');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Toast Alert Banner */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 text-white py-2 px-5 rounded-2xl shadow-xl font-bold text-xs select-none transition-all duration-300 transform animate-in slide-in-from-bottom-5">
          {toast}
        </div>
      )}

      {/* Header and LogOut */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-black mb-0.5">Особистий кабінет</h1>
          <p className="text-[var(--text2)] text-xs font-semibold">
            Вітаємо, {user?.email}
          </p>
        </div>
      </div>

      {/* Tabs navigation list */}
      <div className="flex border-b border-[var(--border)] gap-6 overflow-x-auto noscroll">
        <button 
          onClick={() => setActiveTab('prices')}
          className={`flex items-center gap-1.5 pb-2.5 border-b-2 font-black text-xs transition-colors whitespace-nowrap ${
            activeTab === 'prices' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <FileCode size={14} />
          Прайси
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-1.5 pb-2.5 border-b-2 font-black text-xs transition-colors whitespace-nowrap ${
            activeTab === 'orders' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <Package size={14} />
          Мої замовлення
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-1.5 pb-2.5 border-b-2 font-black text-xs transition-colors whitespace-nowrap ${
            activeTab === 'profile' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <User size={14} />
          Профіль
        </button>
        
        {/* Admin only tabs */}
        {profile?.role === 'admin' && (
          <>
            <button 
              onClick={() => setActiveTab('generator')}
              className={`flex items-center gap-1.5 pb-2.5 border-b-2 font-black text-xs transition-colors whitespace-nowrap ${
                activeTab === 'generator' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <Settings size={14} />
              Генератор прайсу
            </button>
            <button 
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 pb-2.5 border-b-2 font-black text-xs transition-colors whitespace-nowrap ${
                activeTab === 'admin' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <ShieldCheck size={14} />
              Адмін-панель
            </button>
          </>
        )}
      </div>

      {/* Tab Contents */}
      <div className="mt-2">
        {/* Tab 1: Прайси (Price lists) */}
        {activeTab === 'prices' && (
          <div className="flex flex-col gap-6">
            {/* Markup adjustment controls */}
            <div className="card grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="sec-title mb-3 block">% від дроп-ціни</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[10, 15, 20, 25, 30].map(v => (
                    <button
                      key={v}
                      onClick={() => setMarkupPct(v)}
                      className={`gbtn text-xs py-1 px-3 ${markupPct === v ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface2)] text-[var(--text)] border border-[var(--border)]'}`}
                    >
                      +{v}%
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={markupPct}
                    onChange={(e) => setMarkupPct(Math.max(0, Number(e.target.value)))}
                    className="input-field w-24 text-xs font-bold py-1 px-2"
                  />
                  <span className="text-xs font-bold text-[var(--text2)]">%</span>
                </div>
              </div>

              <div>
                <h3 className="sec-title mb-3 block">Фіксована надбавка (грн)</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[0, 50, 100, 150].map(v => (
                    <button
                      key={v}
                      onClick={() => setMarkupGrn(v)}
                      className={`gbtn text-xs py-1 px-3 ${markupGrn === v ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface2)] text-[var(--text)] border border-[var(--border)]'}`}
                    >
                      +{v} ₴
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={markupGrn}
                    onChange={(e) => setMarkupGrn(Math.max(0, Number(e.target.value)))}
                    className="input-field w-24 text-xs font-bold py-1 px-2"
                  />
                  <span className="text-xs font-bold text-[var(--text2)]">₴</span>
                </div>
              </div>

              <div className="md:col-span-2 border-t border-[var(--border)] pt-3 text-[10px] text-[var(--text2)] leading-relaxed font-semibold">
                * Розрахунок кінцевих цін у завантаженому прайсі відбувається у вашому браузері: Ціна = Дроп × (1 + Націнка%/100) + Націнка ₴.
              </div>
            </div>

            {/* Allowed prices list */}
            <div className="card">
              <h2 className="text-sm font-black mb-4 flex items-center gap-2">
                Доступні прайси
              </h2>
              {exportsLoading ? (
                <div className="flex items-center justify-center py-10 text-[var(--text2)]">
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Завантаження списку автопрайсів...
                </div>
              ) : allowedExports.length === 0 ? (
                <div className="text-center py-12 text-[var(--text2)]">
                  <PackageX size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-extrabold text-xs">Прайси ще не призначені. Зверніться до адміністратора.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {allowedExports.map((e, idx) => (
                    <div 
                      key={e.name} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[var(--surface2)] border border-[var(--border)] rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-xs shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-xs text-[var(--text)]">{e.name}.xml</h3>
                          <span className="text-[10px] font-bold text-[var(--text2)]">
                            {e.count?.toLocaleString('uk-UA')} товарів
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleDownloadWithMarkup(e.url, e.name)}
                          className="gbtn bg-[var(--accent)] text-white text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          <Download size={14} />
                          Завантажити
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(e.url);
                            showToast('📋 Посилання скопійовано!');
                          }}
                          className="gbtn bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs p-1.5"
                          title="Скопіювати посилання"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Мої замовлення */}
        {activeTab === 'orders' && (
          <div className="flex flex-col gap-6">
            {/* Order Stats Dashboard */}
            {!ordersLoading && orders.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
                <div className="card bg-[var(--surface2)] border border-[var(--border)] p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text2)]">Продажі (виконані)</span>
                  <span className="text-base font-black text-[var(--text)]">{orderStats.totalSales.toLocaleString('uk-UA')} ₴</span>
                </div>
                <div className="card bg-[var(--surface2)] border border-[var(--border)] p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text2)]">Зароблено прибутку</span>
                  <span className="text-base font-black text-emerald-500">{orderStats.totalProfit.toLocaleString('uk-UA')} ₴</span>
                </div>
                <div className="card bg-[var(--surface2)] border border-[var(--border)] p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text2)]">Виконаних угод</span>
                  <span className="text-base font-black text-[var(--text)]">{orderStats.completedCount}</span>
                </div>
                <div className="card bg-[var(--surface2)] border border-[var(--border)] p-4 flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text2)]">В процесі обробки</span>
                  <span className="text-base font-black text-amber-500">{orderStats.processingCount}</span>
                </div>
              </div>
            )}

            <div className="card">
              <h2 className="text-sm font-black mb-4">Історія моїх замовлень</h2>
              {ordersLoading ? (
                <div className="flex items-center justify-center py-12 text-[var(--text2)]">
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Завантаження замовлень...
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[var(--text2)]">
                  <PackageX size={44} className="mb-3 opacity-30" />
                  <p className="font-extrabold text-xs">У вас ще немає замовлень</p>
                </div>
              ) : (
                <div className="grid gap-4">
                {orders.map(o => {
                  const items: OrderItem[] = Array.isArray(o.items) 
                    ? o.items 
                    : (typeof o.items === 'string' ? JSON.parse(o.items) : []);
                  const status = ORDER_STATUS_MAP[o.status] || { label: o.status, bg: 'bg-slate-50', text: 'text-slate-600' };
                  const profit = Math.round(o.total_sell - o.total_drop);
                  const date = new Date(o.created_at).toLocaleString('uk-UA', { 
                    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' 
                  });

                  return (
                    <div 
                      key={o.id} 
                      className="p-4 bg-[var(--surface2)] border border-[var(--border)] rounded-2xl flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <span className="font-black text-sm text-[var(--text)]">Замовлення #{o.id}</span>
                          <span className="text-[10px] text-[var(--text2)] font-semibold ml-2">{date}</span>
                        </div>
                        <span className={`badge ${status.bg} ${status.text} font-black`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="text-[11px] text-[var(--text2)] font-medium">
                        Клієнт: <strong className="text-[var(--text)]">{o.client_name}</strong> · {o.client_phone} · {o.client_city}
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs pt-1 border-t border-[var(--border)]/50">
                        <span>
                          Продаж: <strong className="text-[var(--text)]">{o.total_sell.toLocaleString('uk-UA')} ₴</strong>
                        </span>
                        <span>
                          Закуп: <span className="text-[var(--text2)]">{o.total_drop.toLocaleString('uk-UA')} ₴</span>
                        </span>
                        <span>
                          Прибуток: <strong className={profit >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {profit >= 0 ? `+${profit}` : profit} ₴
                          </strong>
                        </span>
                        <span className="text-[var(--text2)]">{items.length} поз.</span>
                      </div>

                      {o.ttn && (
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl py-2 px-3 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--text2)]">ТТН Нової Пошти:</span>
                            <strong className="tracking-wider text-[var(--text)]">{o.ttn}</strong>
                          </div>
                          <a 
                            href={`https://novaposhta.ua/tracking/?cargo_number=${o.ttn}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-black text-[var(--accent)] hover:underline flex items-center gap-0.5 uppercase tracking-wider shrink-0"
                          >
                            Відстежити
                            <ChevronRight size={12} />
                          </a>
                        </div>
                      )}

                      {o.admin_notes && (
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl py-2 px-3 text-xs text-[var(--text2)] font-medium">
                          📋 Коментар адміністратора: <span className="text-[var(--text)] font-bold">{o.admin_notes}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Tab 3: Профіль (Profile settings) */}
        {activeTab === 'profile' && (
          <div className="card max-w-lg">
            <h2 className="text-sm font-black mb-4">Налаштування профілю</h2>
            <div className="space-y-4">
              <div>
                <label className="sec-title mb-1.5 block">Email</label>
                <input 
                  type="text" 
                  value={user?.email || ''} 
                  readOnly 
                  className="input-field w-full opacity-60 cursor-not-allowed text-xs font-semibold py-1.5" 
                />
              </div>
              <div>
                <label className="sec-title mb-1.5 block">Ваше імʼя *</label>
                <input 
                  type="text" 
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Прізвище та ім'я" 
                  className="input-field w-full text-xs font-bold py-1.5" 
                />
              </div>
              <div>
                <label className="sec-title mb-1.5 block">Назва магазину</label>
                <input 
                  type="text" 
                  value={profileStore}
                  onChange={(e) => setProfileStore(e.target.value)}
                  placeholder="Мій магазин" 
                  className="input-field w-full text-xs font-bold py-1.5" 
                />
              </div>
              <div>
                <label className="sec-title mb-1.5 block">Телефон (Telegram / Viber)</label>
                <input 
                  type="text" 
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="+380XXXXXXXXX" 
                  className="input-field w-full text-xs font-bold py-1.5" 
                />
              </div>
              <div className="flex items-center gap-2 py-1 text-xs">
                <span className="font-bold text-[var(--text2)]">Статус акаунту:</span>
                <span className={`badge ${
                  profile?.status === 'active' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-500/20' 
                    : 'bg-amber-50 text-amber-700 border border-amber-500/20'
                } font-black`}>
                  {profile?.status === 'active' ? 'Активний' : 'На розгляді'}
                </span>
              </div>
              <button 
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="btn-primary w-full justify-center text-xs py-2 font-black"
              >
                {profileSaving ? 'Збереження...' : 'Зберегти зміни'}
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Генератор прайсу (Admins Only) */}
        {activeTab === 'generator' && profile?.role === 'admin' && (
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
                  <h2 className="text-base font-black text-sky-600 dark:text-sky-400 pb-2 border-b border-[var(--border)]">
                    Генератор прайсу ЯВШОКЕ
                  </h2>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>Категорії ЯВШОКЕ</span>
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

                  {/* Settings grid */}
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
                        Тільки наявні
                      </label>
                    </div>
                    <div>
                      <label className="font-bold text-[var(--text2)] mb-1 block">ID Префікс</label>
                      <input type="text" placeholder="yav-" value={yavIdPrefix} onChange={(e) => setYavIdPrefix(e.target.value)} className="input-field w-full py-1.5 px-2" />
                    </div>
                    <div>
                      <label className="font-bold text-[var(--text2)] mb-1 block">Категорія Префікс</label>
                      <input type="text" placeholder="10000" value={yavCatPrefix} onChange={(e) => setYavCatPrefix(e.target.value)} className="input-field w-full py-1.5 px-2" />
                    </div>
                    <div className="col-span-2 py-1 flex flex-col gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                        <input type="checkbox" checked={yavAddBrand} onChange={(e) => setYavAddBrand(e.target.checked)} className="rounded border-[var(--border)] text-[var(--accent)]" />
                        Додати бренд до назви
                      </label>
                      {yavAddBrand && (
                        <div>
                          <label className="font-bold text-[var(--text2)] mb-1 block">Дефолтний бренд (якщо відсутній у картці)</label>
                          <input type="text" placeholder="UTRADE" value={yavDefaultBrand} onChange={(e) => setYavDefaultBrand(e.target.value)} className="input-field w-full py-1.5 px-2" />
                        </div>
                      )}
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                        <input type="checkbox" checked={yavFillParams} onChange={(e) => setYavFillParams(e.target.checked)} className="rounded border-[var(--border)] text-[var(--accent)]" />
                        Доповнити порожні характеристики
                      </label>
                    </div>
                  </div>

                  <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-2xl p-3 flex justify-between text-xs font-bold mt-2">
                    <span className="text-[var(--text2)]">Обрано категорій: {yavStats.selectedCatsCount}</span>
                    <span className="text-[var(--accent)]">Товарів у вигрузці: {yavStats.productsCount}</span>
                  </div>

                  <div className="flex flex-col gap-2 mt-2">
                    <button 
                      onClick={() => handleLocalGeneratorDownload('yavshoke')}
                      disabled={yavStats.productsCount === 0 || generatorStatus.length > 0}
                      className="gbtn w-full bg-[var(--accent)] text-white text-xs font-black py-2 rounded-xl"
                    >
                      Згенерувати ЯВШОКЕ XML
                    </button>
                    <button 
                      onClick={() => handleOpenPresetSaver('yavshoke')}
                      disabled={yavStats.productsCount === 0}
                      className="gbtn w-full bg-emerald-600 text-white text-xs font-black py-2 rounded-xl"
                    >
                      Зберегти як автопрайс
                    </button>
                  </div>
                </div>

                {/* Mastereva Generator */}
                <div className="card flex flex-col gap-4">
                  <h2 className="text-base font-black text-purple-600 dark:text-purple-400 pb-2 border-b border-[var(--border)]">
                    Генератор прайсу Mastereva
                  </h2>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>Категорії Mastereva</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleSelectAllCats('mastereva', true)}
                          className="text-[10px] font-black text-purple-600 hover:underline"
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

                  {/* Settings grid */}
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
                        Тільки наявні
                      </label>
                    </div>
                    <div>
                      <label className="font-bold text-[var(--text2)] mb-1 block">ID Префікс</label>
                      <input type="text" placeholder="ME-" value={meIdPrefix} onChange={(e) => setMeIdPrefix(e.target.value)} className="input-field w-full py-1.5 px-2" />
                    </div>
                    <div>
                      <label className="font-bold text-[var(--text2)] mb-1 block">Категорія Префікс</label>
                      <input type="text" placeholder="20000" value={meCatPrefix} onChange={(e) => setMeCatPrefix(e.target.value)} className="input-field w-full py-1.5 px-2" />
                    </div>
                    <div className="col-span-2 py-1 flex flex-col gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                        <input type="checkbox" checked={meAddBrand} onChange={(e) => setMeAddBrand(e.target.checked)} className="rounded border-[var(--border)] text-[var(--accent)]" />
                        Додати бренд до назви
                      </label>
                      {meAddBrand && (
                        <div>
                          <label className="font-bold text-[var(--text2)] mb-1 block">Дефолтний бренд</label>
                          <input type="text" placeholder="UTRADE" value={meDefaultBrand} onChange={(e) => setMeDefaultBrand(e.target.value)} className="input-field w-full py-1.5 px-2" />
                        </div>
                      )}
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                        <input type="checkbox" checked={meFillParams} onChange={(e) => setMeFillParams(e.target.checked)} className="rounded border-[var(--border)] text-[var(--accent)]" />
                        Доповнити порожні характеристики
                      </label>
                    </div>
                  </div>

                  <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-2xl p-3 flex justify-between text-xs font-bold mt-2">
                    <span className="text-[var(--text2)]">Обрано категорій: {meStats.selectedCatsCount}</span>
                    <span className="text-[var(--accent)]">Товарів у вигрузці: {meStats.productsCount}</span>
                  </div>

                  <div className="flex flex-col gap-2 mt-2">
                    <button 
                      onClick={() => handleLocalGeneratorDownload('mastereva')}
                      disabled={meStats.productsCount === 0 || generatorStatus.length > 0}
                      className="gbtn w-full bg-[var(--accent)] text-white text-xs font-black py-2 rounded-xl"
                    >
                      Згенерувати Mastereva XML
                    </button>
                    <button 
                      onClick={() => handleOpenPresetSaver('mastereva')}
                      disabled={meStats.productsCount === 0}
                      className="gbtn w-full bg-emerald-600 text-white text-xs font-black py-2 rounded-xl"
                    >
                      Зберегти як автопрайс
                    </button>
                  </div>
                </div>

                {/* Progress banner for local generation */}
                {generatorStatus && (
                  <div className="xl:col-span-2 bg-[var(--surface)] border border-[var(--accent)]/40 p-4 rounded-2xl flex items-center justify-center font-bold text-xs gap-3">
                    <Loader2 className="animate-spin text-[var(--accent)]" size={16} />
                    <span>{generatorStatus}</span>
                  </div>
                )}

                {/* GitHub Token Setup card */}
                <div className="xl:col-span-2 card">
                  <h3 className="text-sm font-black mb-3">Налаштування з'єднання з GitHub</h3>
                  <p className="text-[10px] text-[var(--text2)] mb-3 leading-relaxed">
                    Для збереження автопрайсів у репозиторій введіть свій **Personal Access Token (PAT)**. Він зберігається суто у локальному пам'яті (`localStorage`) вашого браузера.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                      type="password" 
                      placeholder="github_pat_..." 
                      value={ghTokenVal}
                      onChange={(e) => setGhTokenVal(e.target.value)}
                      className="input-field flex-1 text-xs py-1.5"
                    />
                    <button 
                      onClick={handleSaveGhToken}
                      className="gbtn bg-[var(--text)] text-[var(--surface)] text-xs font-black py-1.5 px-4"
                    >
                      Зберегти токен
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Адмін-панель (Admins Only) */}
        {activeTab === 'admin' && profile?.role === 'admin' && (
          <div className="flex flex-col gap-6">
            {adminLoading ? (
              <div className="flex items-center justify-center py-20 text-[var(--text2)]">
                <Loader2 className="animate-spin mr-2" size={24} />
                Завантаження панелі адміністрування...
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Dropshipper Profiles Management */}
                <div className="card xl:col-span-2 flex flex-col gap-4">
                  <h2 className="text-sm font-black text-[var(--text)] pb-2 border-b border-[var(--border)]">
                    Користувачі ({adminUsers.length})
                  </h2>
                  <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-1 noscroll">
                    {adminUsers.map(u => {
                      const allowed = u.allowed_exports || [];
                      const isMe = u.id === user?.id;
                      const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString('uk-UA') : '';
                      const isExpanded = expandedUserPanel === u.id;

                      return (
                        <div key={u.id} className="p-4 bg-[var(--surface2)] border border-[var(--border)] rounded-2xl flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <h3 className="font-extrabold text-xs text-[var(--text)] flex items-center gap-1.5">
                                {u.name || '—'}
                                {isMe && <span className="text-[10px] text-[var(--text2)] font-bold">(Ви)</span>}
                              </h3>
                              <p className="text-[10px] text-[var(--text2)] font-semibold mt-0.5">
                                {u.store_name || 'Магазин не вказано'} · {dateStr}
                              </p>
                              <p className="text-[10px] text-[var(--text2)] font-semibold mt-0.5">
                                Націнка: {u.markup_pct ?? 20}% + {u.markup_grn ?? 0}₴
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className={`badge ${
                                u.status === 'active' 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-500/20' 
                                  : u.status === 'blocked'
                                    ? 'bg-red-50 text-red-700 border border-red-500/20'
                                    : 'bg-amber-50 text-amber-700 border border-amber-500/20'
                              } font-black uppercase text-[8px]`}>
                                {u.status}
                              </span>

                              {!isMe && (
                                <div className="flex gap-1.5">
                                  {u.status !== 'active' && (
                                    <button 
                                      onClick={() => handleSetUserStatus(u.id, 'active')}
                                      className="gbtn bg-emerald-500 text-white py-1 px-2.5 rounded-lg text-[10px]"
                                    >
                                      Активувати
                                    </button>
                                  )}
                                  {u.status !== 'blocked' && (
                                    <button 
                                      onClick={() => handleSetUserStatus(u.id, 'blocked')}
                                      className="gbtn bg-red-500 text-white py-1 px-2.5 rounded-lg text-[10px]"
                                    >
                                      Блок
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setExpandedUserPanel(isExpanded ? null : u.id)}
                                    className="gbtn bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)] font-bold py-1 px-2.5 rounded-lg text-[10px]"
                                  >
                                    Прайси ({allowed.length})
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* XML Feeds checkboxes for current user */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-col gap-2">
                              <span className="font-extrabold text-[10px] text-[var(--text2)]">Дозволені прайси:</span>
                              <div className="flex flex-wrap gap-2">
                                {exportsList.map(e => (
                                  <label 
                                    key={e.name} 
                                    className="flex items-center gap-1.5 cursor-pointer bg-[var(--surface)] border border-[var(--border)] rounded-xl py-1 px-3 text-[10px] font-bold"
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
                                className="gbtn bg-[var(--accent)] text-white text-[10px] font-black py-1.5 px-3 self-start rounded-xl mt-1.5"
                              >
                                Зберегти дозволи
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* All Orders Dashboard */}
                <div className="card flex flex-col gap-4">
                  <h2 className="text-sm font-black text-[var(--text)] pb-2 border-b border-[var(--border)]">
                    Останні замовлення ({adminOrders.length})
                  </h2>
                  <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-1 noscroll">
                    {adminOrders.map(o => {
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
          </div>
        )}
      </div>

      {/* Preset GitHub Saving Modal */}
      {savePresetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSavePresetModalOpen(false)} />
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl w-full max-w-lg p-5 relative z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-3 border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-sm font-black">
                  Автопрайс {presetSaveType === 'yavshoke' ? 'ЯВШОКЕ' : 'Mastereva'}
                </h3>
                <span className="text-[10px] text-[var(--text2)] font-bold">Оновлюється автоматично кожні 5 годин</span>
              </div>
              <button onClick={() => setSavePresetModalOpen(false)} className="text-[var(--text2)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>
            
            <p className="text-[10px] text-[var(--text2)] leading-relaxed mb-4">
              Зберігає вибрані категорії та націнку як файл-пресет. Після завантаження у репозиторій сервер автоматично перегенерує XML файл кожні 5 годин з актуальними цінами та наявністю.
            </p>

            <div className="space-y-4">
              <div>
                <label className="sec-title mb-1 block">Назва файлу (тільки латиниця)</label>
                <input 
                  type="text" 
                  value={presetSaveType === 'yavshoke' ? yavPresetName : mePresetName}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
                    if (presetSaveType === 'yavshoke') setYavPresetName(clean);
                    else setMePresetName(clean);
                  }}
                  className="input-field w-full text-xs font-bold py-1.5"
                  placeholder="export-1"
                />
              </div>

              <div>
                <label className="sec-title mb-1 block font-bold text-[var(--text2)]">Вміст файлу (.json)</label>
                <textarea 
                  readOnly 
                  rows={6}
                  value={buildPresetJsonText(presetSaveType)}
                  className="input-field w-full font-mono text-[10px] leading-relaxed resize-none bg-[var(--surface2)]"
                />
              </div>

              {/* GitHub Auth check & Push button */}
              <div className="p-3 bg-[var(--surface2)] border border-[var(--border)] rounded-2xl">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-bold text-[var(--text)]">Пуш у репозиторій GitHub</span>
                  <span className="flex items-center gap-1 font-bold">
                    {ghTokenVal.trim().length > 10 ? (
                      <span className="text-emerald-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Підключено</span>
                    ) : (
                      <span className="text-red-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Не підключено</span>
                    )}
                  </span>
                </div>

                {ghTokenVal.trim().length > 10 ? (
                  <button
                    onClick={handlePushPresetToGitHub}
                    disabled={ghPushing}
                    className="gbtn w-full bg-[var(--accent)] text-white text-xs font-black py-2 rounded-xl flex items-center justify-center gap-1.5"
                  >
                    {ghPushing && <Loader2 className="animate-spin" size={14} />}
                    {ghPushing ? 'Зберігаю...' : 'Запушити на GitHub'}
                  </button>
                ) : (
                  <p className="text-[9px] text-[var(--text2)] font-semibold text-center italic">
                    GitHub PAT не підключено. Спочатку введіть токен у нижньому блоці генератора.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
