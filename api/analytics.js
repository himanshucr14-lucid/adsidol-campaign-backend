// api/analytics.js
// GET /api/analytics
// Header: x-api-key: <founder's key>
// Returns the full historical ledger of sent emails for this user.

const { getUserByApiKey } = require('../lib/users');
const store             = require('../lib/store');

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}

module.exports = async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const user = getUserByApiKey(req.headers['x-api-key']);
    if (!user) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    try {
        const events = await store.getAnalytics(user.id);
        
        // Basic grouping/stats logic could go here, or we can send raw data 
        // and let the frontend handle flexible date filtering.
        // For performance with large datasets, we'll send the raw ledger.
        
        return res.status(200).json({
            ok: true,
            userName: user.name,
            totalEvents: events.length,
            events: events
        });

    } catch (err) {
        console.error(`[Analytics API] Error for ${user.name}:`, err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
};
