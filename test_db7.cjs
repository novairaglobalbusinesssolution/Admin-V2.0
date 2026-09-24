const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/get_triggers`, {
        method: 'POST',
        headers: {
            'apikey': process.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
        }
    });
    console.log(res.status);
}
check();
