const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data } = await supabase.from('app_comments').select('*').order('created_at', { ascending: false }).limit(20);
    console.log(JSON.stringify(data.map(d => d.content), null, 2));
}
check();
