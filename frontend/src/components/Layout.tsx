import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LogOut, 
  User, 
  LayoutDashboard, 
  Search, 
  Info, 
  MessageCircle, 
  Send, 
  Phone, 
  ChevronRight, 
  X 
} from 'lucide-react';

export default function Layout() {
  const { user, signOut } = useAuth();
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <header className="sticky top-0 z-50 bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3 shadow-sm">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-extrabold tracking-tighter text-[var(--text)] flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--accent)] to-blue-400 flex items-center justify-center text-white text-sm">
              U
            </span>
            UTRADE
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3">
            {/* Desktop Company Info / Contacts */}
            <button 
              onClick={() => setIsAboutOpen(true)}
              className="gbtn bg-[var(--surface2)] text-[var(--text2)] border border-[var(--border)] hover:bg-[var(--border)] hidden lg:flex items-center gap-1.5"
              title="Про нас"
            >
              <Info size={16} /> <span className="hidden xl:inline">Про нас</span>
            </button>
            <a 
              href="viber://chat?number=%2B380666172764"
              className="gbtn text-white hidden lg:flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#7360f2' }}
              title="Написати у Viber"
            >
              <MessageCircle size={16} /> <span className="hidden xl:inline">Viber</span>
            </a>
            <a 
              href="https://t.me/sergeymod" 
              target="_blank" 
              rel="noopener noreferrer"
              className="gbtn text-white hidden lg:flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#2aabee' }}
              title="Написати у Telegram"
            >
              <Send size={16} /> <span className="hidden xl:inline">Telegram</span>
            </a>

            <div className="hidden lg:block h-6 w-px bg-[var(--border)] mx-1" />

            <Link to="/" className="gbtn bg-[var(--surface2)] text-[var(--text)] hover:bg-[var(--border)]">
              <Search size={16} /> <span className="hidden sm:inline">Каталог</span>
            </Link>
            
            {user ? (
              <>
                <Link to="/cabinet" className="gbtn bg-[var(--surface2)] text-[var(--text)] hover:bg-[var(--border)]">
                  <LayoutDashboard size={16} /> <span className="hidden sm:inline">Кабінет</span>
                </Link>
                <div className="h-8 w-px bg-[var(--border)] mx-1" />
                <button 
                  onClick={signOut}
                  className="gbtn text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                  title="Вийти"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link to="/auth" className="gbtn bg-[var(--accent)] text-white shadow-md shadow-blue-500/20">
                <User size={16} /> Увійти
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1700px] mx-auto p-4 sm:p-6 pb-24">
        <Outlet />
      </main>

      {/* Floating Support Button for Mobile/Tablet */}
      <div className="fixed bottom-5 right-5 z-[40] flex flex-col items-end gap-2 lg:hidden">
        {isContactsOpen && (
          <div className="flex flex-col gap-2 bg-[var(--surface)] border border-[var(--border)] p-3 rounded-2xl shadow-xl animate-in slide-in-from-bottom-2 fade-in duration-200">
            <a 
              href="tel:+380666172764" 
              className="flex items-center gap-2 text-xs font-bold text-[var(--text)] hover:text-[var(--accent)] p-1.5 hover:bg-[var(--surface2)] rounded-lg transition-all"
            >
              <span className="w-6 h-6 rounded-md bg-emerald-500 text-white flex items-center justify-center"><Phone size={12} /></span>
              +380 66 617 27 64
            </a>
            <a 
              href="viber://chat?number=%2B380666172764" 
              className="flex items-center gap-2 text-xs font-bold text-[var(--text)] hover:text-[var(--accent)] p-1.5 hover:bg-[var(--surface2)] rounded-lg transition-all"
            >
              <span className="w-6 h-6 rounded-md bg-[#7360f2] text-white flex items-center justify-center"><MessageCircle size={12} /></span>
              Написати у Viber
            </a>
            <a 
              href="https://t.me/sergeymod" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 text-xs font-bold text-[var(--text)] hover:text-[var(--accent)] p-1.5 hover:bg-[var(--surface2)] rounded-lg transition-all"
            >
              <span className="w-6 h-6 rounded-md bg-[#2aabee] text-white flex items-center justify-center"><Send size={12} /></span>
              Написати у Telegram
            </a>
            <button 
              onClick={() => { setIsAboutOpen(true); setIsContactsOpen(false); }}
              className="flex items-center gap-2 text-xs font-bold text-[var(--text)] hover:text-[var(--accent)] p-1.5 hover:bg-[var(--surface2)] rounded-lg transition-all w-full text-left"
            >
              <span className="w-6 h-6 rounded-md bg-blue-500 text-white flex items-center justify-center"><Info size={12} /></span>
              Про нашу компанію
            </button>
          </div>
        )}
        <button 
          onClick={() => setIsContactsOpen(!isContactsOpen)}
          className="w-12 h-12 rounded-full bg-[var(--accent)] text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          title="Контакти та підтримка"
        >
          {isContactsOpen ? <X size={20} /> : <MessageCircle size={20} />}
        </button>
      </div>

      {/* About Us Modal (Info modal) */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setIsAboutOpen(false)}
          />
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl w-full max-w-md overflow-hidden flex flex-col relative z-10 shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-blue-400 flex items-center justify-center text-white text-sm font-extrabold">
                  U
                </span>
                <div>
                  <div className="text-sm font-black text-[var(--text)]">UTRADE</div>
                  <div className="text-[10px] text-[var(--text2)] font-bold tracking-wider">ДРОП-ПЛАТФОРМА</div>
                </div>
              </div>
              <button 
                onClick={() => setIsAboutOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--surface2)] text-[var(--text2)] hover:text-[var(--text)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
              <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-2xl p-4 text-xs leading-relaxed text-[var(--text2)]">
                🚀 <strong className="text-[var(--text)]">UTRADE</strong> — сучасна платформа дропшипінгу з тисячами актуальних товарів від перевірених постачальників.<br/><br/>
                📦 Відправка товарів: <strong className="text-[var(--text)]">1–3 робочих дні</strong><br/>
                🏬 Товари відправляються з різних складів по всій Україні<br/>
                💳 Способи оплати: накладений платіж та передоплата на ФОП<br/>
                🔄 Працюємо без мінімального замовлення (від 1 одиниці)
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[var(--surface2)] p-2.5 rounded-xl border border-[var(--border)]">
                  <span className="block font-black text-sm text-[var(--accent)]">122к+</span>
                  <span className="text-[9px] text-[var(--text2)] font-bold uppercase tracking-wide">Товарів</span>
                </div>
                <div className="bg-[var(--surface2)] p-2.5 rounded-xl border border-[var(--border)]">
                  <span className="block font-black text-sm text-[var(--accent)]">5</span>
                  <span className="text-[9px] text-[var(--text2)] font-bold uppercase tracking-wide">Складів</span>
                </div>
                <div className="bg-[var(--surface2)] p-2.5 rounded-xl border border-[var(--border)]">
                  <span className="block font-black text-sm text-[var(--accent)]">1–3</span>
                  <span className="text-[9px] text-[var(--text2)] font-bold uppercase tracking-wide">Дні відп.</span>
                </div>
              </div>

              {/* Contacts */}
              <div className="flex flex-col gap-2.5 mt-2">
                <a 
                  href="tel:+380666172764" 
                  className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface2)] hover:bg-[var(--border)] border border-[var(--border)] transition-all text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center"><Phone size={14} /></span>
                    <div>
                      <span className="block font-black text-[var(--text)]">Телефон</span>
                      <span className="text-[10px] text-[var(--text2)] font-semibold">+380 66 617 27 64</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[var(--text2)]" />
                </a>
                
                <a 
                  href="viber://chat?number=%2B380666172764" 
                  className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface2)] hover:bg-[var(--border)] border border-[var(--border)] transition-all text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-[#7360f2] text-white flex items-center justify-center"><MessageCircle size={14} /></span>
                    <div>
                      <span className="block font-black text-[var(--text)]">Viber</span>
                      <span className="text-[10px] text-[var(--text2)] font-semibold">Написати у Viber</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[var(--text2)]" />
                </a>

                <a 
                  href="https://t.me/sergeymod" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface2)] hover:bg-[var(--border)] border border-[var(--border)] transition-all text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-[#2aabee] text-white flex items-center justify-center"><Send size={14} /></span>
                    <div>
                      <span className="block font-black text-[var(--text)]">Telegram</span>
                      <span className="text-[10px] text-[var(--text2)] font-semibold">Написати у Telegram</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[var(--text2)]" />
                </a>
              </div>

              {/* Payment Methods */}
              <div className="bg-[var(--surface2)] p-4 rounded-2xl border border-[var(--border)]/50 mt-1">
                <span className="block text-[10px] text-[var(--text2)] font-black uppercase tracking-wider mb-2.5">💳 Способи оплати</span>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">Накладений платіж</span>
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">Передоплата на ФОП</span>
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">Карткою онлайн</span>
                </div>
                <div className="mt-3.5 text-[9px] text-[var(--text2)] font-semibold">
                  Базу товарів оновлено · автооновлення кожні 5 годин
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
