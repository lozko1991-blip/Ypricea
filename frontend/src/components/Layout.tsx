import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, LayoutDashboard, Search } from 'lucide-react';

export default function Layout() {
  const { user, profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <header className="sticky top-0 z-50 bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-extrabold tracking-tighter text-[var(--text)] flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--accent)] to-blue-400 flex items-center justify-center text-white text-sm">
              U
            </span>
            UTRADE
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4">
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

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 pb-24">
        <Outlet />
      </main>
    </div>
  );
}
