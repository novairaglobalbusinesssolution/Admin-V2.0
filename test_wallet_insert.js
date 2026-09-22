const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  const payload = {
    transaction_id: 'TEST_TRX_123',
    earner_id: 'NOVAIRA/BULKER/PRATIK1',
    amount: 10,
    transaction_type: 'Credit',
    status: 'Completed'
  };
  
  const { data, error } = await supabase.from('individual_wallet_transactions').insert([payload]);
  console.log("Insert result:", { data, error });
}
check();
