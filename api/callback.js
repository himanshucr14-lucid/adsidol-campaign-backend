// api/callback.js
// Handles Gmail OAuth callback — Google redirects here after login
// Displays access + refresh tokens to copy into Vercel env vars

const { google } = require('googleapis');

module.exports = async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing code from Google');

    const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
    );

    try {
        const { tokens } = await oauth2Client.getToken(code);

        res.send(`
            <html><body style="font-family:sans-serif;padding:40px;max-width:700px">
            <h2>✅ Gmail Connected!</h2>
            <p>Copy these into your <b>Vercel Environment Variables</b> for the correct user (Paramjit / Moni / Ujjwal / Hemleta):</p>
            <hr/>
            <p><b>ACCESS TOKEN</b> (e.g. PARAMJIT_ACCESS_TOKEN):</p>
            <textarea rows="4" style="width:100%;font-size:12px;padding:8px">${tokens.access_token}</textarea>
            <br/><br/>
            <p><b>REFRESH TOKEN</b> (e.g. PARAMJIT_REFRESH_TOKEN):</p>
            <textarea rows="3" style="width:100%;font-size:12px;padding:8px">${tokens.refresh_token || '⚠️ No refresh token returned — go to myaccount.google.com/permissions, revoke this app, then visit /api/auth again'}</textarea>
            <br/><br/>
            <p style="color:red;font-weight:bold">⚠️ Save these now — the refresh token is only shown once!</p>
            <ol>
                <li>Copy both tokens above</li>
                <li>Go to Vercel → Your Project → Settings → Environment Variables</li>
                <li>Paste into the correct user's ACCESS_TOKEN and REFRESH_TOKEN fields</li>
                <li>Click <b>Redeploy</b> in Vercel</li>
                <li>Done — Gmail is connected!</li>
            </ol>
            </body></html>
        `);

    } catch (err) {
        res.status(500).send(`
            <html><body style="font-family:sans-serif;padding:40px">
            <h2>❌ OAuth Error</h2>
            <p>${err.message}</p>
            <p>Go back and try <a href="/api/auth">/api/auth</a> again.</p>
            </body></html>
        `);
    }
};
