// api/callback.js
// GET /api/callback  →  receives Gmail OAuth code, exchanges for tokens,
//                        shows them so you can paste into Vercel env vars.

const { getOAuthClient } = require('../lib/gmail');
const { getUserById }    = require('../lib/users');

module.exports = async (req, res) => {
    const { code, state: userId, error } = req.query;

    if (error) {
        return res.status(400).send(`<h2>OAuth Error</h2><p>${error}</p>`);
    }
    if (!code) {
        return res.status(400).send('<h2>Missing OAuth code</h2>');
    }
    if (!userId) {
        return res.status(400).send('<h2>Missing state (userId) — restart from /api/auth?user=...</h2>');
    }

    const user = getUserById(userId);
    if (!user) {
        return res.status(400).send(`<h2>Unknown user: ${userId}</h2>`);
    }

    try {
        const oauth2Client     = getOAuthClient();
        const { tokens }       = await oauth2Client.getToken(code);
        const accessEnvKey     = `${user.id.toUpperCase()}_ACCESS_TOKEN`;
        const refreshEnvKey    = `${user.id.toUpperCase()}_REFRESH_TOKEN`;

        const hasRefresh = !!tokens.refresh_token;

        return res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Gmail OAuth Success — ${user.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Outfit', sans-serif; background: #F8FAFC; color: #0F172A; padding: 40px 24px; }
    .card { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 20px; padding: 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    h1 { color: #10B981; font-size: 28px; margin-bottom: 8px; }
    p  { color: #475569; margin-bottom: 16px; }
    .env-block { background: #F1F5F9; border-radius: 12px; padding: 20px; margin: 16px 0; }
    .label { font-size: 12px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .val   { font-family: monospace; font-size: 13px; background: #0F172A; color: #34D399; padding: 10px 14px; border-radius: 8px; word-break: break-all; cursor: pointer; }
    .steps { background: #EFF6FF; border-left: 4px solid #3B82F6; border-radius: 0 12px 12px 0; padding: 20px 24px; margin-top: 24px; }
    .steps ol { padding-left: 18px; color: #1E40AF; }
    .steps li { margin-bottom: 8px; line-height: 1.6; }
    .warn { background: #FFFBEB; border-left: 4px solid #F59E0B; border-radius: 0 12px 12px 0; padding: 16px 20px; margin: 16px 0; color: #92400E; }
    a { color: #3B82F6; }
    code { background: #E2E8F0; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ Gmail Connected — ${user.name}</h1>
    <p>Copy both env vars below and add them to your <strong>Vercel Dashboard → Settings → Environment Variables</strong>.</p>

    <div class="env-block">
      <div class="label">Env Var Name</div>
      <div class="val">${accessEnvKey}</div>
      <div class="label" style="margin-top:12px">Value</div>
      <div class="val">${tokens.access_token}</div>
    </div>

    ${hasRefresh ? `
    <div class="env-block">
      <div class="label">Env Var Name</div>
      <div class="val">${refreshEnvKey}</div>
      <div class="label" style="margin-top:12px">Value</div>
      <div class="val">${tokens.refresh_token}</div>
    </div>
    ` : `
    <div class="warn">
      ⚠️ <strong>No refresh_token received.</strong><br>
      This happens when you've already authorised the app. To fix:<br>
      1. Go to <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a><br>
      2. Remove "Adsidol Campaign Manager" access<br>
      3. Visit <a href="/api/auth?user=${user.id}">/api/auth?user=${user.id}</a> again
    </div>
    `}

    <div class="steps">
      <strong>🚀 Next Steps:</strong>
      <ol>
        <li>Go to your <a href="https://vercel.com/dashboard" target="_blank">Vercel Dashboard</a></li>
        <li>Select your project → <strong>Settings → Environment Variables</strong></li>
        <li>Add/update the env vars above (apply to Production, Preview, Development)</li>
        <li>Click <strong>Redeploy</strong> your project</li>
        <li>Test: <code>GET /api/status</code> with header <code>x-api-key: ${user.id}-secret-key</code></li>
      </ol>
    </div>
  </div>
</body>
</html>`);

    } catch (err) {
        console.error(`Token exchange failed for ${userId}:`, err.message);
        return res.status(500).send(
            `<h2>Token exchange failed</h2><p>${err.message}</p>` +
            `<p>Try again: <a href="/api/auth?user=${userId}">/api/auth?user=${userId}</a></p>`
        );
    }
};
