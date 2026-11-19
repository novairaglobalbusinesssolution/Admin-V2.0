import { createClient } from '@supabase/supabase-js';

// Dedicated Workstations Supabase client containing the 'apps' table
const supabaseWork = createClient(
  process.env.SUPABASE_WORK_URL || 'https://efrdodrxbaqjqbhvgjbz.supabase.co',
  process.env.SUPABASE_WORK_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmcmRvZHJ4YmFxanFiaHZnamJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTQxNjEsImV4cCI6MjEwODk3MDE2MX0.9g8IEVit0S68r4NXYtrkEi5mIJdQXDnr1dpGL1vUbO8'
);

/**
 * Extracts clean package identifier and canonical Google Play Store link
 * Handles plain package names and Play Store URL variations.
 */
function parseAppPackage(rawPackage) {
  if (!rawPackage) return { packageName: '', playstoreUrl: '' };
  let pkg = String(rawPackage).trim();

  if (pkg.includes('details?id=')) {
    const match = pkg.match(/[?&]id=([a-zA-Z0-9._]+)/);
    if (match && match[1]) {
      pkg = match[1];
    }
  } else if (pkg.startsWith('http')) {
    const parts = pkg.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart) pkg = lastPart;
  }

  // Strip query strings, fragments, and trailing slashes
  pkg = pkg.split('?')[0].split('&')[0].replace(/[#/]/g, '').trim();
  const playstoreUrl = pkg ? `https://play.google.com/store/apps/details?id=${pkg}` : '';
  return { packageName: pkg, playstoreUrl };
}

/**
 * Converts date representations (YYYY-MM-DD or DD/MM/YYYY) to DD/MM/YYYY
 */
function formatDDMMYYYY(dateInput) {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = isoMatch[2].padStart(2, '0');
    const dd = isoMatch[3].padStart(2, '0');
    return `${dd}/${mm}/${yyyy}`;
  }
  const slashMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slashMatch) {
    const dd = slashMatch[1].padStart(2, '0');
    const mm = slashMatch[2].padStart(2, '0');
    const yyyy = slashMatch[3];
    return `${dd}/${mm}/${yyyy}`;
  }
  return str;
}

/**
 * Resolves date input or returns today's date in Asia/Kolkata (IST) YYYY-MM-DD format
 */
function parseToISODate(dateInput) {
  if (!dateInput) {
    const now = new Date();
    const ist = new Date(now.getTime() + (330 * 60000));
    return ist.toISOString().split('T')[0];
  }
  const str = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const parts = str.split(/[\/-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return str;
}

export default async function handler(req, res) {
  // Set CORS headers so any client or script can consume the JSON API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-admin-key, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Determine target live checking date (defaults to today in IST)
    const rawDate = req.query.date || req.body?.date;
    const targetIsoDate = parseToISODate(rawDate);
    const targetBy = (req.query.target_by || req.body?.target_by || 'release').toLowerCase();

    // 2. Query apps due for live checking from Supabase 'apps' table
    const { data: apps, error: dbError } = await supabaseWork
      .from('apps')
      .select('*')
      .eq('live_checking_date', targetIsoDate)
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('[API live-checking-tasks] Database error:', dbError);
      return res.status(500).json({
        status: 'error',
        message: 'Database query failed',
        error: dbError.message
      });
    }

    const appList = apps || [];

    // 3. Map into the production-ready schema required for Play Store review recordings
    const tasks = appList.map((app) => {
      const { packageName, playstoreUrl } = parseAppPackage(app.app_package);
      const formattedReleaseDate = formatDDMMYYYY(app.app_date);
      const formattedLiveDate = formatDDMMYYYY(app.live_checking_date);

      // Default target_day is the app's release date (e.g. 12/11/2026),
      // which is the date when reviews were dropped and need verification.
      const targetDay = targetBy === 'live' ? formattedLiveDate : formattedReleaseDate;

      return {
        task_id: String(app.task_id || app.id),
        package_name: packageName,
        app_name: app.app_name || '',
        app_link: playstoreUrl,
        playstore_url: playstoreUrl,
        target_day: targetDay,
        release_date: formattedReleaseDate,
        app_date: app.app_date || '',
        live_checking_date: formattedLiveDate,
        raw_live_checking_date: app.live_checking_date || '',
        sponsor_id: app.sponsor_id || ''
      };
    });

    return res.status(200).json({
      status: 'success',
      total: tasks.length,
      live_checking_date: formatDDMMYYYY(targetIsoDate),
      query_date: targetIsoDate,
      target_by: targetBy,
      tasks
    });

  } catch (error) {
    console.error('[API live-checking-tasks] Exception:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message
    });
  }
}
