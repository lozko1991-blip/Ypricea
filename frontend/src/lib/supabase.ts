import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lvolxxwiknltgxotdicj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_R7sjWE6L20aXu7rpLhduSQ__PPB-baf';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase env variables. Check .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
