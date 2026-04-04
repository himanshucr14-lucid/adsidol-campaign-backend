// api/followup.js
// All follow-up scheduling and management for Adsidol Campaign Manager.
//
// Actions (via ?action= query param):
//   POST  schedule  — Schedule up to 4 follow-ups for a contact
//   POST  send      — Manually send a specific follow-up job now
//   POST  cancel    — Cancel a job (by jobId) or all jobs for an email
//   GET   list      — List all follow-up jobs for this user
//   GET   stats     — Summary counts for this user
//
// All requests require:  Header x-api-key: <founder's key>
// Jobs are persistently stored in Upstash Redis via lib/store.js

const { getOAuthClient, google } = require('../lib/gmail');
const { buildRawEmail, personalise } = require('../lib/email');
const USERS = [
    {
        id: 'paramjit',
        name: 'Paramjit',
        senderEmail: 'Paramjit@adsidol.com',
        get apiKey() { return process.env.PARAMJIT_API_KEY; },
        get accessToken() { return process.env.PARAMJIT_ACCESS_TOKEN; },
        get refreshToken() { return process.env.PARAMJIT_REFRESH_TOKEN; },
    },
    {
        id: 'moni',
        name: 'Moni',
        senderEmail: 'moni@adsidol.com',
        get apiKey() { return process.env.MONI_API_KEY; },
        get accessToken() { return process.env.MONI_ACCESS_TOKEN; },
        get refreshToken() { return process.env.MONI_REFRESH_TOKEN; },
    },
    {
        id: 'ujjwal',
        name: 'Ujjwal',
        senderEmail: 'Ujjwal@adsidol.com',
        get apiKey() { return process.env.UJJWAL_API_KEY; },
        get accessToken() { return process.env.UJJWAL_ACCESS_TOKEN; },
        get refreshToken() { return process.env.UJJWAL_REFRESH_TOKEN; },
    },
    {
        id: 'hemleta',
        name: 'Hemleta',
        senderEmail: 'Hemleta@adsidol.com',
        get apiKey() { return process.env.HEMLETA_API_KEY; },
        get accessToken() { return process.env.HEMLETA_ACCESS_TOKEN; },
        get refreshToken() { return process.env.HEMLETA_REFRESH_TOKEN; },
    },
];

function getUserByApiKey(apiKey) {
    if (!apiKey) return null;
    return USERS.find(u => u.apiKey && u.apiKey === apiKey) || null;
}

function getUserById(id) {
    if (!id) return null;
    return USERS.find(u => u.id === id.toLowerCase()) || null;
}

const store = require('../lib/store');

