export interface OrderItem {
  id: string;
  name: string;
  count: number;
  price: number;
  salePrice: number;
}

export interface Order {
  id: number;
  created_at: string;
  status: 'new' | 'processing' | 'shipped' | 'done' | 'cancelled';
  client_name: string;
  client_phone: string;
  client_city: string;
  payment_type: string;
  comment: string;
  items: OrderItem[] | string;
  total_sell: number;
  total_drop: number;
  ttn?: string;
  admin_notes?: string;
  droper_code?: string;
}

export interface Profile {
  id: string;
  name: string;
  store_name: string;
  phone: string;
  status: 'pending' | 'active' | 'blocked';
  role: 'user' | 'admin';
  markup_pct: number;
  markup_grn: number;
  notes: string;
  allowed_exports: string[] | null;
  created_at?: string;
  balance?: number;
  subscription_plan?: string;
  subscription_expires_at?: string;
  subscription_status?: string;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  count?: number;
  total?: number;
  src?: string;
}

export interface FeedSupplier {
  name: string;
  xml_url: string;
  is_active?: boolean;
}

export interface FeedRule {
  type: 'markup' | 'filter_exclude' | 'filter_include' | 'replace_text' | 'stopwords';
  scope: 'global' | 'category' | 'supplier';
  scope_value?: string;
  config: {
    percent?: number;
    fixed?: number;
    ranges?: Array<{ min: number; max: number | null; percent: number; fixed: number }>;
    search_text?: string;
    replace_text?: string;
    keywords?: string[];
  };
}

export interface CustomFeed {
  id?: string;
  user_id?: string;
  name: string;
  token: string;
  format: 'prom' | 'rozetka';
  markup_pct?: number;
  markup_grn?: number;
  suppliers: FeedSupplier[];
  rules: FeedRule[];
  category_mapping: Record<string, { id: string; name: string }>;
  created_at?: string;
  updated_at?: string;
}

export interface SyncLog {
  id: string;
  started_at: string;
  supplier_name: string;
  user_email: string;
  status: 'success' | 'failed' | 'syncing';
  imported_count: number;
  message?: string;
}

export interface GlobalSettings {
  payment_requisites?: string;
  prom_categories_url?: string;
  rozetka_categories_url?: string;
  [key: string]: any;
}
