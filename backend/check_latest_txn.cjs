require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkLatestTransactions() {
  const { data, error } = await supabase.from('individual_wallet_transactions').select('*').order('created_at', { ascending: false }).limit(2);
  console.log("Latest transactions:", data);
}
checkLatestTransactions();
