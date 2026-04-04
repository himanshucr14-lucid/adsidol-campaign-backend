// ═══════════════════════════════════════════════
        // CONFIG — Current Vercel Backend URL
        // ═══════════════════════════════════════════════
        const BACKEND_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3000'
            : 'https://adsidol-campaignemail.vercel.app';

        // Founders registry (for login UI display)
        const FOUNDERS = [
            { id: 'paramjit', name: 'Paramjit', email: 'Paramjit@adsidol.com' },
            { id: 'moni', name: 'Moni', email: 'moni@adsidol.com' },
            { id: 'ujjwal', name: 'Ujjwal', email: 'Ujjwal@adsidol.com' },
            { id: 'hemleta', name: 'Hemleta', email: 'Hemleta@adsidol.com' },
        ];
 
        // ═══════════════════════════════════════════════
        // UNIFIED CALENDAR SYSTEM
        // ═══════════════════════════════════════════════
        class AdsidolCalendar {
            constructor(opts) {
                this.popupId = opts.popupId;
                this.gridId = opts.gridId;
                this.titleId = opts.titleId;
                this.labelId = opts.labelId;
                this.triggerId = opts.triggerId;
                this.onSelect = opts.onSelect;
                this.getCounts = opts.getCounts || (() => ({}));
                
                this.viewDate = new Date();
                this.startDate = null; // YYYY-MM-DD
                this.endDate = null;   // YYYY-MM-DD
                
                this.initOutsideClick();
            }

            get popup() { return document.getElementById(this.popupId); }
            get grid() { return document.getElementById(this.gridId); }
            get title() { return document.getElementById(this.titleId); }
            get label() { return document.getElementById(this.labelId); }
            get trigger() { return document.getElementById(this.triggerId); }

            initOutsideClick() {
                document.addEventListener('mousedown', (e) => {
                    const p = this.popup;
                    if (p && p.style.display === 'block') {
                        const container = p.closest('.adsidol-cal-container');
                        if (container && !container.contains(e.target)) this.close();
                    }
                });
            }

            toggle() {
                const p = this.popup;
                if (!p) return;
                const isVisible = p.style.display === 'block';
                if (isVisible) this.close(); else this.open();
            }

            open() {
                const p = this.popup;
                if (!p) return;
                p.style.display = 'block';
                this.trigger?.classList.add('active');
                this.render();
            }

            close() {
                const p = this.popup;
                if (!p) return;
                p.style.display = 'none';
                this.trigger?.classList.remove('active');
            }

            changeMonth(delta) {
                this.viewDate.setMonth(this.viewDate.getMonth() + delta);
                this.render();
            }

            setRange(start, end) {
                this.startDate = start;
                this.endDate = end;
                this.updateLabel();
                this.render();
                if (this.onSelect) this.onSelect();
            }

            setToToday() {
                const today = new Date().toISOString().split('T')[0];
                this.viewDate = new Date();
                this.setRange(today, null);
                this.close();
            }

            updateLabel() {
                if (!this.label) return;
                if (!this.startDate) {
                    this.label.textContent = 'Select Range';
                    return;
                }
                const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (!this.endDate) {
                    this.label.textContent = fmt(this.startDate);
                } else {
                    this.label.textContent = `${fmt(this.startDate)} - ${fmt(this.endDate)}`;
                }
            }

            render() {
                const g = this.grid;
                const t = this.title;
                if (!g || !t) return;
                const year = this.viewDate.getFullYear();
                const month = this.viewDate.getMonth();
                const counts = this.getCounts();

                t.textContent = this.viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

                let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="adsidol-cal-day-name">${d}</div>`).join('');
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const prevMonthDays = new Date(year, month, 0).getDate();

                for (let i = firstDay - 1; i >= 0; i--) html += `<div class="adsidol-cal-day other-month">${prevMonthDays - i}</div>`;

                const todayStr = new Date().toISOString().split('T')[0];

                for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const count = counts[dateStr] || 0;
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === this.startDate || dateStr === this.endDate;
                    const inRange = this.startDate && this.endDate && dateStr > this.startDate && dateStr < this.endDate;

                    html += `
                        <div class="adsidol-cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${inRange ? 'in-range' : ''}" 
                             onclick="window.${this.triggerId === 'fuCalendarBtn' ? 'handleFuDateClick' : 'handleHistDateClick'}('${dateStr}')">
                            ${d}
                            ${count > 0 ? `<span class="adsidol-cal-count">${count}</span>` : ''}
                        </div>`;
                }
                g.innerHTML = html;
            }
        }


        // Current session user — loaded from sessionStorage
        let currentUser = null;
        let currentApiKey = null;

        function loadSession() {
            try {
                const saved = JSON.parse(sessionStorage.getItem('adsidol_session') || 'null');
                if (saved?.apiKey && saved?.founderId) {
                    const founder = FOUNDERS.find(f => f.id === saved.founderId);
                    if (founder) { currentUser = founder; currentApiKey = saved.apiKey; return true; }
                }
            } catch (e) { }
            return false;
        }
        function saveSession(founder, apiKey) {
            currentUser = founder; currentApiKey = apiKey;
            sessionStorage.setItem('adsidol_session', JSON.stringify({ founderId: founder.id, apiKey }));
        }
        function clearSession() {
            currentUser = null; currentApiKey = null;
            sessionStorage.removeItem('adsidol_session');
        }

        // Backward-compat shim so all existing code using BACKEND.baseUrl / BACKEND.apiKey still works
        const BACKEND = {
            get baseUrl() { return BACKEND_URL; },
            get apiKey() { return currentApiKey || ''; }
        };

        // ═══════════════════════════════════════════════
        // PERSISTENCE
        // ═══════════════════════════════════════════════
        const STORAGE_KEY = 'adsidol_v6';
        function saveState() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    contacts, templates, followupTemplates, darkMode, emailSignature,
                    sendTime: document.getElementById('sendTime').value,
                    sendLimit: document.getElementById('sendLimit').value,
                    sendInterval: document.getElementById('sendInterval') ? document.getElementById('sendInterval').value : '15',
                    startDate: document.getElementById('startDate').value,
                    savedTemplatesList: [...savedTemplates]
                }));
                // Cloud Sync
                saveContactsToCloud();
                saveTemplatesToCloud();
            } catch (e) { }
        }
        function loadState() {
            try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
        }

        async function saveTemplatesToCloud() {
            if (!currentApiKey) return;
            try {
                const res = await fetch(`${BACKEND_URL}/api/templates`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': currentApiKey },
                    body: JSON.stringify({ templates, followupTemplates })
                });
                const data = await res.json();
                if (!data.ok) console.warn('Cloud template sync failed:', data.error);
            } catch (e) { console.error('Cloud template sync error:', e); }
        }

        async function loadTemplatesFromCloud() {
            if (!currentApiKey) return;
            try {
                const res = await fetch(`${BACKEND_URL}/api/templates`, {
                    headers: { 'x-api-key': currentApiKey }
                });
                const data = await res.json();
                if (data.ok && data.data) {
                    if (data.data.templates) templates = data.data.templates;
                    if (data.data.followupTemplates) Object.assign(followupTemplates, data.data.followupTemplates);
                    updateHistoryDashboard();
                    updateStats();
                    // If we are currently editing a template, we might need to refresh the UI
                    if (currentEditingVertical) {
                        const isFollowupTab = document.querySelector('.tpl-tab[data-tab="followups"]').classList.contains('active');
                        if (isFollowupTab) renderFollowupSteps(currentEditingVertical);
                        else renderPreview(templates[currentEditingVertical].subject, templates[currentEditingVertical].body);
                    }
                    console.log('Templates synced from cloud');
                }
            } catch (e) { console.error('Failed to load templates from cloud:', e); }
        }
        async function saveContactsToCloud() {
            if (!currentApiKey) return;
            try {
                const res = await fetch(`${BACKEND_URL}/api/contacts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': currentApiKey },
                    body: JSON.stringify({ contacts })
                });
                const data = await res.json();
                if (!data.ok) console.warn('Cloud contact sync failed:', data.error);
            } catch (e) { console.error('Cloud contact sync error:', e); }
        }

        async function loadContactsFromCloud() {
            if (!currentApiKey) return;
            try {
                const res = await fetch(`${BACKEND_URL}/api/contacts`, {
                    headers: { 'x-api-key': currentApiKey }
                });
                const data = await res.json();
                if (data.ok && data.data && data.data.length > 0) {
                    contacts = data.data;
                    filteredContacts = [...contacts];
                    document.getElementById('uploadPreview').style.display = 'block';
                    document.getElementById('uploadedFileName').textContent = 'Synced from Cloud';
                    document.getElementById('previewCount').textContent = contacts.length;
                    document.getElementById('scheduleBtn').disabled = false;
                    const pb = document.getElementById('persistBadge'); if (pb) pb.style.display = 'inline-flex';
                    updateDashboard();
                    updateStats();
                    console.log('Contacts synced from cloud');
                }
            } catch (e) { console.error('Failed to load contacts from cloud:', e); }
        }
        // ═══════════════════════════════════════════════
        // TOAST
        // ═══════════════════════════════════════════════
        function showToast(msg, type = 'success', duration = 3500) {
            const icons = {
                success: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" fill="#10B981"/><path d="M5 8l2 2 4-4" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
                error: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" fill="#EF4444"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="white" stroke-width="1.6" stroke-linecap="round"/></svg>',
                warning: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L14.5 13H1.5L8 2z" fill="#F59E0B"/><path d="M8 6.5v3M8 11v.5" stroke="white" stroke-width="1.6" stroke-linecap="round"/></svg>',
                info: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" fill="#3B82F6"/><path d="M8 7.5v4M8 5.5v.5" stroke="white" stroke-width="1.6" stroke-linecap="round"/></svg>'
            };
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span><span class="toast-close" onclick="dismissToast(this.parentElement)">✕</span>`;
            container.appendChild(toast);
            const timer = setTimeout(() => dismissToast(toast), duration);
            toast._timer = timer;
        }
        function dismissToast(toast) {
            if (!toast || !toast.parentElement) return;
            clearTimeout(toast._timer);
            toast.classList.add('out');
            setTimeout(() => toast.remove(), 320);
        }

        // ═══════════════════════════════════════════════
        // DARK MODE
        // ═══════════════════════════════════════════════
        let darkMode = false;
        function setDark(on) {
            darkMode = on;
            document.body.classList.toggle('dark', on);
            document.getElementById('desktopDarkToggle').classList.toggle('on', on);
            document.getElementById('mobileDarkToggle').classList.toggle('on', on);
            saveState();
        }
        document.getElementById('desktopDarkToggle').addEventListener('click', () => setDark(!darkMode));
        document.getElementById('mobileDarkToggle').addEventListener('click', () => setDark(!darkMode));

        // ═══════════════════════════════════════════════
        // MOBILE MENU
        // ═══════════════════════════════════════════════
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const mobileMenu = document.getElementById('mobileMenu');
        const mobileBackdrop = document.getElementById('mobileBackdrop');
        function openMobileMenu() { mobileMenu.classList.add('open'); hamburgerBtn.classList.add('open'); document.body.style.overflow = 'hidden'; }
        function closeMobileMenu() { mobileMenu.classList.remove('open'); hamburgerBtn.classList.remove('open'); document.body.style.overflow = ''; }
        hamburgerBtn.addEventListener('click', () => mobileMenu.classList.contains('open') ? closeMobileMenu() : openMobileMenu());
        mobileBackdrop.addEventListener('click', closeMobileMenu);
        document.querySelectorAll('.mobile-menu-panel [data-section]').forEach(link => {
            link.addEventListener('click', () => {
                scrollToSection(link.dataset.section);
                document.querySelectorAll('.mobile-menu-panel [data-section]').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                closeMobileMenu();
            });
        });

        // ═══════════════════════════════════════════════
        // SECTION NAV
        // ═══════════════════════════════════════════════
        function scrollToSection(section) {
            const map = { upload: 'uploadSection', templates: 'templatesSection', schedule: 'scheduleSection', campaigns: 'campaignsSection', analytics: 'analyticsSection', followups: 'followupDashboard' };
            const el = document.getElementById(map[section]);
            if (!el) return;
            if (section === 'analytics') el.style.display = 'block';
            if (section === 'followups') { el.style.display = 'block'; loadFollowupDashboard(); }
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        document.querySelectorAll('.nav-menu .nav-link').forEach(link => {
            link.addEventListener('click', () => {
                document.querySelectorAll('.nav-menu .nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                scrollToSection(link.dataset.section);
            });
        });

        // ═══════════════════════════════════════════════
        // STATE
        // ═══════════════════════════════════════════════
        const VERTICALS = ['Fintech (DC & CC Disbursal)', 'Fintech (FTD)', 'iGaming (FTD)', 'Crypto (FTD)', 'Ecommerce (AOV)', 'VPN'];
        const SAMPLE = { first_name: 'Sarah', company_name: 'Stripe', vertical: 'Fintech (FTD)' };
        const KNOWN_VARS = new Set(['first_name', 'company_name', 'vertical']);

        let contacts = [];
        let filteredContacts = [];
        const savedTemplates = new Set();
        let gmailConnected = false;
        let currentEditingVertical = null;
        let editingContactIndex = -1;

        // Initial email templates
        let templates = {
            'Fintech (DC & CC Disbursal)': { subject: "{{first_name}}, scaling {{company_name}}'s card disbursal?", body: "Hi {{first_name}},\n\nI noticed {{company_name}} is growing in {{vertical}}.\n\nAdsidol drives high-quality leads for fintech disbursement with proven conversion rates.\n\nWould you be open to discussing partnership opportunities?\n\nBest,\nYour Name\nAdsidol" },
            'Fintech (FTD)': { subject: "{{first_name}}, ready to boost FTDs at {{company_name}}?", body: "Hi {{first_name}},\n\nSaw {{company_name}} is expanding in {{vertical}}.\n\nWe specialize in first-time depositor acquisition with 40%+ lower CPA.\n\nInterested in a quick call?\n\nBest,\nYour Name\nAdsidol" },
            'iGaming (FTD)': { subject: "{{first_name}}, scaling {{company_name}}'s player acquisition?", body: "Hi {{first_name}},\n\n{{company_name}} has built something impressive in {{vertical}}.\n\nAdsidol delivers high-intent FTDs across Tier 1 GEOs with proven ROI.\n\nOpen to exploring partnership opportunities?\n\nBest,\nYour Name\nAdsidol" },
            'Crypto (FTD)': { subject: "{{first_name}}, growing {{company_name}}'s crypto user base?", body: "Hi {{first_name}},\n\nI see {{company_name}} is making moves in {{vertical}}.\n\nWe've helped crypto exchanges scale to 50K+ FTDs monthly.\n\nWould you like to discuss?\n\nBest,\nYour Name\nAdsidol" },
            'Ecommerce (AOV)': { subject: "{{first_name}}, optimizing {{company_name}}'s AOV?", body: "Hi {{first_name}},\n\n{{company_name}} is doing great things in {{vertical}}.\n\nAdsidol specializes in high-AOV customer acquisition.\n\nInterested in learning more?\n\nBest,\nYour Name\nAdsidol" },
            'VPN': { subject: "{{first_name}}, scaling {{company_name}}'s VPN subscriptions?", body: "Hi {{first_name}},\n\nSaw {{company_name}} is growing in {{vertical}}.\n\nWe deliver qualified VPN subscribers at 35% lower CPA.\n\nOpen to a conversation?\n\nBest,\nYour Name\nAdsidol" }
        };

        // Follow-up templates: { [vertical]: [ {step,delayDays,subject,body}, ... ] }
        let followupTemplates = {};
        VERTICALS.forEach(v => {
            followupTemplates[v] = [
                { step: 1, delayDays: 3, subject: "Re: {{first_name}}, still interested in scaling {{company_name}}?", body: "Hi {{first_name}},\n\nJust following up on my earlier note about {{vertical}}.\n\nWe've recently helped similar companies reduce their CPA by 35-40%.\n\nWould a 15-minute call this week work for you?\n\nBest,\nYour Name\nAdsidol" },
                { step: 2, delayDays: 7, subject: "{{first_name}} — quick question about {{company_name}}'s Q4 targets", body: "Hi {{first_name}},\n\nI'll keep this short — are {{company_name}}'s {{vertical}} targets for Q4 on track?\n\nWe're currently onboarding 3 new partners in your vertical and have capacity for one more.\n\nWorth a chat?\n\nBest,\nYour Name\nAdsidol" },
                { step: 3, delayDays: 14, subject: "Last try — {{company_name}} + Adsidol", body: "Hi {{first_name}},\n\nI know you're busy so I'll make this my last follow-up.\n\nIf scaling {{vertical}} performance is a priority, I'd love to show you what we've done for similar teams.\n\nIf the timing isn't right, no worries at all — happy to reconnect whenever it makes sense.\n\nBest,\nYour Name\nAdsidol" },
                { step: 4, delayDays: 21, subject: "Resources for {{company_name}}'s {{vertical}} growth", body: "Hi {{first_name}},\n\nSharing a few resources that might be useful for {{company_name}}'s {{vertical}} strategy — no strings attached:\n\n• Case study: 50K+ FTDs in 90 days\n• Guide: Reducing CPA in {{vertical}}\n• Benchmarks: Industry conversion rates 2024\n\nHappy to send these over if helpful.\n\nBest,\nYour Name\nAdsidol" }
            ];
        });

        // Email signature — appended to every automated email & follow-up
        let emailSignature = { name: '', title: '', email: '', linkedin: '', teams: '', website: '' };

        // ═══════════════════════════════════════════════
        // TIMEZONE MAP
        // ═══════════════════════════════════════════════
        const timezoneMap = {
            'United States': 'America/New_York', 'USA': 'America/New_York', 'US': 'America/New_York',
            'United Kingdom': 'Europe/London', 'UK': 'Europe/London', 'Malta': 'Europe/Malta', 'Gibraltar': 'Europe/Gibraltar',
            'Canada': 'America/Toronto', 'Australia': 'Australia/Sydney', 'India': 'Asia/Kolkata', 'Singapore': 'Asia/Singapore',
            'Hong Kong': 'Asia/Hong_Kong', 'Philippines': 'Asia/Manila', 'Ireland': 'Europe/Dublin', 'Sweden': 'Europe/Stockholm',
            'Netherlands': 'Europe/Amsterdam', 'Germany': 'Europe/Berlin', 'France': 'Europe/Paris', 'Spain': 'Europe/Madrid',
            'Italy': 'Europe/Rome', 'Poland': 'Europe/Warsaw', 'Brazil': 'America/Sao_Paulo', 'Mexico': 'America/Mexico_City',
            'Argentina': 'America/Argentina/Buenos_Aires', 'Japan': 'Asia/Tokyo', 'South Korea': 'Asia/Seoul',
            'New Zealand': 'Pacific/Auckland', 'South Africa': 'Africa/Johannesburg', 'UAE': 'Asia/Dubai', 'Israel': 'Asia/Jerusalem'
        };

        // ═══════════════════════════════════════════════
        // HELPERS
        // ═══════════════════════════════════════════════
        function detectTimezone(location) {
            for (const [country, tz] of Object.entries(timezoneMap))
                if (location.toLowerCase().includes(country.toLowerCase())) return tz;
            return 'America/New_York';
        }
        function calculateSendTime(contact, sendTimeStr) {
            const tz = contact.timezone || 'UTC';
            const [h, m] = sendTimeStr.split(':').map(Number);
            const now = new Date();

            // 1. Get current date components in the target timezone
            const fmt = new Intl.DateTimeFormat('en-US', {
                timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
                hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
            });
            const parts = fmt.formatToParts(now);
            const getPart = (t) => parseInt(parts.find(p => p.type === t).value);

            // 2. Construct a "Target Local Date" (The wall clock time in their city)
            const targetDate = new Date(getPart('year'), getPart('month') - 1, getPart('day'), h, m, 0);

            // 3. Calculate the actual UTC delay
            // We find the difference between actual NOW and what the target wall clock says now
            const targetWallClockNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));
            const diff = targetWallClockNow.getTime() - now.getTime();

            // The actual UTC time = target wall clock goal - the timezone difference
            let finalUtc = new Date(targetDate.getTime() - diff);

            // 4. If that time is already passed today in their country, move to tomorrow
            if (finalUtc < now) {
                finalUtc.setDate(finalUtc.getDate() + 1);
            }
            return finalUtc;
        }
        function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
        function personalisePreview(text) {
            return text.replace(/\{\{(\w+)\}\}/g, (_, k) => SAMPLE[k]
                ? `<span class="preview-var">${SAMPLE[k]}</span>`
                : `<span style="color:var(--error);font-weight:700">{{${k}?}}</span>`);
        }
        function validateVars(text) {
            return [...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).filter(v => !KNOWN_VARS.has(v));
        }
        function formatDate(ts) {
            return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
        }

        // ═══════════════════════════════════════════════
        // CSV UPLOAD
        // ═══════════════════════════════════════════════
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
        uploadZone.addEventListener('drop', e => {
            e.preventDefault(); uploadZone.classList.remove('dragover');
            const f = e.dataTransfer.files[0];
            f?.name.endsWith('.csv') ? handleFileUpload(f) : showToast('Please upload a .csv file', 'error');
        });
        fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); });

        function handleFileUpload(file) {
            const reader = new FileReader();
            reader.onload = e => {
                const result = parseCSV(e.target.result);
                if (!result.ok) { showToast(result.error, 'error'); return; }
                if (result.duplicates > 0) showToast(`${result.duplicates} duplicate email${result.duplicates > 1 ? 's' : ''} skipped`, 'warning');
                if (result.repeats > 0) setTimeout(() => showToast(`Note: ${result.repeats} contact${result.repeats > 1 ? 's have' : ' has'} been previously contacted (see ⚠️)`, 'info', 8000), 500);
                
                document.getElementById('uploadedFileName').textContent = file.name;
                document.getElementById('previewCount').textContent = contacts.length;
                document.getElementById('uploadPreview').style.display = 'block';
                const pb = document.getElementById('persistBadge');
                if (pb) pb.style.display = 'inline-flex';
                filteredContacts = [...contacts];
                updateDashboard(); updateStats();
                document.getElementById('scheduleBtn').disabled = false;
                showToast(`${contacts.length} contacts loaded from ${file.name}`, 'success');
                saveState();
            };
            reader.readAsText(file);
        }

        function parseCSV(csv) {
            const lines = csv.split('\n').filter(l => l.trim());
            if (lines.length < 2) return { ok: false, error: 'CSV appears empty.' };
            const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
            const missing = ['name', 'company', 'vertical', 'email'].filter(r => !headers.some(h => h.includes(r)));
            if (missing.length) return { ok: false, error: `Missing columns: ${missing.join(', ')}` };
            const existingEmails = new Set(contacts.map(c => c.email.toLowerCase()));
            const sentEmails = (analyticsData && analyticsData.length > 0) ? new Set(analyticsData.map(e => e.email.toLowerCase())) : new Set();
            let duplicates = 0;
            const newContacts = [];
            for (let i = 1; i < lines.length; i++) {
                const vals = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
                if (vals.length >= 4) {
                    const [name, company, vertical, email, location] = vals;
                    if (!name || !email) continue;
                    if (existingEmails.has(email.toLowerCase())) { duplicates++; continue; }
                    existingEmails.add(email.toLowerCase());
                    const previouslySent = sentEmails.has(email.toLowerCase());
                    newContacts.push({ name, company, vertical, email, location: location || 'Unknown', timezone: detectTimezone(location || company || 'United States'), status: 'pending', scheduledFor: null, selected: false, sentMessageId: null, sentThreadId: null, previouslySent });
                }
            }
            contacts = [...contacts, ...newContacts];
            const repeats = newContacts.filter(c => c.previouslySent).length;
            const sample = lines[1]?.split(',').map(v => v.trim().replace(/^["']|["']$/g, '')) || [];
            return { ok: true, headers: lines[0].split(',').map(h => h.trim()), sample, duplicates, repeats };
        }

        // ═══════════════════════════════════════════════
        // DASHBOARD TABLE
        // ═══════════════════════════════════════════════
        function updateDashboard() {
            const tbody = document.getElementById('campaignTableBody');
            updateBulkBar();
            if (filteredContacts.length === 0) {
                const first = contacts.length === 0;
                tbody.innerHTML = first
                    ? '<tr><td colspan="9"><div class="empty-state"><div class="empty-text">No active contacts loaded in this session.</div></div></td></tr>'
                    : '<tr><td colspan="9"><div class="empty-state"><div class="empty-text">No contacts match your filters.</div></div></td></tr>';
                return;
            }
            tbody.innerHTML = filteredContacts.map((contact) => {
                const scheduledDate = contact.scheduledFor ? new Date(contact.scheduledFor) : calculateSendTime(contact, document.getElementById('sendTime').value);
                const tzAbbr = new Intl.DateTimeFormat('en-US', { timeZone: contact.timezone, timeZoneName: 'short' }).format(scheduledDate).split(' ').pop();
                const realIdx = contacts.indexOf(contact);
                const hasFu = followupTemplates[contact.vertical]?.length > 0;
                return `<tr>
                    <td><input type="checkbox" class="checkbox contact-checkbox" data-real="${realIdx}" ${contact.selected ? 'checked' : ''}></td>
                    <td style="font-weight:600;">${escHtml(contact.name)}</td>
                    <td class="col-company">${escHtml(contact.company)}</td>
                    <td style="color:var(--blue-600);font-weight:600;">${escHtml(contact.vertical)}</td>
                    <td style="color:var(--text-light);">
                        <div style="display:flex;align-items:center;flex-wrap:nowrap;">
                            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;" title="${escHtml(contact.email)}">${escHtml(contact.email)}</span>
                            ${contact.previouslySent ? '<span title="Previously contacted" style="cursor:help;font-size:12px;margin-left:6px;flex-shrink:0;">⚠️</span>' : ''}
                        </div>
                    </td>
                    <td class="col-timezone">
                        <div style="display:flex;align-items:center;flex-wrap:nowrap;gap:6px;">
                            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;" title="${escHtml(contact.location)}">${escHtml(contact.location)}</span>
                            <span class="timezone-badge" style="flex-shrink:0;">${tzAbbr}</span>
                        </div>
                    </td>
                    <td style="line-height:1.4;">
                        <div style="font-weight:600;display:flex;align-items:baseline;white-space:nowrap;">${new Intl.DateTimeFormat('en-US', { timeZone: contact.timezone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(scheduledDate)} <span style="font-size:11px;font-weight:700;color:var(--text-muted);opacity:0.8;margin-left:4px;">(Local)</span></div>
                        <div style="font-size:12px;font-weight:500;color:var(--text-light);margin-top:2px;display:flex;align-items:baseline;white-space:nowrap;">${new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(scheduledDate)} <span style="font-size:10px;font-weight:700;opacity:0.6;margin-left:4px;">(IST)</span></div>
                    </td>
                    <td>
                        <div style="display:flex;align-items:center;flex-wrap:nowrap;gap:6px;">
                            <span class="status status-${contact.status}" style="flex-shrink:0;"><span class="status-icon"></span>${contact.status}</span>
                            ${hasFu ? `<span title="Follow-ups configured" style="display:inline-flex;align-items:center;flex-shrink:0;"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h10M8 3l3 3-3 3" stroke="var(--blue-500)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>` : ''}
                        </div>
                    </td>
                    <td><div class="row-actions">
                        ${contact.status !== 'sent' ? `<button class="row-action-btn row-send-btn" data-real="${realIdx}" title="Send Now"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 6.5l4 4 7-7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ''}
                        <button class="row-action-btn row-edit-btn" data-real="${realIdx}" title="Edit"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9.5 2l1.5 1.5-8 8H1.5V10l8-8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></button>
                        <button class="row-action-btn row-del-btn" data-real="${realIdx}" title="Delete"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M5 3.5V2.5h3v1M10 3.5l-.5 7H3.5L3 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                    </div></td>
                </tr>`;
            }).join('');

            tbody.querySelectorAll('.contact-checkbox').forEach(cb => {
                cb.addEventListener('change', e => { contacts[parseInt(e.target.dataset.real)].selected = e.target.checked; updateBulkBar(); });
            });
            tbody.querySelectorAll('.row-edit-btn').forEach(btn => { btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.real))); });
            tbody.querySelectorAll('.row-send-btn').forEach(btn => { btn.addEventListener('click', () => sendManualNow(parseInt(btn.dataset.real))); });
            tbody.querySelectorAll('.row-del-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const ri = parseInt(btn.dataset.real);
                    const name = contacts[ri].name;
                    contacts.splice(ri, 1);
                    filteredContacts = filteredContacts.filter(c => contacts.includes(c));
                    updateDashboard(); updateStats();
                    showToast(`Deleted ${name}`, 'info');
                    saveState();
                });
            });
            updateBulkBar();
        }

        // ═══════════════════════════════════════════════
        // STATS
        // ═══════════════════════════════════════════════
        function animateCount(el, target) {
            const start = parseInt(el.textContent) || 0, diff = target - start;
            if (!diff) return;
            let step = 0;
            const iv = setInterval(() => { step++; el.textContent = Math.round(start + diff * (step / 20)); if (step >= 20) clearInterval(iv); }, 16);
        }
        let analyticsData = [];
        let pollingInterval = null;
        let lastActivityTime = Date.now();
        const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes

        // Record activity to prevent idle sleep
        ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove', 'focus'].forEach(evt => {
            window.addEventListener(evt, () => { 
                lastActivityTime = Date.now(); 
            });
        });

        /**
         * syncStatusWithAnalytics
         * Loops through current contacts and updates their status to 'sent'
         * if they are found in the cloud analytics ledger.
         */
        function syncStatusWithAnalytics() {
            if (!analyticsData || analyticsData.length === 0) return;

            let changed = false;
            const now = Date.now();

            contacts.forEach(c => {
                if (c.status === 'scheduled') {
                    const email = c.email.toLowerCase();
                    if (!c.scheduledFor) return; 
                    const schedTime = new Date(c.scheduledFor).getTime();
                    
                    // 1. SAFETY: Never mark as sent if the scheduled time is in the future (plus 1min buffer)
                    if (schedTime > (now + 60000)) return;

                    // 2. RELAXED MATCH: Check if this email appears in analytics ledger 
                    // AND occured at or after our scheduled time (or just anytime today for same vertical)
                    const isSent = analyticsData.some(e => {
                        if (e.email.toLowerCase() !== email) return false;
                        const eventTime = e.date ? new Date(e.date).getTime() : 0;
                        if (!eventTime) return false; 
                        
                        // If it matches perfectly (post-schedule), it's sent
                        const isAfterSchedule = eventTime >= (schedTime - 300000);
                        // If it happened today for the SAME vertical, treat it as a manual send override
                        const isSameVerticalToday = e.vertical === c.vertical && (now - eventTime) < 86400000;
                        
                        return isAfterSchedule || isSameVerticalToday;
                    });
                    
                    if (isSent) {
                        c.status = 'sent';
                        changed = true;
                    }
                }
            });

            if (changed) {
                filteredContacts = [...contacts];
                updateDashboard();
                saveState();
            }
        }


        // ═══════════════════════════════════════════════
        // HISTORY DASHBOARD LOGIC
        // ═══════════════════════════════════════════════
        let historyCurrentPage = 1;
        const historyPerPage = 20;
        
        function updateHistoryDashboard() {
            const tbody = document.getElementById('historyTableBody');
            
            if (!analyticsData || analyticsData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-text">No sent emails found in your cloud history.</div></div></td></tr>';
                document.getElementById('historyPagination').style.display = 'none';
                return;
            }

            const searchVal = document.getElementById('searchHistory').value.toLowerCase();
            const verticalVal = document.getElementById('historyVerticalFilter').value;
            const dateFilter = document.getElementById('historyDateFilter').value;
            const customStart = document.getElementById('historyStartDate').value;
            const customEnd = document.getElementById('historyEndDate').value;

            // Date calculations
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const yesterday = today - 86400000;
            const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();

            // Filter data
            const filtered = analyticsData.filter(e => {
                // Search filter
                const nameStr = (e.name || '').toLowerCase();
                const emailStr = (e.email || '').toLowerCase();
                if (searchVal && !nameStr.includes(searchVal) && !emailStr.includes(searchVal)) return false;
                
                // Vertical filter
                if (verticalVal && e.vertical !== verticalVal) return false;
                
                // Date filter
                if (e.date && dateFilter !== 'all') {
                    if (dateFilter === 'today' && e.date < today) return false;
                    if (dateFilter === 'yesterday' && (e.date < yesterday || e.date >= today)) return false;
                    if (dateFilter === '7days' && e.date < (now.getTime() - 7 * 86400000)) return false;
                    if (dateFilter === '14days' && e.date < (now.getTime() - 14 * 86400000)) return false;
                    if (dateFilter === '30days' && e.date < (now.getTime() - 30 * 86400000)) return false;
                    if (dateFilter === 'thismonth' && e.date < startOfThisMonth) return false;
                    if (dateFilter === 'lastmonth' && (e.date < startOfLastMonth || e.date > endOfLastMonth)) return false;
                    
                    if (dateFilter === 'custom') {
                        const s = historyCalendar.startDate;
                        const e = historyCalendar.endDate;
                        if (s && e) {
                            const startT = new Date(s).getTime();
                            const endT = new Date(e);
                            endT.setHours(23, 59, 59, 999);
                            if (e.date < startT || e.date > endT.getTime()) return false;
                        } else if (s) {
                            const startT = new Date(s).getTime();
                            const endT = new Date(s);
                            endT.setHours(23,59,59,999);
                            if (e.date < startT || e.date > endT.getTime()) return false;
                        }
                    }
                }
                return true;
            });
            
            // Sort by descending date
            filtered.sort((a, b) => (b.date || 0) - (a.date || 0));

            const totalPages = Math.max(1, Math.ceil(filtered.length / historyPerPage));
            if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;

            const startIndex = (historyCurrentPage - 1) * historyPerPage;
            const pageData = filtered.slice(startIndex, startIndex + historyPerPage);

            if (pageData.length === 0) {
                 tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-text">No history matches your filters.</div></div></td></tr>';
                 document.getElementById('historyPagination').style.display = 'none';
                 return;
            }

            tbody.innerHTML = pageData.map(e => {
                const dateStr = e.date ? new Date(e.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'Unknown Date';
                const typeIndicator = e.type === 'followup' ? '<span style="background:var(--indigo-500);color:white;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;margin-left:8px;">Follow-up</span>' : '';
                return '<tr><td style="font-weight:600;color:var(--text);">' + dateStr + '</td><td style="font-weight:600;">' + escHtml(e.name || '—') + '</td><td style="color:var(--text-light);">' + escHtml(e.email || '—') + ' ' + typeIndicator + '</td><td style="color:var(--blue-600);font-weight:600;">' + escHtml(e.vertical || '—') + '</td><td><span class="status status-sent"><span class="status-icon"></span>Sent</span></td></tr>';
            }).join('');
            
            // Pagination controls
            if (filtered.length > historyPerPage) {
                document.getElementById('historyPagination').style.display = 'flex';
                document.getElementById('historyPagination').style.alignItems = 'center';
                document.getElementById('historyPagination').style.justifyContent = 'space-between';
                document.getElementById('historyCurrentPage').textContent = historyCurrentPage;
                document.getElementById('historyTotalPages').textContent = totalPages;
                document.getElementById('historyPrevBtn').disabled = historyCurrentPage === 1;
                document.getElementById('historyNextBtn').disabled = historyCurrentPage === totalPages;
            } else {
                document.getElementById('historyPagination').style.display = 'none';
            }
        }
        
        document.getElementById('historyDateFilter').addEventListener('change', (ev) => {
            const isCustom = ev.target.value === 'custom';
            document.getElementById('historyCalendarContainer').style.display = isCustom ? 'inline-flex' : 'none';
            if (isCustom) historyCalendar.render();
            else {
                historyCalendar.startDate = null;
                historyCalendar.endDate = null;
                document.getElementById('historyDateLabel').textContent = 'Select Range';
            }
            historyCurrentPage = 1;
            updateHistoryDashboard();
        });

        // Initialize History Calendar
        window.historyCalendar = new AdsidolCalendar({
            popupId: 'historyCalendarPopup',
            gridId: 'histCalGrid',
            titleId: 'histCalMonthTitle',
            labelId: 'historyDateLabel',
            triggerId: 'historyCalendarBtn',
            onSelect: () => {
                historyCurrentPage = 1;
                updateHistoryDashboard();
            }
        });

        window.toggleHistoryCalendar = () => historyCalendar.toggle();
        window.changeHistoryMonth = (d) => historyCalendar.changeMonth(d);
        window.setHistoryDateFilter = (s, e) => historyCalendar.setRange(s, e);
        window.setHistoryDateToToday = () => historyCalendar.setToToday();

        document.getElementById('searchHistory').addEventListener('input', () => { historyCurrentPage = 1; updateHistoryDashboard(); });
        document.getElementById('historyVerticalFilter').addEventListener('change', () => { historyCurrentPage = 1; updateHistoryDashboard(); });

        
        document.getElementById('historyPrevBtn').addEventListener('click', () => {
            if (historyCurrentPage > 1) { historyCurrentPage--; updateHistoryDashboard(); }
        });
        
        document.getElementById('historyNextBtn').addEventListener('click', () => {
             historyCurrentPage++; updateHistoryDashboard();
        });

        async function fetchCloudAnalytics() {
            if (!currentApiKey) return;
            try {
                const res = await fetch(`${BACKEND_URL}/api/analytics`, {
                    headers: { 'x-api-key': currentApiKey }
                });
                const data = await res.json();
                if (data.ok) {
                    analyticsData = data.events;
                    updateHistoryDashboard();
                    syncStatusWithAnalytics(); // Match local contacts with cloud events
                    updateStats();
                    updateSyncTimestamp();
                }
            } catch (e) { console.error('Failed to fetch analytics:', e); }
        }

        function updateSyncTimestamp(isPaused = false) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const elements = ['headerLastUpdated', 'fuLastUpdated'];
            elements.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    if (isPaused) {
                        el.textContent = ' (Paused)';
                    } else {
                        el.textContent = `@ ${timeStr}`;
                    }
                }
            });
            const indicators = ['headerSyncIndicator', 'fuSyncIndicator'];
            indicators.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.classList.add('visible');
                    el.classList.toggle('paused', isPaused);
                    const label = el.querySelector('span:not(.last-updated-text)');
                    if (label) label.textContent = isPaused ? 'SYNC PAUSED' : 'LIVE SYNC';
                }
            });
        }

        function startPolling() {
            if (pollingInterval) return;
            console.log("Starting smart background sync...");
            
            // Initial full refresh (Immediate)
            fetchCloudAnalytics();
            loadFollowupDashboard();

            // Poll every 60 seconds (Efficient)
            pollingInterval = setInterval(() => {
                if (!currentApiKey || !gmailConnected) {
                    stopPolling();
                    return;
                }

                const isIdle = (Date.now() - lastActivityTime) > IDLE_TIMEOUT;
                const isHidden = document.hidden;

                if (isHidden || isIdle) {
                    console.log(`Sync paused: ${isHidden ? 'tab hidden' : 'user idle'}`);
                    updateSyncTimestamp(true);
                    return;
                }

                fetchCloudAnalytics();
                loadFollowupDashboard();
            }, 60000);
        }

        function stopPolling() {
            if (pollingInterval) {
                console.log("Stopping background sync...");
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
            const indicators = ['headerSyncIndicator', 'fuSyncIndicator'];
            indicators.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('visible');
            });
        }

        // Auto-pause/resume on visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && currentApiKey && gmailConnected) {
                console.log("Tab focused — waking up sync...");
                lastActivityTime = Date.now(); // Reset idle timer on focus
                updateSyncTimestamp(false); // Instantly turn UI green
                
                // Pulse immediately on return if polling is active
                if (pollingInterval) {
                    fetchCloudAnalytics();
                    loadFollowupDashboard();
                }
            }
        });

        document.getElementById('statsPeriod').addEventListener('change', updateStats);

        function updateStats() {
            const period = document.getElementById('statsPeriod').value;
            const now = Date.now();
            let limit = 0;
            if (period === 'today') limit = new Date().setHours(0, 0, 0, 0);
            else if (period === '7d') limit = now - (7 * 86400000);
            else if (period === '30d') limit = now - (30 * 86400000);

            // Cloud Data Metrics
            const filteredCloud = period === 'all' ? analyticsData : analyticsData.filter(e => e.date >= limit);
            const cloudSent = filteredCloud.length;

            // Local Session Metrics (for context)
            const total = contacts.length;
            const scheduled = contacts.filter(c => c.status === 'scheduled').length;
            const pending = contacts.filter(c => c.status === 'pending').length;

            animateCount(document.getElementById('totalContacts'), total);
            animateCount(document.getElementById('scheduledCount'), scheduled);
            animateCount(document.getElementById('sentCount'), cloudSent); // Now driven by Cloud
            animateCount(document.getElementById('pendingCount'), pending);

            const sentLabel = document.getElementById('sentCount').nextElementSibling;
            if (period === 'today') sentLabel.textContent = 'Sent Today';
            else if (period === '7d') sentLabel.textContent = 'Sent This Week';
            else if (period === '30d') sentLabel.textContent = 'Sent This Month';
            else if (period === 'all') sentLabel.textContent = 'Total Sent';

            const pct = n => total > 0 ? (n / total * 100) + '%' : '0%';
            document.getElementById('progressTotal').style.width = total > 0 ? '100%' : '0%';
            document.getElementById('progressScheduled').style.width = pct(scheduled);
            document.getElementById('progressSent').style.width = cloudSent > 0 ? '100%' : '0%'; // Different logic for cloud
            document.getElementById('progressPending').style.width = pct(pending);

            if (typeof updateAdvancedAnalytics === 'function') updateAdvancedAnalytics();
        }

        // ═══════════════════════════════════════════════
        // BULK ACTION BAR
        // ═══════════════════════════════════════════════
        function updateBulkBar() {
            const sel = contacts.filter(c => c.selected);
            const bar = document.getElementById('bulkBar');
            sel.length > 0 ? (bar.classList.add('visible'), document.getElementById('bulkCount').textContent = `${sel.length} selected`) : bar.classList.remove('visible');
        }
        document.getElementById('bulkDelete').addEventListener('click', () => {
            const count = contacts.filter(c => c.selected).length;
            contacts = contacts.filter(c => !c.selected); filteredContacts = [...contacts];
            updateDashboard(); updateStats(); showToast(`Deleted ${count} contact${count !== 1 ? 's' : ''}`, 'success'); saveState();
        });
        document.getElementById('bulkSchedule').addEventListener('click', () => {
            const sendTime = document.getElementById('sendTime').value;
            const sel = contacts.filter(c => c.selected); 
            sel.forEach(c => { 
                c.status = 'scheduled'; 
                c.scheduledFor = calculateSendTime(c, sendTime);
                c.selected = false; 
            });
            filteredContacts = [...contacts]; updateDashboard(); updateStats(); showToast(`${sel.length} marked as scheduled`, 'warning'); saveState();
        });
        document.getElementById('bulkPending').addEventListener('click', () => {
            const sel = contacts.filter(c => c.selected); sel.forEach(c => { c.status = 'pending'; c.selected = false; });
            filteredContacts = [...contacts]; updateDashboard(); updateStats(); showToast(`${sel.length} reset to pending`, 'info'); saveState();
        });
        document.getElementById('bulkClose').addEventListener('click', () => { contacts.forEach(c => c.selected = false); filteredContacts = [...contacts]; updateDashboard(); });

        // ═══════════════════════════════════════════════
        // TEMPLATE TABS
        // ═══════════════════════════════════════════════
        document.querySelectorAll('.tpl-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tpl-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const which = tab.dataset.tab;
                document.getElementById('tabInitial').style.display = which === 'initial' ? 'block' : 'none';
                document.getElementById('tabFollowups').style.display = which === 'followups' ? 'block' : 'none';
                document.getElementById('tabSignature').style.display = which === 'signature' ? 'block' : 'none';
                if (which === 'followups' && currentEditingVertical) renderFollowupSteps(currentEditingVertical);
            });
        });

        // ═══════════════════════════════════════════════
        // INITIAL EMAIL TEMPLATE EDITING
        // ═══════════════════════════════════════════════
        function formatEmailPreview(text) {
            if (!text) return '';
            // Match backend logic: split by double-newlines, parse **bold**, wrap in <p>
            return text.trim().split(/\n\s*\n/).filter(p => p.trim()).map(para => {
                const cleanPara = para.trim()
                    .replace(/\r?\n/g, '<br>')
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                return `<p style="margin: 0 0 10px 0; padding: 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.5; color: #334155;">${cleanPara}</p>`;
            }).join('');
        }

        function buildSignaturePreviewHtml() {
            if (!emailSignature.name) return '';
            const rows = [];
            if (emailSignature.email)    rows.push(`<div class="sig-contact-row"><span class="sig-contact-label">Mail</span><span class="sig-contact-val"><a href="mailto:${emailSignature.email}">${emailSignature.email}</a></span></div>`);
            if (emailSignature.linkedin) rows.push(`<div class="sig-contact-row"><span class="sig-contact-label">LinkedIn</span><span class="sig-contact-val"><a href="${emailSignature.linkedin}" target="_blank">${emailSignature.linkedin}</a></span></div>`);
            if (emailSignature.teams)    rows.push(`<div class="sig-contact-row"><span class="sig-contact-label">Teams</span><span class="sig-contact-val"><a href="${emailSignature.teams}" target="_blank">${emailSignature.teams}</a></span></div>`);
            if (emailSignature.website)  rows.push(`<div class="sig-contact-row"><span class="sig-contact-label">Website</span><span class="sig-contact-val"><a href="${emailSignature.website}" target="_blank">${emailSignature.website}</a></span></div>`);
            return `<div style="margin-top:22px;padding-top:16px;border-top:1px solid var(--border);">
                <p class="sig-name" style="font-weight:700;margin:0 0 2px 0;">${escHtml(emailSignature.name)}</p>
                <p class="sig-title-text" style="margin:0 0 12px 0;font-size:13px;color:var(--text-light);">${escHtml(emailSignature.title||'')}</p>
                ${rows.join('')}
            </div>`;
        }

        function renderPreview(subject, body) {
            document.getElementById('previewSubject').innerHTML = subject ? personalisePreview(subject) : '<em style="opacity:0.4">Subject here…</em>';
            const bodyHtml = formatEmailPreview(body) || '<em style="opacity:0.4">Body here…</em>';
            document.getElementById('previewBody').innerHTML = bodyHtml + buildSignaturePreviewHtml();
        }
        document.getElementById('subjectLine').addEventListener('input', () => renderPreview(document.getElementById('subjectLine').value, document.getElementById('emailBody').value));
        document.getElementById('emailBody').addEventListener('input', () => renderPreview(document.getElementById('subjectLine').value, document.getElementById('emailBody').value));

        // ── BOLD BUTTON ──────────────────────────────────────────────────────────
        function applyBold(textarea) {
            const start = textarea.selectionStart;
            const end   = textarea.selectionEnd;
            if (start === end) { showToast('Select some text first, then click Bold', 'info', 2500); return; }
            const selected = textarea.value.substring(start, end);
            // Toggle: remove ** if already bold, otherwise add
            if (selected.startsWith('**') && selected.endsWith('**') && selected.length > 4) {
                textarea.setRangeText(selected.slice(2, -2), start, end, 'select');
            } else {
                textarea.setRangeText(`**${selected}**`, start, end, 'select');
            }
            textarea.dispatchEvent(new Event('input'));
        }
        document.getElementById('boldBtn').addEventListener('click', () => applyBold(document.getElementById('emailBody')));
        document.getElementById('emailBody').addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                applyBold(document.getElementById('emailBody'));
            }
        });

        // ── SIGNATURE EDITOR ─────────────────────────────────────────────────────
        function updateSignaturePreview() {
            const el = document.getElementById('signaturePreview');
            if (!el) return;
            el.innerHTML = emailSignature.name
                ? buildSignaturePreviewHtml()
                : '<em style="opacity:0.4">Fill in your details to preview the signature...</em>';
        }
        document.getElementById('saveSignatureBtn').addEventListener('click', () => {
            emailSignature = {
                name:     document.getElementById('sigName').value.trim(),
                title:    document.getElementById('sigTitle').value.trim(),
                email:    document.getElementById('sigEmail').value.trim(),
                linkedin: document.getElementById('sigLinkedin').value.trim(),
                teams:    document.getElementById('sigTeams').value.trim(),
                website:  document.getElementById('sigWebsite').value.trim(),
            };
            saveState();
            updateSignaturePreview();
            renderPreview(document.getElementById('subjectLine').value, document.getElementById('emailBody').value);
            showToast('Signature saved — it will be appended to all emails you send.', 'success');
        });
        // Live preview while typing
        ['sigName','sigTitle','sigEmail','sigLinkedin','sigTeams','sigWebsite'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => {
                emailSignature = {
                    name:     document.getElementById('sigName').value.trim(),
                    title:    document.getElementById('sigTitle').value.trim(),
                    email:    document.getElementById('sigEmail').value.trim(),
                    linkedin: document.getElementById('sigLinkedin').value.trim(),
                    teams:    document.getElementById('sigTeams').value.trim(),
                    website:  document.getElementById('sigWebsite').value.trim(),
                };
                updateSignaturePreview();
            });
        });

        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                currentEditingVertical = card.dataset.vertical;
                document.getElementById('editingVertical').textContent = `Edit ${currentEditingVertical} Template`;
                document.getElementById('subjectLine').value = templates[currentEditingVertical].subject;
                document.getElementById('emailBody').value = templates[currentEditingVertical].body;
                document.getElementById('templateEditor').style.display = 'block';
                document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');

                // Reset to initial tab
                document.querySelectorAll('.tpl-tab').forEach(t => t.classList.remove('active'));
                document.querySelector('.tpl-tab[data-tab="initial"]').classList.add('active');
                document.getElementById('tabInitial').style.display = 'block';
                document.getElementById('tabFollowups').style.display = 'none';
                document.getElementById('tabSignature').style.display = 'none';

                renderPreview(templates[currentEditingVertical].subject, templates[currentEditingVertical].body);
                updateFuCountBadge(currentEditingVertical);
                setTimeout(() => document.getElementById('templateEditor').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
            });
        });

        document.getElementById('saveTemplate').addEventListener('click', () => {
            if (!currentEditingVertical) return;
            const subject = document.getElementById('subjectLine').value;
            const body = document.getElementById('emailBody').value;
            const badVars = [...new Set([...validateVars(subject), ...validateVars(body)])];
            if (badVars.length) showToast(`Unknown variable${badVars.length > 1 ? 's' : ''}: {{${badVars.join('}}, {{')}}}  — check spelling`, 'warning', 6000);
            templates[currentEditingVertical] = { subject, body };
            savedTemplates.add(currentEditingVertical);
            document.querySelectorAll('.template-card').forEach(card => {
                if (card.dataset.vertical === currentEditingVertical && !card.querySelector('.template-saved-badge'))
                    card.insertAdjacentHTML('beforeend', '<div class="template-saved-badge"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Customised</div>');
            });
            document.getElementById('templateEditor').style.display = 'none';
            document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
            showToast(`${currentEditingVertical} template saved!`, 'success');
            saveState();
            saveTemplatesToCloud();
        });

        function closeTemplateEditor() {
            document.getElementById('templateEditor').style.display = 'none';
            document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
        }
        document.getElementById('cancelTemplate').addEventListener('click', closeTemplateEditor);
        document.getElementById('cancelTemplate2').addEventListener('click', closeTemplateEditor);

        // ═══════════════════════════════════════════════
        // FOLLOW-UP TEMPLATE SYSTEM
        // ═══════════════════════════════════════════════
        const DELAY_PRESETS = [1, 2, 3, 5, 7, 10, 14, 21];

        function updateFuCountBadge(vertical) {
            const badge = document.getElementById('fuCountBadge');
            const count = followupTemplates[vertical]?.filter(f => f.subject && f.body).length || 0;
            if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block'; }
            else badge.style.display = 'none';
        }

        function renderFollowupSteps(vertical) {
            const steps = followupTemplates[vertical] || [];
            const container = document.getElementById('followupSteps');
            container.innerHTML = steps.map((fu, i) => {
                const isSaved = fu.subject && fu.body;
                return `
                <div class="fu-step-card" id="fuCard${i}" data-step="${i}">
                    <div class="fu-step-header" onclick="toggleFuStep(${i})">
                        <div class="fu-step-num">F${fu.step}</div>
                        <div class="fu-step-info">
                            <div class="fu-step-title">Follow-up ${fu.step}</div>
                            <div class="fu-step-meta">Sends ${fu.delayDays} day${fu.delayDays !== 1 ? 's' : ''} after ${fu.step === 1 ? 'initial email' : 'previous follow-up'}</div>
                        </div>
                        <span class="fu-step-status ${isSaved ? 'saved' : 'unsaved'}">${isSaved ? 'Saved' : 'Not saved'}</span>
                        <svg class="fu-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </div>
                    <div class="fu-step-body">
                        <div class="fu-delay-row">
                            <span class="fu-delay-label">Send after:</span>
                            <div class="fu-delay-btns">
                                ${DELAY_PRESETS.map(d => `<button class="fu-delay-btn ${fu.delayDays === d ? 'active' : ''}" onclick="setFuDelay(${i},${d})">${d}d</button>`).join('')}
                            </div>
                        </div>
                        <div class="fu-grid">
                            <div>
                                <div style="margin-bottom:14px;">
                                    <label style="font-size:13px;">Subject Line</label>
                                    <input type="text" id="fuSubject${i}" value="${escHtml(fu.subject || '')}" placeholder="Re: {{first_name}}, following up…" oninput="updateFuPreview(${i})" style="font-size:14px;">
                                </div>
                                <div>
                                    <label style="font-size:13px;">Email Body</label>
                                    <textarea id="fuBody${i}" style="min-height:140px;font-size:13px;" placeholder="Hi {{first_name}},\n\nJust following up…" oninput="updateFuPreview(${i})">${escHtml(fu.body || '')}</textarea>
                                </div>
                            </div>
                            <div class="fu-preview">
                                <div class="fu-preview-hdr">Preview</div>
                                <div class="fu-preview-subj" id="fuPreviewSubj${i}">${fu.subject ? personalisePreview(fu.subject) : '<em style="opacity:0.4">Subject…</em>'}</div>
                                <div class="fu-preview-body" id="fuPreviewBody${i}">${fu.body ? formatEmailPreview(fu.body) : '<em style="opacity:0.4">Body…</em>'}</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');

            // Open first unsaved step automatically
            const firstUnsaved = steps.findIndex(f => !f.subject || !f.body);
            toggleFuStep(firstUnsaved >= 0 ? firstUnsaved : 0);
        }

        window.toggleFuStep = function (idx) {
            document.querySelectorAll('.fu-step-card').forEach((card, i) => {
                if (i === idx) { card.classList.toggle('open'); card.classList.toggle('active-step', card.classList.contains('open')); }
                else { card.classList.remove('open', 'active-step'); }
            });
        };

        window.setFuDelay = function (idx, days) {
            followupTemplates[currentEditingVertical][idx].delayDays = days;
            document.querySelectorAll(`#fuCard${idx} .fu-delay-btn`).forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.textContent) === days);
            });
            document.querySelector(`#fuCard${idx} .fu-step-meta`).textContent = `Sends ${days} day${days !== 1 ? 's' : ''} after ${idx === 0 ? 'initial email' : 'previous follow-up'}`;
        };

        window.updateFuPreview = function (idx) {
            const subject = document.getElementById(`fuSubject${idx}`)?.value || '';
            const body = document.getElementById(`fuBody${idx}`)?.value || '';
            const subj = document.getElementById(`fuPreviewSubj${idx}`);
            const bod = document.getElementById(`fuPreviewBody${idx}`);
            if (subj) subj.innerHTML = subject ? personalisePreview(subject) : '<em style="opacity:0.4">Subject…</em>';
            if (bod) bod.innerHTML = body ? formatEmailPreview(body) : '<em style="opacity:0.4">Body…</em>';
        };

        document.getElementById('saveFollowups').addEventListener('click', () => {
            if (!currentEditingVertical) return;
            let allValid = true;
            const steps = followupTemplates[currentEditingVertical];
            steps.forEach((fu, i) => {
                const subject = document.getElementById(`fuSubject${i}`)?.value?.trim() || '';
                const body = document.getElementById(`fuBody${i}`)?.value?.trim() || '';
                // Validate vars
                const badVars = [...new Set([...validateVars(subject), ...validateVars(body)])];
                if (badVars.length) { showToast(`Follow-up ${fu.step}: unknown variable {{${badVars[0]}}}`, 'warning', 5000); allValid = false; }
                fu.subject = subject;
                fu.body = body;
            });
            updateFuCountBadge(currentEditingVertical);
            // Update saved badge status in step cards
            steps.forEach((fu, i) => {
                const card = document.getElementById(`fuCard${i}`);
                if (card) {
                    const badge = card.querySelector('.fu-step-status');
                    const saved = fu.subject && fu.body;
                    badge.className = `fu-step-status ${saved ? 'saved' : 'unsaved'}`;
                    badge.textContent = saved ? 'Saved' : 'Not saved';
                }
            });
            showToast(`Follow-ups for ${currentEditingVertical} saved!`, allValid ? 'success' : 'info');
            saveState();
            saveTemplatesToCloud();
        });

        // ═══════════════════════════════════════════════
        // FOLLOW-UP DASHBOARD
        // ═══════════════════════════════════════════════
        let fuJobs = []; // local mirror of backend jobs

        async function loadFollowupDashboard() {
            if (!currentApiKey) return; // Not logged in — skip silently
            const dashboard = document.getElementById('followupDashboard');
            dashboard.style.display = 'block';
            if (!BACKEND.baseUrl || BACKEND.baseUrl.includes('CHANGE')) {
                fuJobs = []; renderFuDashboard(); return;
            }
            try {
                const res = await fetch(`${BACKEND.baseUrl}/api/followup?action=list`, { headers: { 'x-api-key': BACKEND.apiKey } });
                const data = await res.json();
                if (data.ok) { fuJobs = data.jobs || []; renderFuDashboard(); }
                else showToast('Could not load follow-up jobs', 'error');
            } catch (e) { fuJobs = []; renderFuDashboard(); }
        }

        if(typeof window.fuStatusFilter === 'undefined') window.fuStatusFilter = 'all';

        function renderFuDashboard() {
            let jobs = fuJobs;
            const activeSteps = Array.from(document.querySelectorAll('.fu-widget.active')).map(w => parseInt(w.dataset.step));
            if (activeSteps.length < 4) {
                jobs = fuJobs.filter(j => activeSteps.includes(j.step));
            }

            // Stats
            const total = jobs.length, pending = jobs.filter(j => j.status === 'pending').length,
                sent = jobs.filter(j => j.status === 'sent').length, failed = jobs.filter(j => j.status === 'failed').length;
            
            document.getElementById('fuStatsRow').innerHTML = [
                ['all', 'Total', total, 'var(--blue-600)'], 
                ['pending', 'Pending', pending, '#D97706'], 
                ['sent', 'Sent', sent, '#059669'], 
                ['failed', 'Failed', failed, '#EF4444']
            ].map(([id, l, v, c]) => {
                const isActive = window.fuStatusFilter === id;
                const border = isActive ? `1.5px solid ${c}` : `1px solid var(--border)`;
                const shadow = isActive ? `0 4px 12px ${c}25` : `none`;
                return `<div class="fu-stat" style="cursor:pointer; border:${border}; box-shadow:${shadow}; transition:all 0.2s; transform:${isActive?'scale(1.02)':'translateY(0)'}; border-radius:12px;" onclick="window.fuStatusFilter='${id}'; renderFuDashboard();">
                    <div class="fu-stat-val" style="background:none;-webkit-text-fill-color:${c};color:${c}">${v}</div>
                    <div class="fu-stat-lbl">${l}</div>
                </div>`;
            }).join('');

            // Apply status filter to the jobs list shown in the table
            if (window.fuStatusFilter !== 'all') {
                jobs = jobs.filter(j => j.status === window.fuStatusFilter);
            }

            // Date Filter (Unified Calendar)
            if (fuCalendar.startDate) {
                const s = fuCalendar.startDate;
                const e = fuCalendar.endDate;
                jobs = jobs.filter(j => {
                    const jobDateTime = new Date(j.scheduledFor).getTime();
                    const jobDateStr = new Date(j.scheduledFor).toISOString().split('T')[0];
                    if (s && e) {
                        return jobDateStr >= s && jobDateStr <= e;
                    } else {
                        return jobDateStr === s;
                    }
                });
            }

            // Date Range Filter (Dropdown)
            const rangeVal = document.getElementById('fuDateRangeFilter')?.value || 'all';
            if (rangeVal !== 'all') {
                const now = new Date();
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                jobs = jobs.filter(j => {
                    const jobDate = new Date(j.scheduledFor);
                    const jTime = jobDate.getTime();
                    const todayTime = todayMidnight.getTime();
                    const diffDays = (jTime - todayTime) / (1000 * 60 * 60 * 24);

                    if (rangeVal === 'today') {
                        return diffDays >= 0 && diffDays < 1;
                    } else if (rangeVal === 'next7') {
                        return diffDays >= 0 && diffDays <= 7;
                    } else if (rangeVal === 'next14') {
                        return diffDays >= 0 && diffDays <= 14;
                    } else if (rangeVal === 'thisMonth') {
                        return jobDate.getMonth() === now.getMonth() && jobDate.getFullYear() === now.getFullYear();
                    }
                    return true;
                });
            }

            // Search Filter
            const fuSearchQuery = document.getElementById('searchFuJobs')?.value.toLowerCase() || '';
            if (fuSearchQuery) {
                jobs = jobs.filter(j => {
                    const c = j.contact || {};
                    return (c.name || '').toLowerCase().includes(fuSearchQuery) ||
                           (c.email || '').toLowerCase().includes(fuSearchQuery) ||
                           (c.company || '').toLowerCase().includes(fuSearchQuery);
                });
            }

            const tbody = document.getElementById('fuJobTableBody');
            if (jobs.length === 0) {
                const emptyMsg = window.fuDateFilter || rangeVal !== 'all' || fuSearchQuery ? 'No follow-ups match your criteria.' : 'No follow-ups scheduled yet.';
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px;">${emptyMsg}</td></tr>`;
                return;
            }
            tbody.innerHTML = jobs.map(job => {
                const tz = job.contact?.timezone || detectTimezone(job.contact?.location || job.contact?.company || 'United States');
                return `
                <tr>
                    <td><strong>${escHtml(job.contact?.name || '')}</strong><br><span style="color:var(--text-muted);font-size:12px;">${escHtml(job.contact?.email || '')}</span></td>
                    <td class="col-company" style="font-size:13px;">${escHtml(job.contact?.company || '—')}</td>
                    <td><span style="color:var(--blue-600);font-weight:600;font-size:12px;">${escHtml(job.contact?.vertical || '')}</span></td>
                    <td><div style="width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,var(--blue-500),var(--indigo-500));display:inline-flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:800;">F${job.step}</div></td>
                    <td style="line-height:1.4;">
                        <div style="font-weight:600;display:flex;align-items:baseline;white-space:nowrap;">${new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(job.scheduledFor))} <span style="font-size:11px;font-weight:700;color:var(--text-muted);opacity:0.8;margin-left:4px;">(Local)</span></div>
                        <div style="font-size:12px;font-weight:500;color:var(--text-light);margin-top:2px;display:flex;align-items:baseline;white-space:nowrap;">${new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(job.scheduledFor))} <span style="font-size:10px;font-weight:700;opacity:0.6;margin-left:4px;">(IST)</span></div>
                    </td>
                    <td><span class="fu-status-badge fu-status-${job.status}">${job.status}</span></td>
                    <td style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${job.status === 'pending' || job.status === 'failed' || job.status === 'cancelled' ? `<button class="fu-send-now-btn" onclick="sendFuNow('${job.id}')">Send now</button>` : ''}
                        ${job.status === 'pending' || job.status === 'failed' || job.status === 'cancelled' ? `<button class="fu-send-now-btn" style="background:#F59E0B;" onclick="openRescheduleModal('${job.id}', ${job.scheduledFor}, ${job.step}, '${job.contact?.email}')">Reschedule</button>` : ''}
                        ${job.status === 'pending' || job.status === 'failed' ? `<button class="fu-cancel-btn" onclick="cancelFuJob('${job.id}')">Cancel</button>` : ''}
                        ${job.status === 'sent' ? '—' : ''}
                    </td>
                </tr>`;
            }).join('');

            if (typeof updateAdvancedAnalytics === 'function') updateAdvancedAnalytics();
            if (document.getElementById('fuCalendarPopup')?.style.display === 'block') fuCalendar.render();
        }


        // --- Follow-up Calendar Logic ---
        window.fuCalendar = new AdsidolCalendar({
            popupId: 'fuCalendarPopup',
            gridId: 'calGrid',
            titleId: 'calMonthTitle',
            labelId: 'fuDateLabel',
            triggerId: 'fuCalendarBtn',
            getCounts: () => {
                const counts = {};
                fuJobs.forEach(j => {
                    if (['pending', 'scheduled', 'failed'].includes(j.status)) {
                        try {
                            const d = new Date(j.scheduledFor).toISOString().split('T')[0];
                            counts[d] = (counts[d] || 0) + 1;
                        } catch(e) {}
                    }
                });
                return counts;
            },
            onSelect: () => renderFuDashboard()
        });

        window.toggleFuCalendar = () => fuCalendar.toggle();
        window.changeFuMonth = (d) => fuCalendar.changeMonth(d);
        window.setFuDateFilter = (s, e) => fuCalendar.setRange(s, e);
        window.setFuDateToToday = () => fuCalendar.setToToday();

        window.handleFuDateClick = (dateStr) => {
            if (!fuCalendar.startDate || (fuCalendar.startDate && fuCalendar.endDate)) {
                fuCalendar.setRange(dateStr, null);
            } else {
                if (dateStr < fuCalendar.startDate) {
                    fuCalendar.setRange(dateStr, fuCalendar.startDate);
                } else if (dateStr === fuCalendar.startDate) {
                    fuCalendar.setRange(null, null);
                } else {
                    fuCalendar.setRange(fuCalendar.startDate, dateStr);
                    fuCalendar.close();
                }
            }
        };

        window.handleHistDateClick = (dateStr) => {
            if (!historyCalendar.startDate || (historyCalendar.startDate && historyCalendar.endDate)) {
                historyCalendar.setRange(dateStr, null);
            } else {
                if (dateStr < historyCalendar.startDate) {
                    historyCalendar.setRange(dateStr, historyCalendar.startDate);
                } else if (dateStr === historyCalendar.startDate) {
                    historyCalendar.setRange(null, null);
                } else {
                    historyCalendar.setRange(historyCalendar.startDate, dateStr);
                    historyCalendar.close();
                }
            }
        };


        window.sendFuNow = async function (jobId) {
            if (!gmailConnected) { showToast('Connect Gmail first', 'warning'); return; }
            showToast('Sending follow-up…', 'info', 3000);
            try {
                const res = await fetch(`${BACKEND.baseUrl}/api/followup?action=send`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': BACKEND.apiKey }, body: JSON.stringify({ jobId }) });
                const data = await res.json();
                if (data.ok) { showToast(`Follow-up F${data.step} sent!`, 'success'); loadFollowupDashboard(); }
                else showToast(`Send failed: ${data.error}`, 'error', 6000);
            } catch (e) { showToast('Network error', 'error'); }
        };

        window.cancelFuJob = async function (jobId) {
            try {
                const res = await fetch(`${BACKEND.baseUrl}/api/followup?action=cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': BACKEND.apiKey }, body: JSON.stringify({ jobId }) });
                const data = await res.json();
                if (data.ok) { showToast('Follow-up cancelled', 'info'); loadFollowupDashboard(); }
            } catch (e) { showToast('Network error', 'error'); }
        };

        window.openRescheduleModal = function (jobId, scheduledFor, step, email) {
            document.getElementById('reschedJobId').value = jobId;
            document.getElementById('reschedSubtitle').textContent = `Step ${step} for ${email}`;
            
            // Format current scheduledFor into local date/time inputs
            let timeToUse = scheduledFor;
            if (timeToUse < Date.now()) {
                timeToUse = Date.now() + 5 * 60000; // default to 5 minutes from now if the original was in the past
            }
            
            const dateObj = new Date(timeToUse);
            const dateStr = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
            const timeStr = String(dateObj.getHours()).padStart(2, '0') + ':' + String(dateObj.getMinutes()).padStart(2, '0');
            
            document.getElementById('reschedDate').value = dateStr;
            document.getElementById('reschedTime').value = timeStr;
            
            document.getElementById('rescheduleModal').style.display = 'flex';
        };

        document.getElementById('reschedCancel').addEventListener('click', () => {
            document.getElementById('rescheduleModal').style.display = 'none';
        });

        document.getElementById('reschedSave').addEventListener('click', async () => {
            const jobId = document.getElementById('reschedJobId').value;
            const dateVal = document.getElementById('reschedDate').value;
            const timeVal = document.getElementById('reschedTime').value;
            
            if (!dateVal || !timeVal) { showToast('Please select both date and time', 'warning'); return; }
            
            const [y, m, d] = dateVal.split('-');
            const [hr, min] = timeVal.split(':');
            const newTimestamp = new Date(Date.parse(`${y}-${m}-${d}T${hr}:${min}:00`)).getTime();
            
            if (newTimestamp <= Date.now()) {
                showToast('Scheduled time must be in the future', 'warning'); return;
            }
            
            showToast('Rescheduling...', 'info');
            try {
                const res = await fetch(`${BACKEND.baseUrl}/api/followup?action=reschedule`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'x-api-key': BACKEND.apiKey }, 
                    body: JSON.stringify({ jobId, newTimestamp }) 
                });
                const data = await res.json();
                if (data.ok) { 
                    showToast('Follow-up rescheduled!', 'success'); 
                    document.getElementById('rescheduleModal').style.display = 'none';
                    loadFollowupDashboard(); 
                } else {
                    showToast(`Error: ${data.error}`, 'error');
                }
            } catch (e) { showToast('Network error', 'error'); }
        });

        document.getElementById('sendDueBtn').addEventListener('click', async () => {
            if (!gmailConnected) { showToast('Connect Gmail first', 'warning'); return; }
            showToast('Sending all due follow-ups…', 'info', 4000);
            try {
                const res = await fetch(`${BACKEND.baseUrl}/api/followup?action=send-due`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': BACKEND.apiKey } });
                const data = await res.json();
                if (data.ok) { showToast(`Sent ${data.sent} follow-ups${data.failed ? `, ${data.failed} failed` : ''}`, data.failed ? 'warning' : 'success'); loadFollowupDashboard(); }
            } catch (e) { showToast('Network error', 'error'); }
        });

        document.getElementById('refreshFuBtn').addEventListener('click', loadFollowupDashboard);

        // ═══════════════════════════════════════════════
        // EDIT CONTACT MODAL
        // ═══════════════════════════════════════════════
        function openEditModal(ri) {
            const c = contacts[ri]; editingContactIndex = ri;
            document.getElementById('editName').value = c.name;
            document.getElementById('editCompany').value = c.company;
            document.getElementById('editEmail').value = c.email;
            document.getElementById('editVertical').value = c.vertical;
            document.getElementById('editLocation').value = c.location;
            document.getElementById('editModal').style.display = 'flex';
        }
        document.getElementById('editModalCancel').addEventListener('click', () => { document.getElementById('editModal').style.display = 'none'; });
        document.getElementById('editModal').addEventListener('click', e => { if (e.target === document.getElementById('editModal')) document.getElementById('editModal').style.display = 'none'; });
        document.getElementById('editModalSave').addEventListener('click', () => {
            if (editingContactIndex < 0) return;
            const email = document.getElementById('editEmail').value.trim();
            if (!email.includes('@')) { showToast('Enter a valid email', 'error'); return; }
            const dup = contacts.findIndex((c, i) => i !== editingContactIndex && c.email.toLowerCase() === email.toLowerCase());
            if (dup !== -1) { showToast('Email already exists for another contact', 'error'); return; }
            const c = contacts[editingContactIndex];
            c.name = document.getElementById('editName').value.trim();
            c.company = document.getElementById('editCompany').value.trim();
            c.email = email;
            c.vertical = document.getElementById('editVertical').value;
            c.location = document.getElementById('editLocation').value.trim();
            c.timezone = detectTimezone(c.location || c.company || 'United States');
            filteredContacts = [...contacts]; applyFilters();
            document.getElementById('editModal').style.display = 'none';
            showToast(`${c.name} updated`, 'success'); saveState();
        });

        // ═══════════════════════════════════════════════
        // TEST EMAIL MODAL
        // ═══════════════════════════════════════════════
        document.getElementById('testBtn').addEventListener('click', () => {
            if (!gmailConnected) { showToast('Connect Gmail first', 'warning'); return; }
            document.getElementById('testEmailModal').style.display = 'flex';
        });
        document.getElementById('testEmailCancel').addEventListener('click', () => { document.getElementById('testEmailModal').style.display = 'none'; });
        document.getElementById('testEmailModal').addEventListener('click', e => { if (e.target === document.getElementById('testEmailModal')) document.getElementById('testEmailModal').style.display = 'none'; });
        document.getElementById('testEmailSend').addEventListener('click', async () => {
            const email = document.getElementById('testEmailInput').value.trim();
            const vertical = document.getElementById('testEmailVertical').value;
            if (!email.includes('@')) { showToast('Enter a valid email address', 'error'); return; }
            document.getElementById('testEmailModal').style.display = 'none';
            const tpl = templates[vertical];
            if (!tpl || !tpl.subject || !tpl.body) { showToast('No saved template found for this vertical', 'error'); return; }
            showToast(`Sending test to ${email}...`, 'info');
            try {
                const res = await fetch(`${BACKEND.baseUrl}/api/send`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': BACKEND.apiKey }, body: JSON.stringify({ contact: { first_name: 'Test', company_name: 'Test Co', vertical, email, name: 'Test', company: 'Test Co' }, subject: tpl.subject, body: tpl.body }) });
                const data = await res.json();
                data.ok ? showToast(`Test sent to ${email}`, 'success') : showToast(`Send failed: ${data.error}`, 'error', 6000);
            } catch (e) { showToast('Could not reach backend - Network or CORS error', 'error'); }
        });

        async function sendManualNow(ri) {
            const contact = contacts[ri];
            if (!gmailConnected) { showToast('Connect Gmail first', 'warning'); return; }
            if (contact.status === 'sent') return;

            const tpl = templates[contact.vertical];
            if (!tpl || !tpl.subject || !tpl.body) { showToast('No template saved for ' + contact.vertical, 'warning'); return; }

            if (!confirm(`Are you sure you want to send the "${contact.vertical}" email to ${contact.email} immediately?`)) return;

            showToast(`Initiating manual send to ${contact.name}...`, 'info');
            try {
                const res = await fetch(`${BACKEND.baseUrl}/api/send`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'x-api-key': BACKEND.apiKey }, 
                    body: JSON.stringify({ 
                        contact, 
                        subject: tpl.subject, 
                        body: tpl.body,
                        followups: followupTemplates[contact.vertical] || [],
                        signature: emailSignature
                    }) 
                });
                const data = await res.json();
                if (data.ok) {
                    showToast(`Successfully sent! Status will update shortly.`, 'success');
                    contact.status = 'sent';
                    updateDashboard();
                    updateStats();
                    saveState();
                } else {
                    showToast(`Manual send failed: ${data.error}`, 'error', 7000);
                }
            } catch (e) { showToast('Could not reach backend', 'error'); }
        }

        // ═══════════════════════════════════════════════
        // GMAIL CONNECTION
        // ═══════════════════════════════════════════════
        // Auto-check on page load — SILENT: never opens OAuth popup
        async function autoCheckGmailStatus() {
            if (!currentApiKey) return;
            try {
                const res = await fetch(`${BACKEND.baseUrl}/api/status`, { headers: { 'x-api-key': BACKEND.apiKey } });
                const data = await res.json();
                if (data.connected) {
                    gmailConnected = true;
                    document.getElementById('headerGmailDot').classList.add('connected');
                    document.getElementById('headerGmailStatus').textContent = data.email || 'Connected';
                    document.getElementById('mobileGmailDot').classList.add('connected');
                    document.getElementById('mobileGmailStatus').textContent = data.email || 'Connected';
                    document.getElementById('headerConnectGmail').innerHTML = `✅ ${currentUser?.name || 'Connected'}`;
                    document.getElementById('headerConnectGmail').style.cssText = 'background:linear-gradient(135deg,var(--success),#059669);color:white;padding:9px 16px;font-size:13px;border-radius:14px;cursor:pointer;border:none;';
                    document.getElementById('mobileConnectGmail').innerHTML = `✅ ${data.email || 'Gmail'}`;
                    document.getElementById('mobileConnectGmail').style.background = 'linear-gradient(135deg,var(--success),#059669)';
                    const banner = document.querySelector('.demo-banner');
                    if (banner) banner.style.display = 'none';
                    showToast(`Gmail connected — sending as ${data.senderEmail || data.email}`, 'success');
                    
                    // Start auto-syncing when connected
                    startPolling();
                }
                // If not connected: do nothing silently — user must click Connect button
            } catch (e) { console.warn('Auto Gmail status check failed:', e.message); }
        }

        // Manual connect — called only when user CLICKS the button
        async function checkGmailStatus() {
            if (!currentApiKey) { showToast('Please sign in first', 'warning'); showLoginModal(); return; }
            try {
                const res = await fetch(`${BACKEND.baseUrl}/api/status`, { headers: { 'x-api-key': BACKEND.apiKey } });
                const data = await res.json();
                if (data.connected) {
                    gmailConnected = true;
                    document.getElementById('headerGmailDot').classList.add('connected');
                    document.getElementById('headerGmailStatus').textContent = data.email || 'Connected';
                    document.getElementById('mobileGmailDot').classList.add('connected');
                    document.getElementById('mobileGmailStatus').textContent = data.email || 'Connected';
                    document.getElementById('headerConnectGmail').innerHTML = `✅ ${currentUser?.name || 'Connected'}`;
                    document.getElementById('headerConnectGmail').style.cssText = 'background:linear-gradient(135deg,var(--success),#059669);color:white;padding:9px 16px;font-size:13px;border-radius:14px;cursor:pointer;border:none;';
                    document.getElementById('mobileConnectGmail').innerHTML = `✅ ${data.email || 'Gmail'}`;
                    document.getElementById('mobileConnectGmail').style.background = 'linear-gradient(135deg,var(--success),#059669)';
                    const banner = document.querySelector('.demo-banner');
                    if (banner) banner.style.display = 'none';
                    showToast(`Gmail connected — sending as ${data.senderEmail || data.email}`, 'success');
                    
                    // Start auto-syncing when connected
                    startPolling();
                } else {
                    // Only open OAuth when user explicitly clicks Connect
                    if (data.code === 'TOKEN_EXPIRED') {
                        showToast(`Token expired for ${currentUser?.name} — opening re-auth…`, 'warning');
                    } else {
                        showToast('Gmail not connected — opening sign-in…', 'info', 4000);
                    }
                    const authUser = currentUser?.id || 'paramjit';
                    window.open(`${BACKEND.baseUrl}/api/auth?user=${authUser}`, '_blank', 'width=600,height=700');
                    showToast('Complete Gmail sign-in in the popup, then click Connect again', 'info', 7000);
                }
            } catch (e) { showToast('Could not reach backend — check BACKEND_URL', 'error', 7000); }
        }
        document.getElementById('headerConnectGmail').addEventListener('click', checkGmailStatus);
        document.getElementById('mobileConnectGmail').addEventListener('click', () => { checkGmailStatus(); closeMobileMenu(); });

        // ═══════════════════════════════════════════════
        // LOGIN MODAL LOGIC
        // ═══════════════════════════════════════════════

        function showLoginModal() {
            document.getElementById('loginModal').style.display = 'flex';
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('loginLoading').style.display = 'none';
            document.getElementById('loginError').style.display = 'none';
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
        }

        function hideLoginModal() {
            document.getElementById('loginModal').style.display = 'none';
        }

        // Sign in confirm
        document.getElementById('loginSubmitBtn').addEventListener('click', async () => {
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const errorDiv = document.getElementById('loginError');

            if (!email || !password) {
                errorDiv.textContent = 'Please enter both email and password';
                errorDiv.style.display = 'block';
                return;
            }

            errorDiv.style.display = 'none';
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('loginLoading').style.display = 'block';

            try {
                const res = await fetch(`${BACKEND_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();

                if (res.ok && data.ok) {
                    // Success
                    const founder = {
                        id: data.user.id,
                        name: data.user.name,
                        email: data.user.email
                    };
                    saveSession(founder, data.apiKey);
                    hideLoginModal();
                    showToast(`Welcome back, ${founder.name}! 👋`, 'success');

                    // Update header to show user name
                    const userBadge = document.getElementById('headerGmailStatus');
                    if (userBadge) userBadge.textContent = founder.name;

                    // Auto-check Gmail status silently after login
                    autoCheckGmailStatus();
                    // Load templates from cloud
                    loadTemplatesFromCloud();
                    
                    // Start auto-syncing after login
                    startPolling();
                } else {
                    // Failed
                    errorDiv.textContent = data.error || 'Invalid email or password';
                    errorDiv.style.display = 'block';
                    document.getElementById('loginLoading').style.display = 'none';
                    document.getElementById('loginForm').style.display = 'block';
                }
            } catch (e) {
                console.error('Login error:', e);
                errorDiv.textContent = 'Cannot reach backend — check your network';
                errorDiv.style.display = 'block';
                document.getElementById('loginLoading').style.display = 'none';
                document.getElementById('loginForm').style.display = 'block';
            }
        });

        // Enter key submits form
        document.getElementById('loginPassword').addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('loginSubmitBtn').click();
        });
        document.getElementById('loginEmail').addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('loginPassword').focus();
        });

        // ═══════════════════════════════════════════════
        // PAGE LOAD — restore session or show login
        // ═══════════════════════════════════════════════
        window.addEventListener('load', () => {
            if (loadSession()) {
                // Already logged in from this browser session
                hideLoginModal();
                const userBadge = document.getElementById('headerGmailStatus');
                if (userBadge) userBadge.textContent = currentUser.name;
                autoCheckGmailStatus(); // Silent check — never opens OAuth popup
            } else {
                // Show login modal
                showLoginModal();
            }
        });

        // ═══════════════════════════════════════════════
        // SEND TIME / LIMIT / DATE
        // ═══════════════════════════════════════════════
        function formatTime(val) { return new Date('2000-01-01 ' + val).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); }
        function syncTime(val, skipSave = false) { 
            document.getElementById('displayTime').textContent = formatTime(val); 
            document.getElementById('infoTime').textContent = formatTime(val); 
            updateDashboard(); 
            if (!skipSave) saveState(); 
        }
        document.getElementById('sendTime').addEventListener('change', e => syncTime(e.target.value));
        document.getElementById('timeHourDown').addEventListener('click', () => { const i = document.getElementById('sendTime'); const [h, m] = i.value.split(':').map(Number); i.value = String((h + 23) % 24).padStart(2, '0') + ':' + String(m).padStart(2, '0'); syncTime(i.value); });
        document.getElementById('timeHourUp').addEventListener('click', () => { const i = document.getElementById('sendTime'); const [h, m] = i.value.split(':').map(Number); i.value = String((h + 1) % 24).padStart(2, '0') + ':' + String(m).padStart(2, '0'); syncTime(i.value); });
        function syncLimit(val, skipSave = false) { 
            document.getElementById('displayLimit').textContent = val; 
            document.getElementById('infoLimit').textContent = val; 
            const pct = ((val - 10) / (490) * 100).toFixed(1); 
            document.getElementById('sendLimit').style.setProperty('--pct', pct + '%'); 
            if (!skipSave) saveState(); 
        }
        document.getElementById('sendLimit').addEventListener('input', e => syncLimit(e.target.value));
        document.getElementById('limitDown').addEventListener('click', () => { const s = document.getElementById('sendLimit'); s.value = Math.max(10, parseInt(s.value) - 10); syncLimit(s.value); });
        document.getElementById('limitUp').addEventListener('click', () => { const s = document.getElementById('sendLimit'); s.value = Math.min(500, parseInt(s.value) + 10); syncLimit(s.value); });
        function syncDate(val, skipSave = false) { 
            if (!val) return; 
            const d = new Date(val + 'T00:00:00'); 
            document.getElementById('displayDate').textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); 
            if (!skipSave) saveState(); 
        }
        document.getElementById('startDate').addEventListener('change', e => syncDate(e.target.value));

        function syncInterval(val, skipSave = false) {
            let display = val + 's';
            if (val >= 60) {
                const mins = Math.floor(val / 60);
                const secs = val % 60;
                display = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
            }
            document.getElementById('displayInterval').textContent = display;
            const pct = ((val - 15) / (105) * 100).toFixed(1);
            document.getElementById('sendInterval').style.setProperty('--pct', pct + '%');
            if (!skipSave) saveState();
        }
        document.getElementById('sendInterval').addEventListener('input', e => syncInterval(e.target.value));
        document.getElementById('intervalDown').addEventListener('click', () => { const s = document.getElementById('sendInterval'); s.value = Math.max(15, parseInt(s.value) - 15); syncInterval(s.value); });
        document.getElementById('intervalUp').addEventListener('click', () => { const s = document.getElementById('sendInterval'); s.value = Math.min(120, parseInt(s.value) + 15); syncInterval(s.value); });

        // ═══════════════════════════════════════════════
        // SCHEDULE CAMPAIGN + AUTO-QUEUE FOLLOW-UPS
        // ═══════════════════════════════════════════════
        document.getElementById('scheduleBtn').addEventListener('click', async () => {
            if (!gmailConnected) { showToast('Connect Gmail first', 'warning'); return; }
            if (contacts.length === 0) { showToast('Please upload contacts first', 'warning'); return; }
            const pending = contacts.filter(c => c.status === 'pending');
            if (pending.length === 0) { showToast('No pending contacts to schedule', 'info'); return; }
            const sendTime = document.getElementById('sendTime').value;
            const dailyLimit = parseInt(document.getElementById('sendLimit').value);
            const intervalSecondsStr = document.getElementById('sendInterval') ? document.getElementById('sendInterval').value : "15";
            const intervalSeconds = parseInt(intervalSecondsStr);
            const toSend = pending.slice(0, dailyLimit);

            toSend.forEach(c => { c.status = 'scheduled'; c.scheduledFor = calculateSendTime(c, sendTime); });
            filteredContacts = [...contacts]; updateDashboard(); updateStats(); saveState();
            showToast(`Scheduling ${toSend.length} emails in the cloud via Upstash...`, 'info', 5000);

            const scheduleBtn = document.getElementById('scheduleBtn');
            const originalText = scheduleBtn.innerHTML;
            scheduleBtn.disabled = true;
            scheduleBtn.innerHTML = '<span class="icon-3d icon-3d-slate"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg></span> Scheduling...';

            const batch = toSend.map(contact => {
                const tpl = templates[contact.vertical] || templates[Object.keys(templates)[0]];
                let followups = [];
                const fuSteps = followupTemplates[contact.vertical];
                if (fuSteps && fuSteps.some(f => f.subject && f.body)) {
                    followups = fuSteps.filter(f => f.subject && f.body);
                }
                return {
                    contact: {
                        email: contact.email,
                        first_name: contact.name ? contact.name.split(' ')[0] : '',
                        company_name: contact.company,
                        vertical: contact.vertical,
                        name: contact.name,
                        company: contact.company
                    },
                    scheduledFor: contact.scheduledFor,
                    subject: tpl.subject,
                    body: tpl.body,
                    signature: emailSignature.name ? emailSignature : null,
                    followups: followups
                };
            });

            try {
                const res = await fetch(`${BACKEND.baseUrl}/api/schedule-batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': BACKEND.apiKey },
                    body: JSON.stringify({ batch, intervalSeconds })
                });

                const data = await res.json();

                if (data.ok) {
                    showToast('Campaign successfully scheduled online! You can safely close this tab.', 'success', 8000);
                } else {
                    showToast('Scheduling failed: ' + (data.error || 'Unknown error'), 'error', 8000);
                    toSend.forEach(c => c.status = 'pending');
                }
            } catch (e) {
                console.error('Schedule Error:', e);
                showToast('Failed to connect to backend.', 'error');
                toSend.forEach(c => c.status = 'pending');
            }

            scheduleBtn.disabled = false;
            scheduleBtn.innerHTML = originalText;

            filteredContacts = [...contacts]; updateDashboard(); updateStats(); saveState();


            // Refresh follow-up dashboard if visible
            if (document.getElementById('followupDashboard').style.display !== 'none') loadFollowupDashboard();
        });

        // ═══════════════════════════════════════════════
        // FILTERS
        // ═══════════════════════════════════════════════
        document.getElementById('searchContacts').addEventListener('input', applyFilters);
        document.getElementById('filterVertical').addEventListener('change', applyFilters);
        document.getElementById('filterStatus').addEventListener('change', applyFilters);
        function applyFilters() {
            const search = document.getElementById('searchContacts').value.toLowerCase(), vertical = document.getElementById('filterVertical').value, status = document.getElementById('filterStatus').value;
            filteredContacts = contacts.filter(c => (!search || c.name.toLowerCase().includes(search) || c.email.toLowerCase().includes(search) || c.company.toLowerCase().includes(search)) && (!vertical || c.vertical === vertical) && (!status || c.status === status));
            
            const cards = [
                { id: 'topCardAll', val: '', color: 'var(--blue-500)' },
                { id: 'topCardScheduled', val: 'scheduled', color: '#F59E0B' },
                { id: 'topCardSent', val: 'sent', color: '#10B981' },
                { id: 'topCardPending', val: 'pending', color: '#94A3B8' }
            ];

            cards.forEach(c => {
                const el = document.getElementById(c.id);
                if (!el) return;
                if (status === c.val) {
                    el.style.border = `1.5px solid ${c.color}`;
                    el.style.boxShadow = `0 4px 12px ${c.color}25`;
                    el.style.transform = `scale(1.02)`;
                    el.style.borderRadius = `12px`;
                } else {
                    el.style.border = `1px solid var(--border)`;
                    el.style.boxShadow = `none`;
                    el.style.transform = `scale(1)`;
                    el.style.borderRadius = `12px`;
                }
            });

            updateDashboard();
        }
        
        window.setTopFilter = function(val) {
            document.getElementById('filterStatus').value = val;
            applyFilters();
            const section = document.getElementById('campaignsSection');
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        document.getElementById('selectAll').addEventListener('change', e => { filteredContacts.forEach(c => c.selected = e.target.checked); updateDashboard(); updateBulkBar(); });

        // ═══════════════════════════════════════════════
        // EXPORT
        // ═══════════════════════════════════════════════
        document.getElementById('exportBtn').addEventListener('click', () => {
            const csv = ['Name,Company,Vertical,Email,Timezone,Status', ...contacts.map(c => `${c.name},${c.company},${c.vertical},${c.email},${c.timezone},${c.status}`)].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' }), url = URL.createObjectURL(blob), a = document.createElement('a');
            a.href = url; a.download = 'adsidol-campaign-export.csv'; a.click();
            showToast('Export downloaded!', 'success');
        });

        // ═══════════════════════════════════════════════
        // ADVANCED ANALYTICS (DYNAMIC DASHBOARD)
        // ═══════════════════════════════════════════════
        function updateAdvancedAnalytics() {
            let sentCount = 0;
            let failedCount = 0;
            let pendingCount = contacts.filter(c => c.status === 'pending' || c.status === 'scheduled').length;

            const verticalCounts = {};

            // Aggregate initial contacts
            contacts.forEach(c => {
                if (c.vertical) {
                    if (!verticalCounts[c.vertical]) verticalCounts[c.vertical] = 0;
                    verticalCounts[c.vertical]++;
                    if (c.status === 'sent') sentCount++;
                    if (c.status === 'failed') failedCount++;
                }
            });

            // Aggregate follow-ups
            fuJobs?.forEach(j => {
                const vert = j.contact?.vertical;
                if (vert) {
                    if (!verticalCounts[vert]) verticalCounts[vert] = 0;
                    verticalCounts[vert]++;
                }
                if (j.status === 'sent') sentCount++;
                if (j.status === 'failed') failedCount++;
                if (j.status === 'pending' || j.status === 'scheduled') pendingCount++;
            });

            const totalProcessed = sentCount + failedCount;
            const deliveryRate = totalProcessed > 0 ? ((sentCount / totalProcessed) * 100).toFixed(1) : 0;

            // Delivery Rate Card
            const drEl = document.getElementById('advDeliveryRate');
            const drSubEl = document.getElementById('advDeliverySub');
            if (drEl && drSubEl) {
                drEl.textContent = deliveryRate + '%';
                drSubEl.textContent = totalProcessed > 0 ? `${sentCount} successful out of ${totalProcessed}` : 'Awaiting data';
                drSubEl.className = `analytics-change ${(deliveryRate > 90 && totalProcessed > 0) ? 'positive' : ''}`;
            }

            // Queue Health Card
            const qhEl = document.getElementById('advQueueHealth');
            if (qhEl) qhEl.textContent = `${pendingCount} / ${sentCount}`;

            // Top Vertical Card
            let topVert = '—';
            let topVertCount = 0;
            let totalVolume = 0;
            Object.entries(verticalCounts).forEach(([v, count]) => {
                totalVolume += count;
                if (count > topVertCount) { topVertCount = count; topVert = v; }
            });

            const tvEl = document.getElementById('advTopVertical');
            const tvSubEl = document.getElementById('advTopVerticalSub');
            if (tvEl && tvSubEl) {
                tvEl.textContent = topVert;
                tvEl.title = topVert;
                if (totalVolume > 0) {
                    let pct = ((topVertCount / totalVolume) * 100).toFixed(1);
                    tvSubEl.textContent = `${pct}% of total volume`;
                    tvSubEl.className = 'analytics-change positive';
                } else {
                    tvSubEl.textContent = 'Awaiting data';
                    tvSubEl.className = 'analytics-change';
                }
            }

            // Vertical Breakdown Chart
            const breakdownContainer = document.getElementById('verticalBreakdownContainer');
            if (breakdownContainer) {
                if (totalVolume === 0) {
                    breakdownContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">No data to display yet.</div>';
                } else {
                    const sortedVerts = Object.entries(verticalCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
                    breakdownContainer.innerHTML = sortedVerts.map(([v, count]) => {
                        let pct = ((count / totalVolume) * 100).toFixed(1);
                        return `
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
                                <span style="color: var(--text);">${escHtml(v)}</span>
                                <span style="color: var(--text-muted);">${count} (${pct}%)</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; position: relative;">
                                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${pct}%; background: linear-gradient(90deg, var(--blue-500), var(--indigo-500)); border-radius: 4px; transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                            </div>
                        </div>`;
                    }).join('');
                }
            }
        }

        // ═══════════════════════════════════════════════
        // RESTORE FROM LOCALSTORAGE
        // ═══════════════════════════════════════════════
        (function restoreState() {
            const saved = loadState();
            const today = new Date();
            document.getElementById('startDate').valueAsDate = today;
            
            // Initialization Phase: UI update only (no saveState while still loading)
            syncDate(today.toISOString().split('T')[0], true);
            syncTime('11:15', true); 
            syncLimit(50, true);
            if (document.getElementById('sendInterval')) syncInterval(15, true);

            if (!saved) { updateStats(); return; }
            if (saved.darkMode) setDark(true);
            if (saved.templates) templates = saved.templates;
            if (saved.followupTemplates) {
                Object.assign(followupTemplates, saved.followupTemplates);
            }
            if (saved.sendTime) { document.getElementById('sendTime').value = saved.sendTime; syncTime(saved.sendTime); }
            if (saved.sendLimit) { document.getElementById('sendLimit').value = saved.sendLimit; syncLimit(saved.sendLimit); }
            if (saved.sendInterval && document.getElementById('sendInterval')) { document.getElementById('sendInterval').value = saved.sendInterval; syncInterval(saved.sendInterval); }
            // Restore email signature
            if (saved.emailSignature) {
                emailSignature = { ...emailSignature, ...saved.emailSignature };
                const fieldMap = { name:'sigName', title:'sigTitle', email:'sigEmail', linkedin:'sigLinkedin', teams:'sigTeams', website:'sigWebsite' };
                Object.entries(fieldMap).forEach(([key, id]) => {
                    const el = document.getElementById(id);
                    if (el) el.value = emailSignature[key] || '';
                });
                updateSignaturePreview();
            }
            // Start date always defaults to today — not restored from saved state
            if (saved.savedTemplatesList) {
                saved.savedTemplatesList.forEach(v => {
                    savedTemplates.add(v);
                    document.querySelectorAll('.template-card').forEach(card => {
                        if (card.dataset.vertical === v && !card.querySelector('.template-saved-badge'))
                            card.insertAdjacentHTML('beforeend', '<div class="template-saved-badge"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Customised</div>');
                    });
                });
            }
            if (saved.contacts && saved.contacts.length > 0) {
                contacts = saved.contacts;
                filteredContacts = [...contacts];
                document.getElementById('uploadPreview').style.display = 'block';
                document.getElementById('uploadedFileName').textContent = 'Restored from last session';
                document.getElementById('previewCount').textContent = contacts.length;
                document.getElementById('scheduleBtn').disabled = false;
                const pb = document.getElementById('persistBadge'); if (pb) pb.style.display = 'inline-flex';
                updateDashboard();
                showToast(`${contacts.length} contacts restored from last session`, 'info');
            }
            if (loadSession()) {
                fetchCloudAnalytics(); // Fetch analytics on load
                loadTemplatesFromCloud(); // Sync templates on load
                loadContactsFromCloud(); // Sync contacts on load
            }
            updateStats();
            loadFollowupDashboard(); // Load follow-up queue on page load
            
            // Start polling if session is already active
            if (currentApiKey) startPolling();

            // Follow-up Widgets Interactivity
            document.querySelectorAll('.fu-widget').forEach(w => {
                w.addEventListener('click', () => {
                    w.classList.toggle('active');
                    // Ensure at least one is selected
                    if (!document.querySelector('.fu-widget.active')) w.classList.add('active');
                    renderFuDashboard();
                });
            });
        })();