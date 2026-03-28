// api/status.js
// GET /api/status — checks if Gmail is connected and returns sender info
// Multi-user version — uses {USER}_ACCESS_TOKEN env vars

const { google } = require('googleapis');

function getOAuthClient(user) {
    const userKey = user.toUpperCase();
    const client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
    );
    
    // Use per-user tokens
    const accessToken = process.env[`${userKey}_ACCESS_TOKEN`];
    const refreshToken = process.env[`${userKey}_REFRESH_TOKEN`];
    
    if (accessToken && refreshToken) {
        client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });
    }
    
    return client;
}

function getUserFromApiKey(apiKey) {
    // Match API key to user
    const users = ['PARAMJIT', 'MONI', 'UJJWAL', 'HEMLETA'];
    for (const user of users) {
        if (process.env[`${user}_API_KEY`] === apiKey) {
            return user;
        }
    }
    return null;
}

module.exports = async (req, res) => {
    // More permissive CORS - allow all subpaths of adsidol.com
    const origin = req.headers.origin || req.headers.referer;
    const allowedOrigins = [
        'https://www.adsidol.com',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ];
    
    // Check if origin starts with any allowed origin
    const isAllowed = allowedOrigins.some(allowed => 
        origin && origin.startsWith(allowed)
    );
    
    if (isAllowed || origin?.includes('adsidol.com')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://www.adsidol.com');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    // API key check
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ ok: false, connected: false, error: 'Missing API key' });
    }
    
    const user = getUserFromApiKey(apiKey);
    if (!user) {
        return res.status(401).json({ ok: false, connected: false, error: 'Invalid API key' });
    }

    // Check if tokens are configured for this user
    const accessToken = process.env[`${user}_ACCESS_TOKEN`];
    const refreshToken = process.env[`${user}_REFRESH_TOKEN`];
    
    if (!accessToken || !refreshToken) {
        return res.status(200).json({
            ok: false,
            connected: false,
            user: user.toLowerCase(),
            error: `Gmail not connected for ${user} — tokens not configured`
        });
    }

    try {
        const auth = getOAuthClient(user);
        const gmail = google.gmail({ version: 'v1', auth });

        // We only have gmail.send and userinfo.email scopes.
        // We cannot call gmail.users.getProfile without readonly/metadata scope.
        // Instead, we use the oauth2 userinfo API to fetch the connected email.
        const oauth2 = google.oauth2({ version: 'v2', auth });
        const userInfo = await oauth2.userinfo.get();

        return res.status(200).json({
            ok: true,
            connected: true,
            user: user.toLowerCase(),
            email: userInfo.data.email,
            senderEmail: userInfo.data.email,
            messagesTotal: 0 // Cannot get this without read scope, but it's not strictly needed
        });

    } catch (err) {
        console.error(`Status check failed for ${user}:`, err.message);
        const tokenExpired = err.message?.includes('invalid_grant') || err.message?.includes('Token has been expired');
        return res.status(200).json({
            ok: false,
            connected: false,
            user: user.toLowerCase(),
            error: tokenExpired ? 'Token expired — re-authenticate via Connect Gmail' : err.message,
            code: tokenExpired ? 'TOKEN_EXPIRED' : 'ERROR'
        });
    }
};
