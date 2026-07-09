import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useSearch } from '../contexts/SearchContext';
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
  X,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { getSupplierInfo } from '../lib/suppliers';

export default function Layout() {
  const { user, signOut, profile } = useAuth();
  const { 
    cart, 
    cartCount, 
    isCartOpen, 
    setIsCartOpen, 
    removeFromCart, 
    updateCount, 
    updateSalePrice, 
    submitOrder 
  } = useCart();
  const { searchTerm, setSearchTerm } = useSearch();
  const navigate = useNavigate();
  const location = useLocation();

  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Checkout Form States
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientCity, setClientCity] = useState('');
  const [paymentType, setPaymentType] = useState('Накладений платіж');
  const [clientComment, setClientComment] = useState('');

  // Submission States
  const [submitting, setSubmitting] = useState(false);
  const [successOrderNum, setSuccessOrderNum] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Auto-fill client name and phone from profile when checkout opens
  useEffect(() => {
    if (isCheckoutOpen && profile) {
      if (!clientName) setClientName(profile.name || '');
      if (!clientPhone) setClientPhone(profile.phone || '');
    }
  }, [isCheckoutOpen, profile]);

  // Calculate totals
  const totalWholesale = cart.reduce((acc, item) => acc + item.price * item.count, 0);
  const totalSale = cart.reduce((acc, item) => acc + item.salePrice * item.count, 0);
  const totalProfit = totalSale - totalWholesale;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) {
      setSubmitError('Заповніть ім\'я та телефон клієнта');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSuccessOrderNum(null);

    const res = await submitOrder({
      clientName,
      phone: clientPhone,
      city: clientCity,
      payment: paymentType,
      comment: clientComment
    });

    setSubmitting(false);
    if (res.ok && res.orderNum) {
      setSuccessOrderNum(res.orderNum);
      // Reset form
      setClientName('');
      setClientPhone('');
      setClientCity('');
      setClientComment('');
      setIsCheckoutOpen(false);
    } else {
      setSubmitError(res.error || 'Сталася помилка при відправці замовлення');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <header className="sticky top-0 z-50 bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3 shadow-sm">
        <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-y-3">
          <Link to="/" className="text-xl font-extrabold tracking-tighter text-[var(--text)] flex items-center gap-2 order-1">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--accent)] to-blue-400 flex items-center justify-center text-white text-sm font-extrabold">
              U
            </span>
            UTRADE
          </Link>

          {/* Responsive Wide Search Bar */}
          <div className="order-3 w-full md:order-2 md:flex-1 md:max-w-md lg:max-w-lg xl:max-w-xl md:mx-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text2)]" size={16} />
            <input
              type="text"
              placeholder="Пошук товарів (розумний пошук)..."
              className="input-field w-full pl-9 pr-9 py-2 text-sm"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (location.pathname !== '/catalog') {
                  navigate('/catalog');
                }
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text2)] hover:text-[var(--text)]"
                type="button"
                title="Очистити пошук"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <nav className="flex items-center gap-2 sm:gap-3 order-2">
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

            {/* Shopping Cart Button */}
            <button 
              onClick={() => setIsCartOpen(true)}
              className="gbtn relative bg-[var(--surface2)] text-[var(--text)] hover:bg-[var(--border)]"
              title="Кошик"
            >
              <ShoppingBag size={16} /> 
              <span className="hidden sm:inline">Кошик</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-[10px] text-white font-extrabold w-4 h-4 rounded-full flex items-center justify-center border border-[var(--surface)] animate-in scale-in duration-200 shadow-sm">
                  {cartCount}
                </span>
              )}
            </button>
            
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

      {/* About Us Modal */}
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
            <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[80vh] noscroll">
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

      {/* Shopping Cart Drawer Backdrop Overlay */}
      {isCartOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      {/* Shopping Cart Drawer Sidebar */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-[440px] z-[110] bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col transition-transform duration-300 transform ${
          isCartOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-[var(--accent)]" />
            <h2 className="text-sm sm:text-base font-black">Кошик замовлень</h2>
            {cartCount > 0 && (
              <span className="text-xs bg-[var(--surface2)] text-[var(--text)] font-black px-2 py-0.5 rounded-full">
                {cartCount} шт.
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--surface2)] text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--border)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Success Alert */}
        {successOrderNum && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-500/25 p-4 flex flex-col gap-2 items-center text-center animate-in slide-in-from-top duration-300">
            <CheckCircle2 size={36} className="text-emerald-500" />
            <h3 className="font-extrabold text-sm text-emerald-800 dark:text-emerald-400">Замовлення №{successOrderNum} прийнято!</h3>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 leading-snug">
              Дякуємо! Замовлення надіслано в систему обліку UTRADE та дубльовано в Telegram/Email.
            </p>
            <button 
              onClick={() => setSuccessOrderNum(null)}
              className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 underline hover:no-underline mt-1"
            >
              Закрити сповіщення
            </button>
          </div>
        )}

        {/* Error Alert */}
        {submitError && (
          <div className="bg-red-50 dark:bg-red-950/20 border-b border-red-500/25 p-3 text-center text-xs font-bold text-red-600 dark:text-red-400">
            {submitError}
          </div>
        )}

        {/* Drawer Body - Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[var(--surface2)]/40">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--text2)] py-20">
              <ShoppingBag size={48} className="opacity-20 mb-4" />
              <span className="font-black text-xs uppercase tracking-wider opacity-30">Кошик порожній</span>
            </div>
          ) : (
            cart.map(item => {
              const supplier = getSupplierInfo(item.supplier || 'yavshoke');
              const itemProfit = (item.salePrice - item.price) * item.count;
              
              return (
                <div 
                  key={item.id}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 flex gap-3 relative shadow-sm hover:shadow-md transition-shadow group"
                >
                  {/* Remove Button */}
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="absolute top-2 right-2 text-[var(--text2)] hover:text-red-500 opacity-60 hover:opacity-100 transition-opacity"
                    title="Видалити"
                  >
                    <Trash2 size={14} />
                  </button>

                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl bg-[var(--surface2)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center p-1">
                    {item.img ? (
                      <img src={item.img} alt={item.name} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                    ) : (
                      <ShoppingBag size={20} className="opacity-20" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col pr-4">
                    <h4 className="font-extrabold text-[11px] leading-snug text-[var(--text)] line-clamp-2 pr-2" title={item.name}>
                      {item.name}
                    </h4>

                    {/* Supplier badge */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span 
                        className="text-[9px] font-black px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${supplier.bg}`, color: `${supplier.text}` }}
                      >
                        {supplier.short}
                      </span>
                      <span className="text-[9px] text-[var(--text2)] font-semibold">ID: {item.id}</span>
                    </div>

                    {/* Price details */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border)]/30 pt-2">
                      <div className="text-[10px]">
                        <span className="text-[var(--text2)] font-semibold block">Закуп:</span>
                        <span className="font-bold text-[var(--text)]">{item.price} ₴</span>
                      </div>
                      
                      <div className="text-[10px]">
                        <span className="text-[var(--text2)] font-semibold block">Продаж:</span>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number"
                            value={item.salePrice}
                            min={0}
                            onChange={(e) => updateSalePrice(item.id, Number(e.target.value))}
                            className="input-field w-14 py-0.5 px-1 font-black text-center text-[10px]"
                          />
                          <span className="font-semibold text-[var(--text2)]">₴</span>
                        </div>
                      </div>

                      <div className="text-[10px] ml-auto">
                        <span className="text-[var(--text2)] font-semibold block text-right">Прибуток:</span>
                        <span className={`font-black text-right block ${itemProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {itemProfit >= 0 ? '+' : ''}{itemProfit} ₴
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quantity control */}
                  <div className="absolute right-2 top-8 flex flex-col items-center border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--surface2)] text-[var(--text)]">
                    <button 
                      onClick={() => updateCount(item.id, item.count + 1)}
                      className="w-5 h-5 flex items-center justify-center hover:bg-[var(--border)] transition-colors"
                    >
                      <Plus size={10} />
                    </button>
                    <span className="font-black text-[10px] px-1.5 py-0.5">{item.count}</span>
                    <button 
                      onClick={() => updateCount(item.id, item.count - 1)}
                      className="w-5 h-5 flex items-center justify-center hover:bg-[var(--border)] transition-colors"
                    >
                      <Minus size={10} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer - Totals & Checkout */}
        {cart.length > 0 && (
          <div className="border-t border-[var(--border)] p-4 bg-[var(--surface)] flex flex-col gap-3.5">
            {/* Totals Summary */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-[var(--surface2)]/80 p-2 rounded-xl border border-[var(--border)]/50">
                <span className="block text-[10px] text-[var(--text2)] font-bold mb-0.5">Опт (Закуп)</span>
                <span className="font-black text-[var(--text)]">{totalWholesale} ₴</span>
              </div>
              <div className="bg-[var(--surface2)]/80 p-2 rounded-xl border border-[var(--border)]/50">
                <span className="block text-[10px] text-[var(--text2)] font-bold mb-0.5">Продаж</span>
                <span className="font-black text-[var(--text)]">{totalSale} ₴</span>
              </div>
              <div className={`p-2 rounded-xl border ${
                totalProfit >= 0 
                  ? 'bg-emerald-50 border-emerald-200/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                  : 'bg-red-50 border-red-200/50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
              }`}>
                <span className="block text-[10px] font-bold mb-0.5">Прибуток</span>
                <span className="font-black">{totalProfit >= 0 ? '+' : ''}{totalProfit} ₴</span>
              </div>
            </div>

            {/* Checkout Form Toggle */}
            <button
              onClick={() => setIsCheckoutOpen(!isCheckoutOpen)}
              className="gbtn w-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] font-extrabold py-2 text-xs hover:bg-[var(--border)] active:scale-[0.98] transition-all"
            >
              {isCheckoutOpen ? '✕ Приховати форму' : '📝 Оформити замовлення'}
            </button>

            {/* Collapsible Checkout Form */}
            {isCheckoutOpen && (
              <form onSubmit={handleCheckoutSubmit} className="flex flex-col gap-2.5 border-t border-[var(--border)]/50 pt-3.5 animate-in slide-in-from-bottom duration-300">
                <div>
                  <label className="sec-title mb-1 block">Ім'я клієнта *</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Прізвище, Ім'я"
                    className="input-field w-full py-1.5 text-xs px-2.5"
                  />
                </div>
                <div>
                  <label className="sec-title mb-1 block">Телефон клієнта *</label>
                  <input
                    type="tel"
                    required
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+380..."
                    className="input-field w-full py-1.5 text-xs px-2.5"
                  />
                </div>
                <div>
                  <label className="sec-title mb-1 block">Місто доставки</label>
                  <input
                    type="text"
                    value={clientCity}
                    onChange={(e) => setClientCity(e.target.value)}
                    placeholder="Напр. Київ, Відділення Нової Пошти №..."
                    className="input-field w-full py-1.5 text-xs px-2.5"
                  />
                </div>
                <div>
                  <label className="sec-title mb-1 block">💳 Спосіб оплати</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    className="input-field w-full py-1.5 text-xs px-2.5"
                  >
                    <option value="Накладений платіж">Накладений платіж</option>
                    <option value="Передоплата на ФОП">Передоплата на ФОП</option>
                    <option value="Карткою онлайн">Карткою онлайн</option>
                  </select>
                </div>
                <div>
                  <label className="sec-title mb-1 block">Коментар до замовлення</label>
                  <textarea
                    value={clientComment}
                    onChange={(e) => setClientComment(e.target.value)}
                    placeholder="Вкажіть колір, розмір, ТТН або додаткові деталі..."
                    rows={2}
                    className="input-field w-full py-1.5 text-xs px-2.5 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="gbtn w-full bg-[var(--text)] text-[var(--surface)] font-black py-2.5 text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-55"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      Надсилання...
                    </>
                  ) : (
                    '🚀 Підтвердити та відправити'
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
