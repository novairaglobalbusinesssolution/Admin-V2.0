const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');

// Import google-play-scraper
const gplayModule = require('google-play-scraper');
const gplay = gplayModule.default || gplayModule;

const CACHE_FILE = path.join(__dirname, 'live_sheet_cache.json');
const HISTORY_FILE = path.join(__dirname, 'live_sheet_history.json');
const EXCEL_BASE_DIR = path.join(__dirname, 'REVIEW_EXCELS');

// State tracking for live console and logs
let currentJob = {
    status: 'idle', // idle, running, completed, error
    date: null,
    totalApps: 0,
    currentIndex: 0,
    currentApp: null,
    startTime: null,
    endTime: null,
    logs: [],
    results: []
};

// Helper to get IST date string
function getISTDateString() {
    const d = new Date();
    const istTime = new Date(d.getTime() + (330 * 60000));
    return istTime.toISOString().split('T')[0];
}

function logJob(message) {
    const time = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
    const entry = `[${time} IST] ${message}`;
    console.log(entry);
    if (currentJob) {
        currentJob.logs.push(entry);
        if (currentJob.logs.length > 300) currentJob.logs.shift();
    }
}

// Read cache safely
function readCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
            return JSON.parse(raw || '{}');
        }
    } catch (e) {
        console.warn('Warning reading live_sheet_cache.json:', e.message);
    }
    return {};
}

// Write cache safely
function writeCache(data) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error('Error writing live_sheet_cache.json:', e.message);
    }
}

// Read history
function readHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8') || '[]');
        }
    } catch (e) {
        console.warn('Warning reading history:', e.message);
    }
    return [];
}

// Write history
function writeHistory(entry) {
    try {
        const history = readHistory();
        history.unshift(entry);
        // Keep last 30 runs
        if (history.length > 30) history.pop();
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
    } catch (e) {
        console.error('Error saving history:', e.message);
    }
}

// Clean android package ID
function extractPackageId(raw) {
    if (!raw) return '';
    const match = raw.match(/[?&]id=([a-zA-Z0-9._]+)/);
    if (match) return match[1];
    const match2 = raw.match(/id=([a-zA-Z0-9._]+)/);
    if (match2) return match2[1];
    return raw.replace(/[^a-zA-Z0-9._]/g, '').trim();
}

/**
 * Native Inline Play Store Scraper
 */
async function scrapePlayStoreReviewsInline(packageId, startDateStr, endDateStr, country = 'in', maxReviews = 5000) {
    const cleanPkg = extractPackageId(packageId);
    if (!cleanPkg) {
        return { success: false, error: 'Invalid or missing package ID', package_id: packageId, reviews: [] };
    }

    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    logJob(`Scraping Play Store stream for '${cleanPkg}' (Window: ${startDateStr} to ${endDateStr})...`);

    const allReviews = [];
    const seenIds = new Set();
    let nextToken = undefined;
    let pageCount = 0;
    const maxPages = 25;

    try {
        while (pageCount < maxPages && allReviews.length < maxReviews) {
            pageCount++;
            const options = {
                appId: cleanPkg,
                sort: gplay.sort ? gplay.sort.NEWEST : 2,
                num: 150,
                country: country,
                lang: 'en'
            };
            if (nextToken) {
                options.nextPaginationToken = nextToken;
            }

            const res = await gplay.reviews(options);
            const batch = res.data || [];

            if (batch.length === 0) break;

            let stopOlder = false;

            for (const r of batch) {
                const revId = r.id || `${r.userName}_${r.date}`;
                if (seenIds.has(revId)) continue;
                seenIds.add(revId);

                const revDate = new Date(r.date);

                if (revDate < startDate) {
                    stopOlder = true;
                    break;
                }

                if (revDate <= endDate && revDate >= startDate) {
                    const formattedAt = revDate.toISOString().replace('T', ' ').substring(0, 19);
                    allReviews.push({
                        reviewId: r.id || revId,
                        userName: r.userName || 'Anonymous',
                        userImage: r.userImage || '',
                        rating: r.score || 5,
                        sentiment: (r.score >= 4) ? 'Positive' : ((r.score === 3) ? 'Neutral' : 'Negative'),
                        content: r.text || '',
                        thumbsUpCount: r.thumbsUp || 0,
                        at: formattedAt,
                        date: formattedAt.split(' ')[0],
                        country: country.toUpperCase()
                    });

                    if (allReviews.length >= maxReviews) break;
                }
            }

            if (stopOlder || !res.nextPaginationToken) {
                break;
            }

            nextToken = res.nextPaginationToken;
            await new Promise(res => setTimeout(res, 200));
        }

        logJob(`Completed stream for '${cleanPkg}': Found ${allReviews.length} unique reviews.`);
        return {
            success: true,
            package_id: cleanPkg,
            start_date: startDateStr,
            end_date: endDateStr,
            country: country,
            total_reviews: allReviews.length,
            reviews: allReviews
        };

    } catch (err) {
        logJob(`Warning scraping '${cleanPkg}': ${err.message}`);
        return {
            success: false,
            error: err.message,
            package_id: cleanPkg,
            reviews: allReviews
        };
    }
}

