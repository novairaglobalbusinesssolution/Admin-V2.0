require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkWallet() {
  const { data, error } = await supabase.from('individual_wallet_transactions').select('*').limit(1);
  if (error) console.log("Error:", error.message);
  else console.log("individual_wallet_transactions exists!", data.length > 0 ? Object.keys(data[0]) : "Empty table");
}
checkWallet();
