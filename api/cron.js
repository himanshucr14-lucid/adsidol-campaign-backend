// api/cron.js
// Called automatically by Vercel Cron once every hour.
// Finds all pending follow-up jobs that are due and sends them.
//
// Vercel Cron config is in vercel.json:
//   { "path": "/api/cron", "schedule": "0 * * * *" }
//
// Vercel automatically sends Authorization: Bearer <CRON_SECRET> to cron endpoints.
// Set CRON_SECRET in your Vercel env vars (any random string).

const { getOAuthClient, google }     = require('../lib/gmail');
const { buildRawEmail, personalise } = require('../lib/email');
const { getUserById }                = require('../lib/users');
const store                          = require('../lib/store');

module.exports = async (req, res) => {
    // Verify this is called by Vercel Cron (or your own trigger)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const now     = Date.now();
    const allJobs = await store.getAllJobs();
    const due     = allJobs.filter(j => j.status === 'pending' && j.scheduledFor <= now);

    if (!due.length) {
        console.log(`[Cron] No follow-ups due at ${new Date().toISOString()}`);
        return res.status(200).json({ ok: true, sent: 0, message: 'No follow-ups due' });
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

    return res.status(200).json({ ok: true, sent, failed, results });
};
