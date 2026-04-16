// api/agency.js
// GET  /api/agency  → returns agency contacts, template, and follow-ups for this user
// POST /api/agency  → saves agency payload for this user
// Header: x-api-key: <founder's key>

const { getUserByApiKey } = require('../lib/users');
const store = require('../lib/store');

function cors(req, res) {
    const reqOrigin = req.headers.origin || req.headers.referer || '';
    if (reqOrigin.includes('adsidol.com') || reqOrigin.includes('localhost') || reqOrigin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', reqOrigin.replace(/\/$/, ''));
    } else {
        res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://www.adsidol.com');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}

module.exports = async (req, res) => {
    cors(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = getUserByApiKey(req.headers['x-api-key']);
    if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    // GET — load agency data from Redis
    if (req.method === 'GET') {
        try {
            const data = await store.getAgency(user.id);
            return res.status(200).json({ ok: true, data: data || null });
        } catch (err) {
            console.error(`[Agency API] GET error for ${user.name}:`, err.message);
            return res.status(500).json({ ok: false, error: err.message });
        }
    }

    // POST — save agency data to Redis
    if (req.method === 'POST') {
        try {
            const { agencyContacts, agencyTemplate, agencyFollowups } = req.body || {};
            if (!agencyContacts && !agencyTemplate && !agencyFollowups) {
                return res.status(400).json({ ok: false, error: 'No agency data provided' });
            }
            await store.setAgency(user.id, { agencyContacts, agencyTemplate, agencyFollowups });
            return res.status(200).json({ ok: true, message: 'Agency data saved to cloud' });
        } catch (err) {
            console.error(`[Agency API] POST error for ${user.name}:`, err.message);
            return res.status(500).json({ ok: false, error: err.message });
        }
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
