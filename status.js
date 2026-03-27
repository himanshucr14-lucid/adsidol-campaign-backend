// api/status.js
// GET /api/status — checks if Gmail is connected and returns sender info
// Called by the HTML app on load to show connection status

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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://www.adsidol.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // API key check
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.ADSIDOL_API_KEY) {
        return res.status(401).json({ ok: false, connected: false, error: 'Unauthorized' });
    }

    // Check if tokens are configured
    if (!process.env.GMAIL_ACCESS_TOKEN || !process.env.GMAIL_REFRESH_TOKEN) {
        return res.status(200).json({
            ok: false,
            connected: false,
            error: 'Gmail tokens not configured — run OAuth setup first'
        });
    }

    try {
        const auth = getOAuthClient();
        const gmail = google.gmail({ version: 'v1', auth });

        // Get sender profile to confirm token works
        const profile = await gmail.users.getProfile({ userId: 'me' });

        return res.status(200).json({
            ok: true,
            connected: true,
            email: profile.data.emailAddress,
            senderDisplay: process.env.GMAIL_SENDER_EMAIL || profile.data.emailAddress,
            messagesTotal: profile.data.messagesTotal
        });

    } catch (err) {
        const tokenExpired = err.message?.includes('invalid_grant') || err.message?.includes('Token has been expired');
        return res.status(200).json({
            ok: false,
            connected: false,
            error: tokenExpired ? 'Token expired — re-run /api/auth' : err.message,
            code: tokenExpired ? 'TOKEN_EXPIRED' : 'ERROR'
        });
    }
};
