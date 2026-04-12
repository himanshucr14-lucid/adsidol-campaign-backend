// api/auth.js
// Handles Gmail OAuth flow — GET /api/auth → redirects to Google login

const { google } = require('googleapis');

function getOAuthClient() {
    return new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI  // e.g. https://your-project.vercel.app/api/callback
    );
}

module.exports = (req, res) => {
    // Secure Dynamic CORS
    const reqOrigin = req.headers.origin || req.headers.referer || '';
    if (reqOrigin.includes('adsidol.com') || reqOrigin.includes('localhost') || reqOrigin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', reqOrigin.replace(/\/$/, ""));
    } else {
        res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://www.adsidol.com');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const oauth2Client = getOAuthClient();
    
    // Get user from query param to track which user is authenticating
    const user = req.query.user || 'paramjit';

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',      // gets refresh token so we don't need to re-auth
        prompt: 'consent',           // forces refresh token on every auth
        scope: [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/userinfo.email'
        ],
        state: user  // Pass user ID to callback
    });

    res.redirect(authUrl);
};
