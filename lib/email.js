// lib/email.js
// Helpers for building MIME emails and personalising templates.

/**
 * Build a base64url-encoded MIME email with both plain text and HTML parts.
 * Supports threading via In-Reply-To / References headers.
 */
function buildRawEmail({ name, from, to, subject, body, inReplyTo, references }) {
    const boundary = `boundary_${Date.now()}`;

    const headers = [
        `From: ${name} <${from}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];
    if (inReplyTo)  headers.push(`In-Reply-To: ${inReplyTo}`);
    if (references) headers.push(`References: ${references}`);

    // Final Professional Spacing (10px margins, full width, Arial font)
    const htmlBody = body.trim().split(/\n\s*\n/).filter(p => p.trim()).map(para => {
        const cleanPara = para.trim().replace(/\r?\n/g, '<br>');
        return `<p style="margin: 0 0 10px 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #000000;">${cleanPara}</p>`;
    }).join('');

    const email = [
        ...headers,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        ``,
        body,
        ``,
        `--${boundary}`,
        `Content-Type: text/html; charset="UTF-8"`,
        ``,
        `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #000000;">`,
        htmlBody,
        `</div>`,
        ``,
        `--${boundary}--`,
    ].join('\r\n');

    return Buffer.from(email).toString('base64url');
}

/**
 * Replace {{first_name}}, {{company_name}}, {{vertical}} in a template string.
 */
function personalise(template, contact) {
    return template
        .replace(/\{\{first_name\}\}/g,   contact.first_name   || contact.name?.split(' ')[0] || '')
        .replace(/\{\{company_name\}\}/g, contact.company_name || contact.company || '')
        .replace(/\{\{vertical\}\}/g,     contact.vertical     || '');
}

module.exports = { buildRawEmail, personalise };
