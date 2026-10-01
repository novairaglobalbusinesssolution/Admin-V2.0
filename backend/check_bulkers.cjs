require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkAccountTypes() {
  const { data, error } = await supabase.from('bulker_profiles').select('*').limit(5);
  console.log("Bulker Profiles sample:", data);
}
checkAccountTypes();
