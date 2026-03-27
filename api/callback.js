// api/callback.js
// OAuth callback — exchanges authorization code for tokens, then displays them
// URL: https://your-project.vercel.app/api/callback?code=...&state=paramjit

const { google } = require('googleapis');

function getOAuthClient() {
    return new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
    );
}

module.exports = async (req, res) => {
    const { code, state, user } = req.query;

    if (!code) {
        return res.status(400).send(`
            <html>
            <head>
                <title>OAuth Error</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; background: #FEF2F2; }
                    h1 { color: #EF4444; }
                </style>
            </head>
            <body>
                <h1>❌ OAuth Error</h1>
                <p>No authorization code received. Please try the Gmail connection process again.</p>
                <button onclick="window.close()" style="margin-top:20px; padding:10px 20px; background:#3B82F6; color:white; border:none; border-radius:8px; cursor:pointer;">Close Window</button>
            </body>
            </html>
        `);
    }

    try {
        const oauth2Client = getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);

        oauth2Client.setCredentials(tokens);

        // Get user's email
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const email = userInfo.data.email;

        // Determine which user this is for (from state param or user param)
        const userName = (state || user || 'paramjit').toUpperCase();

        res.send(`
            <html>
            <head>
                <title>Gmail Connected ✅</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        padding: 20px;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .container {
                        background: white;
                        border-radius: 16px;
                        padding: 40px;
                        max-width: 700px;
                        width: 100%;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    }
                    h1 {
                        color: #10B981;
                        margin-bottom: 10px;
                        font-size: 32px;
                    }
                    .email {
                        color: #64748B;
                        font-size: 18px;
                        margin-bottom: 30px;
                    }
                    .step {
                        background: #F8FAFC;
                        border-left: 4px solid #3B82F6;
                        padding: 20px;
                        margin-bottom: 20px;
                        border-radius: 8px;
                    }
                    .step-title {
                        font-weight: 600;
                        color: #1E293B;
                        margin-bottom: 12px;
                        font-size: 16px;
                    }
                    .token-box {
                        background: #1E293B;
                        color: #10B981;
                        padding: 16px;
                        border-radius: 8px;
                        font-family: 'Monaco', 'Courier New', monospace;
                        font-size: 13px;
                        word-break: break-all;
                        margin-top: 10px;
                        position: relative;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .token-box:hover {
                        background: #0F172A;
                    }
                    .token-box::after {
                        content: '📋 Click to copy';
                        position: absolute;
                        top: 8px;
                        right: 12px;
                        font-size: 11px;
                        color: #64748B;
                        font-family: 'Segoe UI', sans-serif;
                    }
                    .token-box.copied::after {
                        content: '✅ Copied!';
                        color: #10B981;
                    }
                    .var-name {
                        color: #F59E0B;
                        font-weight: 600;
                        margin-bottom: 8px;
                    }
                    .warning {
                        background: #FEF3C7;
                        border-left: 4px solid #F59E0B;
                        padding: 16px;
                        border-radius: 8px;
                        color: #92400E;
                        margin-top: 24px;
                        font-size: 14px;
                    }
                    .close-btn {
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        color: white;
                        border: none;
                        padding: 14px 28px;
                        border-radius: 10px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        margin-top: 24px;
                        width: 100%;
                        transition: all 0.3s;
                    }
                    .close-btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
                    }
                    code {
                        background: #F1F5F9;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-family: monospace;
                        color: #1E293B;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>✅ Gmail Connected!</h1>
                    <div class="email">Authenticated as: <strong>${email}</strong></div>
                    
                    <div class="step">
                        <div class="step-title">📋 Step 1: Copy Your Tokens</div>
                        <p style="color: #64748B; font-size: 14px; margin-bottom: 12px;">
                            Click each token box below to copy it to your clipboard:
                        </p>
                        
                        <div class="var-name">${userName}_ACCESS_TOKEN</div>
                        <div class="token-box" onclick="copyToken(this, '${tokens.access_token}')">
                            ${tokens.access_token}
                        </div>
                        
                        <div class="var-name" style="margin-top: 20px;">${userName}_REFRESH_TOKEN</div>
                        <div class="token-box" onclick="copyToken(this, '${tokens.refresh_token}')">
                            ${tokens.refresh_token}
                        </div>
                    </div>
                    
                    <div class="step">
                        <div class="step-title">⚙️ Step 2: Add to Vercel</div>
                        <ol style="color: #64748B; font-size: 14px; padding-left: 20px;">
                            <li>Go to <strong>Vercel Dashboard</strong> → Your Project → <strong>Settings</strong> → <strong>Environment Variables</strong></li>
                            <li>Add/Update these two variables:
                                <ul style="margin-top: 8px;">
                                    <li><code>${userName}_ACCESS_TOKEN</code></li>
                                    <li><code>${userName}_REFRESH_TOKEN</code></li>
                                </ul>
                            </li>
                            <li>Click <strong>Save</strong></li>
                            <li><strong>Redeploy</strong> your project (Settings → Deployments → click "..." → Redeploy)</li>
                        </ol>
                    </div>
                    
                    <div class="warning">
                        <strong>🔒 Security Note:</strong> Keep these tokens private! They grant access to send emails from ${email}. Never share them or commit them to Git.
                    </div>
                    
                    <button class="close-btn" onclick="window.close()">Close Window & Return to Dashboard</button>
                </div>
                
                <script>
                    function copyToken(element, text) {
                        navigator.clipboard.writeText(text).then(() => {
                            element.classList.add('copied');
                            setTimeout(() => element.classList.remove('copied'), 2000);
                        });
                    }
                </script>
            </body>
            </html>
        `);

    } catch (err) {
        console.error('OAuth callback error:', err.message);
        res.status(500).send(`
            <html>
            <head>
                <title>OAuth Error</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; background: #FEF2F2; }
                    h1 { color: #EF4444; }
                    .error { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #EF4444; }
                </style>
            </head>
            <body>
                <h1>❌ Authentication Failed</h1>
                <div class="error">
                    <p><strong>Error:</strong> ${err.message}</p>
                    <p style="margin-top: 12px; color: #64748B;">Please try connecting Gmail again from the dashboard.</p>
                </div>
                <button onclick="window.close()" style="margin-top:20px; padding:10px 20px; background:#3B82F6; color:white; border:none; border-radius:8px; cursor:pointer;">Close Window</button>
            </body>
            </html>
        `);
    }
};
