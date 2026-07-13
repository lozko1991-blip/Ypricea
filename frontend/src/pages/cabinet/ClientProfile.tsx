import type { Profile, GlobalSettings } from './CabinetTypes';

interface ClientProfileProps {
  profile: Profile | null;
  user: any;
  profileName: string;
  setProfileName: (val: string) => void;
  profileStore: string;
  setProfileStore: (val: string) => void;
  profilePhone: string;
  setProfilePhone: (val: string) => void;
  profileSaving: boolean;
  handleSaveProfile: () => void;
  globalSettings: GlobalSettings;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({
  profile,
  user,
  profileName,
  setProfileName,
  profileStore,
  setProfileStore,
  profilePhone,
  setProfilePhone,
  profileSaving,
  handleSaveProfile,
  globalSettings
}) => {
  const expiresAt = profile?.subscription_expires_at 
    ? new Date(profile.subscription_expires_at).toLocaleDateString('uk-UA') 
    : '—';
  const balance = profile?.balance ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <div className="flex flex-col gap-6">
        <div className="card">
          <h2 className="text-sm font-black mb-4">Налаштування профілю</h2>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase text-[var(--text2)] block mb-1.5">
                Email користувача
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="input-field w-full py-1.5 px-3 bg-[var(--surface)] opacity-50 cursor-not-allowed text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-[var(--text2)] block mb-1.5">
                Ваше ім'я / Код дропшиппера
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="input-field w-full py-1.5 px-3 text-xs"
                placeholder="Введіть ваше ім'я"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-[var(--text2)] block mb-1.5">
                Назва магазину (для фідів)
              </label>
              <input
                type="text"
                value={profileStore}
                onChange={(e) => setProfileStore(e.target.value)}
                className="input-field w-full py-1.5 px-3 text-xs"
                placeholder="Наприклад: BestShop"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-[var(--text2)] block mb-1.5">
                Контактний телефон
              </label>
              <input
                type="tel"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="input-field w-full py-1.5 px-3 text-xs"
                placeholder="+380..."
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className="btn-primary w-full py-2 text-xs font-black"
            >
              {profileSaving ? 'Збереження...' : 'Зберегти зміни'}
            </button>
          </div>
        </div>


      </div>

      <div className="card flex flex-col gap-6">
        {/* Wallet Balance & Subscription Badge */}
        <div className="p-4 bg-[var(--surface2)] border border-[var(--border)] rounded-2xl flex flex-col gap-3 font-semibold text-xs">
          <div className="flex justify-between items-center border-b border-[var(--border)] pb-2 flex-wrap gap-2">
            <div>
              <span className="text-[10px] text-[var(--text2)] font-black uppercase">Ваш баланс:</span>
              <p className="text-lg font-black text-emerald-500">{balance.toLocaleString('uk-UA')} ₴</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[var(--text2)] font-black uppercase block">Тарифний план:</span>
              <span className="badge bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-black uppercase text-[9px] px-2 py-0.5 rounded-md border border-blue-500/20">
                {profile?.subscription_plan || 'TRIAL'}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[var(--text2)]">Статус підписки:</span>
            <span className={`font-black uppercase text-[10px] ${
              profile?.subscription_status === 'active' ? 'text-emerald-500' : 'text-amber-500'
            }`}>
              {profile?.subscription_status === 'active' ? 'Активна' : 'Призупинена / Очікує оплати'}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[var(--text2)]">Термін дії підписки:</span>
            <span className="font-bold text-[var(--text)]">{expiresAt}</span>
          </div>
        </div>

        {/* Payment instructions (from Global Requisites Settings) */}
        {globalSettings.payment_requisites && (
          <div className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-2xl">
            <h3 className="text-xs font-black text-[var(--text)] mb-2 uppercase tracking-wide">Реквізити для оплати та продовження</h3>
            <div className="text-[10px] text-[var(--text2)] font-mono leading-relaxed whitespace-pre-wrap">
              {globalSettings.payment_requisites}
            </div>
          </div>
        )}

        <div className="card">
          <h2 className="text-sm font-black mb-2">Мої рахунки та білінг</h2>
          <p className="text-[10px] text-[var(--text2)] mb-4 font-semibold">
            Тут відображається фінансова історія платежів та активні рахунки за користування платформою UTRADE.
          </p>
          
          <div className="flex flex-col gap-3">
            <div className="p-3.5 bg-[var(--surface2)] border border-[var(--border)] rounded-2xl flex flex-col gap-1.5 text-xs font-bold">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text)] font-extrabold text-[11px]">Абонплата за кабінет (30 днів)</span>
                <span className="badge bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-black text-[9px] uppercase px-2 py-0.5 rounded-md border border-emerald-500/20">Сплачено</span>
              </div>
              <div className="flex justify-between text-[10px] text-[var(--text2)]">
                <span>Сума: 250 ₴</span>
                <span>Діє до: {new Date(Date.now() + 2592000000).toLocaleDateString('uk-UA')}</span>
              </div>
            </div>

            <div className="p-3.5 bg-[var(--surface2)] border border-[var(--border)] rounded-2xl flex flex-col gap-1.5 text-xs font-bold">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text)] font-extrabold text-[11px]">Налаштування XML імпорту (Разово)</span>
                <span className="badge bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-black text-[9px] uppercase px-2 py-0.5 rounded-md border border-emerald-500/20">Сплачено</span>
              </div>
              <div className="flex justify-between text-[10px] text-[var(--text2)]">
                <span>Сума: 500 ₴</span>
                <span>Сплачено: {new Date().toLocaleDateString('uk-UA')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
