require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkPoulami() {
  const { data, error } = await supabase.from('profiles').select('earner_id, fcm_token').eq('earner_id', 'NOVAIRA/INDIVIDUAL/C70829C');
  console.log("Poulami:", data);
}
checkPoulami();
