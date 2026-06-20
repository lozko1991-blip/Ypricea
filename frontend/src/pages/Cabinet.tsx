import { useState } from 'react';
import { Package, User, Settings, LogOut, PackageX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function Cabinet() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'profile' | 'admin'>('orders');

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Особистий кабінет</h1>
          <p className="text-[var(--text2)] text-sm font-medium">
            Вітаємо, {session?.user?.email}
          </p>
        </div>
        <button onClick={handleSignOut} className="btn-secondary text-red-500 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
          <LogOut size={16} />
          Вийти
        </button>
      </div>

      <div className="flex border-b border-[var(--border)] gap-6 overflow-x-auto noscroll">
        <button 
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 pb-3 border-b-2 font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'orders' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'}`}
        >
          <Package size={16} />
          Мої замовлення
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 pb-3 border-b-2 font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'}`}
        >
          <User size={16} />
          Профіль
        </button>
        {/* Placeholder for admin tab, we might need to check role later */}
        <button 
          onClick={() => setActiveTab('admin')}
          className={`flex items-center gap-2 pb-3 border-b-2 font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'admin' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'}`}
        >
          <Settings size={16} />
          Генератор прайсу
        </button>
      </div>

      <div className="mt-4">
        {activeTab === 'orders' && (
          <div className="card flex flex-col items-center justify-center py-20 text-[var(--text2)]">
            <PackageX size={48} className="mb-4 opacity-50" />
            <p className="font-bold">У вас ще немає замовлень</p>
          </div>
        )}
        
        {activeTab === 'profile' && (
          <div className="card max-w-lg">
            <h2 className="text-lg font-bold mb-4">Налаштування профілю</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text2)] uppercase tracking-wider mb-1">Email</label>
                <input type="text" value={session?.user?.email || ''} readOnly className="input-field w-full opacity-70 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text2)] uppercase tracking-wider mb-1">Telegram / Viber</label>
                <input type="text" placeholder="Ваш номер або нікнейм" className="input-field w-full" />
              </div>
              <button className="btn-primary w-full justify-center">Зберегти зміни</button>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="card">
            <h2 className="text-lg font-bold mb-2">Генератор прайсу (в розробці)</h2>
            <p className="text-[var(--text2)] text-sm mb-4">
              Тут буде розміщено інтерфейс генератора прайсу Prom.ua, OLX, Rozetka.
            </p>
            <div className="p-4 bg-[var(--surface2)] rounded-xl border border-[var(--border)] flex items-center justify-center text-[var(--text2)] font-bold">
              Скоро з'явиться...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
