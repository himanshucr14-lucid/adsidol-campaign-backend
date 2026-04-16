// api/contacts.js
// GET  /api/contacts           — Retrieves client contacts
// POST /api/contacts           — Saves client contacts
// GET  /api/contacts?type=agency  — Retrieves agency data (contacts + template + followups)
// POST /api/contacts?type=agency  — Saves agency data
// Header: x-api-key: <founder's key>

const { getUserByApiKey } = require('../lib/users');
const store               = require('../lib/store');

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

    const isAgency = req.query.type === 'agency';

    try {
        // ── AGENCY MODE ──────────────────────────────────────────────────────────
        if (isAgency) {
            if (req.method === 'GET') {
                const data = await store.getAgency(user.id);
                return res.status(200).json({ ok: true, data: data || null });
            }
            if (req.method === 'POST') {
                const { agencyContacts, agencyTemplate, agencyFollowups } = req.body || {};
                if (!agencyContacts && !agencyTemplate && !agencyFollowups) {
                    return res.status(400).json({ ok: false, error: 'No agency data provided' });
                }
                await store.setAgency(user.id, { agencyContacts, agencyTemplate, agencyFollowups });
                return res.status(200).json({ ok: true, message: 'Agency data saved to cloud' });
            }
        }

        // ── CLIENT MODE (original behaviour) ─────────────────────────────────────
        if (req.method === 'GET') {
            const data = await store.getContacts(user.id);
            return res.status(200).json({ ok: true, data: data || [] });
        }
        if (req.method === 'POST') {
            const { contacts } = req.body || {};
            if (!Array.isArray(contacts)) {
                return res.status(400).json({ ok: false, error: 'Invalid contacts list' });
            }
            await store.setContacts(user.id, contacts);
            return res.status(200).json({ ok: true, message: 'Contacts saved to cloud' });
        }

        return res.status(405).json({ ok: false, error: 'Method not allowed' });

    } catch (err) {
        console.error(`[Contacts API] Error for ${user.id}:`, err.message);
        return res.status(500).json({ ok: false, error: err.message });
    }
};
