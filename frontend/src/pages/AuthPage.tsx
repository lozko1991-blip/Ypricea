import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    navigate('/cabinet');
    return null;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Перевірте вашу пошту для підтвердження реєстрації!');
      }
    } catch (err: any) {
      setError(err.message || 'Помилка авторизації');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center pt-12">
      <div className="card w-full max-w-md shadow-xl shadow-blue-500/5">
        <h1 className="text-2xl font-extrabold text-center mb-2">
          {isLogin ? 'З поверненням!' : 'Створити акаунт'}
        </h1>
        <p className="text-center text-[var(--text2)] text-sm mb-6">
          Увійдіть у систему для управління замовленнями
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-500 text-sm p-3 rounded-xl mb-4 border border-red-200 dark:border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-[var(--text2)]">Email</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="vash@email.com"
            />
          </div>
          
          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-[var(--text2)]">Пароль</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="gbtn bg-[var(--text)] text-[var(--surface)] mt-2 py-3 shadow-lg hover:shadow-xl transition-all">
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Увійти' : 'Зареєструватись')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-[var(--text2)] hover:text-[var(--accent)] font-bold transition-colors"
          >
            {isLogin ? 'Немає акаунту? Реєстрація' : 'Вже є акаунт? Увійти'}
          </button>
        </div>
      </div>
    </div>
  );
}
