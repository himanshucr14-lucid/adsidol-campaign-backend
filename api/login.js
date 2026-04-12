// api/login.js
// POST /api/login — validates user credentials and returns API key

function getUserFromApiKey(apiKey) {
    const users = ['PARAMJIT', 'MONI', 'UJJWAL', 'HEMLETA'];
    for (const user of users) {
        if (process.env[`${user}_API_KEY`] === apiKey) {
            return user;
        }
    }
    return null;
}

module.exports = async (req, res) => {
    // Permissive CORS for adsidol.com
    // Secure Dynamic CORS for Adsidol
    const reqOrigin = req.headers.origin || req.headers.referer || '';
    if (reqOrigin.includes('adsidol.com') || reqOrigin.includes('localhost') || reqOrigin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', reqOrigin.replace(/\/$/, ""));
    } else {
        res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://www.adsidol.com');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ ok: false, error: 'Missing email or password' });
    }

    // Map email to user ID
    const emailToUser = {
        'paramjit@adsidol.com': 'PARAMJIT',
        'moni@adsidol.com': 'MONI',
        'ujjwal@adsidol.com': 'UJJWAL',
        'hemleta@adsidol.com': 'HEMLETA'
    };

    const userKey = emailToUser[email.toLowerCase()];
    if (!userKey) {
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    // Check password
    const storedPassword = process.env[`${userKey}_PASSWORD`];
    if (!storedPassword || password !== storedPassword) {
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    // Return API key
    const apiKey = process.env[`${userKey}_API_KEY`];
    if (!apiKey) {
        return res.status(500).json({ ok: false, error: 'API key not configured for this user' });
    }

    // Check if Gmail is connected
    const hasTokens = !!(process.env[`${userKey}_ACCESS_TOKEN`] && process.env[`${userKey}_REFRESH_TOKEN`]);

    return res.status(200).json({
        ok: true,
        user: {
            id: userKey.toLowerCase(),
            name: userKey.charAt(0) + userKey.slice(1).toLowerCase(),
            email: email.toLowerCase()
        },
        apiKey: apiKey,
        gmailConnected: hasTokens
    });
};
