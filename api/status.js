// api/status.js
// GET /api/status
// Header: x-api-key: <founder's api key>
// Returns Gmail connection status for the authenticated founder.

const { getOAuthClient, google } = require('../lib/gmail');
const { getUserByApiKey }        = require('../lib/users');

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}

module.exports = async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = getUserByApiKey(req.headers['x-api-key']);
    if (!user) {
        return res.status(401).json({ ok: false, connected: false, error: 'Unauthorized — invalid or missing x-api-key' });
    }

    if (!user.accessToken || !user.refreshToken) {
        return res.status(200).json({
            ok:        false,
            connected: false,
            user:      user.name,
            error:     `Gmail not configured for ${user.name}. Visit /api/auth?user=${user.id} to connect.`,
            authUrl:   `/api/auth?user=${user.id}`,
        });
    }

    try {
        const auth     = getOAuthClient(user);
        const oauth2   = google.oauth2({ version: 'v2', auth });
        const userInfo = await oauth2.userinfo.get();

        return res.status(200).json({
            ok:           true,
            connected:    true,
            user:         user.name,
            email:        userInfo.data.email,
            senderEmail:  user.senderEmail,
        });

    } catch (err) {
        const tokenExpired =
            err.message?.includes('invalid_grant') ||
            err.message?.includes('Token has been expired');

        return res.status(200).json({
            ok:        false,
            connected: false,
            user:      user.name,
            error:     tokenExpired
                ? `Token expired for ${user.name} — re-authorise at /api/auth?user=${user.id}`
                : err.message,
            code:      tokenExpired ? 'TOKEN_EXPIRED' : 'ERROR',
            authUrl:   tokenExpired ? `/api/auth?user=${user.id}` : undefined,
        });
    }
};
