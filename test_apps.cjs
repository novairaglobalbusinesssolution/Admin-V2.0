const { createClient } = require("@supabase/supabase-js");
const fs = require('fs');
require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function getApps() {
    const { data } = await supabase.from("apps").select("*").limit(1);
    console.log(Object.keys(data[0]));
}
getApps();
