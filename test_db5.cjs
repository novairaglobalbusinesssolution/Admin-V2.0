const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fetchDemo() {
    const { data, error } = await supabase.from('app_comments').select('*').like('content', '%5-Star Review%').order('created_at', { ascending: false });
    if (error) console.error(error);
    else {
        console.log(`Found ${data.length} demo comments`);
        data.slice(0, 5).forEach(d => console.log(`${d.created_at} - ${d.app_id} - ${d.content}`));
    }
}
fetchDemo();
