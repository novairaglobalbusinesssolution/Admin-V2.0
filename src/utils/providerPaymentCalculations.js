/**
 * providerPaymentCalculations.js
 *
 * Core financial calculations and billing logic for Provider Agencies & Sponsors.
 * Calculates campaign apps, verified deliverables, gross billed totals, disbursements, and dues.
 */

export const normalizeProviderId = (id) => {
  if (!id) return '';
  return String(id).trim();
};

export const getProviderIdVariants = (providerId) => {
  if (!providerId) return [];
  const raw = String(providerId).trim();
  const clean = raw.replace(/^NOVAIRA\/PROVIDER\//i, '');
  const prefixed = `NOVAIRA/PROVIDER/${clean}`;
  return Array.from(new Set([raw, clean, prefixed]));
};

/**
 * Resolves the monthly billing cycle key (YYYY-MM) based strictly on APP DATE (app.app_date or app.created_at).
 */
export const getAppMonthKey = (app, fallbackDateStr) => {
  const rawDate = app?.app_date || app?.created_at || fallbackDateStr;
  if (!rawDate) return '2026-10';
  const str = String(rawDate).trim();
  if (/^\d{4}-\d{2}/.test(str)) {
    return str.substring(0, 7);
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
  } catch {
    // fallback
  }
  return str.substring(0, 7) || '2026-10';
};

export const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(val) || 0);

export const formatMonthTitle = (mKey, full = false) => {
  if (!mKey) return 'Select Billing Cycle';
  try {
    const [year, month] = mKey.split('-');
    const d = new Date(year, parseInt(month, 10) - 1, 1);
    return d.toLocaleDateString('en-IN', { month: full ? 'long' : 'short', year: 'numeric' });
  } catch {
    return mKey;
  }
};

/**
 * Calculates provider finances:
 * 1. Matches all applications sponsored by this provider.
 * 2. Aggregates verified live reviews (status in ['Live', 'Approved']).
 * 3. Multiplies by sponsor_amount to determine gross total.
 * 4. Groups by month based on APP DATE.
 * 5. Matches disbursements from individual_wallet_transactions.
 */
export const calculateProviderFinances = ({
  provider,
  apps = [],
  reviews = [],
  transactions = []
}) => {
  const targetVariants = getProviderIdVariants(provider?.provider_id || provider?.id);
  const cleanId = (provider?.provider_id || '').replace(/^NOVAIRA\/PROVIDER\//i, '').toLowerCase();

  // 1. Filter apps sponsored by this provider
  const providerApps = apps.filter((app) => {
    if (!app.sponsor_id) return false;
    const sId = String(app.sponsor_id).trim().toLowerCase();
    const sClean = sId.replace(/^novaira\/provider\//i, '');
    return targetVariants.some((v) => {
      const vClean = String(v).replace(/^NOVAIRA\/PROVIDER\//i, '').toLowerCase();
      return sClean === vClean || sId === String(v).toLowerCase();
    }) || sClean === cleanId;
  });

  const providerAppMap = new Map();
  providerApps.forEach((a) => {
    providerAppMap.set(a.id, a);
  });

  // 2. Count live reviews for these apps
  const reviewCountMap = new Map();
  const sampleSubmittedMap = new Map();

  reviews.forEach((r) => {
    if (!providerAppMap.has(r.app_id)) return;
    const st = (r.status || '').toLowerCase();
    if (st !== 'live' && st !== 'approved') return;

    reviewCountMap.set(r.app_id, (reviewCountMap.get(r.app_id) || 0) + 1);
    if (!sampleSubmittedMap.has(r.app_id) && r.submitted_at) {
      sampleSubmittedMap.set(r.app_id, r.submitted_at);
    }
  });

  // 3. Group by Monthly Billing Cycle (using APP DATE)
  const byMonth = {};
  let totalBilledAmount = 0;
  let totalLiveReviews = 0;

  providerApps.forEach((app) => {
    const liveCount = reviewCountMap.get(app.id) || 0;
    const rate = Number(app.sponsor_amount || 0);
    const appTotal = liveCount * rate;
    const mKey = getAppMonthKey(app, sampleSubmittedMap.get(app.id));

    totalLiveReviews += liveCount;
    totalBilledAmount += appTotal;

    if (!byMonth[mKey]) {
      byMonth[mKey] = {
        monthKey: mKey,
        grossTotal: 0,
        liveCount: 0,
        apps: {}
      };
    }

    byMonth[mKey].grossTotal += appTotal;
    byMonth[mKey].liveCount += liveCount;

    byMonth[mKey].apps[app.id] = {
      appId: app.id,
      appName: app.app_name || 'Campaign App',
      taskId: app.task_id || '-',
      appPackage: app.app_package || '',
      appDate: app.app_date || app.created_at || null,
      rate,
      liveCount,
      appTotal
    };
  });

  // 4. Match payments recorded for this provider
  let totalPaidAmount = 0;
  const matchedTransactions = transactions.filter((tx) => {
    if (tx.transaction_type !== 'Debit') return false;
    const st = (tx.status || 'Completed').toLowerCase();
    if (st === 'cancelled' || st === 'rejected' || st === 'failed') return false;

    const earner = String(tx.earner_id || '').toLowerCase();
    const eClean = earner.replace(/^novaira\/provider\//i, '');
    const isMatchingEarner = targetVariants.some((v) => {
      const vClean = String(v).replace(/^NOVAIRA\/PROVIDER\//i, '').toLowerCase();
      return eClean === vClean || earner === String(v).toLowerCase();
    }) || eClean === cleanId;

    if (isMatchingEarner) {
      totalPaidAmount += Number(tx.amount || 0);
      return true;
    }

    const desc = String(tx.description || '').toLowerCase();
    if (cleanId && desc.includes(cleanId)) {
      totalPaidAmount += Number(tx.amount || 0);
      return true;
    }

    return false;
  });

  const remainingDue = Math.max(0, totalBilledAmount - totalPaidAmount);
  const isFullyPaid = totalBilledAmount > 0 && remainingDue <= 0.01;
  const isPartiallyPaid = totalPaidAmount > 0 && remainingDue > 0.01;
  const paymentStatus = isFullyPaid ? 'PAID' : isPartiallyPaid ? 'PARTIAL' : 'PENDING';

  // Sorted month keys descending
  const monthKeys = Object.keys(byMonth).sort().reverse();

  return {
    provider,
    appsCount: providerApps.length,
    apps: providerApps,
    totalLiveReviews,
    totalBilledAmount,
    totalPaidAmount,
    remainingDue,
    paymentStatus,
    byMonth,
    monthKeys,
    matchedTransactions
  };
};
