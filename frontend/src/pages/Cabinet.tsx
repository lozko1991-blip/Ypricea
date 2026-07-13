import { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  User, 
  Settings, 
  FileCode, 
  Sliders 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchGzipJSON } from '../lib/dataLoader';

// Modular Subcomponents Imports
import { ClientPrices } from './cabinet/ClientPrices';
import { ClientOrders } from './cabinet/ClientOrders';
import { ClientProfile } from './cabinet/ClientProfile';
import { ClientFeeds } from './cabinet/ClientFeeds';
import { AdminCabinet } from './cabinet/AdminCabinet';

// Shared Interface Types
import type { Order, Profile, Category, SyncLog, GlobalSettings, CustomFeed } from './cabinet/CabinetTypes';

export default function Cabinet() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'prices' | 'orders' | 'profile' | 'generator' | 'admin' | 'custom_feeds'>('prices');
  
  // Custom Toast State
  const [toast, setToast] = useState<string | null>(null);

  // Global Margin State (Client side downloads)
  const [markupPct, setMarkupPct] = useState<number>(profile?.markup_pct ?? 20);
  const [markupGrn, setMarkupGrn] = useState<number>(profile?.markup_grn ?? 0);

  // Sync state values with profile once loaded
  useEffect(() => {
    if (profile) {
      setMarkupPct(profile.markup_pct ?? 20);
      setMarkupGrn(profile.markup_grn ?? 0);
      setProfileName(profile.name ?? '');
      setProfileStore(profile.store_name ?? '');
      setProfilePhone(profile.phone ?? '');
    }
  }, [profile]);

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
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [adminOrdersSearch, setAdminOrdersSearch] = useState('');
  const [adminOrdersStatusFilter, setAdminOrdersStatusFilter] = useState('all');

  // Generator States (Admins Only)
  const [categories, setCategories] = useState<Category[]>([]);
  const [imgPrefix, setImgPrefix] = useState('https://crm.yavshoke.ua/media/shop//');
  const [generatorProducts, setGeneratorProducts] = useState<any[]>([]);
  const [generatorLoading, setGeneratorLoading] = useState(false);
  const [generatorStatus, setGeneratorStatus] = useState('');
  const [ghTokenVal, setGhTokenVal] = useState(localStorage.getItem('utrade_gh_pat') || '');

  // ── CUSTOM FEEDS STATES ──
  const [customFeeds, setCustomFeeds] = useState<CustomFeed[]>([]);
  const [customFeedsLoading, setCustomFeedsLoading] = useState(false);
  const [savingFeed, setSavingFeed] = useState(false);

  // ── ADMIN SaaS STATES ──
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncLogsLoading, setSyncLogsLoading] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({ payment_requisites: '' });
  const [globalSettingsLoading, setGlobalSettingsLoading] = useState(false);
  const [savingGlobalSettings, setSavingGlobalSettings] = useState(false);
  const [marketplacesStats, setMarketplacesStats] = useState({ promCount: 0, rozetkaCount: 0 });
  const [syncingMarketplace, setSyncingMarketplace] = useState<string | null>(null);
  const [triggeringBuild, setTriggeringBuild] = useState(false);

  // Toast Helper
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch exports list manifest from repository
  useEffect(() => {
    const fetchExports = async () => {
      setExportsLoading(true);
      try {
        const timestamp = Date.now();
        const res = await fetch(`data/exports.json?_=${timestamp}`);
        if (res.ok) {
          const data = await res.json();
          setExportsList(data.exports || []);
        }
      } catch (e) {
        console.error('Failed loading exports index', e);
      } finally {
        setExportsLoading(false);
      }
    };
    fetchExports();
  }, []);

  const [workflowStatus, setWorkflowStatus] = useState<{
    status: string | null;
    conclusion: string | null;
    updated_at: string | null;
  }>({ status: null, conclusion: null, updated_at: null });

  const fetchWorkflowStatus = async () => {
    const token = localStorage.getItem('utrade_gh_pat') || ghTokenVal;
    if (!token) return;
    try {
      const repoUrl = localStorage.getItem('utrade_gh_repo') || 'https://github.com/lozko1991-blip/Ypricea.git';
      const cleanUrl = repoUrl.replace('.git', '');
      const parts = cleanUrl.split('/');
      const repoName = parts.pop();
      const repoOwner = parts.pop();
      if (!repoOwner || !repoName) return;

      const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/runs?per_page=1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.workflow_runs && data.workflow_runs.length > 0) {
          const run = data.workflow_runs[0];
          setWorkflowStatus({
            status: run.status, // queued, in_progress, completed
            conclusion: run.conclusion, // success, failure, etc.
            updated_at: run.updated_at
          });
        }
      }
    } catch (e) {
      console.warn('Failed checking GitHub workflow status', e);
    }
  };

  useEffect(() => {
    fetchWorkflowStatus();
    const interval = setInterval(fetchWorkflowStatus, 20000);
    return () => clearInterval(interval);
  }, [ghTokenVal]);

  // Fetch customer orders from Supabase
  const fetchOrders = async () => {
    if (!user) return;
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

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders();
    }
  }, [activeTab, user]);

  // Load Custom Feeds from Supabase user_feeds table (falling back to user-exports.json)
  const fetchCustomFeeds = async () => {
    if (!user) return;
    setCustomFeedsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_feeds')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setCustomFeeds(data as CustomFeed[]);
      } else {
        // Fallback to static manifest file
        const timestamp = Date.now();
        const res = await fetch(`data/user-exports.json?_=${timestamp}`);
        if (res.ok) {
          const fileData = await res.json();
          setCustomFeeds(fileData.exports || []);
        } else {
          setCustomFeeds([]);
        }
      }
    } catch (e) {
      console.error("Error loading user-feeds:", e);
      setCustomFeeds([]);
    } finally {
      setCustomFeedsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCustomFeeds();
    }
  }, [user]);

  // Lazy load categories & index products for generator tab
  useEffect(() => {
    if (activeTab === 'generator' && profile?.role === 'admin' && categories.length === 0) {
      const fetchGeneratorData = async () => {
        setGeneratorLoading(true);
        setGeneratorStatus('Завантаження бази категорій...');
        try {
          // 1. Fetch categories
          const timestamp = Date.now();
          const catsRes = await fetch(`data/categories.json?_=${timestamp}`);
          if (catsRes.ok) {
            const json = await catsRes.json();
            setCategories(json.categories || []);
            if (json.meta?.imgPrefix) setImgPrefix(json.meta.imgPrefix);
          }

          // 2. Fetch gzipped index.json (5.6MB) for counting and local generation
          setGeneratorStatus('Завантаження бази товарів (~5.6 МБ)...');
          const productsData = await fetchGzipJSON(`data/index.json.gz?_=${timestamp}`);
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

  // Fetch Admin Dashboards details
  const fetchSyncLogs = async () => {
    setSyncLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      setSyncLogs(data || []);
    } catch (e: any) {
      console.warn('Sync logs not available or RLS blocked:', e.message);
    } finally {
      setSyncLogsLoading(false);
    }
  };

  const fetchGlobalSettings = async () => {
    setGlobalSettingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*');
      if (error) throw error;
      const settingsMap: Record<string, string> = {};
      data?.forEach(s => {
        settingsMap[s.key] = s.value;
      });
      setGlobalSettings(prev => ({ ...prev, ...settingsMap }));
    } catch (e: any) {
      console.warn('Global settings not loaded:', e.message);
    } finally {
      setGlobalSettingsLoading(false);
    }
  };

  const handleSaveGlobalSettings = async (key: string, value: string) => {
    setSavingGlobalSettings(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
      setGlobalSettings(prev => ({ ...prev, [key]: value }));
      showToast('✅ Налаштування успішно збережено');
    } catch (e: any) {
      showToast('⚠️ Помилка збереження: ' + e.message);
    } finally {
      setSavingGlobalSettings(false);
    }
  };

  const fetchMarketplacesStats = async () => {
    try {
      const [promRes, rozetkaRes] = await Promise.all([
        supabase.from('marketplace_categories').select('*', { count: 'exact', head: true }).eq('marketplace', 'prom'),
        supabase.from('marketplace_categories').select('*', { count: 'exact', head: true }).eq('marketplace', 'rozetka')
      ]);
      setMarketplacesStats({
        promCount: promRes.count || 0,
        rozetkaCount: rozetkaRes.count || 0
      });
    } catch (e: any) {
      console.warn('Marketplace categories fetch failed:', e.message);
    }
  };

  const handleClearMarketplaceCategories = async () => {
    if (!confirm('Ви впевнені, що хочете очистити всі еталонні категорії?')) return;
    try {
      const { error } = await supabase.from('marketplace_categories').delete().neq('id', '');
      if (error) throw error;
      setMarketplacesStats({ promCount: 0, rozetkaCount: 0 });
      showToast('🗑️ Еталонні категорії очищено');
    } catch (e: any) {
      showToast('⚠️ Помилка очищення: ' + e.message);
    }
  };

  const handleSyncMarketplaceCategories = async (marketplace: string, url: string) => {
    if (!url) {
      showToast('⚠️ Введіть правильне посилання XML/YML');
      return;
    }
    setSyncingMarketplace(marketplace);
    try {
      showToast('📥 Завантаження та парсинг категорій у браузері...');
      const res = await fetch(url);
      if (!res.ok) throw new Error('Не вдалося завантажити XML');
      const text = await res.text();
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      const categoryNodes = xmlDoc.querySelectorAll('category');
      
      if (categoryNodes.length === 0) {
        throw new Error('У XML файлі не знайдено категорій');
      }

      showToast(`⚙️ Знайдено ${categoryNodes.length} категорій. Імпортуємо в Supabase...`);
      
      const itemsToInsert = Array.from(categoryNodes).map(node => ({
        id: node.getAttribute('id') || '',
        name: node.textContent?.trim() || '',
        marketplace,
        parent_id: node.getAttribute('parentId') || null
      })).filter(item => item.id && item.name);

      // Bulk insert in chunks of 500
      const chunkSize = 500;
      for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
        const chunk = itemsToInsert.slice(i, i + chunkSize);
        const { error } = await supabase.from('marketplace_categories').upsert(chunk);
        if (error) throw error;
      }

      showToast(`✅ Успішно завантажено категорій: ${itemsToInsert.length}`);
      await fetchMarketplacesStats();
    } catch (e: any) {
      showToast('⚠️ Помилка імпорту категорій: ' + e.message);
    } finally {
      setSyncingMarketplace(null);
    }
  };

  const handleAdjustUserBalance = async (userId: string, currentBalance: number, amount: number) => {
    if (isNaN(amount) || amount === 0) {
      showToast('⚠️ Введіть коректну суму');
      return;
    }
    const newBalance = Number((currentBalance + amount).toFixed(2));
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', userId);
      if (error) throw error;
      
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: newBalance } : u));
      showToast('✅ Баланс користувача оновлено');
    } catch (e: any) {
      showToast('⚠️ Помилка: ' + e.message);
    }
  };

  const handleUpdateUserSubscription = async (userId: string, plan: string, status: string, expiresAt: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_plan: plan,
          subscription_status: status,
          subscription_expires_at: expiresAt || null
        })
        .eq('id', userId);
      if (error) throw error;

      setAdminUsers(prev => prev.map(u => u.id === userId ? { 
        ...u, 
        subscription_plan: plan, 
        subscription_status: status, 
        subscription_expires_at: expiresAt 
      } : u));
      showToast('✅ Налаштування підписки збережено');
    } catch (e: any) {
      showToast('⚠️ Помилка збереження: ' + e.message);
    }
  };

  const handleTriggerBuild = async () => {
    const token = localStorage.getItem('utrade_gh_pat') || ghTokenVal;
    if (!token) {
      showToast('⚠️ Збережіть GitHub PAT токен у налаштуваннях перед запуском!');
      return;
    }
    setTriggeringBuild(true);
    try {
      const repoUrl = localStorage.getItem('utrade_gh_repo') || 'https://github.com/lozko1991-blip/Ypricea.git';
      const cleanUrl = repoUrl.replace('.git', '');
      const parts = cleanUrl.split('/');
      const repoName = parts.pop();
      const repoOwner = parts.pop();

      if (!repoOwner || !repoName) {
        throw new Error('Невірний формат посилання на репозиторій');
      }

      const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: 'manual_rebuild'
        })
      });

      if (res.status === 204) {
        showToast('🚀 Запит на збірку надіслано в GitHub Actions! Процес розпочнеться за декілька секунд.');
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Код відповіді: ${res.status}`);
      }
    } catch (e: any) {
      showToast('⚠️ Помилка запуску збірки: ' + e.message);
    } finally {
      setTriggeringBuild(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin' && profile?.role === 'admin') {
      const fetchAdminData = async () => {
        setAdminLoading(true);
        try {
          const [usersRes, ordersRes] = await Promise.all([
            supabase.from('profiles').select('*').order('created_at', { ascending: false }),
            supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(60)
          ]);
          
          if (usersRes.error) throw usersRes.error;
          if (ordersRes.error) throw ordersRes.error;

          setAdminUsers(usersRes.data as Profile[]);
          setAdminOrders(ordersRes.data as Order[]);
          
          await Promise.all([
            fetchSyncLogs(),
            fetchGlobalSettings(),
            fetchMarketplacesStats()
          ]);
        } catch (e: any) {
          showToast('⚠️ Помилка панелі адміністрування: ' + e.message);
        } finally {
          setAdminLoading(false);
        }
      };
      fetchAdminData();
    }
  }, [activeTab, profile]);

  // Profile Save Action
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

  // Admin Account Actions
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

  // Admin Order Actions
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

  // Custom Feeds Save Action (DB upsert + Github preset push)
  const handleSaveCustomFeed = async (feed: CustomFeed) => {
    setSavingFeed(true);
    const token = feed.token;
    const presetName = `user-feed-${token}`;
    const jsonContent = JSON.stringify(feed, null, 2);

    try {
      // 1. Save to Supabase user_feeds table
      const { error: sbError } = await supabase
        .from('user_feeds')
        .upsert({
          user_id: user?.id,
          name: feed.name,
          token: token,
          format: feed.format,
          suppliers: feed.suppliers,
          rules: feed.rules,
          category_mapping: feed.category_mapping
        }, { onConflict: 'token' });

      if (sbError) throw new Error('Помилка збереження в Supabase: ' + sbError.message);

      // 2. Push JSON configuration file to GitHub
      const owner = 'lozko1991-blip';
      const repo = 'Ypricea';
      const path = `presets/${presetName}.json`;
      const commitMessage = `feat: update custom user feed ${feed.name}`;
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

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `GitHub API error ${res.status}`);
      }

      showToast(`🚀 Фід "${feed.name}" збережено та надіслано на автозлиття!`);
      
      // Auto dispatch manual build trigger on save for instant processing
      handleTriggerBuild();
      
      fetchCustomFeeds();
    } catch (e: any) {
      showToast('⚠️ Помилка збереження фіду: ' + e.message);
    } finally {
      setSavingFeed(false);
    }
  };

  // Custom Feeds Delete Action (DB delete)
  const handleDeleteCustomFeed = async (token: string) => {
    try {
      const { error: sbError } = await supabase
        .from('user_feeds')
        .delete()
        .eq('token', token);
      if (sbError) throw sbError;

      showToast('🗑️ Фід успішно видалено з бази даних!');
      fetchCustomFeeds();
    } catch (e: any) {
      showToast('⚠️ Помилка видалення: ' + e.message);
    }
  };

  // ORDER_STATUS_MAP constant configuration
  const ORDER_STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
    new: { label: 'Нове', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400' },
    processing: { label: 'Обробляється', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400' },
    shipped: { label: 'Відправлено', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400' },
    done: { label: 'Виконано', bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-600 dark:text-green-400' },
    cancelled: { label: 'Скасовано', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600 dark:text-red-400' }
  };

  // Dynamically calculate order statistics for dashboard
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

  // Client markup compiler download pipeline
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

  // Allowed Exports filtered by user profile list permissions
  const allowedExports = useMemo(() => {
    const allowed = profile?.allowed_exports || [];
    return exportsList.filter(e => allowed.includes(e.name));
  }, [exportsList, profile]);

  const handleSaveGhToken = () => {
    localStorage.setItem('utrade_gh_pat', ghTokenVal.trim());
    showToast(ghTokenVal.trim() ? '🔑 Токен GitHub підключено!' : '🔓 Токен видалено');
  };

  const handleUpdateClientTTN = async (orderId: number, ttn: string) => {
    try {
      const { error: sbError } = await supabase
        .from('orders')
        .update({ ttn })
        .eq('id', orderId);
      if (sbError) throw sbError;
      showToast('✅ ТТН успішно збережено!');
      fetchOrders();
    } catch (e: any) {
      showToast('⚠️ Помилка оновлення ТТН: ' + e.message);
    }
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
          className={`flex items-center gap-1.5 pb-2 text-xs font-black border-b-2 transition-all uppercase whitespace-nowrap ${
            activeTab === 'prices' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <Package size={14} />
          Прайси
        </button>
        <button 
          onClick={() => setActiveTab('custom_feeds')}
          className={`flex items-center gap-1.5 pb-2 text-xs font-black border-b-2 transition-all uppercase whitespace-nowrap ${
            activeTab === 'custom_feeds' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <Sliders size={14} />
          Конструктор фіду
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-1.5 pb-2 text-xs font-black border-b-2 transition-all uppercase whitespace-nowrap ${
            activeTab === 'orders' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <Package size={14} />
          Мої замовлення
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-1.5 pb-2 text-xs font-black border-b-2 transition-all uppercase whitespace-nowrap ${
            activeTab === 'profile' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <User size={14} />
          Профіль
        </button>

        {profile?.role === 'admin' && (
          <>
            <button 
              onClick={() => setActiveTab('generator')}
              className={`flex items-center gap-1.5 pb-2 text-xs font-black border-b-2 transition-all uppercase whitespace-nowrap text-sky-600 dark:text-sky-400 ${
                activeTab === 'generator' ? 'border-sky-500 text-sky-500 font-extrabold' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <FileCode size={14} />
              Генератор
            </button>
            <button 
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 pb-2 text-xs font-black border-b-2 transition-all uppercase whitespace-nowrap text-emerald-600 dark:text-emerald-400 ${
                activeTab === 'admin' ? 'border-emerald-500 text-emerald-500 font-extrabold' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <Settings size={14} />
              Адмінпанель
            </button>
          </>
        )}
      </div>

      {/* Main Tab Routing switcher */}
      <div className="mt-2">
        {activeTab === 'prices' && (
          <ClientPrices 
            allowedExports={allowedExports}
            exportsLoading={exportsLoading}
            markupPct={markupPct}
            setMarkupPct={setMarkupPct}
            markupGrn={markupGrn}
            setMarkupGrn={setMarkupGrn}
            handleDownloadWithMarkup={handleDownloadWithMarkup}
            showToast={showToast}
          />
        )}

        {activeTab === 'custom_feeds' && (
          <ClientFeeds 
            customFeeds={customFeeds}
            customFeedsLoading={customFeedsLoading}
            onSaveFeed={handleSaveCustomFeed}
            onDeleteFeed={handleDeleteCustomFeed}
            savingFeed={savingFeed}
            ghTokenVal={ghTokenVal}
            user={user}
            showToast={showToast}
            exportsList={exportsList}
            workflowStatus={workflowStatus}
            onRefreshWorkflow={fetchWorkflowStatus}
          />
        )}

        {activeTab === 'orders' && (
          <ClientOrders 
            orders={orders}
            ordersLoading={ordersLoading}
            orderStats={orderStats}
            ORDER_STATUS_MAP={ORDER_STATUS_MAP}
            onUpdateTTN={handleUpdateClientTTN}
          />
        )}

        {activeTab === 'profile' && (
          <ClientProfile 
            profileName={profileName}
            setProfileName={setProfileName}
            profileStore={profileStore}
            setProfileStore={setProfileStore}
            profilePhone={profilePhone}
            setProfilePhone={setProfilePhone}
            profileSaving={profileSaving}
            handleSaveProfile={handleSaveProfile}
            profile={profile}
            globalSettings={globalSettings}
            user={user}
          />
        )}

        {(activeTab === 'generator' || activeTab === 'admin') && profile?.role === 'admin' && (
          <AdminCabinet 
            activeTab={activeTab}
            user={user}
            adminUsers={adminUsers}
            adminOrders={adminOrders}
            adminLoading={adminLoading}
            adminUserSearch={adminUserSearch}
            setAdminUserSearch={setAdminUserSearch}
            adminOrdersSearch={adminOrdersSearch}
            setAdminOrdersSearch={setAdminOrdersSearch}
            adminOrdersStatusFilter={adminOrdersStatusFilter}
            setAdminOrdersStatusFilter={setAdminOrdersStatusFilter}
            expandedUserPanel={expandedUserPanel}
            setExpandedUserPanel={setExpandedUserPanel}
            handleSetUserStatus={handleSetUserStatus}
            handleUpdateUserSubscription={handleUpdateUserSubscription}
            handleAdjustUserBalance={handleAdjustUserBalance}
            handleSaveUserExports={handleSaveUserExports}
            handleUpdateOrderStatus={handleUpdateOrderStatus}
            handleSaveAdminTTN={handleSaveAdminTTN}
            handleSaveAdminNotes={handleSaveAdminNotes}
            exportsList={exportsList}
            customFeeds={customFeeds}
            syncLogs={syncLogs}
            syncLogsLoading={syncLogsLoading}
            onRefreshSyncLogs={fetchSyncLogs}
            globalSettings={globalSettings}
            globalSettingsLoading={globalSettingsLoading}
            savingGlobalSettings={savingGlobalSettings}
            handleSaveGlobalSettings={handleSaveGlobalSettings}
            marketplacesStats={marketplacesStats}
            syncingMarketplace={syncingMarketplace}
            handleSyncMarketplaceCategories={handleSyncMarketplaceCategories}
            handleClearMarketplaceCategories={handleClearMarketplaceCategories}
            triggeringBuild={triggeringBuild}
            handleTriggerBuild={handleTriggerBuild}
            categories={categories}
            generatorLoading={generatorLoading}
            generatorStatus={generatorStatus}
            setGeneratorStatus={setGeneratorStatus}
            generatorProducts={generatorProducts}
            imgPrefix={imgPrefix}
            ghTokenVal={ghTokenVal}
            setGhTokenVal={setGhTokenVal}
            onSaveGhToken={handleSaveGhToken}
            showToast={showToast}
            workflowStatus={workflowStatus}
          />
        )}
      </div>
    </div>
  );
}
