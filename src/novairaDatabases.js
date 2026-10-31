/**
 * NOVAIRA MULTI-DATABASE ARCHITECTURE (Admin Panel)
 * 5 Distributed Supabase Clients for Zero Quota Overages
 */
import { createClient } from '@supabase/supabase-js';

// 1. Authentication
export const supabaseAuth = createClient(
  'https://ybqdewajnpffrguihujn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicWRld2FqbnBmZnJndWlodWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MDkxMTAsImV4cCI6MjEwODk4NTExMH0.Yn9688u1oTp_woM12CXrylSVXNRDsm9fRl3QTk8H9zk'
);

// 2. Workstations
export const supabaseWork = createClient(
  'https://efrdodrxbaqjqbhvgjbz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmcmRvZHJ4YmFxanFiaHZnamJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTQxNjEsImV4cCI6MjEwODk3MDE2MX0.9g8IEVit0S68r4NXYtrkEi5mIJdQXDnr1dpGL1vUbO8'
);

// 3. Payments
export const supabasePayments = createClient(
  'https://bpiuvfiebiipjzvuexqg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwaXV2ZmllYmlpcGp6dnVleHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MTIwNzAsImV4cCI6MjEwODk4ODA3MH0.zy77ozEPCLk-yXmb4PwFqs3bOiKae2BI5pbA2RrbRSg'
);

// 4. Community
export const supabaseCommunity = createClient(
  'https://bgmdikzbolgcvfbutybw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbWRpa3pib2xnY3ZmYnV0eWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MTIyNDMsImV4cCI6MjEwODk4ODI0M30.N5cfdbwss-YaU6Ni6p6DkM20OhgIFcrcaxuZtecv38Q'
);

// 5. System
export const supabaseSystem = createClient(
  'https://egatmhtiyxuixdbdjzae.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYXRtaHRpeXh1aXhkYmRqemFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMTg4NDQsImV4cCI6MjA5OTg5NDg0NH0.WWhKBhCl37GMH66AUqV-fzkfYG8FF94NKjg5PvYEcjI'
);
