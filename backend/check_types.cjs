require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkAccountTypes() {
  const { data, error } = await supabase.from('profiles').select('account_type');
  const counts = {};
  if (data) {
    data.forEach(p => {
      counts[p.account_type] = (counts[p.account_type] || 0) + 1;
    });
  }
  console.log("Account Types:", counts);
}
checkAccountTypes();
