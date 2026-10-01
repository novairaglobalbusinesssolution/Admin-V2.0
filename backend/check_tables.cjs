require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkTables() {
  const { data, error } = await supabase.rpc('get_tables'); // Or just fetch a few known ones
  const tables = ['bulkers', 'earners', 'profiles'];
  for (let t of tables) {
    const { data } = await supabase.from(t).select('*').limit(1);
    console.log(t, data ? Object.keys(data[0] || {}) : "No data/table");
  }
}
checkTables();
