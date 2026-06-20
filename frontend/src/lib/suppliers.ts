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
  key: 'ev_kievopt',
  label: 'Mastereva · KievOpt',
  short: 'KO',
  color: '#64748b',
  bg: '#e2e8f0',
  text: '#475569',
};

export const MASTEREVA_SUPPLIERS: SupplierInfo[] = [
  { key: 'ev_dropt',      label: 'Mastereva · Dropt',      short: 'DO', color: '#84cc16', bg: '#f7fee7', text: '#3f6212' },
  { key: 'ev_forus',      label: 'Mastereva · Forus',      short: 'FO', color: '#14b8a6', bg: '#f0fdfa', text: '#134e4a' },
  { key: 'ev_shkatulka',  label: 'Mastereva · Shkatulka',  short: 'SH', color: '#f59e0b', bg: '#fef3c7', text: '#b45309' },
  { key: 'ev_optdrop',    label: 'Mastereva · Opt-Drop',   short: 'OD', color: '#8b5cf6', bg: '#ede9fe', text: '#6d28d9' },
  { key: 'ev_lugi',       label: 'Mastereva · Lugi',       short: 'LU', color: '#ec4899', bg: '#fce7f3', text: '#be185d' },
  { key: 'ev_dropom',     label: 'Mastereva · Dropom',     short: 'DR', color: '#10b981', bg: '#d1fae5', text: '#047857' },
  { key: 'ev_royaltoys',  label: 'Mastereva · RoyalToys',  short: 'RT', color: '#ef4444', bg: '#fee2e2', text: '#b91c1c' },
  { key: 'ev_posudograd', label: 'Mastereva · Posudograd', short: 'PS', color: '#f97316', bg: '#fff7ed', text: '#9a3412' },
  { key: 'ev_iposud',     label: 'Mastereva · i-Posud',    short: 'IP', color: '#06b6d4', bg: '#ecfeff', text: '#164e63' },
  { key: 'ev_websklad',   label: 'Mastereva · Websklad',   short: 'WS', color: '#6366f1', bg: '#eef2ff', text: '#3730a3' },
];

const BY_KEY: Record<string, SupplierInfo> = {
  [YAVSHOKE.key]: YAVSHOKE,
  [MASTEREVA_DEFAULT.key]: MASTEREVA_DEFAULT,
};

MASTEREVA_SUPPLIERS.forEach(s => {
  BY_KEY[s.key] = s;
});

export function getSupplierInfo(srcKey: string | undefined): SupplierInfo {
  if (!srcKey) return YAVSHOKE;
  return BY_KEY[srcKey] || YAVSHOKE;
}
