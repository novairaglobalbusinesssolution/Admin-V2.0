require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkWallet() {
  const { data, error } = await supabase.from('individual_wallet_transactions').select('*').eq('earner_id', 'NOVAIRA/INDIVIDUAL/C70829C').order('created_at', { ascending: false }).limit(2);
  console.log("Poulami Wallet:", data);
}
checkWallet();
