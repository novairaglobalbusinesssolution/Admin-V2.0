import { createClient } from '@supabase/supabase-js';

export const CHAT_SUPABASE_URL = 'https://zawjkbvemiluzupznepy.supabase.co';
export const CHAT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphd2prYnZlbWlsdXp1cHpuZXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MzY5MzIsImV4cCI6MjEwODIxMjkzMn0.ygLGwI93LjUs1B9YneUdo5crn-7Y5PMKizlgOJ-kGLg';

export const chatSupabase = createClient(CHAT_SUPABASE_URL, CHAT_SUPABASE_ANON_KEY);
