require('dotenv').config({ path: 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkTokens() {
  const { data, error } = await supabase.from('profiles').select('earner_id, fcm_token');
  let withToken = 0;
  let noToken = 0;
  if(data) {
    data.forEach(p => {
       if (p.fcm_token) withToken++;
       else noToken++;
    });
  }
  console.log(`With token: ${withToken}, No token: ${noToken}`);
}
checkTokens();
