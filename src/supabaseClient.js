import { 
  supabaseAuth, 
  supabaseWork, 
  supabasePayments, 
  supabaseCommunity, 
  supabaseSystem 
} from './novairaDatabases';

/**
 * NOVAIRA MULTI-DATABASE ROUTER
 * Routes database requests to their respective dedicated Supabase instances
 * to ensure 100% free tier compliance, isolated bandwidth, and zero quota limits.
 */
const TABLE_ROUTING = {
  // 1. Workstations Database
  'apps': supabaseWork,
  'app_comments': supabaseWork,
  'review_submit_data': supabaseWork,
  'bulker_app_acceptances': supabaseWork,
  'tasks': supabaseWork,
  'user_task_logs': supabaseWork,
  'user_daily_stats': supabaseWork,

  // 2. Payments Database
  'individual_wallet_transactions': supabasePayments,
  'company_fund_transactions': supabasePayments,
  'bulker_wallet_transactions': supabasePayments,
  'bulker_billing_history': supabasePayments,
  'invoices': supabasePayments,
  'gift_cards': supabasePayments,
  'individual_payment_settings': supabasePayments,
  'payment_settings': supabasePayments,
  'payment_gateways': supabasePayments,

  // 3. Community Database
  'puja_zone_posts': supabaseCommunity,
  'puja_zone_comments': supabaseCommunity,
  'tickets': supabaseCommunity,
  'ticket_messages': supabaseCommunity,
  'community_chat': supabaseCommunity,

  // 4. Security & System Database
  'cron_settings': supabaseSystem,
  'live_list_settings': supabaseSystem,
  'smtp_settings': supabaseSystem,
  'security_blacklist': supabaseSystem,
  'system_audit_logs': supabaseSystem,

  // 5. Authentication Database (Default)
  'admins': supabaseAuth,
  'profiles': supabaseAuth,
  'bulker_desks': supabaseAuth,
  'clients': supabaseAuth,
  'providers': supabaseAuth
};

/**
 * Universal Supabase Client Proxy
 * Any call to `supabase.from('tableName')` is automatically dispatched
 * to the correct isolated database without modifying existing UI pages!
 */
export const supabase = new Proxy(supabaseAuth, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (tableName) => {
        const client = TABLE_ROUTING[tableName] || supabaseAuth;
        return client.from(tableName);
      };
    }
    // Auth, Storage, Channels default to primary/target
    return Reflect.get(target, prop, receiver);
  }
});

// Also export specific databases for explicit usage
export { 
  supabaseAuth, 
  supabaseWork, 
  supabasePayments, 
  supabaseCommunity, 
  supabaseSystem 
};

export default supabase;
