require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkUserNotifs() {
  const { data, error } = await supabase.from('user_notifications').select('*').eq('earner_id', 'NOVAIRA/INDIVIDUAL/CCFEE3D').order('created_at', { ascending: false }).limit(2);
  console.log("Subhadeep Notifs:", data);
}
checkUserNotifs();
