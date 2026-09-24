const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data } = await supabase.from('app_comments').select('*').order('created_at', { ascending: false }).limit(60);
    const demo = data.filter(d => d.content.includes('5-Star Review'));
    console.log(demo.map(d => d.content));
}
check();
