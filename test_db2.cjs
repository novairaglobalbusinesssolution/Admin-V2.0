const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fetchComments() {
    const { data, error } = await supabase.from('app_comments').select('content').order('created_at', { ascending: false }).limit(50);
    if (error) console.error(error);
    else data.forEach(d => console.log(d.content));
}
fetchComments();
