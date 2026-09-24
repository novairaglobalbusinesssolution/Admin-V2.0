const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTriggers() {
    const { data, error } = await supabase.rpc('get_triggers');
    if (error) {
        console.log("No rpc 'get_triggers'. Executing SQL direct.");
    }
}
checkTriggers();
