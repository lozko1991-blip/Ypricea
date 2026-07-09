import React, { useState } from 'react';
import { Loader2, PackageX, ChevronRight, Edit2, Save } from 'lucide-react';
import type { Order, OrderItem } from './CabinetTypes';

interface ClientOrdersProps {
  orders: Order[];
  ordersLoading: boolean;
  orderStats: {
    totalSales: number;
    totalProfit: number;
    completedCount: number;
    processingCount: number;
  };
  ORDER_STATUS_MAP: Record<string, { label: string; bg: string; text: string }>;
  onUpdateTTN: (id: number, ttn: string) => Promise<void>;
}

export const ClientOrders: React.FC<ClientOrdersProps> = ({
  orders,
  ordersLoading,
  orderStats,
  ORDER_STATUS_MAP,
  onUpdateTTN
}) => {
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [ttnInput, setTtnInput] = useState('');
  return (
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

                  {editingOrderId === o.id ? (
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl py-2 px-3 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="font-bold text-[var(--text2)] shrink-0">ТТН Нової Пошти:</span>
                        <input 
                          type="text" 
                          value={ttnInput}
                          onChange={(e) => setTtnInput(e.target.value)}
                          className="input-field text-xs py-0.5 px-2 tracking-wider font-extrabold w-full"
                          placeholder="Введіть 14-значний номер ТТН"
                        />
                      </div>
                      <button 
                        onClick={async () => {
                          await onUpdateTTN(o.id, ttnInput.trim());
                          setEditingOrderId(null);
                        }}
                        className="gbtn bg-[var(--accent)] text-white text-[10px] font-black py-1 px-3 rounded-lg shrink-0 flex items-center gap-1"
                      >
                        <Save size={10} /> Зберегти
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl py-2 px-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text2)] font-semibold">ТТН Нової Пошти:</span>
                        {o.ttn ? (
                          <strong className="tracking-wider text-[var(--text)]">{o.ttn}</strong>
                        ) : (
                          <span className="text-[var(--text2)] italic">Не вказано</span>
                        )}
                        <button 
                          onClick={() => {
                            setEditingOrderId(o.id);
                            setTtnInput(o.ttn || '');
                          }}
                          className="text-[var(--text2)] hover:text-[var(--text)] transition-colors p-1"
                          title="Редагувати ТТН"
                        >
                          <Edit2 size={10} />
                        </button>
                      </div>
                      {o.ttn && (
                        <a 
                          href={`https://novaposhta.ua/tracking/?cargo_number=${o.ttn}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-black text-[var(--accent)] hover:underline flex items-center gap-0.5 uppercase tracking-wider shrink-0"
                        >
                          Відстежити
                          <ChevronRight size={12} />
                        </a>
                      )}
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
  );
};
