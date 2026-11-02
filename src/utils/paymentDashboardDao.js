import { supabase } from '../supabaseClient';

const normalizeAmount = (value) => Number(value || 0);
const normalizeString = (value) => String(value || '').trim();
const isSuccessfulStatus = (status) => ['completed', 'success', 'successful'].includes(normalizeString(status).toLowerCase());

const formatDate = (value) => {
  if (!value) return 'N/A';

  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    });
  } catch (error) {
    return 'N/A';
  }
};

const isIgnoredStatus = (status) => ['cancelled', 'rejected', 'failed'].includes(normalizeString(status).toLowerCase());

export async function fetchPaymentDashboardData() {
  const [companyRes, withdrawalsRes] = await Promise.all([
    supabase
      .from('company_fund_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
    supabase
      .from('individual_wallet_transactions')
      .select('amount')
      .eq('status', 'Pending')
      .eq('transaction_type', 'Debit')
      .ilike('description', 'Withdrawal:%')
  ]);

  if (companyRes.error && companyRes.error.code !== '42P01') {
    throw companyRes.error;
  }

  const companyTransactions = Array.isArray(companyRes.data) ? companyRes.data : [];
  const pendingWithdrawalRows = Array.isArray(withdrawalsRes.data) ? withdrawalsRes.data : [];

  const currentCompanyBalance = companyTransactions.reduce((sum, tx) => {
    if (isIgnoredStatus(tx.status) || !isSuccessfulStatus(tx.status)) return sum;

    const amount = normalizeAmount(tx.amount);
    if (normalizeString(tx.transaction_type).toLowerCase() === 'credit') {
      return sum + amount;
    }

    if (normalizeString(tx.transaction_type).toLowerCase() === 'debit') {
      return sum - amount;
    }

    return sum;
  }, 0);

  const totalWithdrawalRequests = pendingWithdrawalRows.length;
  const pendingWithdrawalAmount = pendingWithdrawalRows.reduce((sum, tx) => sum + normalizeAmount(tx.amount), 0);

  const totalProcessed = companyTransactions.reduce((sum, tx) => {
    if (isIgnoredStatus(tx.status) || !isSuccessfulStatus(tx.status)) return sum;
    return sum + normalizeAmount(tx.amount);
  }, 0);

  return {
    currentCompanyBalance,
    totalWithdrawalRequests,
    pendingWithdrawalAmount,
    totalProcessed,
    transactions: companyTransactions
      .filter((tx) => !isIgnoredStatus(tx.status))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .map((tx) => ({
        id: tx.id,
        transaction_id: tx.transaction_id || 'N/A',
        transaction_type: tx.transaction_type || 'Debit',
        reference_type: tx.reference_type || 'N/A',
        reference_id: tx.reference_id || 'N/A',
        party_type: tx.party_type || 'N/A',
        party_id: tx.party_id || 'N/A',
        amount: normalizeAmount(tx.amount),
        status: tx.status || 'Completed',
        description: tx.description || 'Company fund transaction',
        created_at: formatDate(tx.created_at),
        created_at_value: tx.created_at,
      })),
  };
}
