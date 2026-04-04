// api/send.js
// POST /api/send
// Header: x-api-key: <founder's api key>
// Body: { contact: { email, first_name?, company_name?, vertical? }, subject, body }
// Sends the initial email via the founder's Gmail and returns IDs for follow-up threading.

const { getOAuthClient, google }     = require('../lib/gmail');
const { buildRawEmail, personalise } = require('../lib/email');
const { getUserByApiKey }            = require('../lib/users');
const store                        = require('../lib/store');

function cors(req, res) {
    const origin = req.headers.origin || req.headers.referer || '*';
    if (origin.includes('adsidol.com') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', origin.replace(/\/$/, ""));
    } else {
        // Secure Dynamic CORS for Adsidol
    const reqOrigin = req.headers.origin || req.headers.referer || '';
    if (reqOrigin.includes('adsidol.com') || reqOrigin.includes('localhost') || reqOrigin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', reqOrigin.replace(/\/$/, ""));
    } else {
        res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://www.adsidol.com');
    }
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-api-key');
}

module.exports = async (req, res) => {
    cors(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed — use POST' });
    }

    const user = getUserByApiKey(req.headers['x-api-key']);
    if (!user) {
        return res.status(401).json({ ok: false, error: 'Unauthorized — invalid or missing x-api-key' });
    }

    const { contact, subject, body, followups, signature } = req.body || {};

    if (!contact?.email || !subject || !body) {
        return res.status(400).json({
            ok:    false,
            error: 'Missing required fields: contact.email, subject, body',
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        return res.status(400).json({ ok: false, error: 'Invalid email address' });
    }

    try {
        const auth  = getOAuthClient(user);
        const gmail = google.gmail({ version: 'v1', auth });

        const raw = buildRawEmail({
            name:    user.name,
            from:    user.senderEmail,
            to:      contact.email,
            subject: personalise(subject, contact),
            body:    personalise(body, contact),
            signature,
        });

        const result = await gmail.users.messages.send({
            userId:      'me',
            requestBody: { raw },
        });

        // Fetch the RFC Message-ID header for proper email threading in follow-ups
        let rfcMessageId = null;
        try {
            const msg = await gmail.users.messages.get({
                userId:          'me',
                id:              result.data.id,
                format:          'metadata',
                metadataHeaders: ['Message-ID'],
            });
            rfcMessageId = msg.data.payload?.headers?.find(h => h.name === 'Message-ID')?.value || null;
        } catch (_) { /* non-critical */ }

        console.log(`[${user.name}] Sent to ${contact.email} — id: ${result.data.id}`);

        // ── LOG ANALYTICS (Permanent Cloud Ledger) ──
        try {
            await store.logEvent(user.id, {
                type:     'initial',
                date:     Date.now(),
                email:    contact.email.toLowerCase().trim(),
                vertical: contact.vertical,
                name:     contact.first_name || contact.name?.split(' ')[0] || 'Unknown',
                step:     0 // Step 0 = Initial
            });
        } catch (logErr) {
            console.error(`[Analytics] Failed to log send for ${contact.email}:`, logErr.message);
        }

        // ── AUTO-QUEUE FOLLOW-UPS ──
        if (followups && Array.isArray(followups) && followups.length > 0) {
            try {
                const allJobs = await store.getAllJobs();
                const toReplace = allJobs.filter(
                    j => j.userId === user.id && j.contact.email === contact.email && j.contact.vertical === contact.vertical && j.status === 'pending'
                );
                for (const j of toReplace) {
                    j.status = 'cancelled';
                    await store.updateJob(j);
                }

                const now = Date.now();
                let cumulativeDelayDays = 0;
                const newJobs = followups.slice(0, 4).map((fu, i) => {
                    const stepDelay = fu.delayDays || 3;
                    cumulativeDelayDays += stepDelay; // Accumulate delay based on previous steps

                    return {
                        id:                `fu_${now}_${i}_${Math.random().toString(36).slice(2, 7)}`,
                        userId:            user.id,
                        userName:          user.name,
                        step:              fu.step || (i + 1),
                        contact,
                        subject:           fu.subject,
                        body:              fu.body,
                        signature:         signature || null,
                        delayDays:         stepDelay,
                        scheduledFor:      now + (cumulativeDelayDays * 86400000),
                        status:            'pending',
                        originalMessageId: rfcMessageId || result.data.id || null,
                        originalThreadId:  result.data.threadId || null,
                        sentAt:            null,
                        sentMessageId:     null,
                        error:             null,
                        createdAt:         now,
                    };
                });

                for (const job of newJobs) await store.saveJob(job);
                console.log(`[${user.name}] Auto-queued ${newJobs.length} follow-ups for ${contact.email}`);
            } catch (fuErr) {
                console.error(`[Auto-Followup] Failed to schedule for ${contact.email}:`, fuErr.message);
            }
        }

        return res.status(200).json({
            ok:           true,
            messageId:    result.data.id,
            threadId:     result.data.threadId,
            rfcMessageId,
            sentTo:       contact.email,
            sentBy:       user.name,
        });

    } catch (err) {
        console.error(`[${user.name}] Failed to send to ${contact?.email}:`, err.message);
        const tokenExpired =
            err.message?.includes('invalid_grant') ||
            err.message?.includes('Token has been expired');
        if (tokenExpired) {
            return res.status(401).json({
                ok:      false,
                error:   `Gmail token expired for ${user.name} — re-authorise at /api/auth?user=${user.id}`,
                code:    'TOKEN_EXPIRED',
                authUrl: `/api/auth?user=${user.id}`,
            });
        }
        return res.status(500).json({ ok: false, error: err.message });
    }
};
