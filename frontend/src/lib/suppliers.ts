export interface SupplierInfo {
  key: string;
  label: string;
  short: string;
  color: string;
  bg: string;
  text: string;
}

export const YAVSHOKE: SupplierInfo = {
  key: 'yavshoke',
  label: 'ЯВШОКЕ',
  short: 'ЯВ',
  color: '#0ea5e9',
  bg: '#e0f2fe',
  text: '#0369a1',
};

export const MASTEREVA_DEFAULT: SupplierInfo = {
  key: 'ev_new',
  label: 'NEW',
  short: 'NEW',
  color: '#64748b',
  bg: '#e2e8f0',
  text: '#475569',
};

export const YAVSHOKE_SUB_SUPPLIERS: SupplierInfo[] = [
  { key: 'ys_rolets',     label: 'Yavshoke - Штори (Rolets)',     short: 'YS-RL', color: '#0284c7', bg: '#e0f2fe', text: '#0369a1' },
  { key: 'ys_flexdress',   label: 'Yavshoke - Одяг (FlexDress)',   short: 'YS-FD', color: '#ec4899', bg: '#fce7f3', text: '#be185d' },
  { key: 'ys_sunnysky',    label: 'Yavshoke - Світло (Sunnysky)',  short: 'YS-SK', color: '#eab308', bg: '#fef9c3', text: '#a16207' },
  { key: 'ys_textile',     label: 'Yavshoke - Білизна & Текстиль',  short: 'YS-TX', color: '#8b5cf6', bg: '#ede9fe', text: '#6d28d9' },
  { key: 'ys_dishes',      label: 'Yavshoke - Посуд (Ardesto/Empire)', short: 'YS-DS', color: '#059669', bg: '#d1fae5', text: '#065f46' },
  { key: 'ys_partner',     label: 'Yavshoke - Партнерські склади', short: 'YS-PR', color: '#f97316', bg: '#fff7ed', text: '#c2410c' },
];

export const MASTEREVA_SUPPLIERS: SupplierInfo[] = [
  { key: 'ev_dropt',      label: 'Dropt',      short: 'DO', color: '#84cc16', bg: '#f7fee7', text: '#3f6212' },
  { key: 'ev_forus',      label: 'Forus',      short: 'FO', color: '#14b8a6', bg: '#f0fdfa', text: '#134e4a' },
  { key: 'ev_shkatulka',  label: 'Shkatulka',  short: 'SH', color: '#f59e0b', bg: '#fef3c7', text: '#b45309' },
  { key: 'ev_optdrop',    label: 'Opt-Drop',   short: 'OD', color: '#8b5cf6', bg: '#ede9fe', text: '#6d28d9' },
  { key: 'ev_lugi',       label: 'Lugi',       short: 'LU', color: '#ec4899', bg: '#fce7f3', text: '#be185d' },
  { key: 'ev_dropom',     label: 'Dropom',     short: 'DR', color: '#10b981', bg: '#d1fae5', text: '#047857' },
  { key: 'ev_royaltoys',  label: 'RoyalToys',  short: 'RT', color: '#ef4444', bg: '#fee2e2', text: '#b91c1c' },
  { key: 'ev_posudograd', label: 'Posudograd', short: 'PS', color: '#f97316', bg: '#fff7ed', text: '#9a3412' },
  { key: 'ev_iposud',     label: 'i-Posud',    short: 'IP', color: '#06b6d4', bg: '#ecfeff', text: '#164e63' },
  { key: 'ev_iposud2',    label: 'Iposud2',    short: 'IP2', color: '#0891b2', bg: '#ecfeff', text: '#155e75' },
  { key: 'ev_websklad',   label: 'Websklad',   short: 'WS', color: '#6366f1', bg: '#eef2ff', text: '#3730a3' },
  { key: 'ev_ager',       label: 'AGER',       short: 'AG', color: '#059669', bg: '#d1fae5', text: '#065f46' },
  { key: 'ev_issa',       label: 'ISSA Plus',  short: 'IS', color: '#d946ef', bg: '#fdf4ff', text: '#701a75' },
  { key: 'ev_draap',      label: 'Draap',      short: 'DP', color: '#ea580c', bg: '#fff7ed', text: '#7c2d12' },
  { key: 'ev_aveopt',     label: 'Aveopt',     short: 'AV', color: '#f43f5e', bg: '#fff1f2', text: '#9f1239' },
  { key: 'ev_sonechko',   label: 'Sonechko',   short: 'SO', color: '#a855f7', bg: '#faf5ff', text: '#6b21a8' },
  { key: 'ev_dropshipping', label: 'Dropship.ua', short: 'DS', color: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' },
];

const BY_KEY: Record<string, SupplierInfo> = {
  [YAVSHOKE.key]: YAVSHOKE,
  [MASTEREVA_DEFAULT.key]: MASTEREVA_DEFAULT,
};

MASTEREVA_SUPPLIERS.forEach(s => {
  BY_KEY[s.key] = s;
});

YAVSHOKE_SUB_SUPPLIERS.forEach(s => {
  BY_KEY[s.key] = s;
});

export function getSupplierInfo(srcKey: string | undefined): SupplierInfo {
  if (!srcKey) return YAVSHOKE;
  return BY_KEY[srcKey] || YAVSHOKE;
}
