// api/auth.js
// GET /api/auth?user=paramjit  →  redirects to Gmail OAuth for that founder
// The ?user= param must be one of: paramjit, moni, ujjwal, hemleta

const { getOAuthClient } = require('../lib/gmail');
const { getUserById }    = require('../lib/users');

const VALID_IDS = ['paramjit', 'moni', 'ujjwal', 'hemleta'];

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
];

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}

module.exports = (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const userId = (req.query.user || '').toLowerCase();

    if (!userId) {
        return res.status(400).send(
            `<h2>Missing ?user= param</h2>` +
            `<p>Usage: <code>/api/auth?user=paramjit</code></p>` +
            `<p>Valid users: ${VALID_IDS.join(', ')}</p>`
        );
    }

    const user = getUserById(userId);
    if (!user) {
        return res.status(404).send(
            `<h2>Unknown user: "${userId}"</h2>` +
            `<p>Valid users: ${VALID_IDS.join(', ')}</p>`
        );
    }

    const oauth2Client = getOAuthClient();

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt:      'consent',       // always get refresh_token
        scope:       SCOPES,
        state:       userId,          // carry userId through OAuth flow
    });

    console.log(`OAuth initiated for user: ${user.name}`);
    res.redirect(authUrl);
};
