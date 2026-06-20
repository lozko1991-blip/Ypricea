import { useEffect, useState } from 'react';
import { Search, Loader2, PackageX } from 'lucide-react';
import { getSupplierInfo } from '../lib/suppliers';

interface CatalogProduct {
  id: string;
  a: number; // 1 = available, 0 = unavailable
  c: string; // catId
  pr: number; // price
  n: string; // name
  i?: string; // image
  s: string; // source
}

interface IndexData {
  meta: any;
  imgPrefix: string;
  products: CatalogProduct[];
}

export default function Catalog() {
  const [data, setData] = useState<IndexData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/data/index.json');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error('Failed to load catalog data', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredProducts = data?.products.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return p.n.toLowerCase().includes(term) || p.id.includes(term);
  }).slice(0, 100) || []; // Display first 100 results for perf

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
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Каталог товарів</h1>
          <p className="text-[var(--text2)] text-sm font-medium">
            Всього товарів: {data?.products.length.toLocaleString('uk-UA')}
          </p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text2)]" size={18} />
          <input 
            type="text" 
            placeholder="Пошук (назва, ID)..." 
            className="input-field w-full pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-[var(--text2)]">
          <PackageX size={48} className="mb-4 opacity-50" />
          <p className="font-bold">Товарів не знайдено</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map(p => {
            const imgUrl = p.i ? (p.i.startsWith('http') ? p.i : `${data?.imgPrefix || ''}${p.i}`) : '';
            return (
              <div key={p.id} className="card flex flex-col hover:-translate-y-1 transition-transform cursor-pointer group">
                <div className="aspect-square bg-[var(--surface2)] rounded-xl overflow-hidden mb-3 relative">
                  {imgUrl ? (
                    <img src={imgUrl} alt={p.n} className="w-full h-full object-contain mix-blend-multiply p-2" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--text2)]">
                      <PackageX size={32} className="opacity-20" />
                    </div>
                  )}
                  {p.a === 0 && (
                    <div className="absolute top-2 left-2 bg-red-500/90 text-white text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-wider backdrop-blur-sm">
                      Немає
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full font-black">
                    ID: {p.id}
                  </div>
                </div>
                <div className="flex flex-col flex-1">
                  <h3 className="font-bold text-sm leading-tight line-clamp-2 mb-2 group-hover:text-[var(--accent)] transition-colors">
                    {p.n}
                  </h3>
                  <div className="mt-auto flex items-end justify-between">
                    <div>
                      <span className="sec-title block mb-0.5">Опт ціна</span>
                      <span className="font-black text-lg text-[var(--text)]">{p.pr} ₴</span>
                    </div>
                    {(() => {
                      const supplier = getSupplierInfo(p.s);
                      return (
                        <span 
                          className="badge" 
                          style={{ 
                            backgroundColor: supplier.bg, 
                            color: supplier.text,
                            border: `1px solid ${supplier.color}40`
                          }}
                          title={supplier.label}
                        >
                          <span 
                            className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" 
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
      )}
    </div>
  );
}
