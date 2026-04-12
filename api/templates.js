// api/templates.js
// GET  /api/templates        → returns saved initial + followup templates for this user
// POST /api/templates        → saves templates payload for this user
// Header: x-api-key: <founder's key>

const { getUserByApiKey } = require('../lib/users');
const store = require('../lib/store');

function cors(req, res) {

    // Secure Dynamic CORS for Adsidol
    const reqOrigin = req.headers.origin || req.headers.referer || '';
    if (reqOrigin.includes('adsidol.com') || reqOrigin.includes('localhost') || reqOrigin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', reqOrigin.replace(/\/$/, ""));
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

    // GET: load templates from Redis
    if (req.method === 'GET') {
        try {
            const data = await store.getTemplates(user.id);
            return res.status(200).json({ ok: true, data: data || null });
        } catch (err) {
            console.error(`[Templates API] GET error for ${user.name}:`, err.message);
            return res.status(500).json({ ok: false, error: err.message });
        }
    }

    // POST: save templates to Redis
    if (req.method === 'POST') {
        try {
            const { templates, followupTemplates } = req.body;
            if (!templates && !followupTemplates) {
                return res.status(400).json({ ok: false, error: 'No templates provided' });
            }
            await store.setTemplates(user.id, { templates, followupTemplates });
            return res.status(200).json({ ok: true });
        } catch (err) {
            console.error(`[Templates API] POST error for ${user.name}:`, err.message);
            return res.status(500).json({ ok: false, error: err.message });
        }
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
