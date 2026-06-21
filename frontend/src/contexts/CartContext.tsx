import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

export interface CartItem {
  id: string;
  name: string;
  price: number; // Wholesale drop price
  salePrice: number; // Retail sale price
  count: number;
  img?: string;
  supplier?: string;
}

interface OrderData {
  clientName: string;
  phone: string;
  city: string;
  payment: string;
  comment: string;
}

interface CartContextType {
  cart: CartItem[];
  cartCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (product: { id: string; n: string; pr: number; i?: string; s?: string }) => void;
  removeFromCart: (id: string) => void;
  updateCount: (id: string, count: number) => void;
  updateSalePrice: (id: string, salePrice: number) => void;
  clearCart: () => void;
  submitOrder: (details: OrderData) => Promise<{ ok: boolean; orderNum?: string; error?: string }>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const APPS_SCRIPT_URL = 'https://utrade-orders.lozko1991.workers.dev';
const TG_BOT_TOKEN = '8767253093:AAFn4NqhiboZR-SQgMkBU9Mc_3OVej9zyWQ';
const TG_CHAT_ID = '5251531339';
const SHOP_NAME = 'UTRADE';
const SHOP_EMAIL = 'lozko1991@gmail.com';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ypricea_cart');
      if (stored) {
        setCart(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to parse cart from localStorage:', e);
    }
  }, []);

  // Sync cart back to localStorage
  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem('ypricea_cart', JSON.stringify(newCart));
  };

  const cartCount = cart.reduce((acc, item) => acc + item.count, 0);

  const addToCart = (p: { id: string; n: string; pr: number; i?: string; s?: string }) => {
    const existing = cart.find(item => item.id === p.id);
    if (existing) {
      const updated = cart.map(item => 
        item.id === p.id ? { ...item, count: item.count + 1 } : item
      );
      saveCart(updated);
    } else {
      // Calculate initial markup price based on user profile or default (20%)
      const pct = profile?.markup_pct ?? 20;
      const grn = profile?.markup_grn ?? 0;
      const initialSalePrice = Math.max(1, Math.round(p.pr * (1 + pct / 100) + grn));
      
      const newItem: CartItem = {
        id: p.id,
        name: p.n,
        price: p.pr,
        salePrice: initialSalePrice,
        count: 1,
        img: p.i,
        supplier: p.s
      };
      saveCart([...cart, newItem]);
    }
  };

  const removeFromCart = (id: string) => {
    const filtered = cart.filter(item => item.id !== id);
    saveCart(filtered);
  };

  const updateCount = (id: string, count: number) => {
    const updated = cart.map(item => 
      item.id === id ? { ...item, count: Math.max(1, count) } : item
    );
    saveCart(updated);
  };

  const updateSalePrice = (id: string, salePrice: number) => {
    const updated = cart.map(item => 
      item.id === id ? { ...item, salePrice: Math.max(0, salePrice) } : item
    );
    saveCart(updated);
  };

  const clearCart = () => {
    saveCart([]);
  };

  // Helper for silent background notifications
  const notifyOrder = (orderData: any) => {
    try {
      const items = (orderData.items || []).map((it: any) => ({
        name: it.name,
        qty: it.count,
        sell: it.salePrice,
        price: it.price
      }));
      const total = items.reduce((s: number, it: any) => s + (it.sell || 0) * (it.qty || 1), 0);
      const fmt = (n: number) => Number(n || 0).toLocaleString('uk-UA');
      const now = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' });

      // Send to Telegram Bot API
      if (TG_BOT_TOKEN && TG_CHAT_ID) {
        let lines = '';
        items.forEach((it: any, i: number) => {
          lines += `\n  ${i + 1}. ${it.name}\n     x${it.qty} × ${fmt(it.sell)} ₴ = ${fmt((it.sell || 0) * (it.qty || 1))} ₴`;
        });

        const msg = `🛒 *НОВЕ ЗАМОВЛЕННЯ* — ${SHOP_NAME}\n`
          + `━━━━━━━━━━━━━━━━━━━━\n`
          + `👤 Ім'я: *${orderData.clientName || '—'}*\n`
          + `📞 Телефон: *${orderData.phone || '—'}*\n`
          + `🏙 Місто: ${orderData.city || 'не вказано'}\n`
          + `💳 Оплата: ${orderData.payment || '—'}\n`
          + `━━━━━━━━━━━━━━━━━━━━\n`
          + `📦 *Товари:${lines || ' —'}*\n`
          + `━━━━━━━━━━━━━━━━━━━━\n`
          + `💰 *Сума: ${fmt(Math.round(total))} ₴*\n`
          + (orderData.comment ? `📝 Коментар: ${orderData.comment}\n` : '')
          + `🕐 ${now}`;

        fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg, parse_mode: 'Markdown' })
        })
        .then(r => r.json())
        .then(r => console.info('[notify] telegram ok =', r && r.ok))
        .catch(e => console.error('[notify] telegram fail:', e.message));
      }

      // Send Email via formsubmit.co
      if (SHOP_EMAIL) {
        const body = new URLSearchParams();
        body.set('_subject', 'Замовлення з кошика — ' + SHOP_NAME);
        body.set('_template', 'table');
        body.set('_captcha', 'false');
        body.set('Магазин', SHOP_NAME);
        body.set("Ім'я", orderData.clientName || '');
        body.set('Телефон', orderData.phone || '');
        body.set('Місто', orderData.city || 'не вказано');
        body.set('Оплата', orderData.payment || '');
        body.set('Товари', items.map((it: any) => `${it.name} ×${it.qty} = ${fmt((it.sell || 0) * (it.qty || 1))} ₴`).join('\n') || 'не вказані');
        body.set('Сума', fmt(Math.round(total)) + ' ₴');
        if (orderData.comment) body.set('Коментар', orderData.comment);
        body.set('Час', now);

        fetch(`https://formsubmit.co/ajax/${encodeURIComponent(SHOP_EMAIL)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        })
        .then(r => r.json())
        .then(r => console.info('[notify] email ok =', r && r.success))
        .catch(e => console.error('[notify] email fail:', e.message));
      }
    } catch (err: any) {
      console.warn('[notify] fail:', err.message);
    }
  };

  const submitOrder = async (details: OrderData) => {
    if (!cart.length) {
      return { ok: false, error: 'Кошик порожній' };
    }

    const orderData = {
      action: 'addOrder',
      clientName: details.clientName.trim(),
      phone: details.phone.trim(),
      city: details.city.trim(),
      payment: details.payment,
      comment: details.comment.trim(),
      items: cart.map(p => ({
        id: p.id,
        name: p.name,
        count: p.count,
        price: p.price,
        salePrice: p.salePrice
      }))
    };

    // Send notifications (silent/async background)
    notifyOrder(orderData);

    try {
      // POST order to Oblik Worker
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      }).then(r => r.json());

      if (res.ok && res.orderNum) {
        // If authorized, also insert to Supabase
        if (user) {
          const items = cart.map(p => ({
            id: p.id,
            name: p.name,
            count: p.count,
            price: p.price,
            salePrice: p.salePrice
          }));

          const sellTotal = Math.round(items.reduce((s, it) => s + (it.salePrice || 0) * (it.count || 1), 0) * 100) / 100;
          const dropTotal = Math.round(items.reduce((s, it) => s + (it.price || 0) * (it.count || 1), 0) * 100) / 100;

          await supabase.from('orders').insert({
            user_id: user.id,
            droper_code: profile?.store_name || profile?.name || user.email || null,
            client_name: orderData.clientName,
            client_phone: orderData.phone,
            client_city: orderData.city,
            payment_type: orderData.payment,
            comment: orderData.comment,
            items,
            total_sell: sellTotal,
            total_drop: dropTotal
          });
        }

        clearCart();
        return { ok: true, orderNum: String(res.orderNum) };
      } else {
        return { ok: false, error: res.error || 'Помилка генерації замовлення' };
      }
    } catch (e: any) {
      console.error('Order submission error:', e);
      return { ok: false, error: 'Помилка з\'єднання з сервером замовлень' };
    }
  };

  return (
    <CartContext.Provider value={{
      cart,
      cartCount,
      isCartOpen,
      setIsCartOpen,
      addToCart,
      removeFromCart,
      updateCount,
      updateSalePrice,
      clearCart,
      submitOrder
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
