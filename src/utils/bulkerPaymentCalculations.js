/**
 * bulkerPaymentCalculations.js
 *
 * Shared calculation logic mirroring the exact calculations from the Bulker Panel (bulkers_panel/src/pages/PaymentsScreen.jsx).
 *
 * Calculations:
 * 1. Mode check per submission date:
 *    Checks review_submit_data.submitted_at against bulker_billing_history (ascending by change_date_time).
 *    Returns 'Wallet System' or 'Manual' (falls back to bulker.account_type or 'Wallet System').
 *
 * 2. Bulker Assignment on an App:
 *    Searches app.assigned_bulkers (JSON/array) matching [bulker_id, cleanId, 'NOVAIRA/BULKER/' + cleanId].
 *    Returns { amount, member_amount }.
 *
 * 3. Wallet Calculation (for 'Wallet System' periods):
 *    getAmount = Math.max(0, assignedAmount - memberAmount)
 *    totalProfit = getAmount * liveCount
 *    liveWalletBalance = transactions.length > 0 ? Math.max(creditSum - debitSum, totalProfit) : totalProfit
 *
 * 4. Monthly Invoice Calculation (for 'Manual' periods):
 *    appTotal = liveCount * assignedAmount
 *    grossTotal = sum(appTotal)
 */

export const normalizeBulkerId = (id) => {
  if (!id) return '';
  return String(id).trim();
};

export const getBulkerIdVariants = (bulkerId) => {
  if (!bulkerId) return [];
  const raw = String(bulkerId).trim();
  const clean = raw.replace(/^NOVAIRA\/BULKER\//i, '');
  const prefixed = `NOVAIRA/BULKER/${clean}`;
  return Array.from(new Set([raw, clean, prefixed]));
};

export const getModeAtDate = (dateStr, billingHistory = [], fallbackAccountType = 'Wallet System') => {
  if (!billingHistory || billingHistory.length === 0) {
    return fallbackAccountType || 'Wallet System';
  }
  const targetTime = new Date(dateStr).getTime();
  let mode = billingHistory[0]?.change_mode || fallbackAccountType || 'Wallet System';
  for (const h of billingHistory) {
    if (new Date(h.change_date_time).getTime() <= targetTime) {
      mode = h.change_mode;
    } else {
      break;
    }
  }
  return mode;
};

export const getBulkerAssignment = (app, bulkerVariants = []) => {
  if (!app || !app.assigned_bulkers) return { amount: 0, member_amount: null };
  let list = [];
  if (Array.isArray(app.assigned_bulkers)) {
    list = app.assigned_bulkers;
  } else if (typeof app.assigned_bulkers === 'string') {
    try {
      list = JSON.parse(app.assigned_bulkers);
    } catch {
      list = [];
    }
  }

  const match = list.find((b) => {
    if (!b || !b.bulker_id) return false;
    const bId = String(b.bulker_id).trim();
    const bClean = bId.replace(/^NOVAIRA\/BULKER\//i, '');
    return bulkerVariants.some((v) => {
      const vClean = String(v).replace(/^NOVAIRA\/BULKER\//i, '');
      return bClean.toLowerCase() === vClean.toLowerCase();
    });
  });

  return match || { amount: 0, member_amount: null };
};

export const calculateBulkerFinances = ({
  bulker,
  billingHistory = [],
  transactions = [],
  reviews = [],
  appsMap = {}
}) => {
  const bulkerVariants = getBulkerIdVariants(bulker?.bulker_id || bulker?.id);
  const fallbackType = bulker?.account_type || 'Wallet System';

  // 1. Transactions sums (credits and debits from individual_wallet_transactions)
  let creditSum = 0;
  let debitSum = 0;
  transactions.forEach((tx) => {
    const amt = Number(tx.amount || 0);
    const st = (tx.status || 'Success').toLowerCase();
    if (st === 'cancelled' || st === 'rejected' || st === 'failed') return;
    if (tx.transaction_type === 'Credit') creditSum += amt;
    else if (tx.transaction_type === 'Debit') debitSum += amt;
  });

  // 2. Reviews processing for Wallet Mode vs Manual Mode
  let walletLiveReviews = 0;
  let manualLiveReviews = 0;
  const walletAppBreakdown = {};
  const manualByMonth = {};

  reviews.forEach((r) => {
    const mode = getModeAtDate(r.submitted_at, billingHistory, fallbackType);
    const app = appsMap[r.app_id];
    const assignment = getBulkerAssignment(app, bulkerVariants);
    const assignedAmount = Number(assignment.amount || 0);

    if (mode === 'Wallet System') {
      walletLiveReviews += 1;
      const memberAmount =
        assignment.member_amount !== undefined && assignment.member_amount !== null
          ? Number(assignment.member_amount)
          : Number(app?.members_reward || 0);
      const getAmount = Math.max(0, assignedAmount - memberAmount);

      if (!walletAppBreakdown[r.app_id]) {
        walletAppBreakdown[r.app_id] = {
          appId: r.app_id,
          appName: app ? app.app_name : 'Unknown Application',
          taskId: app ? app.task_id : '-',
          assignedAmount,
          memberAmount,
          getAmount,
          liveCount: 0,
          totalEarned: 0
        };
      }
      walletAppBreakdown[r.app_id].liveCount += 1;
      walletAppBreakdown[r.app_id].totalEarned += getAmount;
    } else {
      // Manual Mode
      manualLiveReviews += 1;
      const mKey = r.submitted_at ? r.submitted_at.substring(0, 7) : '2026-10';

      if (!manualByMonth[mKey]) {
        manualByMonth[mKey] = {
          monthKey: mKey,
          grossTotal: 0,
          liveCount: 0,
          apps: {}
        };
      }

      manualByMonth[mKey].grossTotal += assignedAmount;
      manualByMonth[mKey].liveCount += 1;

      if (!manualByMonth[mKey].apps[r.app_id]) {
        manualByMonth[mKey].apps[r.app_id] = {
          appId: r.app_id,
          appName: app ? app.app_name : 'Unknown Application',
          taskId: app ? app.task_id : '-',
          assignedAmount,
          liveCount: 0,
          appTotal: 0
        };
      }

      manualByMonth[mKey].apps[r.app_id].liveCount += 1;
      manualByMonth[mKey].apps[r.app_id].appTotal += assignedAmount;
    }
  });

  const walletBreakdownList = Object.values(walletAppBreakdown);
  const computedWalletProfit = walletBreakdownList.reduce((sum, item) => sum + item.totalEarned, 0);

  // User requested: Formula Profit = Wallet Amount
  const liveWalletBalance = computedWalletProfit;

  // Month keys sorted descending
  const monthKeys = Object.keys(manualByMonth).sort().reverse();
  const totalManualGross = Object.values(manualByMonth).reduce((acc, m) => acc + m.grossTotal, 0);

  return {
    wallet: {
      walletLiveReviews,
      breakdownList: walletBreakdownList,
      computedProfit: computedWalletProfit,
      liveWalletBalance,
      creditSum,
      debitSum,
      netTransactions: creditSum - debitSum
    },
    invoices: {
      manualLiveReviews,
      byMonth: manualByMonth,
      monthKeys,
      totalManualGross
    }
  };
};

export const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(val) || 0);

export const formatMonthTitle = (mKey) => {
  if (!mKey) return 'Select Month';
  try {
    const [year, month] = mKey.split('-');
    const d = new Date(year, parseInt(month, 10) - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  } catch {
    return mKey;
  }
};
