const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
async function runQuery() {
  const { data, error } = await supabase.rpc('run_sql', {
    query: `ALTER TABLE public.individual_wallet_transactions 
            ADD CONSTRAINT individual_wallet_transactions_earner_id_fkey 
            FOREIGN KEY (earner_id) REFERENCES public.profiles(earner_id);`
  });
  console.log("Error:", error);
}
runQuery();
