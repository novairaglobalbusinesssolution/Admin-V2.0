document.addEventListener('DOMContentLoaded', () => {
    // ─── DOM Elements ────────────────────────────────────────────────────────
    const extractForm = document.getElementById('extractForm');
    const packageIdInput = document.getElementById('packageId');
    const btnPreviewApp = document.getElementById('btnPreviewApp');
    const appPreviewCard = document.getElementById('appPreviewCard');
    const appIcon = document.getElementById('appIcon');
    const appTitle = document.getElementById('appTitle');
    const appDeveloper = document.getElementById('appDeveloper');
    const appScore = document.getElementById('appScore');
    const appInstalls = document.getElementById('appInstalls');
    const appGenre = document.getElementById('appGenre');

    const targetDateInput = document.getElementById('targetDate');
    const countrySelect = document.getElementById('country');

    const btnStart = document.getElementById('btnStart');
    const btnStop = document.getElementById('btnStop');
    const liveJobBadge = document.getElementById('liveJobBadge');

    const metricUnique = document.getElementById('metricUnique');
    const metricSpeed = document.getElementById('metricSpeed');
    const metricElapsed = document.getElementById('metricElapsed');
    const metricDuplicates = document.getElementById('metricDuplicates');

    const progressPercent = document.getElementById('progressPercent');
    const progressBarFill = document.getElementById('progressBarFill');
    const logConsole = document.getElementById('logConsole');
    const btnClearLogs = document.getElementById('btnClearLogs');

    const analyticsSection = document.getElementById('analyticsSection');
    const tableSection = document.getElementById('tableSection');
    const tableTotalCount = document.getElementById('tableTotalCount');
    const reviewsTableBody = document.getElementById('reviewsTableBody');
    const tableSearch = document.getElementById('tableSearch');
    const ratingFilter = document.getElementById('ratingFilter');
    const sentimentFilter = document.getElementById('sentimentFilter');
    const pageInfo = document.getElementById('pageInfo');
    const btnPrevPage = document.getElementById('btnPrevPage');
    const btnNextPage = document.getElementById('btnNextPage');
    const currentPageNum = document.getElementById('currentPageNum');

    // Theme Toggle Elements
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggleLabel = document.getElementById('themeToggleLabel');

    // ─── Global State ────────────────────────────────────────────────────────
    let activeJobId = null;
    let pollInterval = null;
    let currentPage = 1;
    let chartRatingsInst = null;
    let chartSentimentInst = null;
    let chartTimelineInst = null;
    let lastAnalyticsData = null;

    // ─── Theme Management (Default Light Theme, Supports Dark) ───────────────
    function initTheme() {
        const savedTheme = localStorage.getItem('playstore_theme') || 'light';
        applyTheme(savedTheme);
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            document.documentElement.setAttribute('data-theme', 'dark');
            if (themeToggleLabel) themeToggleLabel.textContent = 'Dark';
        } else {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            document.documentElement.setAttribute('data-theme', 'light');
            if (themeToggleLabel) themeToggleLabel.textContent = 'Light';
        }
        localStorage.setItem('playstore_theme', theme);

        // Re-render charts with updated grid & label colors if data is available
        if (lastAnalyticsData) {
            renderCharts(lastAnalyticsData);
        }
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-theme');
            applyTheme(isDark ? 'light' : 'dark');
        });
    }

    initTheme();

    // ─── Default Target Date Setup ───────────────────────────────────────────
    const today = new Date();
    targetDateInput.value = formatDate(today);

    function formatDate(d) {
        return d.toISOString().split('T')[0];
    }

    // ─── Quick Date Preset Buttons ───────────────────────────────────────────
    const dateChips = document.querySelectorAll('.btn-chip');
    dateChips.forEach(chip => {
        chip.addEventListener('click', () => {
            dateChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const offset = parseInt(chip.getAttribute('data-offset'));
            const d = new Date();
            d.setDate(d.getDate() - offset);
            targetDateInput.value = formatDate(d);
        });
    });

    // ─── Quick App Preset Pills (Spotify, WhatsApp, Flipkart, etc.) ──────────
    document.querySelectorAll('.btn-app-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const pkg = btn.getAttribute('data-pkg');
            if (pkg) {
                packageIdInput.value = pkg;
                fetchAppPreview();
            }
        });
    });

    // ─── Inspect / Preview App Details ───────────────────────────────────────
    btnPreviewApp.addEventListener('click', fetchAppPreview);
    packageIdInput.addEventListener('blur', () => {
        if (packageIdInput.value && packageIdInput.value.trim().length > 3) {
            fetchAppPreview();
        }
    });

    async function fetchAppPreview() {
        const pkg = packageIdInput.value.trim();
        if (!pkg) return;

        btnPreviewApp.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Loading...</span>`;
        try {
            const res = await fetch(`/api/app-info?package_id=${encodeURIComponent(pkg)}&country=${countrySelect.value}`);
            const data = await res.json();

            if (data.success) {
                appIcon.src = data.icon || '';
                appTitle.textContent = data.title;
                appDeveloper.textContent = data.developer;
                appScore.textContent = data.score;
                appInstalls.textContent = data.installs;
                appGenre.textContent = data.genre;
                appPreviewCard.classList.remove('hidden');
                appendLog(`Inspected app '${data.title}' successfully.`, 'system');
            } else {
                appendLog(`Warning: App inspection failed - ${data.error}`, 'system');
            }
        } catch (e) {
            console.error(e);
        } finally {
            btnPreviewApp.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> <span>Inspect</span>`;
        }
    }

    // ─── Start Extraction Form Submission ────────────────────────────────────
    extractForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pkg = packageIdInput.value.trim();
        const targetDate = targetDateInput.value;
        if (!pkg || !targetDate) return;

        btnStart.classList.add('hidden');
        btnStop.classList.remove('hidden');
        liveJobBadge.textContent = 'RUNNING';
        liveJobBadge.className = 'job-badge running';

        const payload = {
            package_id: pkg,
            start_date: targetDate,
            end_date: targetDate,
            country: countrySelect.value,
            max_reviews: 1000000
        };

        appendLog(`Initiating multi-threaded extraction job for '${pkg}' on date ${targetDate}...`, 'system');

        try {
            const res = await fetch('/api/extract/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                activeJobId = data.job_id;
                appendLog(`Job registered successfully. ID: ${activeJobId}`, 'system');
                startPollingStatus();
            } else {
                alert(`Failed to start job: ${data.error}`);
                resetJobUI('IDLE', 'idle');
            }
        } catch (err) {
            alert(`Network error starting job: ${err.message}`);
            resetJobUI('IDLE', 'idle');
        }
    });

    // ─── Stop Button Handler ─────────────────────────────────────────────────
    btnStop.addEventListener('click', async () => {
        if (!activeJobId) return;
        btnStop.disabled = true;
        appendLog("Sending stop signal to extraction engine...", 'system');
        await fetch(`/api/extract/stop/${activeJobId}`, { method: 'POST' });
    });

    // ─── Polling Status Loop ─────────────────────────────────────────────────
    let pollCounter = 0;
    function startPollingStatus() {
        if (pollInterval) clearInterval(pollInterval);
        pollCounter = 0;
        pollInterval = setInterval(pollJobStatus, 1000);
        setTimeout(loadJobResults, 1200);
    }

    async function pollJobStatus() {
        if (!activeJobId) return;
        pollCounter++;

        try {
            const res = await fetch(`/api/extract/status/${activeJobId}`);
            const data = await res.json();

            if (!data.success) return;

            // Update Metrics Cards
            metricUnique.textContent = (data.unique_reviews || 0).toLocaleString();
            metricSpeed.textContent = `${data.speed_per_sec || 0} /s`;
            metricElapsed.textContent = `${data.elapsed_seconds || 0}s`;
            metricDuplicates.textContent = (data.duplicates || 0).toLocaleString();

            // Update Liquid Progress Bar
            if (data.max_reviews >= 1000000) {
                progressPercent.textContent = `${(data.unique_reviews || 0).toLocaleString()} reviews`;
                progressBarFill.style.width = '100%';
            } else {
                const percent = Math.min(100, Math.round((data.unique_reviews / data.max_reviews) * 100));
                progressPercent.textContent = `${percent}%`;
                progressBarFill.style.width = `${percent}%`;
            }

            // Append Logs
            if (data.logs && data.logs.length > 0) {
                logConsole.innerHTML = '';
                data.logs.forEach(log => appendLog(log));
            }

            // Refresh table & analytics live every 3 seconds while running
            if (data.unique_reviews > 0 && pollCounter % 3 === 0) {
                loadJobResults();
            }

            // Check completion/stopping
            if (['completed', 'stopped', 'error'].includes(data.status)) {
                clearInterval(pollInterval);
                pollInterval = null;

                const statusTag = data.status.toUpperCase();
                const badgeClass = data.status === 'completed' ? 'completed' : 'stopped';
                resetJobUI(statusTag, badgeClass);

                appendLog(`Extraction process finished with status: ${statusTag}`, 'system');
                loadJobResults();

                // Auto-record reviews on connected device/emulator if enabled
                if (data.status === 'completed') {
                    const autoRecordToggle = document.getElementById('autoRecordToggle');
                    if (autoRecordToggle && autoRecordToggle.checked && (data.unique_reviews > 0)) {
                        appendLog('⚡ Auto-Record trigger: Reviews scraped! Auto-starting Android device recording...', 'system');
                        setTimeout(() => {
                            if (btnRecordAndroid) {
                                btnRecordAndroid.click();
                            }
                        }, 1200);
                    }
                }
            }
        } catch (e) {
            console.error("Status polling error:", e);
        }
    }

    function resetJobUI(statusText, badgeClass) {
        btnStart.classList.remove('hidden');
        btnStop.classList.add('hidden');
        btnStop.disabled = false;
        liveJobBadge.textContent = statusText;
        liveJobBadge.className = `job-badge ${badgeClass}`;
    }

    function appendLog(msg, type = 'normal') {
        const p = document.createElement('p');
        p.className = `log-entry ${type}`;

        // Format tags nicely
        if (msg.startsWith('[System]')) {
            p.innerHTML = `<span class="log-tag tag-system">[System]</span> ${escapeHtml(msg.replace('[System]', '').trim())}`;
        } else if (msg.startsWith('[Info]')) {
            p.innerHTML = `<span class="log-tag tag-info">[Info]</span> ${escapeHtml(msg.replace('[Info]', '').trim())}`;
        } else {
            p.textContent = msg;
        }

        logConsole.appendChild(p);
        logConsole.scrollTop = logConsole.scrollHeight;
    }

    btnClearLogs.addEventListener('click', () => {
        logConsole.innerHTML = '<p class="log-entry system"><span class="log-tag tag-system">[System]</span> Console logs cleared.</p>';
    });

    // ─── Load Job Results & Analytics ────────────────────────────────────────
    async function loadJobResults() {
        if (!activeJobId) return;

        const search = encodeURIComponent(tableSearch.value.trim());
        const rating = ratingFilter.value;
        const sentiment = sentimentFilter.value;

        const url = `/api/extract/results/${activeJobId}?page=${currentPage}&limit=50&search=${search}&rating=${rating}&sentiment=${sentiment}`;
        try {
            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                analyticsSection.classList.remove('hidden');
                tableSection.classList.remove('hidden');

                tableTotalCount.textContent = (data.total_unique || 0).toLocaleString();
                renderTable(data.reviews, data.page, data.limit, data.total_filtered, data.total_pages);
                
                if (data.analytics && Object.keys(data.analytics).length > 0) {
                    lastAnalyticsData = data.analytics;
                    renderCharts(data.analytics);
                }

                // Render Virtual Phone Feed
                if (data.reviews && data.reviews.length > 0) {
                    const pkgName = appTitle ? appTitle.textContent : 'Google Play Store';
                    const targetDateStr = targetDateInput ? targetDateInput.value : 'Target Date';
                    renderVirtualPhoneFeed(data.reviews, targetDateStr, pkgName);
                }
            }
        } catch (err) {
            console.error("Error loading job results:", err);
        }
    }

    // ─── Render Table ────────────────────────────────────────────────────────
    function renderTable(reviews, page, limit, totalFiltered, totalPages) {
        reviewsTableBody.innerHTML = '';

        if (!reviews || reviews.length === 0) {
            reviewsTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center empty-state">
                        <div class="empty-state-wrap">
                            <i class="fa-regular fa-folder-open empty-icon"></i>
                            <p>No matching reviews found for current filters.</p>
                        </div>
                    </td>
                </tr>`;
            pageInfo.textContent = 'Showing 0 of 0';
            btnPrevPage.disabled = true;
            btnNextPage.disabled = true;
            return;
        }

        reviews.forEach(r => {
            const tr = document.createElement('tr');
            const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
            
            tr.innerHTML = `
                <td>
                    <div style="font-weight:700; color:var(--text-main);">${escapeHtml(r.userName)}</div>
                </td>
                <td><span class="star-rating">${stars}</span></td>
                <td><span class="sentiment-badge ${r.sentiment}">${r.sentiment}</span></td>
                <td style="max-width:380px; line-height:1.45;">${escapeHtml(r.content)}</td>
                <td><span style="font-size:0.8rem; color:var(--text-muted); font-family:'JetBrains Mono',monospace;">${r.date}</span></td>
                <td><span style="font-weight:600;">👍 ${r.thumbsUpCount}</span></td>
                <td><span style="font-size:0.75rem; color:var(--text-muted); font-family:'JetBrains Mono',monospace;">${escapeHtml(r.reviewCreatedVersion || 'N/A')}</span></td>
                <td><span class="tag" style="font-size:0.7rem; font-weight:700;">${(r.language || 'IN').toUpperCase()}</span></td>
            `;
            reviewsTableBody.appendChild(tr);
        });

        const startItem = (page - 1) * limit + 1;
        const endItem = Math.min(page * limit, totalFiltered);
        pageInfo.textContent = `Showing ${startItem}-${endItem} of ${totalFiltered.toLocaleString()} reviews`;
        currentPageNum.textContent = page;

        btnPrevPage.disabled = (page <= 1);
        btnNextPage.disabled = (page >= totalPages);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // ─── Filter Listeners ────────────────────────────────────────────────────
    tableSearch.addEventListener('input', debounce(() => { currentPage = 1; loadJobResults(); }, 300));
    ratingFilter.addEventListener('change', () => { currentPage = 1; loadJobResults(); });
    sentimentFilter.addEventListener('change', () => { currentPage = 1; loadJobResults(); });

    btnPrevPage.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadJobResults();
        }
    });

    btnNextPage.addEventListener('click', () => {
        currentPage++;
        loadJobResults();
    });

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // ─── Render Analytics Charts with Chart.js (Adaptive Light/Dark Theme) ───
    function renderCharts(analytics) {
        const isDark = document.body.classList.contains('dark-theme');
        const textColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

        // 1. Star Ratings Doughnut Chart
        const rData = analytics.ratings || {};
        const ratingLabels = ['5 Stars', '4 Stars', '3 Stars', '2 Stars', '1 Star'];
        const ratingCounts = [rData['5'] || 0, rData['4'] || 0, rData['3'] || 0, rData['2'] || 0, rData['1'] || 0];

        if (chartRatingsInst) chartRatingsInst.destroy();
        const ctxRatings = document.getElementById('chartRatings').getContext('2d');
        chartRatingsInst = new Chart(ctxRatings, {
            type: 'doughnut',
            data: {
                labels: ratingLabels,
                datasets: [{
                    data: ratingCounts,
                    backgroundColor: ['#10b981', '#2563eb', '#f59e0b', '#f97316', '#ef4444'],
                    borderWidth: 2,
                    borderColor: isDark ? '#0f172a' : '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: textColor,
                            font: { family: 'Plus Jakarta Sans', weight: '600', size: 12 }
                        }
                    }
                }
            }
        });

        // 2. Sentiment Doughnut Chart
        const sData = analytics.sentiments || {};
        if (chartSentimentInst) chartSentimentInst.destroy();
        const ctxSent = document.getElementById('chartSentiment').getContext('2d');
        chartSentimentInst = new Chart(ctxSent, {
            type: 'pie',
            data: {
                labels: ['Positive', 'Neutral', 'Negative'],
                datasets: [{
                    data: [sData['Positive'] || 0, sData['Neutral'] || 0, sData['Negative'] || 0],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 2,
                    borderColor: isDark ? '#0f172a' : '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: textColor,
                            font: { family: 'Plus Jakarta Sans', weight: '600', size: 12 }
                        }
                    }
                }
            }
        });

        // 3. Timeline Velocity Line Chart
        const datesData = analytics.dates || {};
        const dateLabels = Object.keys(datesData);
        const dateCounts = Object.values(datesData);

        if (chartTimelineInst) chartTimelineInst.destroy();
        const ctxTimeline = document.getElementById('chartTimeline').getContext('2d');
        chartTimelineInst = new Chart(ctxTimeline, {
            type: 'line',
            data: {
                labels: dateLabels,
                datasets: [{
                    label: 'Reviews Per Day',
                    data: dateCounts,
                    borderColor: '#2563eb',
                    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.22)' : 'rgba(37, 99, 235, 0.12)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointBackgroundColor: '#2563eb',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 11 } },
                        grid: { color: gridColor }
                    },
                    y: {
                        ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 11 } },
                        grid: { color: gridColor }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: textColor,
                            font: { family: 'Plus Jakarta Sans', weight: '600', size: 12 }
                        }
                    }
                }
            }
        });
    }

    // ─── Export Dataset Downloads ────────────────────────────────────────────
    document.querySelectorAll('.btn-export').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!activeJobId) {
                alert("No active or completed extraction job to export.");
                return;
            }
            const fmt = btn.getAttribute('data-format');
            window.location.href = `/api/extract/export/${activeJobId}/${fmt}`;
        });
    });

    // ─── Virtual Phone Simulator & Screen Recorder ───────────────────────────
    const phoneSection = document.getElementById('phoneSection');
    const phoneReviewScreen = document.getElementById('phoneReviewScreen');
    const phoneReviewFeed = document.getElementById('phoneReviewFeed');
    const btnPhonePlay = document.getElementById('btnPhonePlay');
    const btnPhonePause = document.getElementById('btnPhonePause');
    const btnPhoneRecord = document.getElementById('btnPhoneRecord');
    const phoneSpeedSelect = document.getElementById('phoneSpeedSelect');
    const phoneTargetDateLabel = document.getElementById('phoneTargetDateLabel');
    const phoneAppHeaderTitle = document.getElementById('phoneAppHeaderTitle');
    const phoneClock = document.getElementById('phoneClock');
    const recordingStatusBadge = document.getElementById('recordingStatusBadge');
    const recordingTime = document.getElementById('recordingTime');

    let phoneScrollTimer = null;
    let isPhoneScrolling = false;
    let mediaRecorder = null;
    let recordedChunks = [];
    let recTimer = null;
    let recSeconds = 0;

    // Update Live Digital Clock on Phone Status Bar
    function updatePhoneClock() {
        if (!phoneClock) return;
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        phoneClock.textContent = `${hrs}:${mins}`;
    }
    updatePhoneClock();
    setInterval(updatePhoneClock, 30000);

    // Populate Virtual Phone Feed with live reviews
    function renderVirtualPhoneFeed(reviews, targetDate, appTitleText) {
        if (!phoneReviewFeed) return;
        phoneSection.classList.remove('hidden');
        if (phoneTargetDateLabel) phoneTargetDateLabel.textContent = targetDate || 'Target Date';
        if (phoneAppHeaderTitle) phoneAppHeaderTitle.textContent = appTitleText || 'Google Play Store';

        phoneReviewFeed.innerHTML = '';
        if (!reviews || reviews.length === 0) {
            phoneReviewFeed.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:30px;">No reviews available for virtual phone simulator.</div>';
            return;
        }

        reviews.forEach(r => {
            const card = document.createElement('div');
            card.className = 'phone-review-card';

            const userInit = (r.userName || 'A').trim().charAt(0).toUpperCase();
            const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);

            card.innerHTML = `
                <div class="phone-card-user">
                    <div class="phone-avatar">${userInit}</div>
                    <div class="phone-user-meta">
                        <span class="phone-user-name">${escapeHtml(r.userName)}</span>
                        <span class="phone-review-date">${r.at || r.date}</span>
                    </div>
                </div>
                <div class="phone-stars">${stars}</div>
                <div class="phone-review-body">${escapeHtml(r.content)}</div>
                <div class="phone-card-footer">
                    <span>👍 ${r.thumbsUpCount}</span>
                    <span>Ver: ${escapeHtml(r.reviewCreatedVersion || 'N/A')}</span>
                    <span>${(r.country || 'IN').toUpperCase()}</span>
                </div>
            `;
            phoneReviewFeed.appendChild(card);
        });

        startPhoneAutoScroll();
    }

    // Auto Scroll Controls
    if (btnPhonePlay) btnPhonePlay.addEventListener('click', startPhoneAutoScroll);
    if (btnPhonePause) btnPhonePause.addEventListener('click', stopPhoneAutoScroll);

    function startPhoneAutoScroll() {
        stopPhoneAutoScroll();
        isPhoneScrolling = true;
        if (btnPhonePlay) btnPhonePlay.classList.add('hidden');
        if (btnPhonePause) btnPhonePause.classList.remove('hidden');

        const speed = parseFloat(phoneSpeedSelect ? phoneSpeedSelect.value : 2) || 2;
        phoneScrollTimer = setInterval(() => {
            if (!phoneReviewScreen) return;
            phoneReviewScreen.scrollTop += (1.5 * speed);

            // Loop back to top smoothly if reached bottom
            if (phoneReviewScreen.scrollTop + phoneReviewScreen.clientHeight >= phoneReviewScreen.scrollHeight - 5) {
                setTimeout(() => {
                    if (phoneReviewScreen) phoneReviewScreen.scrollTop = 0;
                }, 1000);
            }
        }, 30);
    }

    function stopPhoneAutoScroll() {
        isPhoneScrolling = false;
        if (phoneScrollTimer) clearInterval(phoneScrollTimer);
        phoneScrollTimer = null;
        if (btnPhonePlay) btnPhonePlay.classList.remove('hidden');
        if (btnPhonePause) btnPhonePause.classList.add('hidden');
    }

    // Tab Screen Recording Feature
    if (btnPhoneRecord) {
        btnPhoneRecord.addEventListener('click', async () => {
            if (mediaRecorder && mediaRecorder.state === "recording") {
                stopScreenRecording();
            } else {
                startScreenRecording();
            }
        });
    }

    async function startScreenRecording() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: "screen", displaySurface: "browser" },
                audio: false
            });

            recordedChunks = [];
            const options = { mimeType: 'video/webm;codecs=vp9,opus' };
            try {
                mediaRecorder = new MediaRecorder(stream, options);
            } catch (e) {
                mediaRecorder = new MediaRecorder(stream);
            }

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                stopRecTimer();
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                const targetDate = targetDateInput ? targetDateInput.value : 'date';
                a.download = `virtual_phone_screen_record_${targetDate}.webm`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);

                btnPhoneRecord.innerHTML = `<i class="fa-solid fa-circle-dot"></i> Record Screen Video`;
                btnPhoneRecord.className = 'btn-phone-rec';
                recordingStatusBadge.classList.add('hidden');
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start(1000);
            startRecTimer();

            btnPhoneRecord.innerHTML = `<i class="fa-solid fa-square"></i> Stop Recording`;
            btnPhoneRecord.className = 'btn-danger';
            recordingStatusBadge.classList.remove('hidden');
            startPhoneAutoScroll();

        } catch (err) {
            console.error("Screen recording permission error:", err);
            alert("To record the virtual phone screen, please select the browser window tab when prompted.");
        }
    }

    function stopScreenRecording() {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
    }

    function startRecTimer() {
        recSeconds = 0;
        if (recordingTime) recordingTime.textContent = 'REC 00:00';
        recTimer = setInterval(() => {
            recSeconds++;
            const mins = String(Math.floor(recSeconds / 60)).padStart(2, '0');
            const secs = String(recSeconds % 60).padStart(2, '0');
            if (recordingTime) recordingTime.textContent = `REC ${mins}:${secs}`;
        }, 1000);
    }

    function stopRecTimer() {
        if (recTimer) clearInterval(recTimer);
        recTimer = null;
    }

    // ─── Android Live Device / Emulator Screen Recording ─────────────────────
    const btnRecordAndroid = document.getElementById('btnRecordAndroid');
    const recordingPanel = document.getElementById('recordingPanel');
    const recStatusBadge = document.getElementById('recStatusBadge');
    const recProgressBar = document.getElementById('recProgressBar');
    const recProgressPct = document.getElementById('recProgressPct');
    const recLogConsole = document.getElementById('recLogConsole');
    const recDownloadArea = document.getElementById('recDownloadArea');
    const recDownloadLink = document.getElementById('recDownloadLink');

    let recPollInterval = null;

    if (btnRecordAndroid) {
        btnRecordAndroid.addEventListener('click', async () => {
            if (!activeJobId) {
                alert('Please extract reviews first before starting an Android recording.');
                return;
            }

            recordingPanel.classList.remove('hidden');
            recordingPanel.scrollIntoView({ behavior: 'smooth' });

            btnRecordAndroid.disabled = true;
            btnRecordAndroid.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Starting Recorder...`;
            recStatusBadge.textContent = 'CONNECTING';
            recStatusBadge.className = 'job-badge running';
            recProgressBar.style.width = '5%';
            recProgressPct.textContent = '5%';

            appendRecLog('[System] Initiating Android Emulator screen recorder...', 'system');

            try {
                const res = await fetch('/api/record/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        job_id: activeJobId,
                        target_date: targetDateInput.value,
                        app_name: appTitle.textContent || packageIdInput.value
                    })
                });

                const data = await res.json();
                if (data.success && data.rec_id) {
                    appendRecLog(`Recorder job created: ${data.rec_id}`, 'system');
                    pollRecordingStatus(data.rec_id);
                } else {
                    alert(`Failed to start recorder: ${data.error || 'Unknown error'}`);
                    resetRecorderUI();
                }
            } catch (err) {
                alert(`Error starting Android recording: ${err.message}`);
                resetRecorderUI();
            }
        });
    }

    function pollRecordingStatus(recId) {
        if (recPollInterval) clearInterval(recPollInterval);

        recPollInterval = setInterval(async () => {
            try {
                const res = await fetch(`/api/record/status/${recId}`);
                const data = await res.json();

                if (!data.success) return;

                const progress = data.progress || 0;
                recProgressBar.style.width = `${progress}%`;
                recProgressPct.textContent = `${progress}%`;

                // Update steps
                if (progress >= 15) markStepDone('recStep1');
                if (progress >= 35) markStepDone('recStep2');
                if (progress >= 40) markStepDone('recStep3');
                if (progress >= 90) markStepDone('recStep4');

                // Update logs
                if (data.logs && data.logs.length) {
                    recLogConsole.innerHTML = data.logs.map(l => `<p class="log-entry">${escapeHtml(l)}</p>`).join('');
                    recLogConsole.scrollTop = recLogConsole.scrollHeight;
                }

                if (data.status === 'completed') {
                    clearInterval(recPollInterval);
                    markStepDone('recStep5');
                    recStatusBadge.textContent = 'COMPLETED';
                    recStatusBadge.className = 'job-badge completed';
                    recProgressBar.style.width = '100%';
                    recProgressPct.textContent = '100%';

                    recDownloadArea.classList.remove('hidden');
                    recDownloadLink.href = `/api/record/download/${recId}`;
                    btnRecordAndroid.disabled = false;
                    btnRecordAndroid.innerHTML = `<i class="fa-solid fa-mobile-screen"></i> Record on Android`;
                    appendRecLog('✅ Screen recording finished and ready for download!', 'system');
                } else if (data.status === 'error') {
                    clearInterval(recPollInterval);
                    recStatusBadge.textContent = 'ERROR';
                    recStatusBadge.className = 'job-badge idle';
                    alert(`Recording failed: ${data.error}`);
                    resetRecorderUI();
                }
            } catch (e) {
                console.error('Polling recorder status failed:', e);
            }
        }, 1500);
    }

    function markStepDone(stepId) {
        const step = document.getElementById(stepId);
        if (step && !step.classList.contains('done')) {
            step.classList.add('done');
            step.querySelector('.step-icon').innerHTML = '<i class="fa-solid fa-check" style="color:#10b981"></i>';
        }
    }

    function appendRecLog(msg, type = '') {
        const p = document.createElement('p');
        p.className = `log-entry ${type}`;
        p.textContent = msg;
        recLogConsole.appendChild(p);
        recLogConsole.scrollTop = recLogConsole.scrollHeight;
    }

    function resetRecorderUI() {
        if (btnRecordAndroid) {
            btnRecordAndroid.disabled = false;
            btnRecordAndroid.innerHTML = `<i class="fa-solid fa-mobile-screen"></i> Record on Android`;
        }
        recStatusBadge.textContent = 'IDLE';
        recStatusBadge.className = 'job-badge idle';
    }

    // ─── Device Detection & Launch Management ────────────────────────────────
    const deviceStatusText = document.getElementById('deviceStatusText');
    const deviceStatusIcon = document.getElementById('deviceStatusIcon');
    const btnLaunchPixel = document.getElementById('btnLaunchPixel');
    const btnRefreshDevices = document.getElementById('btnRefreshDevices');

    async function checkConnectedDevices() {
        if (!deviceStatusText) return;
        try {
            const res = await fetch('/api/devices');
            const data = await res.json();
            if (data.success) {
                const devs = data.connected_devices || [];
                if (devs.length > 0) {
                    const d = devs[0];
                    const icon = d.is_emulator ? '<i class="fa-solid fa-laptop"></i>' : '<i class="fa-solid fa-mobile-screen"></i>';
                    deviceStatusText.innerHTML = `<span style="color:#10b981;">${icon} Ready: ${escapeHtml(d.type)} - <b>${escapeHtml(d.model)}</b> (${escapeHtml(d.serial)})</span>`;
                    if (deviceStatusIcon) {
                        deviceStatusIcon.className = 'device-icon-wrap';
                        deviceStatusIcon.innerHTML = icon;
                    }
                } else {
                    deviceStatusText.innerHTML = `<span style="color:#f59e0b;"><i class="fa-solid fa-triangle-exclamation"></i> No device connected. Launch Pixel 10a or plug in USB phone.</span>`;
                    if (deviceStatusIcon) {
                        deviceStatusIcon.className = 'device-icon-wrap waiting';
                        deviceStatusIcon.innerHTML = '<i class="fa-solid fa-mobile-screen"></i>';
                    }
                }
            }
        } catch (e) {
            console.error("Device check failed:", e);
        }
    }

    if (btnRefreshDevices) {
        btnRefreshDevices.addEventListener('click', async () => {
            btnRefreshDevices.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking...`;
            await checkConnectedDevices();
            setTimeout(() => {
                btnRefreshDevices.innerHTML = `<i class="fa-solid fa-rotate"></i> Refresh Devices`;
            }, 600);
        });
    }

    if (btnLaunchPixel) {
        btnLaunchPixel.addEventListener('click', async () => {
            btnLaunchPixel.disabled = true;
            btnLaunchPixel.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Launching Pixel 10a...`;
            deviceStatusText.innerHTML = `<span style="color:#3b82f6;"><i class="fa-solid fa-spinner fa-spin"></i> Launching Google Pixel 10a Emulator (window will open, boot takes ~35s)...</span>`;
            
            try {
                const res = await fetch('/api/devices/launch-emulator', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({avd_name: 'Google_Pixel_10a'})
                });
                const data = await res.json();
                if (data.success) {
                    appendRecLog('[System] Google Pixel 10a Virtual Device is starting in background...', 'system');
                    let checks = 0;
                    const devPoll = setInterval(async () => {
                        checks++;
                        await checkConnectedDevices();
                        const text = deviceStatusText.textContent;
                        if (text.includes('Ready') || checks > 30) {
                            clearInterval(devPoll);
                            btnLaunchPixel.disabled = false;
                            btnLaunchPixel.innerHTML = `<i class="fa-brands fa-google"></i> Launch Google Pixel 10a`;
                        }
                    }, 3000);
                } else {
                    alert(`Failed to launch emulator: ${data.error}`);
                    btnLaunchPixel.disabled = false;
                    btnLaunchPixel.innerHTML = `<i class="fa-brands fa-google"></i> Launch Google Pixel 10a`;
                }
            } catch (err) {
                alert(`Error launching emulator: ${err.message}`);
                btnLaunchPixel.disabled = false;
                btnLaunchPixel.innerHTML = `<i class="fa-brands fa-google"></i> Launch Google Pixel 10a`;
            }
        });
    }

    // ─── Live Interactive Device Workflow & Screen Capture ───────────────────
    const liveAppPackage = document.getElementById('liveAppPackage');
    const btnLaunchAppOnDevice = document.getElementById('btnLaunchAppOnDevice');
    const btnStartLiveRec = document.getElementById('btnStartLiveRec');
    const btnStopLiveRec = document.getElementById('btnStopLiveRec');
    const btnLiveScreencap = document.getElementById('btnLiveScreencap');
    const liveRecStatusBox = document.getElementById('liveRecStatusBox');
    const liveRecTimerText = document.getElementById('liveRecTimerText');
    const liveCaptureResult = document.getElementById('liveCaptureResult');
    const captureResultTitle = document.getElementById('captureResultTitle');
    const captureResultDesc = document.getElementById('captureResultDesc');
    const captureResultLink = document.getElementById('captureResultLink');
    const capturePreviewContainer = document.getElementById('capturePreviewContainer');
    const capturePreviewImg = document.getElementById('capturePreviewImg');

    let liveRecInterval = null;
    let liveRecSeconds = 0;

    // Launch App on Device
    if (btnLaunchAppOnDevice) {
        btnLaunchAppOnDevice.addEventListener('click', async () => {
            const pkg = liveAppPackage ? liveAppPackage.value.trim() : '';
            if (!pkg) {
                alert('Please enter an app package ID (e.g. com.whatsapp, com.spotify.music)');
                return;
            }
            btnLaunchAppOnDevice.disabled = true;
            btnLaunchAppOnDevice.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Launching...`;
            try {
                const res = await fetch('/api/device/launch-app', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({package_id: pkg})
                });
                const data = await res.json();
                if (data.success) {
                    appendRecLog(`[Device] ${data.message}`, 'system');
                } else {
                    alert(`Failed to launch app: ${data.error}`);
                }
            } catch (err) {
                alert(`Error launching app: ${err.message}`);
            } finally {
                btnLaunchAppOnDevice.disabled = false;
                btnLaunchAppOnDevice.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i> Open App`;
            }
        });
    }

    // Start Live Screen Recording
    if (btnStartLiveRec) {
        btnStartLiveRec.addEventListener('click', async () => {
            btnStartLiveRec.disabled = true;
            btnStartLiveRec.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Connecting...`;
            const pkg = liveAppPackage ? liveAppPackage.value.trim() : '';

            try {
                const res = await fetch('/api/device/live-record/start', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({package_id: pkg})
                });
                const data = await res.json();
                if (data.success) {
                    btnStartLiveRec.classList.add('hidden');
                    btnStopLiveRec.classList.remove('hidden');
                    liveRecStatusBox.classList.remove('hidden');
                    liveCaptureResult.classList.add('hidden');

                    // Start timer
                    liveRecSeconds = 0;
                    liveRecTimerText.textContent = 'RECORDING LIVE: 00:00';
                    liveRecInterval = setInterval(() => {
                        liveRecSeconds++;
                        const m = String(Math.floor(liveRecSeconds / 60)).padStart(2, '0');
                        const s = String(liveRecSeconds % 60).padStart(2, '0');
                        liveRecTimerText.textContent = `RECORDING LIVE: ${m}:${s}`;
                    }, 1000);

                    appendRecLog(`[Device] ${data.message} Recording user interactions live...`, 'system');
                } else {
                    alert(`Could not start live recording: ${data.error}`);
                }
            } catch (e) {
                alert(`Network error starting live recording: ${e.message}`);
            } finally {
                btnStartLiveRec.disabled = false;
                btnStartLiveRec.innerHTML = `<i class="fa-solid fa-circle-dot"></i> Start Live Screen Recording`;
            }
        });
    }

    // Stop Live Screen Recording
    if (btnStopLiveRec) {
        btnStopLiveRec.addEventListener('click', async () => {
            btnStopLiveRec.disabled = true;
            btnStopLiveRec.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Finalizing Video...`;
            if (liveRecInterval) clearInterval(liveRecInterval);

            try {
                const res = await fetch('/api/device/live-record/stop', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    liveRecStatusBox.classList.add('hidden');
                    btnStopLiveRec.classList.add('hidden');
                    btnStartLiveRec.classList.remove('hidden');

                    captureResultTitle.textContent = 'Live Interaction Video Saved!';
                    captureResultDesc.textContent = `Recorded: ${data.filename} (${liveRecSeconds}s duration)`;
                    captureResultLink.href = data.download_url;
                    captureResultLink.download = data.filename;
                    capturePreviewContainer.classList.add('hidden');
                    liveCaptureResult.classList.remove('hidden');

                    appendRecLog(`[Device] ✅ Live screen recording saved: ${data.filename}`, 'system');
                } else {
                    alert(`Failed to save video: ${data.error}`);
                }
            } catch (err) {
                alert(`Error stopping recording: ${err.message}`);
            } finally {
                btnStopLiveRec.disabled = false;
                btnStopLiveRec.innerHTML = `<i class="fa-solid fa-stop"></i> Stop & Save Video`;
            }
        });
    }

    // Instant Screenshot Capture
    if (btnLiveScreencap) {
        btnLiveScreencap.addEventListener('click', async () => {
            btnLiveScreencap.disabled = true;
            btnLiveScreencap.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Capturing...`;
            try {
                const res = await fetch('/api/device/screencap', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    captureResultTitle.textContent = 'Device Screenshot Captured!';
                    captureResultDesc.textContent = `Screenshot from ${data.device.model} saved (${data.filename})`;
                    captureResultLink.href = data.url;
                    captureResultLink.download = data.filename;
                    capturePreviewImg.src = data.url + '?t=' + Date.now();
                    capturePreviewContainer.classList.remove('hidden');
                    liveCaptureResult.classList.remove('hidden');
                    appendRecLog(`[Device] 📸 Screenshot captured: ${data.filename}`, 'system');
                } else {
                    alert(`Screenshot failed: ${data.error}`);
                }
            } catch (e) {
                alert(`Screenshot error: ${e.message}`);
            } finally {
                btnLiveScreencap.disabled = false;
                btnLiveScreencap.innerHTML = `<i class="fa-solid fa-camera"></i> Screenshot`;
            }
        });
    }

    // Initial device check
    checkConnectedDevices();
});