function cors(req, res) {
    // Secure Dynamic CORS
    const reqOrigin = req.headers.origin || req.headers.referer || '';
    if (reqOrigin.includes('adsidol.com') || reqOrigin.includes('localhost') || reqOrigin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', reqOrigin.replace(/\/$/, ""));
    } else {
        res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://www.adsidol.com');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-api-key');
}

// Shared send logic (used by 'send' action and cron)
async function executeJob(job) {
    // Always look up fresh tokens at send time (handles token refresh)
    const sender = getUserById(job.userId);
    if (!sender) throw new Error(`Unknown user: ${job.userId}`);

    const auth = getOAuthClient(sender);
    const gmail = google.gmail({ version: 'v1', auth });

    const raw = buildRawEmail({
        name: sender.name,
        from: sender.senderEmail,
        to: job.contact.email,
        subject: personalise(job.subject, job.contact),
        body: personalise(job.body, job.contact),
        inReplyTo: job.originalMessageId,
        references: job.originalMessageId,
        signature: job.signature || null,
    });

    const params = { userId: 'me', requestBody: { raw } };
    if (job.originalThreadId) params.requestBody.threadId = job.originalThreadId;

    const result = await gmail.users.messages.send(params);
    return result.data;
}

module.exports = async (req, res) => {
    try {
        cors(req, res);
        if (req.method === 'OPTIONS') return res.status(200).end();

        const user = getUserByApiKey(req.headers['x-api-key']);
        if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

        const action = req.query.action;

        // ── LIST ─────────────────────────────────────────────────────────────────
        if (req.method === 'GET' && action === 'list') {
            const all = await store.getAllJobs();
            const userJobs = all.filter(j => j.userId === user.id);
            const vertical = req.query.vertical;
            return res.status(200).json({
                ok: true,
                jobs: vertical ? userJobs.filter(j => j.contact.vertical === vertical) : userJobs,
            });
        }

        // ── STATS ─────────────────────────────────────────────────────────────────
        if (req.method === 'GET' && action === 'stats') {
            const all = await store.getAllJobs();
            const userJobs = all.filter(j => j.userId === user.id);
            const stats = {
                total: userJobs.length,
                pending: userJobs.filter(j => j.status === 'pending').length,
                sent: userJobs.filter(j => j.status === 'sent').length,
                failed: userJobs.filter(j => j.status === 'failed').length,
                cancelled: userJobs.filter(j => j.status === 'cancelled').length,
                byVertical: {},
            };
            userJobs.forEach(j => {
                const v = j.contact.vertical || 'Unknown';
                if (!stats.byVertical[v]) stats.byVertical[v] = { total: 0, pending: 0, sent: 0, failed: 0, cancelled: 0 };
                stats.byVertical[v].total++;
                stats.byVertical[v][j.status] = (stats.byVertical[v][j.status] || 0) + 1;
            });
            return res.status(200).json({ ok: true, stats });
        }

        // ── SCHEDULE ──────────────────────────────────────────────────────────────
        if (req.method === 'POST' && action === 'schedule') {
            const { contact, followups, originalMessageId, originalThreadId } = req.body || {};

            if (!contact?.email || !followups?.length) {
                return res.status(400).json({ ok: false, error: 'Missing contact.email or followups array' });
            }

            // Cancel existing pending jobs for same contact + vertical + user
            const allJobs = await store.getAllJobs();
            const toReplace = allJobs.filter(
                j => j.userId === user.id &&
                    j.contact.email === contact.email &&
                    j.contact.vertical === contact.vertical &&
                    j.status === 'pending'
            );
            for (const j of toReplace) {
                j.status = 'cancelled';
                await store.updateJob(j);
            }
            if (toReplace.length) {
                console.log(`[${user.name}] Replaced ${toReplace.length} existing jobs for ${contact.email}`);
            }

            const now = Date.now();
            const newJobs = followups.slice(0, 4).map((fu, i) => ({
                id: `fu_${now}_${i}_${Math.random().toString(36).slice(2, 7)}`,
                userId: user.id,
                userName: user.name,
                step: fu.step || (i + 1),
                contact,
                subject: fu.subject,
                body: fu.body,
                delayDays: fu.delayDays || (i + 1) * 3,
                scheduledFor: now + (fu.delayDays || (i + 1) * 3) * 86400000,
                status: 'pending',
                originalMessageId: originalMessageId || null,
                originalThreadId: originalThreadId || null,
                sentAt: null,
                sentMessageId: null,
                error: null,
                createdAt: now,
            }));

            for (const job of newJobs) await store.saveJob(job);

            console.log(`[${user.name}] Scheduled ${newJobs.length} follow-ups for ${contact.email}`);
            return res.status(200).json({ ok: true, scheduled: newJobs.length, jobs: newJobs });
        }

        // ── SEND SPECIFIC JOB ─────────────────────────────────────────────────────
        if (req.method === 'POST' && action === 'send') {
            const { jobId } = req.body || {};
            if (!jobId) return res.status(400).json({ ok: false, error: 'Missing jobId' });

            const job = await store.getJob(jobId);
            if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
            if (job.userId !== user.id) return res.status(403).json({ ok: false, error: 'Forbidden — not your job' });
            if (job.status === 'sent') return res.status(409).json({ ok: false, error: 'Already sent' });
            if (job.status === 'cancelled') return res.status(409).json({ ok: false, error: 'Job was cancelled' });

            try {
                const result = await executeJob(job);
                job.status = 'sent';
                job.sentAt = Date.now();
                job.sentMessageId = result.id;
                await store.updateJob(job);

                // ── LOG ANALYTICS (Permanent Cloud Ledger) ──
                try {
                    await store.logEvent(user.id, {
                        type: 'followup',
                        date: Date.now(),
                        email: job.contact.email,
                        vertical: job.contact.vertical,
                        name: job.contact.name || job.contact.first_name || 'Unknown',
                        step: job.step
                    });
                } catch (logErr) {
                    console.error(`[Manual Analytics] Failed to log for ${job.contact.email}:`, logErr.message);
                }

                console.log(`[${user.name}] Follow-up step ${job.step} sent to ${job.contact.email}`);
                return res.status(200).json({ ok: true, messageId: result.id, step: job.step });

            } catch (err) {
                job.status = 'failed';
                job.error = err.message;
                await store.updateJob(job);
                const tokenExpired = err.message?.includes('invalid_grant');
                if (tokenExpired) return res.status(401).json({ ok: false, error: 'Token expired', code: 'TOKEN_EXPIRED' });
                return res.status(500).json({ ok: false, error: err.message });
            }
        }

        // ── RESCHEDULE ────────────────────────────────────────────────────────────
        if (req.method === 'POST' && action === 'reschedule') {
            const { jobId, newTimestamp } = req.body || {};
            if (!jobId || !newTimestamp) return res.status(400).json({ ok: false, error: 'Missing jobId or newTimestamp' });

            const job = await store.getJob(jobId);
            if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
            if (job.userId !== user.id) return res.status(403).json({ ok: false, error: 'Forbidden' });
            if (job.status === 'sent' || job.status === 'cancelled') {
                return res.status(409).json({ ok: false, error: `Cannot reschedule a ${job.status} job` });
            }

            job.scheduledFor = parseInt(newTimestamp, 10);
            job.status = 'pending'; // In case it was failed, rescheduling sets it back to pending
            job.error = null;
            await store.updateJob(job);

            console.log(`[${user.name}] Rescheduled job ${jobId} to ${new Date(job.scheduledFor).toISOString()}`);
            return res.status(200).json({ ok: true, rescheduledJob: job });
        }

        // ── CANCEL ────────────────────────────────────────────────────────────────
        if (req.method === 'POST' && action === 'cancel') {
            const { jobId, email, vertical } = req.body || {};

            if (jobId) {
                const job = await store.getJob(jobId);
                if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
                if (job.userId !== user.id) return res.status(403).json({ ok: false, error: 'Forbidden' });
                job.status = 'cancelled';
                await store.updateJob(job);
                return res.status(200).json({ ok: true, cancelled: 1 });
            }

            if (email) {
                const all = await store.getAllJobs();
                let count = 0;
                for (const j of all) {
                    if (j.userId === user.id && j.contact.email === email && j.status === 'pending') {
                        if (!vertical || j.contact.vertical === vertical) {
                            j.status = 'cancelled';
                            await store.updateJob(j);
                            count++;
                        }
                    }
                }
                return res.status(200).json({ ok: true, cancelled: count });
            }

            return res.status(400).json({ ok: false, error: 'Provide jobId or email to cancel' });
        }

        return res.status(400).json({ ok: false, error: `Unknown action: "${action}". Valid: schedule, send, cancel, list, stats` });
    } catch (e) {
        return res.status(500).json({ ok: false, error: "CRASH: " + String(e.message) });
    }
};
