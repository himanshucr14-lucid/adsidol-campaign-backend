// api/status.js
// GET /api/status
// Header: x-api-key: <founder's api key>
// Returns Gmail connection status for the authenticated founder.

const { getOAuthClient, google } = require('../lib/gmail');

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}

const USERS = [
    {
        id:          'paramjit',
        name:        'Paramjit',
        senderEmail: 'Paramjit@adsidol.com',
        get apiKey()       { return process.env.PARAMJIT_API_KEY; },
        get accessToken()  { return process.env.PARAMJIT_ACCESS_TOKEN; },
        get refreshToken() { return process.env.PARAMJIT_REFRESH_TOKEN; },
    },
    {
        id:          'moni',
        name:        'Moni',
        senderEmail: 'moni@adsidol.com',
        get apiKey()       { return process.env.MONI_API_KEY; },
        get accessToken()  { return process.env.MONI_ACCESS_TOKEN; },
        get refreshToken() { return process.env.MONI_REFRESH_TOKEN; },
    },
    {
        id:          'ujjwal',
        name:        'Ujjwal',
        senderEmail: 'Ujjwal@adsidol.com',
        get apiKey()       { return process.env.UJJWAL_API_KEY; },
        get accessToken()  { return process.env.UJJWAL_ACCESS_TOKEN; },
        get refreshToken() { return process.env.UJJWAL_REFRESH_TOKEN; },
    },
    {
        id:          'hemleta',
        name:        'Hemleta',
        senderEmail: 'Hemleta@adsidol.com',
        get apiKey()       { return process.env.HEMLETA_API_KEY; },
        get accessToken()  { return process.env.HEMLETA_ACCESS_TOKEN; },
        get refreshToken() { return process.env.HEMLETA_REFRESH_TOKEN; },
    },
];

function getUserByApiKey(apiKey) {
    if (!apiKey) return null;
    return USERS.find(u => u.apiKey && u.apiKey === apiKey) || null;
}

module.exports = async (req, res) => {
    try {
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

        return res.status(err.status === 401 ? 401 : 200).json({
            ok:        false,
            connected: false,
            user:      "Paramjit", // Default to reasonable name for UI
            error:     tokenExpired
                ? `Token expired — re-authorise at /api/auth?user=paramjit`
                : err.message,
            code:      tokenExpired ? 'TOKEN_EXPIRED' : 'ERROR',
            authUrl:   tokenExpired ? `/api/auth?user=paramjit` : undefined,
            crash:     err.message
        });
    }
};
