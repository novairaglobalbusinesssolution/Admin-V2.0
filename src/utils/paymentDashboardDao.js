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
  const { data, error } = await supabase
    .from('company_fund_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error && error.code !== '42P01') {
    throw error;
  }

  const companyTransactions = Array.isArray(data) ? data : [];

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

  const pendingWithdrawalRequests = companyTransactions.filter((tx) => {
    const transactionType = normalizeString(tx.transaction_type).toLowerCase();
    const status = normalizeString(tx.status).toLowerCase();

    return transactionType === 'debit' && ['pending', 'processing'].includes(status);
  });

  const pendingWithdrawalAmount = pendingWithdrawalRequests.reduce((sum, tx) => sum + normalizeAmount(tx.amount), 0);

  const totalProcessed = companyTransactions.reduce((sum, tx) => {
    if (isIgnoredStatus(tx.status) || !isSuccessfulStatus(tx.status)) return sum;
    return sum + normalizeAmount(tx.amount);
  }, 0);

  return {
    currentCompanyBalance,
    totalWithdrawalRequests: pendingWithdrawalRequests.length,
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