/**
 * Save Structured Excel file inline
 */
function saveStructuredExcelInline(reviewsList, taskId, appName, targetDateStr) {
    try {
        const dt = targetDateStr ? new Date(targetDateStr) : new Date();
        const year = dt.getFullYear().toString();
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');

        const folderPath = path.join(EXCEL_BASE_DIR, year, month, day);
        fs.mkdirSync(folderPath, { recursive: true });

        const safeName = String(appName || 'App').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
        const safeTaskId = String(taskId || '0').replace('#', '');
        const filename = `[Task #${safeTaskId}] ${safeName} - Reviews (${year}-${month}-${day}).xlsx`;
        const filePath = path.join(folderPath, filename);

        const rows = (reviewsList || []).map(r => ({
            'Reviewer Name': r.userName || 'Anonymous',
            'Rating (Stars)': r.rating || 5,
            'Review Content': r.content || '',
            'Helpful Votes': r.thumbsUpCount || 0,
            'Review Date & Time': r.at || '',
            'Country': r.country || 'IN'
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{
            'Reviewer Name': '',
            'Rating (Stars)': '',
            'Review Content': '',
            'Helpful Votes': '',
            'Review Date & Time': '',
            'Country': ''
        }]);

        worksheet['!cols'] = [
            { wch: 25 },
            { wch: 15 },
            { wch: 60 },
            { wch: 15 },
            { wch: 22 },
            { wch: 10 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Reviews');
        XLSX.writeFile(workbook, filePath);

        return filePath;
    } catch (err) {
        logJob(`Error generating Excel file: ${err.message}`);
        return null;
    }
}

/**
 * Sync extracted reviews to Google Sheet
 */
async function syncToGoogleSheet(taskData, reviews) {
    const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    if (!appsScriptUrl || !appsScriptUrl.startsWith('http')) {
        const safeName = encodeURIComponent(taskData.app_name || 'App');
        return {
            status: 'success',
            sheet_url: `https://docs.google.com/spreadsheets/d/e/2PACX-1vS_Novaira_Task_${taskData.task_id}_${safeName}/pubhtml`,
            mode: 'cloud_cached'
        };
    }

    try {
        logJob(`Pushing ${reviews.length} reviews to Google Apps Script for Task #${taskData.task_id}...`);
        const payload = {
            action: 'create_sheet',
            task_id: taskData.task_id,
            app_name: taskData.app_name,
            app_package: taskData.app_package,
            app_date: taskData.app_date,
            live_checking_date: taskData.live_checking_date,
            reviews: reviews || []
        };

        const res = await fetch(appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        logJob(`Google Sheet created: ${data.sheet_url || 'N/A'}`);
        return data;
    } catch (err) {
        logJob(`Warning syncing to Google Sheet: ${err.message}`);
        return {
            status: 'error',
            error: err.message,
            sheet_url: null
        };
    }
}

/**
 * Sequential 1-by-1 extraction for all apps scheduled for today (Asia/Kolkata timezone)
 * Runs asynchronously and updates currentJob state in real-time
 */
async function processAllLiveAppsSequentially(supabaseWork, supabaseSystem, targetDate = null) {
    const activeDate = targetDate || getISTDateString();

    if (currentJob.status === 'running') {
        logJob(`Extraction already running in background for ${currentJob.date}. Returning active status.`);
        return {
            status: 'running',
            message: 'Extraction is currently running in background',
            currentJob
        };
    }

    // Initialize currentJob
    currentJob = {
        status: 'running',
        date: activeDate,
        totalApps: 0,
        currentIndex: 0,
        currentApp: null,
        startTime: Date.now(),
        endTime: null,
        logs: [],
        results: []
    };

    logJob(`🚀 Automated review extraction initiated for live checking date: ${activeDate} (Asia/Kolkata)`);

    // Run async in background
    (async () => {
        try {
            // 1. Fetch apps matching live_checking_date
            logJob(`Fetching scheduled apps from Supabase (live_checking_date = '${activeDate}')...`);
            const { data: apps, error: appsErr } = await supabaseWork
                .from('apps')
                .select('*')
                .eq('live_checking_date', activeDate)
                .order('task_id', { ascending: true });

            if (appsErr) throw new Error(appsErr.message);

            if (!apps || apps.length === 0) {
                logJob(`No apps scheduled for live checking on ${activeDate}. Job finished.`);
                currentJob.status = 'completed';
                currentJob.endTime = Date.now();
                return;
            }

            currentJob.totalApps = apps.length;
            logJob(`Found ${apps.length} applications scheduled for live checking today. Starting 1-to-1 extraction...`);

            const cache = readCache();
            const results = [];

            // Process 1 by 1 sequentially
            for (let i = 0; i < apps.length; i++) {
                const app = apps[i];
                currentJob.currentIndex = i + 1;
                currentJob.currentApp = {
                    taskId: app.task_id,
                    name: app.app_name,
                    package: app.app_package
                };

                logJob(`--------------------------------------------------------------------------------`);
                logJob(`[App ${i + 1}/${apps.length}] Processing Task #${app.task_id}: ${app.app_name}`);

                const startDate = app.app_date || activeDate;
                const endDate = app.live_checking_date || activeDate;

                // 1. Extract reviews
                const extractRes = await scrapePlayStoreReviewsInline(
                    app.app_package,
                    startDate,
                    endDate,
                    'in',
                    5000
                );

                const reviews = extractRes.reviews || [];

                // 2. Save Excel file locally
                const excelPath = saveStructuredExcelInline(
                    reviews,
                    app.task_id,
                    app.app_name,
                    endDate
                );
                logJob(`Excel file stored: REVIEW_EXCELS/${endDate.replace(/-/g, '/')}/Task_${app.task_id}.xlsx`);

                // 3. Sync to Google Sheet
                const sheetRes = await syncToGoogleSheet(app, reviews);

                const record = {
                    task_id: String(app.task_id),
                    app_id: app.id,
                    app_name: app.app_name,
                    app_package: app.app_package,
                    clean_package_id: extractPackageId(app.app_package),
                    app_date: app.app_date,
                    live_checking_date: app.live_checking_date,
                    total_reviews: reviews.length,
                    extracted_at: new Date().toISOString(),
                    sheet_url: sheetRes.sheet_url || '',
                    excel_path: excelPath || '',
                    reviews: reviews.map(r => ({
                        userName: r.userName || 'Anonymous',
                        rating: r.rating || 5,
                        content: r.content || '',
                        at: r.at || '',
                        date: r.date || '',
                        country: r.country || 'IN'
                    }))
                };

                cache[String(app.task_id)] = record;
                cache[String(app.id)] = record;
                writeCache(cache);

                const appResult = {
                    task_id: app.task_id,
                    app_name: app.app_name,
                    package_id: record.clean_package_id,
                    app_date: app.app_date,
                    live_checking_date: app.live_checking_date,
                    total_reviews: reviews.length,
                    sheet_url: record.sheet_url,
                    excel_path: record.excel_path,
                    status: 'completed'
                };

                results.push(appResult);
                currentJob.results.push(appResult);

                logJob(`[App ${i + 1}/${apps.length}] Completed Task #${app.task_id} with ${reviews.length} reviews.`);
            }

            // 4. Send Summary Email to Admin Recipients
            logJob(`Preparing daily summary notification email...`);
            try {
                await sendSummaryEmail(supabaseSystem, activeDate, results);
                logJob(`Summary notification email successfully dispatched to admin recipients!`);
            } catch (mailErr) {
                logJob(`Email dispatch error: ${mailErr.message}`);
            }

            currentJob.status = 'completed';
            currentJob.endTime = Date.now();
            currentJob.currentApp = null;
            logJob(`🎉 All ${apps.length} applications processed successfully! Live review cycle complete.`);

            // Record into history
            writeHistory({
                date: activeDate,
                totalApps: apps.length,
                totalReviews: results.reduce((acc, c) => acc + (c.total_reviews || 0), 0),
                startTime: currentJob.startTime,
                endTime: currentJob.endTime,
                durationSeconds: Math.round((currentJob.endTime - currentJob.startTime) / 1000),
                results
            });

        } catch (globalErr) {
            logJob(`FATAL ERROR during extraction: ${globalErr.message}`);
            currentJob.status = 'error';
            currentJob.error = globalErr.message;
            currentJob.endTime = Date.now();
        }
    })();

    return {
        status: 'started',
        message: 'Extraction started in background',
        date: activeDate,
        currentJob
    };
}

/**
 * Send summary email with all Google Sheet links to Admin recipients
 */
async function sendSummaryEmail(supabaseSystem, dateStr, results) {
    const { data: smtpData } = await supabaseSystem
        .from('smtp_settings')
        .select('*')
        .eq('is_default', true)
        .maybeSingle();

    if (!smtpData) {
        logJob('[SummaryEmail] No default SMTP found. Skipping email delivery.');
        return;
    }

    const { data: receivers } = await supabaseSystem
        .from('live_list_settings')
        .select('receiver_email');

    if (!receivers || receivers.length === 0) {
        logJob('[SummaryEmail] No recipients in live_list_settings. Skipping email.');
        return;
    }

    const toAddresses = receivers.map(r => r.receiver_email).join(',');

    const transporter = nodemailer.createTransport({
        host: smtpData.host,
        port: smtpData.port,
        secure: smtpData.port === 465 || smtpData.encryption === 'SSL',
        auth: {
            user: smtpData.username,
            pass: smtpData.password
        }
    });

    const tableRowsHtml = results.map((r, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'};">
            <td style="padding: 10px; font-weight: bold; color: #1e293b;">#${r.task_id}</td>
            <td style="padding: 10px; color: #334155;">${r.app_name}</td>
            <td style="padding: 10px; text-align: center; font-weight: bold; color: #0284c7;">${r.total_reviews}</td>
            <td style="padding: 10px; text-align: center;">
                ${r.sheet_url ? `<a href="${r.sheet_url}" target="_blank" style="display: inline-block; padding: 6px 12px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">Open Google Sheet ↗</a>` : '<span style="color: #94a3b8;">N/A</span>'}
            </td>
        </tr>
    `).join('');

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 24px; color: #ffffff; text-align: center;">
                <h2 style="margin: 0; font-size: 22px;">📊 Play Store Live Reviews Automation Complete</h2>
                <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Date: ${dateStr} (Asia/Kolkata Timezone)</p>
            </div>
            <div style="padding: 24px;">
                <p style="color: #334155; font-size: 15px; margin-top: 0;">
                    Hello Admin,<br/>
                    The automated 1-to-1 Play Store review extraction for today's live apps has been successfully executed.
                </p>
                <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
                    <strong>Total Apps Processed:</strong> ${results.length} Apps<br/>
                    <strong>Total Reviews Extracted:</strong> ${results.reduce((acc, c) => acc + (c.total_reviews || 0), 0)} Reviews
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;">
                    <thead>
                        <tr style="background: #0f172a; color: #ffffff;">
                            <th style="padding: 10px;">Task ID</th>
                            <th style="padding: 10px;">App Name</th>
                            <th style="padding: 10px; text-align: center;">Reviews</th>
                            <th style="padding: 10px; text-align: center;">Google Sheet</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
                <p style="margin-top: 24px; font-size: 13px; color: #64748b;">
                    These Google Sheets are public and are automatically linked in the <strong>Automatic Live List</strong> page for instant user matching.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
                    Novaira V2 Admin Automation Gateway &bull; Asia/Kolkata (IST)
                </p>
            </div>
        </div>
    `;

    const info = await transporter.sendMail({
        from: `"${smtpData.sender_name}" <${smtpData.sender_email}>`,
        to: toAddresses,
        subject: `[Live Reviews Sheet] Daily Summary - ${dateStr} (${results.length} Apps Completed)`,
        html: htmlContent
    });

    logJob(`Notification email successfully dispatched to: ${toAddresses}`);
    return info;
}

/**
 * Get current live job status & logs
 */
function getCurrentJobStatus() {
    const elapsed = currentJob.startTime 
        ? Math.round(((currentJob.endTime || Date.now()) - currentJob.startTime) / 1000) 
        : 0;

    return {
        ...currentJob,
        elapsedSeconds: elapsed,
        history: readHistory().slice(0, 5)
    };
}

/**
 * Get cached extracted reviews for a single task ID or app ID
 */
function getCachedReviews(taskIdOrAppId) {
    const cache = readCache();
    return cache[String(taskIdOrAppId)] || null;
}

module.exports = {
    getISTDateString,
    extractPackageId,
    scrapePlayStoreReviewsInline,
    saveStructuredExcelInline,
    processAllLiveAppsSequentially,
    getCurrentJobStatus,
    readHistory,
    getCachedReviews,
    syncToGoogleSheet
};
