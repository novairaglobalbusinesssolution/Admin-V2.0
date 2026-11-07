/**
 * providerFinancesCache.js
 *
 * High-performance shared caching service for Provider Invoices and Billing.
 * Implements in-memory & sessionStorage caching with 15-minute TTL,
 * in-flight request deduplication, and strict column projection.
 */

import { supabase } from '../supabaseClient';
import {
  getProviderIdVariants,
  calculateProviderFinances
} from './providerPaymentCalculations';

const CACHE_KEY = 'NV_PROVIDER_FINANCES_MASTER_CACHE_V1';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 Minutes Cache TTL

let memoryCache = null;
let inFlightPromise = null;

export const getCachedProviderFinances = () => {
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache;
  }
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        memoryCache = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('SessionStorage read error:', e);
  }
  return null;
};

const setCachedProviderFinances = (data) => {
  const cacheObj = {
    timestamp: Date.now(),
    data
  };
  memoryCache = cacheObj;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
  } catch (e) {
    console.warn('SessionStorage write error:', e);
  }
};

export const invalidateProviderFinancesCache = () => {
  memoryCache = null;
  inFlightPromise = null;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch (e) {
    console.warn('SessionStorage remove error:', e);
  }
};

export const getProviderFinances = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh) {
    const cached = getCachedProviderFinances();
    if (cached) {
      return {
        providers: cached.data.providers,
        totals: cached.data.totals,
        isFromCache: true,
        cacheTimestamp: cached.timestamp
      };
    }
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      // 1. Fetch all providers
      const { data: pData, error: pErr } = await supabase
        .from('providers')
        .select('id, provider_id, name, email, phone, status, created_at')
        .order('name', { ascending: true });

      if (pErr) throw pErr;
      const providersList = pData || [];

      // 2. Fetch all apps sponsored by providers
      const { data: appsData, error: aErr } = await supabase
        .from('apps')
        .select('id, app_name, app_package, task_id, sponsor_type, sponsor_id, sponsor_amount, members_reward, app_date, created_at')
        .eq('sponsor_type', 'Provider')
        .range(0, 4999);

      if (aErr) throw aErr;
      const providerApps = appsData || [];
      const providerAppIds = providerApps.map((a) => a.id);

      // 3. Concurrently fetch reviews and transactions
      const [revCountRes, txRes] = await Promise.all([
        supabase
          .from('review_submit_data')
          .select('*', { count: 'exact', head: true })
          .in('status', ['Live', 'Approved']),

        supabase
          .from('individual_wallet_transactions')
          .select('id, transaction_id, earner_id, amount, transaction_type, status, created_at, payout_details, description')
          .order('created_at', { ascending: false })
          .range(0, 4999)
      ]);

      const totalRevCount = revCountRes.count || 0;
      const transactionsAll = txRes.data || [];

      // Parallel fetch reviews in batches of 1000
      const batchSize = 1000;
      const revPromises = [];
      for (let offset = 0; offset < totalRevCount; offset += batchSize) {
        revPromises.push(
          supabase
            .from('review_submit_data')
            .select('app_id, status, submitted_at')
            .in('status', ['Live', 'Approved'])
            .range(offset, offset + batchSize - 1)
            .then((r) => r.data || [])
        );
      }

      const revBatches = await Promise.all(revPromises);
      const reviewsAll = revBatches.flat();

      // 4. Calculate metrics for each provider
      let grandTotalBilled = 0;
      let grandTotalPaid = 0;
      let grandTotalLiveReviews = 0;
      let grandTotalApps = 0;

      const calculatedProviders = providersList.map((p) => {
        const pMetrics = calculateProviderFinances({
          provider: p,
          apps: providerApps,
          reviews: reviewsAll,
          transactions: transactionsAll
        });

        grandTotalBilled += pMetrics.totalBilledAmount;
        grandTotalPaid += pMetrics.totalPaidAmount;
        grandTotalLiveReviews += pMetrics.totalLiveReviews;
        grandTotalApps += pMetrics.appsCount;

        return pMetrics;
      });

      const grandRemainingDue = Math.max(0, grandTotalBilled - grandTotalPaid);

      const totals = {
        totalBilled: grandTotalBilled,
        totalPaid: grandTotalPaid,
        totalDue: grandRemainingDue,
        totalLiveReviews: grandTotalLiveReviews,
        totalApps: grandTotalApps,
        activeProvidersCount: providersList.filter((p) => p.status === 'Active' || !p.status).length
      };

      const result = {
        providers: calculatedProviders,
        totals
      };

      setCachedProviderFinances(result);
      return {
        ...result,
        isFromCache: false,
        cacheTimestamp: Date.now()
      };
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
};
