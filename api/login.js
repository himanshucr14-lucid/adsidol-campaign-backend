// api/login.js
// POST /api/login
// Body: { email, password }
// Returns: { ok: true, user: { id, name, email, senderEmail }, apiKey }
//
// Validates email + password for one of the 4 Adsidol founders.
// Password for each user is set via env vars: PARAMJIT_PASSWORD, MONI_PASSWORD, etc.
// On success, returns the user's API key so the frontend can authenticate further calls.

const USERS = [
    {
        id:          'paramjit',
        name:        'Paramjit',
        senderEmail: 'Paramjit@adsidol.com',
        get apiKey()       { return process.env.PARAMJIT_API_KEY; },
        get accessToken()  { return process.env.PARAMJIT_ACCESS_TOKEN; },
        get refreshToken() { return process.env.PARAMJIT_REFRESH_TOKEN; },
        get password()     { return process.env.PARAMJIT_PASSWORD; },
    },
    {
        id:          'moni',
        name:        'Moni',
        senderEmail: 'moni@adsidol.com',
        get apiKey()       { return process.env.MONI_API_KEY; },
        get accessToken()  { return process.env.MONI_ACCESS_TOKEN; },
        get refreshToken() { return process.env.MONI_REFRESH_TOKEN; },
        get password()     { return process.env.MONI_PASSWORD; },
    },
    {
        id:          'ujjwal',
        name:        'Ujjwal',
        senderEmail: 'Ujjwal@adsidol.com',
        get apiKey()       { return process.env.UJJWAL_API_KEY; },
        get accessToken()  { return process.env.UJJWAL_ACCESS_TOKEN; },
        get refreshToken() { return process.env.UJJWAL_REFRESH_TOKEN; },
        get password()     { return process.env.UJJWAL_PASSWORD; },
    },
    {
        id:          'hemleta',
        name:        'Hemleta',
        senderEmail: 'Hemleta@adsidol.com',
        get apiKey()       { return process.env.HEMLETA_API_KEY; },
        get accessToken()  { return process.env.HEMLETA_ACCESS_TOKEN; },
        get refreshToken() { return process.env.HEMLETA_REFRESH_TOKEN; },
        get password()     { return process.env.HEMLETA_PASSWORD; },
    },
];

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-api-key');
}

module.exports = async (req, res) => {
    try {
        cors(res);
        if (req.method === 'OPTIONS') return res.status(200).end();
        if (req.method !== 'POST') {
            return res.status(405).json({ ok: false, error: 'Method not allowed — use POST' });
        }

        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ ok: false, error: 'Email and password are required' });
        }

        // Find user by email (case-insensitive)
        const user = USERS.find(u => u.senderEmail.toLowerCase() === email.toLowerCase().trim());

        if (!user) {
            // Generic error — don't reveal which emails are valid
            return res.status(401).json({ ok: false, error: 'Invalid email or password' });
        }

        // Check password against env var (e.g. PARAMJIT_PASSWORD)
        const envKey  = `${user.id.toUpperCase()}_PASSWORD`;
        const stored  = process.env[envKey];

        if (!stored) {
            console.error(`Password env var ${envKey} is not set`);
            return res.status(500).json({ ok: false, error: 'Account not fully configured — contact admin' });
        }

        if (stored !== password) {
            return res.status(401).json({ ok: false, error: 'Invalid email or password' });
        }

        // Return user info + API key for subsequent requests
        return res.status(200).json({
            ok:   true,
            user: {
                id:          user.id,
                name:        user.name,
                email:       user.senderEmail,
                senderEmail: user.senderEmail,
            },
            apiKey: user.apiKey,  // frontend uses this for all API calls
        });
    } catch (e) {
        return res.status(500).json({ ok: false, error: "CRASH: " + String(e.message), stack: e.stack });
    }
};
