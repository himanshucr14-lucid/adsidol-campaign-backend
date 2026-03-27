// api/followup.js
// Handles scheduling and sending follow-up emails
//
// POST /api/followup/schedule  — store a follow-up job
// POST /api/followup/send      — send a specific follow-up email now
// GET  /api/followup/list      — list all pending follow-up jobs
// POST /api/followup/cancel    — cancel a follow-up job

const { google } = require('googleapis');

// ─────────────────────────────────────────────
// In-memory store (persists across requests on
// Vercel serverless via module-level variable).
// For production, swap with a real DB (Supabase,
// PlanetScale, Upstash Redis, etc.)
// ─────────────────────────────────────────────
if (!global._followupJobs) global._followupJobs = [];
const jobs = global._followupJobs;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getOAuthClient() {
    const client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
    );
    client.setCredentials({
        access_token:  process.env.GMAIL_ACCESS_TOKEN,
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });
    return client;
}

function buildRawEmail({ from, to, subject, body, threadId, inReplyTo, references }) {
    const boundary = `boundary_${Date.now()}`;
    const headers = [
        `From: Adsidol Outreach <${from}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];
    // Thread the follow-up into the same Gmail thread if IDs provided
    if (inReplyTo)  headers.push(`In-Reply-To: ${inReplyTo}`);
    if (references) headers.push(`References: ${references}`);

    const email = [
        ...headers,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        ``,
        body,
        ``,
        `--${boundary}`,
        `Content-Type: text/html; charset="UTF-8"`,
        ``,
        `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.7;color:#0F172A;max-width:600px">`,
        body.split('\n').map(l => l ? `<p style="margin:0 0 12px">${l}</p>` : '<br>').join(''),
        `</div>`,
        ``,
        `--${boundary}--`
    ].join('\r\n');

    return Buffer.from(email).toString('base64url');
}

function personalise(template, contact) {
    return template
        .replace(/\{\{first_name\}\}/g,   contact.first_name   || contact.name?.split(' ')[0] || '')
        .replace(/\{\{company_name\}\}/g, contact.company_name || contact.company || '')
        .replace(/\{\{vertical\}\}/g,     contact.vertical     || '');
}

