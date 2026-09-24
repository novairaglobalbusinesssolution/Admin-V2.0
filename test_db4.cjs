const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
    const { data, error } = await supabase.from('app_comments').select('*').limit(1);
    console.log(data);
}
checkSchema();
