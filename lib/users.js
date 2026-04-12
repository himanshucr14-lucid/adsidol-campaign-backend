// lib/users.js
// Registry of the 4 Adsidol founders.
// API keys and Gmail tokens are loaded from env vars at runtime.

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

function getUserByApiKey(apiKey) {
    if (!apiKey) return null;
    return USERS.find(u => u.apiKey && u.apiKey === apiKey) || null;
}

function getUserById(id) {
    if (!id) return null;
    return USERS.find(u => u.id === id.toLowerCase()) || null;
}

module.exports = { USERS, getUserByApiKey, getUserById };
