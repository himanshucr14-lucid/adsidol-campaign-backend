// api/schedule-batch.js
// POST /api/schedule-batch
// Header: x-api-key: <founder's api key>
// Body: { batch: [ { contact, subject, body, followups } ], intervalSeconds }
// Dispatches the initial emails to QStash, applying the specific interval delay.
// This allows the browser to close immediately while Upstash handles the rest.

const { getUserByApiKey } = require('../lib/users');

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-api-key');
}

module.exports = async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed — use POST' });
    }

    const apiKey = req.headers['x-api-key'];
    const user = getUserByApiKey(apiKey);
    if (!user) {
        return res.status(401).json({ ok: false, error: 'Unauthorized — invalid or missing x-api-key' });
    }

    const { batch, intervalSeconds = 15 } = req.body || {};

    if (!batch || !Array.isArray(batch) || batch.length === 0) {
        return res.status(400).json({ ok: false, error: 'Missing or empty batch array' });
    }

    const qstashToken = process.env.UPSTASH_QSTASH_TOKEN || process.env.QSTASH_TOKEN;
    if (!qstashToken) {
        return res.status(500).json({ ok: false, error: 'UPSTASH_QSTASH_TOKEN is missing in environment variables. Please add it from your Upstash console.' });
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const destinationUrl = `${protocol}://${host}/api/send`;
    const publishUrl = `https://qstash.upstash.io/v2/publish/${destinationUrl}`;

    try {
        let scheduledCount = 0;

        for (let i = 0; i < batch.length; i++) {
            const payload = batch[i];
            const delaySeconds = i * parseInt(intervalSeconds);

            const headers = {
                'Authorization': `Bearer ${qstashToken}`,
                'Content-Type': 'application/json',
                'Upstash-Forward-x-api-key': apiKey // Proxies your API key to /api/send
            };

            if (delaySeconds > 0) {
                headers['Upstash-Delay'] = `${delaySeconds}s`;
            }

            const response = await fetch(publishUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!data.error) {
                scheduledCount++;
            } else {
                console.error(`[QStash] Failed to schedule:`, data.error);
            }
        }

        return res.status(200).json({ 
            ok: true, 
            message: `Successfully scheduled ${scheduledCount} emails via QStash.` 
        });

    } catch (err) {
        console.error(`[QStash] Fatal schedule error for ${user.name}:`, err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
};
