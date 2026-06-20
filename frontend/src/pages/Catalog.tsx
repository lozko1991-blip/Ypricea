import { useEffect, useState, useMemo } from 'react';
import { 
  Search, 
  Loader2, 
  PackageX, 
  ChevronRight, 
  ChevronDown, 
  ChevronLeft, 
  X, 
  Copy, 
  Filter 
} from 'lucide-react';
import { 
  getSupplierInfo, 
  YAVSHOKE, 
  MASTEREVA_DEFAULT, 
  MASTEREVA_SUPPLIERS 
} from '../lib/suppliers';
import { 
  loadShardMap, 
  loadShard, 
  loadDescShard, 
  mapGet 
} from '../lib/dataLoader';

interface CatalogProduct {
  id: string;
  a: number; // 1 = available, 0 = unavailable
  c: string; // catId
  pr: number; // price
  n: string; // name
  i?: string; // image
  s: string; // source
}

interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  count?: number;
  total?: number;
  src?: string;
}

interface IndexData {
  meta: any;
  imgPrefix: string;
  products: CatalogProduct[];
}

export default function Catalog() {
  const [data, setData] = useState<IndexData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  // Responsive mobile drawer
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modal State
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [fullDetails, setFullDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'desc' | 'params'>('desc');
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  // Fetch initial lightweight index and categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        const timestamp = Date.now();
        const [indexRes, catsRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/index.json?_=${timestamp}`),
          fetch(`${import.meta.env.BASE_URL}data/categories.json?_=${timestamp}`)
        ]);

        if (indexRes.ok && catsRes.ok) {
          const indexJson = await indexRes.json();
          const catsJson = await catsRes.json();
          setData(indexJson);
          setCategories(catsJson.categories || []);
        }
      } catch (e) {
        console.error('Failed to load catalog data', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch product full details (shard) when opening modal
  useEffect(() => {
    if (!selectedProduct) {
      setFullDetails(null);
      return;
    }

    const fetchDetails = async () => {
      setDetailsLoading(true);
      setActivePhotoIdx(0);
      setActiveTab('desc');
      try {
        const map = await loadShardMap();
        const shardNum = map[selectedProduct.id];
        if (!shardNum) {
          // Fallback to basic product
          setFullDetails({
            pics: selectedProduct.i ? [selectedProduct.i.startsWith('http') ? selectedProduct.i : `${data?.imgPrefix || ''}${selectedProduct.i}`] : [],
            params: [],
            desc: '',
            vendorCode: ''
          });
          setDetailsLoading(false);
          return;
        }

        const [shard, descShard] = await Promise.all([
          loadShard(shardNum),
          loadDescShard(shardNum)
        ]);

        const full = mapGet(shard, selectedProduct.id);
        const descObj = mapGet(descShard, selectedProduct.id);

        const pics = full?.pictures?.map((u: string) => 
          u && /^https?:/.test(u) ? u : (u ? `${data?.imgPrefix || ''}${u}` : '')
        ).filter(Boolean) || (selectedProduct.i ? [selectedProduct.i.startsWith('http') ? selectedProduct.i : `${data?.imgPrefix || ''}${selectedProduct.i}`] : []);

        const desc = descObj?.description_ua || descObj?.description || full?.description_ua || full?.description || full?.desc_ua || full?.desc || '';

        setFullDetails({
          pics,
          params: full?.params || [],
          desc,
          vendorCode: full?.vendorCode || '',
          barcode: full?.barcode || '',
          groupId: full?.group_id || ''
        });
      } catch (err) {
        console.error('Failed loading product details shard', err);
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchDetails();
  }, [selectedProduct, data]);

  // Reset page when filters change
  const handleSelectSupplier = (key: string) => {
    setSelectedSupplier(key);
    setSelectedCategory('all');
    setCurrentPage(1);
  };

  const handleSelectCategory = (id: string) => {
    setSelectedCategory(id);
    setCurrentPage(1);
    setIsMobileSidebarOpen(false);
    
    // Auto-expand selected category ancestors
    if (id !== 'all') {
      const ancestors = getAncestors(id, categories);
      setExpandedCategories(prev => {
        const next = new Set(prev);
        ancestors.forEach(a => next.add(String(a.id)));
        next.add(id);
        return next;
      });
    }
  };

  // Helper: Find parent categories
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

  const handleToggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Supplier product counts
  const supplierCounts = useMemo(() => {
    const counts: Record<string, number> = { all: data?.products.length || 0 };
    data?.products.forEach(p => {
      const s = p.s || 'yavshoke';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [data]);

  // List of active suppliers with products
  const activeSuppliers = useMemo(() => {
    const allSuppliers = [
      YAVSHOKE,
      ...MASTEREVA_SUPPLIERS,
      MASTEREVA_DEFAULT
    ];
    return allSuppliers.filter(s => (supplierCounts[s.key] || 0) > 0);
  }, [supplierCounts]);

  // Dynamically calculate category product counts for the active supplier
  const categoryStats = useMemo(() => {
    const direct: Record<string, number> = {};
    const total: Record<string, number> = {};
    
    if (!data || !categories.length) return { direct, total };

    // 1. Direct counts for the active supplier
    data.products.forEach(p => {
      if (selectedSupplier === 'all' || p.s === selectedSupplier) {
        direct[p.c] = (direct[p.c] || 0) + 1;
      }
    });

    // 2. Child mapping
    const childrenMap: Record<string, string[]> = {};
    categories.forEach(c => {
      const pid = String(c.parentId || '');
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(String(c.id));
    });

    // 3. Recursive summation
    const visited = new Set<string>();
    const calculateTotal = (id: string): number => {
      if (visited.has(id)) return total[id] || 0;
      visited.add(id);
      let sum = direct[id] || 0;
      (childrenMap[id] || []).forEach(childId => {
        sum += calculateTotal(childId);
      });
      total[id] = sum;
      return sum;
    };

    // Calculate from roots
    const categoryIdsSet = new Set(categories.map(c => String(c.id)));
    categories.forEach(c => {
      const pid = c.parentId ? String(c.parentId) : '';
      if (!pid || !categoryIdsSet.has(pid)) {
        calculateTotal(String(c.id));
      }
    });

    // Fallbacks
    categories.forEach(c => {
      const cid = String(c.id);
      if (total[cid] === undefined) {
        total[cid] = direct[cid] || 0;
      }
    });

    return { direct, total };
  }, [data, categories, selectedSupplier]);

  // Set of category IDs that have products (reachable)
  const reachableCategoryIds = useMemo(() => {
    const reachable = new Set<string>();
    categories.forEach(c => {
      const cid = String(c.id);
      if ((categoryStats.total[cid] || 0) > 0) {
        reachable.add(cid);
      }
    });
    return reachable;
  }, [categories, categoryStats]);

  // Collect category search matches
  const searchMatchingCategoryIds = useMemo(() => {
    if (!categorySearchTerm.trim()) return null;
    const matched = new Set<string>();
    const term = categorySearchTerm.toLowerCase();
    
    categories.forEach(c => {
      if (c.name.toLowerCase().includes(term)) {
        const cid = String(c.id);
        matched.add(cid);
        getAncestors(cid, categories).forEach(a => matched.add(String(a.id)));
      }
    });
    return matched;
  }, [categories, categorySearchTerm]);

  // Get active category branch IDs
  const activeBranchCategoryIds = useMemo(() => {
    if (selectedCategory === 'all') return null;
    const ids = new Set<string>();
    
    const collect = (id: string) => {
      ids.add(id);
      categories.forEach(c => {
        if (String(c.parentId) === id && !ids.has(String(c.id))) {
          collect(String(c.id));
        }
      });
    };
    
    collect(selectedCategory);
    return ids;
  }, [categories, selectedCategory]);

  // Category Tree Search handler
  const handleCategorySearchChange = (q: string) => {
    setCategorySearchTerm(q);
    if (!q.trim()) return;
    const term = q.toLowerCase();
    setExpandedCategories(prev => {
      const next = new Set(prev);
      categories.forEach(c => {
        if (c.name.toLowerCase().includes(term)) {
          getAncestors(String(c.id), categories).forEach(a => next.add(String(a.id)));
        }
      });
      return next;
    });
  };

  // Filtered Products List
  const filteredProducts = useMemo(() => {
    if (!data) return [];
    return data.products.filter(p => {
      // 1. Supplier filter
      if (selectedSupplier !== 'all' && p.s !== selectedSupplier) return false;
      
      // 2. Category filter
      if (activeBranchCategoryIds && !activeBranchCategoryIds.has(p.c)) return false;
      
      // 3. Search text filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const nameMatch = p.n.toLowerCase().includes(term);
        const idMatch = p.id.toLowerCase().includes(term);
        if (!nameMatch && !idMatch) return false;
      }
      
      return true;
    });
  }, [data, selectedSupplier, activeBranchCategoryIds, searchTerm]);

  // Pagination Variables
  const totalProducts = filteredProducts.length;
  const totalPages = Math.ceil(totalProducts / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  // Render pagination controls with ellipsis logic
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      if (startPage > 2) {
        pages.push('...');
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      if (endPage < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return (
      <div className="flex items-center justify-center gap-1.5 mt-8 border-t border-[var(--border)] pt-6">
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--text2)] transition-all"
          aria-label="Попередня сторінка"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} className="w-9 h-9 flex items-center justify-center text-[var(--text2)] font-extrabold select-none">
                ...
              </span>
            );
          }

          const pageNum = p as number;
          const isActive = currentPage === pageNum;

          return (
            <button
              key={`page-${pageNum}`}
              onClick={() => setCurrentPage(pageNum)}
              className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all ${
                isActive
                  ? 'bg-[var(--accent)] text-white shadow-sm shadow-blue-500/20'
                  : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)]'
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--text2)] transition-all"
          aria-label="Наступна сторінка"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  };


  // HTML format helper
  const formatDescription = (raw: string) => {
    if (!raw || !raw.trim()) return '';
    if (/<(p|ul|ol|li|br|div|h[1-6]|strong|table)\b/i.test(raw)) {
      return raw.replace(/<p>\s*<\/p>/gi, '').replace(/<p><br\s*\/?>\s*<\/p>/gi, '');
    }
    const esc = raw.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
    return '<p>' + esc.replace(/\n+/g, '</p><p>') + '</p>';
  };

  // Copy modal details helper
  const copyModalDescription = () => {
    if (!selectedProduct || !fullDetails) return;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = formatDescription(fullDetails.desc) || '';
    const plainTextDesc = tempDiv.textContent || tempDiv.innerText || '';
    
    let text = `${selectedProduct.n}\n\n`;
    text += `Ціна: ${selectedProduct.pr} ₴\n`;
    text += `ID: ${selectedProduct.id}\n`;
    if (fullDetails.vendorCode) text += `Артикул: ${fullDetails.vendorCode}\n`;
    text += `\n${plainTextDesc}\n`;

    if (fullDetails.params && fullDetails.params.length > 0) {
      text += `\nХарактеристики:\n`;
      fullDetails.params.forEach((pr: any) => {
        text += `${pr.name}: ${pr.value}\n`;
      });
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Render category tree row recursively
  const renderCategoryTree = () => {
    if (!categories.length) return null;
    
    const categoryMap = new Map(categories.map(c => [String(c.id), c]));
    
    // Root categories are those whose parent is not in the list or is null
    const roots = categories.filter(c => {
      const cid = String(c.id);
      const pid = c.parentId ? String(c.parentId) : '';
      return reachableCategoryIds.has(cid) && (!pid || !categoryMap.has(pid));
    });

    const rows: React.ReactNode[] = [];

    const buildNode = (c: Category, depth: number) => {
      const cid = String(c.id);
      const cnt = categoryStats.total[cid] || 0;
      if (cnt === 0) return;

      // Filter by category search matching
      if (searchMatchingCategoryIds && !searchMatchingCategoryIds.has(cid)) return;

      const kids = categories.filter(x => String(x.parentId || '') === cid && reachableCategoryIds.has(String(x.id)));
      const hasKids = kids.length > 0;
      const isExpanded = expandedCategories.has(cid);

      rows.push(
        <div
          key={cid}
          className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-xl cursor-pointer group transition-all select-none ${
            selectedCategory === cid
              ? 'bg-[var(--accent)] text-white font-bold shadow-sm shadow-blue-500/20'
              : 'text-[var(--text)] hover:bg-[var(--surface2)]'
          }`}
          style={{ paddingLeft: `${depth * 10 + 6}px` }}
          onClick={() => handleSelectCategory(cid)}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-4 h-4 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
              onClick={(e) => handleToggleExpand(e, cid)}
            >
              {hasKids && (isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}
            </span>
            <span className="truncate" title={c.name}>{c.name}</span>
          </div>
          <span className={`text-[10px] font-bold ml-2 shrink-0 ${selectedCategory === cid ? 'text-white/80' : 'text-[var(--text2)]'}`}>
            {cnt.toLocaleString('uk-UA')}
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4 text-[var(--text2)]">
        <Loader2 className="animate-spin" size={32} />
        <span className="font-bold">Завантаження каталогу...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Supplier Filtering Tabs */}
      <div className="flex gap-2 p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-x-auto noscroll">
        <button
          onClick={() => handleSelectSupplier('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all ${
            selectedSupplier === 'all'
              ? 'bg-[var(--text)] text-[var(--surface)]'
              : 'text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)]'
          }`}
        >
          Всі
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
            selectedSupplier === 'all' ? 'bg-[var(--surface)] text-[var(--text)]' : 'bg-[var(--surface2)] text-[var(--text2)]'
          }`}>
            {supplierCounts.all.toLocaleString('uk-UA')}
          </span>
        </button>

        {activeSuppliers.map(s => {
          const isActive = selectedSupplier === s.key;
          return (
            <button
              key={s.key}
              onClick={() => handleSelectSupplier(s.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all"
              style={{
                backgroundColor: isActive ? s.color : 'transparent',
                color: isActive ? '#fff' : 'var(--text2)'
              }}
            >
              <span 
                className="w-1.5 h-1.5 rounded-full" 
                style={{ backgroundColor: isActive ? '#fff' : s.color }}
              />
              {s.short}
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-black/10 text-[inherit]">
                {(supplierCounts[s.key] || 0).toLocaleString('uk-UA')}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-6 items-start">
        {/* Left Categories Tree (Desktop Sidebar) */}
        <aside className="card w-64 shrink-0 hidden lg:flex flex-col gap-4 sticky top-20 max-h-[calc(100vh-120px)] overflow-hidden">
          <div className="border-b border-[var(--border)] pb-2">
            <h2 className="text-sm font-black text-[var(--text)]">Категорії</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text2)]" size={14} />
            <input
              type="text"
              placeholder="Пошук категорії..."
              value={categorySearchTerm}
              onChange={(e) => handleCategorySearchChange(e.target.value)}
              className="input-field w-full pl-8 text-xs py-1.5"
            />
            {categorySearchTerm && (
              <button 
                onClick={() => handleCategorySearchChange('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text2)] hover:text-[var(--text)]"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="overflow-y-auto pr-1 flex-1 space-y-1 flex flex-col noscroll">
            <div
              onClick={() => handleSelectCategory('all')}
              className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-xl cursor-pointer font-extrabold transition-all ${
                selectedCategory === 'all'
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)]'
              }`}
            >
              <span>Всі категорії</span>
              <span>
                {(selectedSupplier === 'all' ? supplierCounts.all : (supplierCounts[selectedSupplier] || 0)).toLocaleString('uk-UA')}
              </span>
            </div>
            {renderCategoryTree()}
          </div>
        </aside>

        {/* Right Main Grid */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="self-start">
              <h1 className="text-xl font-black mb-0.5">Каталог товарів</h1>
              <p className="text-[var(--text2)] text-xs font-semibold">
                Знайдено товарів: {totalProducts.toLocaleString('uk-UA')}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto shrink-0">
              {/* Category selector toggle on mobile */}
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="gbtn lg:hidden bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] shadow-sm"
              >
                <Filter size={16} />
                Категорія
              </button>
              
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text2)]" size={16} />
                <input 
                  type="text" 
                  placeholder="Пошук товарів..." 
                  className="input-field w-full pl-9 py-2 text-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          {paginatedProducts.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-24 text-[var(--text2)]">
              <PackageX size={48} className="mb-4 opacity-30" />
              <p className="font-extrabold text-sm">Товарів не знайдено</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedProducts.map(p => {
                  const imgUrl = p.i ? (p.i.startsWith('http') ? p.i : `${data?.imgPrefix || ''}${p.i}`) : '';
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => setSelectedProduct(p)}
                      className="card flex flex-col hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-pointer group"
                    >
                      <div className="aspect-square bg-[var(--surface2)] rounded-2xl overflow-hidden mb-3 relative flex items-center justify-center">
                        {imgUrl ? (
                          <img 
                            src={imgUrl} 
                            alt={p.n} 
                            className="max-h-[92%] max-w-[92%] object-contain mix-blend-multiply p-1 transition-transform duration-300 group-hover:scale-105" 
                            loading="lazy" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--text2)]">
                            <PackageX size={32} className="opacity-20" />
                          </div>
                        )}
                        {p.a === 0 && (
                          <div className="absolute top-2.5 left-2.5 bg-red-500/90 text-white text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider backdrop-blur-sm shadow-sm">
                            Немає
                          </div>
                        )}
                        <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full font-black tracking-wide">
                          ID: {p.id}
                        </div>
                      </div>
                      <div className="flex flex-col flex-1">
                        <h3 className="font-extrabold text-xs leading-snug line-clamp-2 mb-2 group-hover:text-[var(--accent)] transition-colors">
                          {p.n}
                        </h3>
                        <div className="mt-auto flex flex-wrap items-end justify-between gap-1 pt-1">
                          <div>
                            <span className="sec-title block mb-0.5">Опт ціна</span>
                            <span className="font-black text-base text-[var(--text)]">{p.pr} ₴</span>
                          </div>
                          {(() => {
                            const supplier = getSupplierInfo(p.s);
                            return (
                              <span 
                                className="badge shadow-sm" 
                                style={{ 
                                  backgroundColor: supplier.bg, 
                                  color: supplier.text,
                                  border: `1px solid ${supplier.color}30`
                                }}
                                title={supplier.label}
                              >
                                <span 
                                  className="inline-block w-1.5 h-1.5 rounded-full mr-0.5" 
                                  style={{ backgroundColor: supplier.color }}
                                />
                                {supplier.short}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination controls */}
              {renderPagination()}
            </>
          )}
        </div>
      </div>

      {/* Mobile Drawer (Sidebar) */}
      <div className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${isMobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileSidebarOpen(false)} />
        <div className={`absolute top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-[var(--surface)] border-r border-[var(--border)] p-5 flex flex-col gap-4 transition-transform duration-300 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <h2 className="text-sm font-black text-[var(--text)]">Категорії</h2>
            <button onClick={() => setIsMobileSidebarOpen(false)} className="text-[var(--text2)] hover:text-[var(--text)]">
              <X size={18} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text2)]" size={14} />
            <input
              type="text"
              placeholder="Пошук категорії..."
              value={categorySearchTerm}
              onChange={(e) => handleCategorySearchChange(e.target.value)}
              className="input-field w-full pl-8 text-xs py-1.5"
            />
            {categorySearchTerm && (
              <button 
                onClick={() => handleCategorySearchChange('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text2)] hover:text-[var(--text)]"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="overflow-y-auto pr-1 flex-1 space-y-1 flex flex-col noscroll">
            <div
              onClick={() => handleSelectCategory('all')}
              className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-xl cursor-pointer font-extrabold transition-all ${
                selectedCategory === 'all'
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)]'
              }`}
            >
              <span>Всі категорії</span>
              <span>
                {(selectedSupplier === 'all' ? supplierCounts.all : (supplierCounts[selectedSupplier] || 0)).toLocaleString('uk-UA')}
              </span>
            </div>
            {renderCategoryTree()}
          </div>
        </div>
      </div>

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur overlay */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300" 
            onClick={() => setSelectedProduct(null)} 
          />
          
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative z-10 shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] p-4 sm:p-5">
              <h2 className="text-sm sm:text-base font-black truncate max-w-[85%]" title={selectedProduct.n}>
                {selectedProduct.n}
              </h2>
              <button 
                onClick={() => setSelectedProduct(null)} 
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--surface2)] text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--border)] transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto flex flex-col md:flex-row min-h-0">
              {/* Photo Gallery (Left Side) */}
              <div className="w-full md:w-[42%] border-b md:border-b-0 md:border-r border-[var(--border)] p-4 flex flex-col gap-3 shrink-0">
                <div className="aspect-square w-full rounded-2xl bg-[var(--surface2)] flex items-center justify-center p-4 relative border border-[var(--border)]/50">
                  {detailsLoading ? (
                    <Loader2 className="animate-spin text-[var(--accent)]" size={32} />
                  ) : fullDetails?.pics?.length > 0 ? (
                    <img 
                      src={fullDetails.pics[activePhotoIdx]} 
                      alt={selectedProduct.n} 
                      className="max-h-full max-w-full object-contain mix-blend-multiply" 
                    />
                  ) : (
                    <div className="text-[var(--text2)] flex flex-col items-center justify-center gap-2">
                      <PackageX size={48} className="opacity-25" />
                      <span className="text-xs">Фото відсутні</span>
                    </div>
                  )}
                  {selectedProduct.a === 0 && (
                    <div className="absolute top-3 left-3 bg-red-500 text-white text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                      Немає
                    </div>
                  )}
                </div>

                {/* Thumbnails */}
                {fullDetails?.pics?.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto py-1 noscroll">
                    {fullDetails.pics.map((pic: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setActivePhotoIdx(idx)}
                        className={`aspect-square w-12 rounded-xl overflow-hidden shrink-0 border-2 bg-[var(--surface2)] p-1 ${
                          activePhotoIdx === idx ? 'border-[var(--accent)]' : 'border-transparent'
                        }`}
                      >
                        <img src={pic} className="w-full h-full object-contain mix-blend-multiply" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Details & Tabs (Right Side) */}
              <div className="flex-1 flex flex-col min-w-0 p-4 sm:p-5">
                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {(() => {
                    const sup = getSupplierInfo(selectedProduct.s);
                    return (
                      <span 
                        className="badge" 
                        style={{ backgroundColor: sup.bg, color: sup.text, border: `1px solid ${sup.color}25` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full mr-0.5" style={{ backgroundColor: sup.color }} />
                        {sup.label}
                      </span>
                    );
                  })()}
                  <span className="badge bg-[var(--surface2)] text-[var(--text2)]">
                    ID: {selectedProduct.id}
                  </span>
                  {fullDetails?.vendorCode && (
                    <span className="badge bg-[var(--surface2)] text-[var(--accent)] font-extrabold">
                      Арт: {fullDetails.vendorCode}
                    </span>
                  )}
                  <span className={`badge ${selectedProduct.a === 1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-500/20' : 'bg-red-50 text-red-700 border border-red-500/20'}`}>
                    {selectedProduct.a === 1 ? 'В наявності' : 'Немає'}
                  </span>
                </div>

                {/* Price layout */}
                <div className="mb-4 bg-[var(--surface2)] border border-[var(--border)] rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <span className="sec-title block mb-0.5">Опт ціна</span>
                    <span className="font-black text-2xl text-[var(--text)]">{selectedProduct.pr} ₴</span>
                  </div>
                  <div className="text-right">
                    <span className="sec-title block mb-0.5">Рекомендована</span>
                    <span className="font-bold text-xs text-[var(--text2)]">
                      {(Math.round(selectedProduct.pr * 1.25)).toLocaleString('uk-UA')} ₴ (+25%)
                    </span>
                  </div>
                </div>

                {/* Tabs selection */}
                <div className="flex border-b border-[var(--border)] gap-4 mb-4">
                  <button 
                    onClick={() => setActiveTab('desc')}
                    className={`pb-2 text-xs font-black border-b-2 transition-all flex items-center gap-1 ${
                      activeTab === 'desc' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
                    }`}
                  >
                    📄 Опис
                  </button>
                  <button 
                    onClick={() => setActiveTab('params')}
                    className={`pb-2 text-xs font-black border-b-2 transition-all flex items-center gap-1 ${
                      activeTab === 'params' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
                    }`}
                  >
                    📋 Характеристики
                  </button>
                </div>

                {/* Tabs content container */}
                <div className="flex-1 md:overflow-y-auto text-xs leading-relaxed pr-1 noscroll md:max-h-none overflow-visible">
                  {detailsLoading ? (
                    <div className="flex items-center justify-center py-10 text-[var(--text2)]">
                      <Loader2 className="animate-spin mr-2" size={16} />
                      Завантаження повної інформації...
                    </div>
                  ) : activeTab === 'desc' ? (
                    fullDetails?.desc ? (
                      <div 
                        className="space-y-2 text-[var(--text)] break-words prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: formatDescription(fullDetails.desc) }}
                      />
                    ) : (
                      <p className="text-[var(--text2)] italic py-4">Опис відсутній для цього товару.</p>
                    )
                  ) : (
                    fullDetails?.params && fullDetails.params.length > 0 ? (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-left text-[var(--text2)] font-black text-[10px] uppercase">
                            <th className="py-2 pr-4">Параметр</th>
                            <th className="py-2">Значення</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fullDetails.params.map((pm: any, idx: number) => (
                            <tr key={idx} className="border-b border-[var(--border)]/50 last:border-b-0 hover:bg-[var(--surface2)]/50">
                              <td className="py-2 pr-4 font-medium text-[var(--text2)]">{pm.name}</td>
                              <td className="py-2 font-bold text-[var(--text)]">{pm.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-[var(--text2)] italic py-4 text-center">Характеристики відсутні для цього товару.</p>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="border-t border-[var(--border)] p-4 flex gap-3 justify-end bg-[var(--surface2)]/50">
              <button 
                onClick={copyModalDescription}
                disabled={detailsLoading || !fullDetails}
                className="gbtn bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] active:scale-95 transition-all text-xs"
              >
                <Copy size={14} />
                {copied ? 'Скопійовано!' : 'Копіювати опис'}
              </button>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="gbtn bg-[var(--text)] text-[var(--surface)] text-xs active:scale-95 transition-all"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
