import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Settings, 
  Layers, 
  Zap, 
  Globe,
  TrendingUp,
  Box
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl">
              U
            </div>
            <span className="font-black text-xl tracking-tight text-slate-900">UTRADE</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Можливості</a>
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors">Як це працює</a>
            <Link to="/catalog" className="hover:text-blue-600 transition-colors">Каталог товарів</Link>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <Link 
                to="/cabinet" 
                className="text-sm font-bold bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-sm"
              >
                В кабінет
              </Link>
            ) : (
              <>
                <Link 
                  to="/auth" 
                  className="text-sm font-bold text-slate-700 hover:text-slate-900 transition-colors hidden sm:block"
                >
                  Увійти
                </Link>
                <Link 
                  to="/auth" 
                  className="text-sm font-bold bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-sm shadow-blue-200"
                >
                  Почати роботу
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-white to-white -z-10" />
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-bold mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Нова платформа для дропшипінгу
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 mb-8 leading-[1.1]">
              Ваш ідеальний прайс-лист <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                в один клік
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
              Об'єднуйте прайси постачальників, налаштовуйте націнки, фільтруйте товари та отримуйте готовий XML для Prom.ua та Rozetka за секунди.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                to={user ? "/cabinet" : "/auth"} 
                className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
              >
                Створити фід
                <ArrowRight size={20} />
              </Link>
              <Link 
                to="/catalog" 
                className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl font-bold text-lg hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                Переглянути каталог
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-4">
              Все для автоматизації продажів
            </h2>
            <p className="text-slate-600 font-medium text-lg">
              Ми розробили інструменти, які економлять ваш час та збільшують прибуток.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Layers className="text-blue-600" size={28} />}
              title="Об'єднання постачальників"
              desc="Збирайте товари з кількох складів в один загальний XML фід без дублікатів та конфліктів."
              color="bg-blue-100"
            />
            <FeatureCard 
              icon={<Settings className="text-indigo-600" size={28} />}
              title="Гнучкі націнки"
              desc="Встановлюйте націнку у відсотках або гривнях. Додавайте правила для конкретних категорій або брендів."
              color="bg-indigo-100"
            />
            <FeatureCard 
              icon={<Zap className="text-amber-600" size={28} />}
              title="Миттєва генерація"
              desc="Ваш фід генерується автоматично на надшвидких серверах. Завжди актуальні залишки та ціни."
              color="bg-amber-100"
            />
            <FeatureCard 
              icon={<Globe className="text-emerald-600" size={28} />}
              title="Готово до експорту"
              desc="Повна сумісність форматів з Prom.ua, Rozetka та іншими популярними маркетплейсами України."
              color="bg-emerald-100"
            />
            <FeatureCard 
              icon={<Box className="text-rose-600" size={28} />}
              title="Керування категоріями"
              desc="Вимикайте непотрібні категорії в один клік. Жодного сміття у вашому інтернет-магазині."
              color="bg-rose-100"
            />
            <FeatureCard 
              icon={<TrendingUp className="text-cyan-600" size={28} />}
              title="Аналітика замовлень"
              desc="Слідкуйте за статусами відправок, підраховуйте прибуток та керуйте базою клієнтів у кабінеті."
              color="bg-cyan-100"
            />
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-6">
                Почніть продавати <br/> за 3 простих кроки
              </h2>
              <div className="space-y-8 mt-10">
                <Step 
                  number="1"
                  title="Оберіть склади та категорії"
                  desc="Перегляньте наш каталог і відзначте галочками лише ті групи товарів, які хочете продавати."
                />
                <Step 
                  number="2"
                  title="Налаштуйте ціноутворення"
                  desc="Вкажіть вашу маржу. Система сама перерахує всі роздрібні ціни відповідно до ваших правил."
                />
                <Step 
                  number="3"
                  title="Завантажте фід на Prom.ua"
                  desc="Скопіюйте згенероване посилання на ваш XML і вставте його в налаштування імпорту вашого магазину."
                />
              </div>
            </div>
            
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-slate-200 border border-slate-200 bg-slate-50 p-8">
              <div className="absolute top-0 left-0 w-full h-12 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="mt-8 space-y-4">
                <div className="h-8 w-3/4 bg-slate-200 rounded-lg animate-pulse"></div>
                <div className="h-4 w-1/2 bg-slate-200 rounded-lg animate-pulse"></div>
                <div className="grid grid-cols-2 gap-4 pt-6">
                  <div className="h-24 bg-white border border-slate-200 rounded-xl shadow-sm"></div>
                  <div className="h-24 bg-white border border-slate-200 rounded-xl shadow-sm"></div>
                  <div className="h-24 bg-white border border-slate-200 rounded-xl shadow-sm"></div>
                  <div className="h-24 bg-white border border-slate-200 rounded-xl shadow-sm"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-slate-900 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-6">
            Готові збільшити свої продажі?
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto font-medium">
            Приєднуйтесь до платформи UTRADE сьогодні та отримайте доступ до тисяч товарів з моментальною синхронізацією залишків.
          </p>
          <Link 
            to={user ? "/cabinet" : "/auth"} 
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/50"
          >
            Зареєструватись безкоштовно
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs">
              U
            </div>
            <span className="font-black text-lg tracking-tight text-slate-900">UTRADE</span>
          </div>
          <p className="text-slate-500 font-medium text-sm">
            © {new Date().getFullYear()} UTRADE. Всі права захищено.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc, color }: { icon: React.ReactNode, title: string, desc: string, color: string }) {
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
      <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed font-medium">
        {desc}
      </p>
    </div>
  );
}

function Step({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="flex gap-6">
      <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-black text-xl">
        {number}
      </div>
      <div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-600 font-medium leading-relaxed">
          {desc}
        </p>
      </div>
    </div>
  );
}
