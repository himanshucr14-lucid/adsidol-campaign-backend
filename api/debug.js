// api/debug.js
// TEMPORARY - delete after debugging

const { google } = require('googleapis');

module.exports = async (req, res) => {
    const accessToken  = process.env.PARAMJIT_ACCESS_TOKEN;
    const refreshToken = process.env.PARAMJIT_REFRESH_TOKEN;
    const clientId     = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;

    // Show first/last 10 chars of each so we can verify without exposing full values
    const safe = val => val ? `${val.slice(0, 10)}...${val.slice(-10)} (length: ${val.length})` : 'NOT SET';

    // Try calling Gmail API directly
    let gmailResult = null;
    let gmailError  = null;
    try {
        const client = new google.auth.OAuth2(clientId, clientSecret, process.env.GMAIL_REDIRECT_URI);
        client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
        const gmail = google.gmail({ version: 'v1', auth: client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        gmailResult = profile.data;
    } catch (err) {
        gmailError = {
            message: err.message,
            code:    err.code,
            errors:  err.errors,
            status:  err.status
        };
    }

    return res.status(200).json({
        env: {
            PARAMJIT_ACCESS_TOKEN:  safe(accessToken),
            PARAMJIT_REFRESH_TOKEN: safe(refreshToken),
            GMAIL_CLIENT_ID:        safe(clientId),
            GMAIL_CLIENT_SECRET:    safe(clientSecret),
            GMAIL_REDIRECT_URI:     process.env.GMAIL_REDIRECT_URI || 'NOT SET',
        },
        gmailResult,
        gmailError
    });
};
