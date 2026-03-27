// api/send.js  (v2 — returns messageId + threadId for follow-up threading)

const { google } = require('googleapis');

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

function buildRawEmail({ from, to, subject, body }) {
    const boundary = `boundary_${Date.now()}`;
    const email = [
        `From: Adsidol Outreach <${from}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || 'https://www.adsidol.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.ADSIDOL_API_KEY) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { contact, subject, body } = req.body;
    if (!contact?.email || !subject || !body) {
        return res.status(400).json({ ok: false, error: 'Missing required fields: contact.email, subject, body' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact.email)) {
        return res.status(400).json({ ok: false, error: 'Invalid email address' });
    }

    try {
        const auth = getOAuthClient();
        const gmail = google.gmail({ version: 'v1', auth });
        const from = process.env.GMAIL_SENDER_EMAIL;

        const raw = buildRawEmail({
            from,
            to:      contact.email,
            subject: personalise(subject, contact),
            body:    personalise(body, contact)
        });

        const result = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw }
        });

        // Fetch the sent message to get its RFC Message-ID header (needed for threading)
        let rfcMessageId = null;
        try {
            const msg = await gmail.users.messages.get({
                userId: 'me',
                id: result.data.id,
                format: 'metadata',
                metadataHeaders: ['Message-ID']
            });
            const header = msg.data.payload?.headers?.find(h => h.name === 'Message-ID');
            rfcMessageId = header?.value || null;
        } catch (_) { /* non-critical */ }

        console.log(`Sent to ${contact.email} — gmailId: ${result.data.id}`);

        return res.status(200).json({
            ok:        true,
            messageId: result.data.id,       // Gmail internal ID
            threadId:  result.data.threadId, // Gmail thread ID (for follow-up threading)
            rfcMessageId,                    // RFC 2822 Message-ID header (for In-Reply-To)
            sentTo:    contact.email
        });

    } catch (err) {
        console.error(`Failed to send to ${contact?.email}:`, err.message);
        if (err.message?.includes('invalid_grant') || err.message?.includes('Token has been expired')) {
            return res.status(401).json({ ok: false, error: 'Gmail token expired — re-run OAuth at /api/auth', code: 'TOKEN_EXPIRED' });
        }
        return res.status(500).json({ ok: false, error: err.message });
    }
};