function authCheck(req) {
    return req.headers['x-api-key'] === process.env.ADSIDOL_API_KEY;
}

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || 'https://www.adsidol.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────
module.exports = async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (!authCheck(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    // Route on query param ?action=...
    const action = req.query.action;

    // ── LIST JOBS ──────────────────────────────
    if (req.method === 'GET' && action === 'list') {
        const vertical = req.query.vertical;
        const filtered = vertical
            ? jobs.filter(j => j.contact.vertical === vertical)
            : jobs;
        return res.status(200).json({ ok: true, jobs: filtered });
    }

    // ── SCHEDULE FOLLOW-UP ─────────────────────
    if (req.method === 'POST' && action === 'schedule') {
        const { contact, followups, originalMessageId, originalThreadId } = req.body;

        // followups = array of:
        // { step: 1..4, delayDays: number, subject: string, body: string }

        if (!contact?.email || !followups?.length) {
            return res.status(400).json({ ok: false, error: 'Missing contact.email or followups array' });
        }

        // Validate: max 4 follow-ups per contact per vertical
        const existingForContact = jobs.filter(
            j => j.contact.email === contact.email && j.contact.vertical === contact.vertical
        );
        if (existingForContact.length > 0) {
            // Remove old jobs for this contact+vertical to replace them
            const toRemove = new Set(existingForContact.map(j => j.id));
            const before = jobs.length;
            jobs.splice(0, jobs.length, ...jobs.filter(j => !toRemove.has(j.id)));
            console.log(`Replaced ${before - jobs.length} existing follow-up jobs for ${contact.email}`);
        }

        const now = Date.now();
        const newJobs = followups.slice(0, 4).map((fu, i) => ({
            id:              `fu_${now}_${i}_${Math.random().toString(36).slice(2, 7)}`,
            step:            fu.step || (i + 1),
            contact,
            subject:         fu.subject,
            body:            fu.body,
            delayDays:       fu.delayDays || (i + 1) * 3,
            scheduledFor:    now + (fu.delayDays || (i + 1) * 3) * 86400000,
            status:          'pending',   // pending | sent | failed | cancelled
            originalMessageId: originalMessageId || null,
            originalThreadId:  originalThreadId  || null,
            sentAt:          null,
            error:           null,
            createdAt:       now
        }));

        jobs.push(...newJobs);

        console.log(`Scheduled ${newJobs.length} follow-ups for ${contact.email} (${contact.vertical})`);
        return res.status(200).json({ ok: true, scheduled: newJobs.length, jobs: newJobs });
    }

    // ── SEND A SPECIFIC FOLLOW-UP NOW ──────────
    if (req.method === 'POST' && action === 'send') {
        const { jobId } = req.body;
        if (!jobId) return res.status(400).json({ ok: false, error: 'Missing jobId' });

        const job = jobs.find(j => j.id === jobId);
        if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
        if (job.status === 'sent') return res.status(409).json({ ok: false, error: 'Already sent' });
        if (job.status === 'cancelled') return res.status(409).json({ ok: false, error: 'Job was cancelled' });

        try {
            const auth = getOAuthClient();
            const gmail = google.gmail({ version: 'v1', auth });
            const from = process.env.GMAIL_SENDER_EMAIL;

            const personalisedSubject = personalise(job.subject, job.contact);
            const personalisedBody    = personalise(job.body,    job.contact);

            const raw = buildRawEmail({
                from,
                to:         job.contact.email,
                subject:    personalisedSubject,
                body:       personalisedBody,
                inReplyTo:  job.originalMessageId,
                references: job.originalMessageId
            });

            const sendParams = { userId: 'me', requestBody: { raw } };
            // Thread into original conversation if we have the thread ID
            if (job.originalThreadId) sendParams.requestBody.threadId = job.originalThreadId;

            const result = await gmail.users.messages.send(sendParams);

            job.status = 'sent';
            job.sentAt = Date.now();
            job.sentMessageId = result.data.id;

            console.log(`Follow-up step ${job.step} sent to ${job.contact.email} — messageId: ${result.data.id}`);
            return res.status(200).json({ ok: true, messageId: result.data.id, step: job.step });

        } catch (err) {
            job.status = 'failed';
            job.error  = err.message;
            console.error(`Follow-up send failed for job ${jobId}:`, err.message);

            if (err.message?.includes('invalid_grant')) {
                return res.status(401).json({ ok: false, error: 'Gmail token expired', code: 'TOKEN_EXPIRED' });
            }
            return res.status(500).json({ ok: false, error: err.message });
        }
    }

    // ── SEND ALL DUE FOLLOW-UPS ────────────────
    // Called by a cron job or manually from the UI
    if (req.method === 'POST' && action === 'send-due') {
        const now = Date.now();
        const due = jobs.filter(j => j.status === 'pending' && j.scheduledFor <= now);

        if (due.length === 0) {
            return res.status(200).json({ ok: true, sent: 0, message: 'No follow-ups due' });
        }

        const auth = getOAuthClient();
        const gmail = google.gmail({ version: 'v1', auth });
        const from  = process.env.GMAIL_SENDER_EMAIL;

        let sent = 0, failed = 0;
        const results = [];

        for (const job of due) {
            try {
                const personalisedSubject = personalise(job.subject, job.contact);
                const personalisedBody    = personalise(job.body,    job.contact);

                const raw = buildRawEmail({
                    from,
                    to:         job.contact.email,
                    subject:    personalisedSubject,
                    body:       personalisedBody,
                    inReplyTo:  job.originalMessageId,
                    references: job.originalMessageId
                });

                const sendParams = { userId: 'me', requestBody: { raw } };
                if (job.originalThreadId) sendParams.requestBody.threadId = job.originalThreadId;

                const result = await gmail.users.messages.send(sendParams);
                job.status = 'sent';
                job.sentAt = Date.now();
                job.sentMessageId = result.data.id;
                sent++;
                results.push({ jobId: job.id, ok: true, email: job.contact.email, step: job.step });

                await new Promise(r => setTimeout(r, 300)); // rate limit
            } catch (err) {
                job.status = 'failed';
                job.error  = err.message;
                failed++;
                results.push({ jobId: job.id, ok: false, email: job.contact.email, error: err.message });
            }
        }

        return res.status(200).json({ ok: true, sent, failed, results });
    }

    // ── CANCEL A JOB ──────────────────────────
    if (req.method === 'POST' && action === 'cancel') {
        const { jobId, email, vertical } = req.body;

        if (jobId) {
            const job = jobs.find(j => j.id === jobId);
            if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
            job.status = 'cancelled';
            return res.status(200).json({ ok: true, cancelled: 1 });
        }

        // Cancel all pending follow-ups for a contact+vertical
        if (email) {
            let count = 0;
            jobs.forEach(j => {
                if (j.contact.email === email && j.status === 'pending') {
                    if (!vertical || j.contact.vertical === vertical) {
                        j.status = 'cancelled';
                        count++;
                    }
                }
            });
            return res.status(200).json({ ok: true, cancelled: count });
        }

        return res.status(400).json({ ok: false, error: 'Provide jobId or email to cancel' });
    }

    // ── STATS ─────────────────────────────────
    if (req.method === 'GET' && action === 'stats') {
        const stats = {
            total:     jobs.length,
            pending:   jobs.filter(j => j.status === 'pending').length,
            sent:      jobs.filter(j => j.status === 'sent').length,
            failed:    jobs.filter(j => j.status === 'failed').length,
            cancelled: jobs.filter(j => j.status === 'cancelled').length,
            byVertical: {}
        };
        jobs.forEach(j => {
            const v = j.contact.vertical || 'Unknown';
            if (!stats.byVertical[v]) stats.byVertical[v] = { total:0, pending:0, sent:0, failed:0 };
            stats.byVertical[v].total++;
            stats.byVertical[v][j.status] = (stats.byVertical[v][j.status] || 0) + 1;
        });
        return res.status(200).json({ ok: true, stats });
    }

    return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
};
