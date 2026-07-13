import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lvolxxwiknltgxotdicj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_R7sjWE6L20aXu7rpLhduSQ__PPB-baf';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('Loading XLS file...');
  const filePath = './Prom.ua_categories_13_07_2026.xls';
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
  
  console.log(`Loaded sheet with ${rows.length} rows.`);
  
  const categoriesToInsert = [];
  
  // Skip header row (index 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 6) continue;
    
    const cat1 = row[0];
    const cat2 = row[1];
    const cat3 = row[2];
    const cat4 = row[3];
    const id = row[5];
    
    if (!id) continue;
    
    const hierarchy = [cat1, cat2, cat3, cat4].map(s => String(s || '').trim()).filter(Boolean);
    if (hierarchy.length === 0) continue;
    
    const name = hierarchy.join(' > ');
    
    categoriesToInsert.push({
      id: String(id),
      name: name,
      marketplace: 'prom',
      parent_id: null
    });
  }
  
  console.log(`Parsed ${categoriesToInsert.length} valid categories to upload.`);
  
  console.log('Clearing existing Prom categories...');
  const { error: clearError } = await supabase
    .from('marketplace_categories')
    .delete()
    .eq('marketplace', 'prom');
    
  if (clearError) {
    console.error('Error clearing old categories:', clearError);
    return;
  }
  console.log('Cleared successfully.');
  
  console.log('Uploading categories in chunks of 500...');
  const chunkSize = 500;
  for (let i = 0; i < categoriesToInsert.length; i += chunkSize) {
    const chunk = categoriesToInsert.slice(i, i + chunkSize);
    const { error: uploadError } = await supabase
      .from('marketplace_categories')
      .upsert(chunk);
      
    if (uploadError) {
      console.error(`Error uploading chunk starting at index ${i}:`, uploadError);
      return;
    }
    console.log(`Uploaded index ${i} to ${Math.min(i + chunkSize, categoriesToInsert.length)}`);
  }
  
  console.log('Done! All categories successfully synced to Supabase.');
}

main().catch(console.error);
