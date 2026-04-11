// api/cron.js
// Called automatically by Vercel Cron once every hour.
// Finds all pending follow-up jobs that are due and sends them.
// Also checks for bounced emails and auto-pauses follow-ups.

const { getOAuthClient, google }     = require('../lib/gmail');
const { buildRawEmail, personalise } = require('../lib/email');
const { USERS, getUserById }         = require('../lib/users');
const store                          = require('../lib/store');

async function checkBounces(auth, gmail, user, allPendingJobs) {
    try {
        const q = 'from:mailer-daemon@googlemail.com OR from:postmaster newer_than:1d';
        const res = await gmail.users.messages.list({ userId: 'me', q: q, maxResults: 50 });
        if (!res.data.messages || res.data.messages.length === 0) return 0;
        
        let cancelledCount = 0;
        const bouncedEmails = new Set();

        for (const msgRef of res.data.messages) {
            try {
                const msg = await gmail.users.messages.get({ userId: 'me', id: msgRef.id, format: 'full' });
                // Look for X-Failed-Recipients in headers
                const headers = msg.data.payload?.headers || [];
                const failedRcptHdr = headers.find(h => h.name.toLowerCase() === 'x-failed-recipients');
                if (failedRcptHdr) {
                    failedRcptHdr.value.split(',').forEach(e => bouncedEmails.add(e.trim().toLowerCase()));
                } else {
                    // Fallback to snippet parsing
                    const snippet = msg.data.snippet || '';
                    const match = snippet.match(/delivered to\s+([^\s]+@[^\s]+)/i) || snippet.match(/delivery to\s+([^\s]+@[^\s]+)/i);
                    if (match && match[1]) {
                        bouncedEmails.add(match[1].replace(/['"]/g, '').toLowerCase());
                    }
                }
            } catch (e) {
                // Ignore individual message parse errors
            }
        }

        if (bouncedEmails.size > 0) {
            for (const j of allPendingJobs) {
                if (j.userId === user.id && bouncedEmails.has(j.contact.email.toLowerCase())) {
                    j.status = 'bounced';
                    j.error = 'Auto-paused due to bounce detection';
                    await store.updateJob(j);
                    cancelledCount++;
                    console.log(`[Cron] Auto-paused follow-ups for bounced email: ${j.contact.email}`);
                }
            }
        }
        return cancelledCount;
    } catch (err) {
        console.error(`[Cron] Bounce check failed for ${user.id}:`, err.message);
        return 0;
    }
}

module.exports = async (req, res) => {
    // Verify this is called by Vercel Cron (or your own trigger)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const now     = Date.now();
    let allJobs   = [];
    try {
        allJobs = await store.getAllJobs();
    } catch (e) {
        return res.status(500).json({ ok: false, error: 'Failed to fetch jobs' });
    }
    
    let pendingJobs = allJobs.filter(j => j.status === 'pending');
    let totalCancelled = 0;

    // First do bounce checks for all users who have pending jobs
    const usersWithPendingJobs = [...new Set(pendingJobs.map(j => j.userId))];
    for (const userId of usersWithPendingJobs) {
        const sender = getUserById(userId);
        if (sender) {
            try {
                const auth = getOAuthClient(sender);
                const gmail = google.gmail({ version: 'v1', auth });
                const cCount = await checkBounces(auth, gmail, sender, pendingJobs);
                totalCancelled += cCount;
            } catch(e) { console.error(`[Cron] Auth failed for bounce check ${userId}:`, e.message); }
        }
    }

    // Refresh due jobs after possible bounce cancellations
    const due = pendingJobs.filter(j => j.status === 'pending' && j.scheduledFor <= now);

    if (!due.length) {
        console.log(`[Cron] No follow-ups due at ${new Date().toISOString()}`);
        return res.status(200).json({ ok: true, sent: 0, bouncedCancelled: totalCancelled, message: 'No follow-ups due' });
    }

    console.log(`[Cron] Found ${due.length} due follow-ups`);

    let sent = 0, failed = 0;
    const results = [];

    for (const job of due) {
        try {
            const sender = getUserById(job.userId);
            if (!sender) throw new Error(`Unknown user: ${job.userId}`);

            const auth  = getOAuthClient(sender);
            const gmail = google.gmail({ version: 'v1', auth });

            const raw = buildRawEmail({
                name:       sender.name,
                from:       sender.senderEmail,
                to:         job.contact.email,
                subject:    personalise(job.subject, job.contact),
                body:       personalise(job.body, job.contact),
                inReplyTo:  job.originalMessageId,
                references: job.originalMessageId,
                signature:  job.signature || null,
                cc:         job.signature?.cc || null,
            });

            const params = { userId: 'me', requestBody: { raw } };
            if (job.originalThreadId) params.requestBody.threadId = job.originalThreadId;

            const result = await gmail.users.messages.send(params);

            job.status        = 'sent';
            job.sentAt        = Date.now();
            job.sentMessageId = result.data.id;
            await store.updateJob(job);

            // ── LOG ANALYTICS (Permanent Cloud Ledger) ──
            try {
                await store.logEvent(job.userId, {
                    type:     'followup',
                    date:     Date.now(),
                    email:    job.contact.email.toLowerCase().trim(),
                    vertical: job.contact.vertical,
                    name:     job.contact.name || job.contact.first_name || 'Unknown',
                    step:     job.step
                });
            } catch (logErr) {
                console.error(`[Cron Analytics] Failed to log for ${job.contact.email}:`, logErr.message);
            }

            sent++;
            console.log(`[Cron] Sent step ${job.step} to ${job.contact.email} (${job.userName})`);
            results.push({ jobId: job.id, ok: true, email: job.contact.email, step: job.step, user: job.userName });

            // Respect Gmail rate limits (300ms between sends)
            await new Promise(r => setTimeout(r, 300));

        } catch (err) {
            job.status = 'failed';
            job.error  = err.message;
            await store.updateJob(job);

            failed++;
            console.error(`[Cron] Failed for job ${job.id} (${job.contact.email}):`, err.message);
            results.push({ jobId: job.id, ok: false, email: job.contact.email, error: err.message });
        }
    }

    return res.status(200).json({ ok: true, sent, failed, bouncedCancelled: totalCancelled, results });
};

