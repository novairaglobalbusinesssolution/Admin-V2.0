const nodemailer = require('nodemailer');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const DASHBOARD_PASSWORD = process.env.NOVAIRA_DASHBOARD_PASSWORD || 'Novaira002@#';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.urlencoded({ extended: true }));

// Basic Health Check Route
app.get('/api/health', (req, res) => {
    res.json({ status: 'success', message: 'Novaira Admin API is running' });
});

app.get('/', (req, res) => {
    res.json({
        status: 'success',
        message: 'Novaira Admin backend is online',
        timestamp: new Date().toISOString(),
        routes: ['/api/health', '/test']
    });
});

app.get('/test', (req, res) => {
    res.json({
        status: 'success',
        message: 'Backend test route is active',
        timestamp: new Date().toISOString(),
        service: 'novaira-admin-backend'
    });
});

function renderAdminLoginPage(message = '') {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Novaira Backend Dashboard Login</title>
            <style>
                body { font-family: Arial, sans-serif; background: #0b1220; color: #e5e7eb; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                .card { width: min(92vw, 420px); background: #111827; border: 1px solid #273449; border-radius: 16px; padding: 28px; box-shadow: 0 20px 40px rgba(0,0,0,.35); }
                h1 { margin-top: 0; font-size: 28px; }
                label { display: block; margin: 12px 0 8px; font-weight: bold; }
                input { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid #334155; border-radius: 10px; background: #0f172a; color: white; font-size: 16px; }
                button { margin-top: 20px; width: 100%; padding: 12px; border: none; border-radius: 10px; background: linear-gradient(135deg, #22c55e, #14b8a6); color: white; font-weight: bold; cursor: pointer; }
                .error { color: #fca5a5; margin-top: 12px; min-height: 20px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Novaira Admin</h1>
                <form method="POST" action="/admin/login">
                    <label for="password">Dashboard Password</label>
                    <input id="password" name="password" type="password" required placeholder="Enter password" />
                    <button type="submit">Open Dashboard</button>
                </form>
                <div class="error">${message}</div>
            </div>
        </body>
        </html>
    `;
}

function renderAdminDashboard(status) {
    const securityChecks = [
        ['Dashboard protection', status.security.dashboardProtected ? 'Enabled' : 'Disabled'],
        ['HTTPS / secure transport', status.security.httpsProtected ? 'Enabled' : 'Warning'],
        ['CORS enabled', status.security.corsEnabled ? 'Enabled' : 'Disabled'],
        ['Supabase connectivity', status.services.supabase ? 'Healthy' : 'Not configured'],
        ['Firebase admin', status.services.firebase ? 'Healthy' : 'Disabled'],
        ['Environment variables', status.security.envConfigured ? 'Loaded' : 'Missing'],
        ['Admin cookie auth', status.security.cookieAuth ? 'Enabled' : 'Disabled']
    ];

    const rows = securityChecks.map(([label, value]) => `
        <tr>
            <td>${label}</td>
            <td>${value}</td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Novaira Backend Dashboard</title>
            <style>
                body { font-family: Arial, sans-serif; background: #0b1220; color: #e5e7eb; margin: 0; padding: 24px; }
                .wrap { max-width: 1100px; margin: 0 auto; }
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
                .badge { background: #14532d; color: #bbf7d0; padding: 8px 12px; border-radius: 999px; font-size: 12px; font-weight: bold; }
                .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
                .card { background: #111827; border: 1px solid #273449; border-radius: 14px; padding: 18px; }
                .card h3 { margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: .08em; color: #93c5fd; }
                .value { font-size: 24px; font-weight: bold; }
                table { width: 100%; border-collapse: collapse; background: #111827; border: 1px solid #273449; border-radius: 12px; overflow: hidden; }
                th, td { border-bottom: 1px solid #1f2937; padding: 12px 14px; text-align: left; }
                th { background: #0f172a; }
                .logout { color: #fca5a5; text-decoration: none; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="wrap">
                <div class="header">
                    <div>
                        <h1 style="margin:0;">Novaira Backend Dashboard</h1>
                        <div style="margin-top:8px; color:#94a3b8;">${status.timestamp}</div>
                    </div>
                    <span class="badge">${status.status.toUpperCase()}</span>
                </div>

                <div class="grid">
                    <div class="card">
                        <h3>Service</h3>
                        <div class="value">${status.service}</div>
                    </div>
                    <div class="card">
                        <h3>Uptime</h3>
                        <div class="value">${status.uptime}</div>
                    </div>
                    <div class="card">
                        <h3>Node</h3>
                        <div class="value">${status.runtime.node}</div>
                    </div>
                    <div class="card">
                        <h3>Memory</h3>
                        <div class="value">${status.runtime.memory}</div>
                    </div>
                </div>

                <div class="card" style="margin-bottom: 24px;">
                    <h3>Security & Health Checks</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Check</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <a class="logout" href="/admin/logout">Logout</a>
                    <a class="logout" href="/admin/health">Open JSON Health</a>
                </div>
            </div>
        </body>
        </html>
    `;
}

function getBackendHealth() {
    const memoryUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    const firebaseReady = ensureFirebaseReady();

    return {
        status: 'ok',
        service: 'novaira-admin-backend',
        timestamp: new Date().toISOString(),
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        runtime: {
            node: process.version,
            platform: process.platform,
            memory: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB used`,
            rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`
        },
        services: {
            supabase: Boolean(supabaseUrl && supabaseKey),
            firebase: firebaseReady,
            smtp: true
        },
        security: {
            dashboardProtected: true,
            httpsProtected: process.env.NODE_ENV === 'production' || Boolean(process.env.HTTPS_ENABLED),
            corsEnabled: true,
            envConfigured: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.PORT),
            cookieAuth: true
        }
    };
}

function dashboardAuth(req, res, next) {
    const cookies = Object.fromEntries((req.headers.cookie || '')
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .map(cookie => {
            const [key, ...value] = cookie.split('=');
            return [key, decodeURIComponent(value.join('='))];
        }));

    const hasCookie = cookies.novaira_admin_session === 'authenticated';
    const validQueryPassword = req.query.password === DASHBOARD_PASSWORD;

    if (hasCookie || validQueryPassword) {
        if (validQueryPassword) {
            res.cookie('novaira_admin_session', 'authenticated', { httpOnly: true, sameSite: 'lax' });
        }
        return next();
    }

    res.status(401).send(renderAdminLoginPage('Password required.'));
}

app.get('/admin', (req, res) => {
    if (req.query.password === DASHBOARD_PASSWORD) {
        res.cookie('novaira_admin_session', 'authenticated', { httpOnly: true, sameSite: 'lax' });
        return res.redirect('/admin/dashboard');
    }
    res.send(renderAdminLoginPage(''));
});

app.post('/admin/login', (req, res) => {
    const submittedPassword = req.body && req.body.password;
    if (submittedPassword === DASHBOARD_PASSWORD) {
        res.cookie('novaira_admin_session', 'authenticated', { httpOnly: true, sameSite: 'lax' });
        return res.redirect('/admin/dashboard');
    }
    res.status(401).send(renderAdminLoginPage('Invalid password.'));
});

app.get('/admin/logout', (req, res) => {
    res.clearCookie('novaira_admin_session');
    res.redirect('/admin');
});

app.get('/admin/dashboard', dashboardAuth, (req, res) => {
    res.send(renderAdminDashboard(getBackendHealth()));
});

app.get('/admin/health', dashboardAuth, (req, res) => {
    res.json(getBackendHealth());
});

app.get('/api/backend-status', (req, res) => {
    res.json(getBackendHealth());
});

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function ensureFirebaseReady() {
    if (getApps().length > 0) {
        return true;
    }

    try {
        const serviceAccount = require('./serviceAccountKey.json');
        initializeApp({
            credential: cert(serviceAccount)
        });
        console.log('Firebase Admin Initialized Successfully');
        return true;
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('serviceAccountKey')) {
            console.warn('Firebase Admin: serviceAccountKey.json not found. FCM features will remain disabled.');
        } else {
            console.error('Firebase Admin Initialization Error:', error.message);
        }
        return false;
    }
}

function getFirebaseMessaging() {
    if (!ensureFirebaseReady()) {
        throw new Error('Firebase Admin is not configured on this server. Add serviceAccountKey.json to enable push notifications.');
    }
    return getMessaging();
}

// Push Notification Route

// Bulk Push Notification Route
app.post('/api/send-bulk-notification', async (req, res) => {
    const { title, body, type } = req.body;
    
    if (!title || !body) {
        return res.status(400).json({ error: 'Missing title or body' });
    }

    if (!ensureFirebaseReady()) {
        return res.status(503).json({ error: 'Firebase Admin is not configured on this server. Add serviceAccountKey.json to enable push notifications.' });
    }
    
    try {
        // Fetch ALL earner profiles
        const { data: profiles, error: profileErr } = await supabase
            .from('profiles')
            .select('earner_id, fcm_token');
            
        if (profileErr || !profiles || profiles.length === 0) {
            return res.status(404).json({ error: 'No users found.' });
        }
        
        let successCount = 0;
        let dbInsertions = [];

        // We use Multicast for FCM to be efficient (up to 500 tokens at once)
        const validTokens = profiles.filter(p => p.fcm_token).map(p => p.fcm_token);
        
        // Chunk tokens into groups of 500
        const chunkSize = 500;
        for (let i = 0; i < validTokens.length; i += chunkSize) {
            const chunk = validTokens.slice(i, i + chunkSize);
            const message = {
                notification: { title, body },
                tokens: chunk
            };
            try {
                await getFirebaseMessaging().sendEachForMulticast(message);
            } catch(e) { console.error("FCM Multicast error:", e); }
        }

        // Prepare bulk insert into user_notifications
        profiles.forEach(p => {
            if(p.earner_id) {
                dbInsertions.push({
                    earner_id: p.earner_id,
                    title: title,
                    description: body,
                    type: type || 'task',
                    is_read: false
                });
            }
        });

        // Insert in chunks of 1000 to avoid Supabase limits
        for (let i = 0; i < dbInsertions.length; i += 1000) {
            const chunk = dbInsertions.slice(i, i + 1000);
            await supabase.from('user_notifications').insert(chunk);
        }
        
        res.json({ status: 'success', message: `Notification sent to ${profiles.length} users!` });
    } catch (error) {
        console.error("Error sending bulk notification:", error);
        res.status(500).json({ error: error.message || (error.error && error.error.message) });
    }
});

app.post('/api/send-notification', async (req, res) => {
    const { earner_id, title, body, type } = req.body;
    
    if (!earner_id || !title || !body) {
        return res.status(400).json({ error: 'Missing earner_id, title, or body' });
    }

    if (!ensureFirebaseReady()) {
        return res.status(503).json({ error: 'Firebase Admin is not configured on this server. Add serviceAccountKey.json to enable push notifications.' });
    }
    
    try {
        // Fetch user's FCM token from profiles table
        const { data: profileData, error: profileErr } = await supabase
            .from('profiles')
            .select('fcm_token')
            .eq('earner_id', earner_id)
            .single();
            
        if (profileErr || !profileData || !profileData.fcm_token) {
            return res.status(404).json({ error: 'FCM Token not found for this earner. Make sure they opened the app.' });
        }
        
        const message = {
            notification: {
                title: title,
                body: body
            },
            token: profileData.fcm_token
        };
        
        // Send via Firebase Admin
        const response = await getFirebaseMessaging().send(message);
        
        // Also save to user_notifications table so it shows in the app Inbox
        await supabase.from('user_notifications').insert([{
            earner_id: earner_id,
            title: title,
            description: body,
            type: type || 'system',
            is_read: false
        }]);
        
        res.json({ status: 'success', message: 'Notification sent successfully!', fcm_response: response });
    } catch (error) {
        console.error("Error sending notification:", error);
        res.status(500).json({ error: error.message || (error.error && error.error.message) });
    }
});


const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;

app.post('/api/truecaller-login', async (req, res) => {
    try {
        if (!supabaseServiceKey) {
            return res.status(500).json({ success: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured in Vercel." });
        }
        let { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, error: "Phone number is required" });
        }
        
        if (!phone.startsWith('+')) {
            phone = '+91' + phone;
        }

        const { data: profiles, error: profileErr } = await supabaseAdmin
            .from('profiles')
            .select('email, status')
            .eq('phone', phone);

        if (profileErr) {
            return res.status(500).json({ success: false, error: profileErr.message });
        }

        if (!profiles || profiles.length === 0) {
            return res.status(404).json({ success: false, error: "User not registered, please register first." });
        }

        const userProfile = profiles[0];
        if (userProfile.status !== 'Active') {
            return res.status(403).json({ success: false, error: "Account is suspended or inactive." });
        }
        
        if (!userProfile.email) {
             return res.status(400).json({ success: false, error: "No email associated with this account. Cannot auto-login." });
        }

        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: userProfile.email
        });

        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }

        const actionLink = data.properties?.action_link;
        if (!actionLink) {
             return res.status(500).json({ success: false, error: "Failed to generate action link" });
        }

        return res.json({ 
            success: true, 
            action_link: actionLink 
        });
    } catch (err) {
        console.error("Truecaller Login Error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

// Start Server

// Test SMTP Configuration
app.post('/api/test-smtp', async (req, res) => {
    const { host, port, username, password, encryption, sender_email, sender_name, test_email } = req.body;
    
    if (!test_email) {
        return res.status(400).json({ error: 'Test email address is required' });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: host,
            port: port,
            secure: port == 465 || encryption === 'SSL',
            auth: {
                user: username,
                pass: password,
            },
        });

        await transporter.verify();

        await transporter.sendMail({
            from: '"' + sender_name + '" <' + sender_email + '>',
            to: test_email,
            subject: 'Novaira SMTP Test Successful',
            text: 'Your SMTP configuration is working perfectly!',
            html: '<h3>Success!</h3><p>Your SMTP configuration is working perfectly for Novaira!</p>'
        });

        res.json({ status: 'success', message: 'Test email sent successfully!' });
    } catch (error) {
        console.error("Test SMTP Error:", error);
        res.status(500).json({ error: error.message || (error.error && error.error.message) });
    }
});


// ----------------------------------------------------
// CLOUDINARY FILE MANAGER API
// ----------------------------------------------------
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dwflw21ib',
  api_key: '236244777636517',
  api_secret: 'OKMxHQk7eWBkBdxXpix-IoabN2I'
});

app.post('/api/cloudinary/list', async (req, res) => {
    try {
        const { folder = '' } = req.body;
        
        // Fetch sub-folders
        let folders = [];
        try {
            const folderRes = folder ? await cloudinary.api.sub_folders(folder) : await cloudinary.api.root_folders();
            folders = folderRes.folders || [];
        } catch(e) {
            // Ignore if folder doesn't exist or has no subfolders
            console.log("Folder error:", e.message);
        }

        // Fetch files
        let files = [];
        try {
            const searchPrefix = folder ? `${folder}/*` : '*';
            const result = await cloudinary.search
                .expression(`folder:"${folder}"`)
                .with_field('context')
                .with_field('tags')
                .max_results(500)
                .execute();
            files = result.resources || [];
        } catch (e) {
            console.log("Files error:", e.message);
        }

        res.json({ status: 'success', folders, files });
    } catch (error) {
        res.status(500).json({ error: error.message || (error.error && error.error.message) });
    }
});

app.post('/api/cloudinary/delete', async (req, res) => {
    try {
        const { public_ids } = req.body; // array
        if (!public_ids || !public_ids.length) return res.status(400).json({ error: 'No files provided' });
        
        const result = await cloudinary.api.delete_resources(public_ids);
        res.json({ status: 'success', result });
    } catch (error) {
        res.status(500).json({ error: error.message || (error.error && error.error.message) });
    }
});

app.post('/api/cloudinary/rename', async (req, res) => {
    try {
        const { from_id, to_id } = req.body;
        if (!from_id || !to_id) return res.status(400).json({ error: 'Missing parameters' });
        
        const result = await cloudinary.uploader.rename(from_id, to_id);
        res.json({ status: 'success', result });
    } catch (error) {
        res.status(500).json({ error: error.message || (error.error && error.error.message) });
    }
});



const deleteCloudinaryFolderRecursive = async (folderPath) => {
    // 1. Delete all types of files in this folder
    try { await cloudinary.api.delete_resources_by_prefix(`${folderPath}/`, { resource_type: 'image' }); } catch(e){}
    try { await cloudinary.api.delete_resources_by_prefix(`${folderPath}/`, { resource_type: 'video' }); } catch(e){}
    try { await cloudinary.api.delete_resources_by_prefix(`${folderPath}/`, { resource_type: 'raw' }); } catch(e){}

    // 2. Fetch and delete sub-folders
    let subfolders = [];
    try {
        const subRes = await cloudinary.api.sub_folders(folderPath);
        subfolders = subRes.folders || [];
    } catch(e) {}
    
    for (const sub of subfolders) {
        await deleteCloudinaryFolderRecursive(sub.path);
    }
    
    // 3. Delete the now-empty folder
    await cloudinary.api.delete_folder(folderPath);
};

app.post('/api/cloudinary/delete-folder', async (req, res) => {
    try {
        const { folder } = req.body;
        if (!folder) return res.status(400).json({ error: 'Folder path missing' });
        
        await deleteCloudinaryFolderRecursive(folder);
        res.json({ status: 'success' });
    } catch (error) {
        const msg = error.message || (error.error && error.error.message) || JSON.stringify(error);
        res.status(500).json({ error: msg });
    }
});

app.post('/api/cloudinary/rename-folder', async (req, res) => {
    try {
        const { from_path, to_path } = req.body;
        if (!from_path || !to_path) return res.status(400).json({ error: 'Paths missing' });
        
        const result = await cloudinary.api.rename_folder(from_path, to_path);
        res.json({ status: 'success', result });
    } catch (error) {
        res.status(500).json({ error: error.message || (error.error && error.error.message) });
    }
});

app.post('/api/cloudinary/download-folder', async (req, res) => {
    const archiver = require('archiver');
    const https = require('https');
    const http = require('http');

    try {
        const { folder } = req.body;
        if (!folder) return res.status(400).json({ error: 'Folder path missing' });

        // Recursively get ALL files under a folder
        const getAllFiles = async (prefix) => {
            let allFiles = [];

            // Get files in this folder (paginated)
            let nextCursor = undefined;
            do {
                let search = cloudinary.search
                    .expression(`folder:"${prefix}"`)
                    .with_field('secure_url')
                    .max_results(500);

                if (nextCursor) search = search.next_cursor(nextCursor);

                const result = await search.execute();
                allFiles = allFiles.concat(result.resources || []);
                nextCursor = result.next_cursor || undefined;
            } while (nextCursor);

            // Recurse into sub-folders
            try {
                const subRes = await cloudinary.api.sub_folders(prefix);
                for (const sub of (subRes.folders || [])) {
                    const subFiles = await getAllFiles(sub.path);
                    allFiles = allFiles.concat(subFiles);
                }
            } catch(e) {}

            return allFiles;
        };

        const allFiles = await getAllFiles(folder);
        console.log(`Found ${allFiles.length} files in folder: ${folder}`);

        if (allFiles.length === 0) {
            return res.status(404).json({ error: 'No files found in this folder' });
        }

        const folderName = folder.split('/').pop() || folder;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"`);

        const archive = archiver('zip', { zlib: { level: 5 } });
        archive.on('error', (err) => { console.error('Archive error:', err); });
        archive.pipe(res);

        for (const file of allFiles) {
            const relativePath = file.public_id.startsWith(folder + '/') 
                ? file.public_id.slice(folder.length + 1)
                : file.public_id.split('/').pop();
            const ext = file.format ? `.${file.format}` : '';
            const filename = relativePath.includes('.') ? relativePath : relativePath + ext;

            await new Promise((resolve, reject) => {
                const url = file.secure_url;
                const protocol = url.startsWith('https') ? https : http;
                const req2 = protocol.get(url, (fileStream) => {
                    if (fileStream.statusCode >= 400) {
                        console.warn(`Skipping file ${filename}: HTTP ${fileStream.statusCode}`);
                        fileStream.resume();
                        resolve();
                        return;
                    }
                    archive.append(fileStream, { name: filename });
                    fileStream.on('end', resolve);
                    fileStream.on('error', (e) => { console.warn('File stream error:', e); resolve(); });
                });
                req2.on('error', (e) => { console.warn('Request error:', e); resolve(); });
            });
        }

        await archive.finalize();

    } catch (error) {
        console.error('Download folder error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || 'Failed to create zip' });
        }
    }
});





// ----------------------------------------------------
// SEND LIVE CHECKING EMAIL API
// ----------------------------------------------------
app.post('/api/send-live-checking-email', async (req, res) => {
    try {
        const { smtp_id, receiver_email, app_data } = req.body;
        if (!smtp_id || !receiver_email) return res.status(400).json({ error: 'Missing SMTP config or Receiver Email' });

        // Fetch SMTP from Supabase
        const { data: smtpData, error: smtpErr } = await supabase
            .from('smtp_settings')
            .select('*')
            .eq('id', smtp_id)
            .single();
            
        if (smtpErr || !smtpData) throw new Error('SMTP Configuration not found in database');

        // Configure nodemailer
        const transporter = nodemailer.createTransport({
            host: smtpData.host,
            port: smtpData.port,
            secure: smtpData.port === 465 || smtpData.encryption === 'SSL', // true for 465
            auth: {
                user: smtpData.username,
                pass: smtpData.password,
            },
        });

        // Email Content
        const mailOptions = {
            from: `"${smtpData.sender_name}" <${smtpData.sender_email}>`,
            to: receiver_email,
            subject: `Live Checking Update: ${app_data.app_name}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #0b57d0;">App Live Checking Notification</h2>
                    <p>Hello,</p>
                    <p>This is an automated notification regarding the app <strong>${app_data.app_name}</strong>.</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px; max-width: 500px;">
                        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Task ID:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">#${app_data.task_id}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>App Name:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${app_data.app_name}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Package/Link:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${app_data.app_package}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>App Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${app_data.app_date}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Live Checking Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: #d93025; font-weight: bold;">${app_data.live_checking_date}</td></tr>
                    </table>
                    <p style="margin-top: 20px;">Please ensure everything is on track for the live checking phase today.</p>
                    <p>Best regards,<br/><strong>${smtpData.sender_name}</strong></p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        res.json({ status: 'success', info });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/send-bulk-live-checking', async (req, res) => {
    try {
        const { smtp_id, apps } = req.body;
        if (!smtp_id || !apps || apps.length === 0) return res.status(400).json({ error: 'Missing SMTP or apps data' });

        // Fetch SMTP Config
        const { data: smtpData, error: smtpErr } = await supabase.from('smtp_settings').select('*').eq('id', smtp_id).single();
        if (smtpErr || !smtpData) throw new Error('SMTP Config not found');

        // Fetch all receivers
        const { data: receivers, error: recErr } = await supabase.from('live_list_settings').select('receiver_email');
        if (recErr || !receivers || receivers.length === 0) throw new Error('No receiver emails found in settings');

        const receiverEmails = receivers.map(r => r.receiver_email).join(',');

        const transporter = nodemailer.createTransport({
            host: smtpData.host,
            port: smtpData.port,
            secure: smtpData.port === 465 || smtpData.encryption === 'SSL',
            auth: { user: smtpData.username, pass: smtpData.password },
        });

        let tableRows = apps.map(app => `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">#${app.task_id}</td>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>${app.app_name}</strong><br/><span style="font-size: 12px; color: #555;">${app.app_package}</span></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${app.sponsor_id}</td>
                <td style="padding: 8px; border: 1px solid #ddd; color: #d93025; font-weight: bold;">${app.live_checking_date}</td>
            </tr>
        `).join('');

        const mailOptions = {
            from: `"${smtpData.sender_name}" <${smtpData.sender_email}>`,
            to: receiverEmails,
            subject: `Live Checking Summary for Today (${apps[0].live_checking_date})`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #0b57d0;">Daily Live Checking Summary</h2>
                    <p>Hello,</p>
                    <p>Here is the list of <strong>${apps.length}</strong> apps scheduled for live checking today.</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                        <thead>
                            <tr style="background-color: #f8f9fa;">
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Task ID</th>
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">App Name & Link</th>
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Provider</th>
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Live Date</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <p style="margin-top: 20px;">Please ensure all apps are verified.</p>
                    <p>Best regards,<br/><strong>${smtpData.sender_name}</strong></p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        res.json({ status: 'success', info });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ----------------------------------------------------
// AUTOMATED CRON JOB (Checks every 1 minute)
// ----------------------------------------------------
let isEmailSentToday = false;

setInterval(async () => {
    try {
        // Get current IST time
        const d = new Date();
        const istTime = new Date(d.getTime() + (330 * 60000));
        const currentHours = String(istTime.getUTCHours()).padStart(2, '0');
        const currentMinutes = String(istTime.getUTCMinutes()).padStart(2, '0');
        const currentTime = `${currentHours}:${currentMinutes}`;
        
        // Reset flag at midnight IST
        if (currentTime === '00:00') {
            isEmailSentToday = false;
        }
        
        if (isEmailSentToday) return;

        // Fetch cron settings
        const { data: cronData } = await supabase.from('cron_settings').select('*').eq('id', 1).single();
        if (!cronData || !cronData.is_active || !cronData.schedule_time) return;
        
        // schedule_time format is usually 'HH:MM:SS'
        const scheduleTimePrefix = cronData.schedule_time.substring(0, 5);
        
        if (currentTime === scheduleTimePrefix) {
            isEmailSentToday = true; // Mark as sent for today
            console.log(`[CRON] Triggering automated bulk email for ${currentTime} IST`);
            
            // 1. Fetch apps for today
            const todayIST = istTime.toISOString().split('T')[0];
            const { data: apps } = await supabase.from('apps').select('*').eq('live_checking_date', todayIST);
            if (!apps || apps.length === 0) return console.log('[CRON] No apps for today, skipping email.');
            
            // 2. Fetch default SMTP
            const { data: smtpData } = await supabase.from('smtp_settings').select('*').eq('is_default', true).single();
            if (!smtpData) return console.log('[CRON] No default SMTP found, skipping.');
            
            // 3. Fetch receivers
            const { data: receivers } = await supabase.from('live_list_settings').select('receiver_email');
            if (!receivers || receivers.length === 0) return console.log('[CRON] No receiver emails found, skipping.');
            const receiverEmails = receivers.map(r => r.receiver_email).join(',');

            // 4. Send Email
            const transporter = nodemailer.createTransport({
                host: smtpData.host, port: smtpData.port,
                secure: smtpData.port === 465 || smtpData.encryption === 'SSL',
                auth: { user: smtpData.username, pass: smtpData.password },
            });

            let tableRows = apps.map(app => `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">#${app.task_id}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;"><strong>${app.app_name}</strong><br/><span style="font-size: 12px; color: #555;">${app.app_package}</span></td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${app.sponsor_id}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; color: #d93025; font-weight: bold;">${app.live_checking_date}</td>
                </tr>
            `).join('');

            const mailOptions = {
                from: `"${smtpData.sender_name}" <${smtpData.sender_email}>`,
                to: receiverEmails,
                subject: `[Automated] Live Checking Summary for Today (${todayIST})`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #0b57d0;">Daily Live Checking Summary</h2>
                        <p>Hello,</p>
                        <p>This is your automated daily summary. Here is the list of <strong>${apps.length}</strong> apps scheduled for live checking today.</p>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                            <thead>
                                <tr style="background-color: #f8f9fa;">
                                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Task ID</th>
                                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">App Name & Link</th>
                                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Provider</th>
                                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Live Date</th>
                                </tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                        <p style="margin-top: 20px;">Please ensure all apps are verified.</p>
                        <p>Best regards,<br/><strong>${smtpData.sender_name}</strong></p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log('[CRON] Automated email sent successfully!');
        }
    } catch(e) {
        console.error('[CRON] Error:', e.message);
    }
}, 60000); // Check every 60 seconds


// ----------------------------------------------------
// SEND CUSTOM PUSH NOTIFICATIONS
// ----------------------------------------------------
app.post('/api/send-custom-notification', async (req, res) => {
    const { target, user_ids, title, body, link, type } = req.body;
    
    if (!title || !body) {
        return res.status(400).json({ error: 'Missing title or body' });
    }

    if (!ensureFirebaseReady()) {
        return res.status(503).json({ error: 'Firebase Admin is not configured on this server. Add serviceAccountKey.json to enable push notifications.' });
    }
    
    try {
        let profilesData = [];
        
        if (target === 'selected' && user_ids && user_ids.length > 0) {
            const { data, error } = await supabase.from('profiles').select('earner_id, fcm_token').in('earner_id', user_ids);
            if (error) throw error;
            profilesData = data;
        } else {
            const { data, error } = await supabase.from('profiles').select('earner_id, fcm_token');
            if (error) throw error;
            profilesData = data;
        }
            
        if (!profilesData || profilesData.length === 0) {
            return res.status(404).json({ error: 'No users found to send notification.' });
        }
        
        let successCount = 0;
        let dbInsertions = [];

        const validTokens = profilesData.filter(p => p.fcm_token).map(p => p.fcm_token);
        
        const chunkSize = 500;
        for (let i = 0; i < validTokens.length; i += chunkSize) {
            const chunk = validTokens.slice(i, i + chunkSize);
            const message = {
                notification: { title, body },
                data: {
                    type: type || 'system',
                    link: link || '',
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                },
                tokens: chunk
            };
            
            try {
                const response = await getFirebaseMessaging().sendEachForMulticast(message);
                successCount += response.successCount;
            } catch (err) {
                console.error('Firebase send error:', err);
            }
        }
        
        // Batch insert to user_notifications for in-app history
        for (const p of profilesData) {
            dbInsertions.push({
                earner_id: p.earner_id,
                title: title,
                body: body,
                type: type || 'system',
                link: link || '',
                is_read: false
            });
        }
        
        if (dbInsertions.length > 0) {
            const batchSize = 1000;
            for(let i=0; i < dbInsertions.length; i += batchSize) {
               await supabase.from('user_notifications').insert(dbInsertions.slice(i, i + batchSize));
            }
        }
        
        res.json({ status: 'success', successCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/users', async (req, res) => {
    try {
        const { data, error } = await supabase.from('profiles').select('earner_id, first_name, last_name, email, phone').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ status: 'success', data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;


// Send OTP via Zoho SMTP (reads from smtp_settings table)
app.post('/api/send-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ error: 'Missing email or otp' });
    }

    try {
        // Fetch default SMTP settings from Supabase
        const { data: smtpData, error: smtpErr } = await supabase
            .from('smtp_settings')
            .select('*')
            .eq('is_default', true)
            .single();

        if (smtpErr || !smtpData) {
            console.error("SMTP Fetch Error:", smtpErr);
            return res.status(500).json({ error: 'SMTP settings not found in database' });
        }

        // Create Nodemailer transporter
        const transporter = nodemailer.createTransport({
            host: smtpData.host,
            port: smtpData.port,
            secure: smtpData.port === 465 || smtpData.encryption === 'SSL',
            auth: {
                user: smtpData.username,
                pass: smtpData.password,
            },
        });

        // Send Email
        const mailOptions = {
            from: `"${smtpData.sender_name}" <${smtpData.sender_email}>`,
            to: email,
            subject: 'Novaira Login/Registration OTP',
            text: `Your OTP for Novaira is: ${otp}. It is valid for 10 minutes. Please do not share this with anyone.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #4CAF50; text-align: center;">Novaira Verification</h2>
                    <p style="font-size: 16px; color: #333;">Hello,</p>
                    <p style="font-size: 16px; color: #333;">Your One-Time Password (OTP) for login/registration is:</p>
                    <div style="text-align: center; margin: 20px 0;">
                        <span style="font-size: 24px; font-weight: bold; background: #f4f4f4; padding: 10px 20px; border-radius: 8px; letter-spacing: 5px;">${otp}</span>
                    </div>
                    <p style="font-size: 14px; color: #666;">This OTP is valid for 10 minutes. Please do not share it with anyone.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'OTP sent successfully via Zoho' });
    } catch (error) {
        console.error("OTP Send Error:", error);
        res.status(500).json({ error: 'Failed to send email: ' + error.message });
    }
});



// Image Upload API for Scan Zone
app.post('/api/cloudinary/upload', async (req, res) => {
    try {
        const { image, folder } = req.body;
        if (!image) return res.status(400).json({ error: 'No image provided' });
        
        const uploadResponse = await cloudinary.uploader.upload(image, {
            folder: folder || 'SCAN_ZONE_UPLOADS',
            resource_type: 'image'
        });
        
        res.json({ url: uploadResponse.secure_url });
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});
