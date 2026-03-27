// lib/gmail.js
// Builds a Gmail OAuth2 client, optionally loading credentials for a specific user.

const { google } = require('googleapis');

function getOAuthClient(user = null) {
    const client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
    );
    if (user) {
        client.setCredentials({
            access_token:  user.accessToken,
            refresh_token: user.refreshToken,
        });
    }
    return client;
}

module.exports = { getOAuthClient, google };
