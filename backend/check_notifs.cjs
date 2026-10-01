require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkNotifs() {
  const { data, error } = await supabase.from('user_notifications').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Recent notifications:", data);
}
checkNotifs();
