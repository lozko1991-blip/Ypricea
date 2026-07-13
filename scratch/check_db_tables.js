import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lvolxxwiknltgxotdicj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_R7sjWE6L20aXu7rpLhduSQ__PPB-baf';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tables = ['profiles', 'orders', 'user_feeds', 'sync_logs', 'settings', 'marketplace_categories'];

async function check() {
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table "${table}": ERROR - ${error.message} (${error.code})`);
    } else {
      console.log(`Table "${table}": OK (found ${data.length} records)`);
    }
  }
}

check().catch(console.error);
