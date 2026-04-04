// lib/email.js
// Helpers for building MIME emails and personalising templates.

/**
 * Escape HTML special characters in plain text content.
 */
function escText(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Parse **bold** markdown to <b>bold</b> HTML.
 */
function parseBold(text) {
    return text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

/**
 * Build an HTML email signature block from a signature object.
 * @param {Object} sig - { name, title, email, linkedin, teams, website }
 */
function renderSignatureHtml(sig) {
    if (!sig || !sig.name) return '';
    const rows = [];
    if (sig.email)    rows.push(`<tr><td style="padding:3px 16px 3px 0;color:#64748B;font-size:13px;white-space:nowrap;vertical-align:top;">Mail</td><td style="padding:3px 0;font-size:13px;"><a href="mailto:${sig.email}" style="color:#2563EB;text-decoration:none;">${sig.email}</a></td></tr>`);
    if (sig.linkedin) rows.push(`<tr><td style="padding:3px 16px 3px 0;color:#64748B;font-size:13px;white-space:nowrap;vertical-align:top;">LinkedIn</td><td style="padding:3px 0;font-size:13px;"><a href="${sig.linkedin}" style="color:#2563EB;text-decoration:none;">${sig.linkedin}</a></td></tr>`);
    if (sig.teams)    rows.push(`<tr><td style="padding:3px 16px 3px 0;color:#64748B;font-size:13px;white-space:nowrap;vertical-align:top;">Teams</td><td style="padding:3px 0;font-size:13px;"><a href="${sig.teams}" style="color:#2563EB;text-decoration:none;">${sig.teams}</a></td></tr>`);
    if (sig.website)  rows.push(`<tr><td style="padding:3px 16px 3px 0;color:#64748B;font-size:13px;white-space:nowrap;vertical-align:top;">Website</td><td style="padding:3px 0;font-size:13px;"><a href="${sig.website}" style="color:#2563EB;text-decoration:none;">${sig.website}</a></td></tr>`);
    return `<div style="margin-top:28px;padding-top:18px;border-top:1px solid #E2E8F0;font-family:Arial,Helvetica,sans-serif;"><p style="margin:0 0 2px 0;font-weight:bold;font-size:14px;color:#0F172A;">${escText(sig.name)}</p>\r\n<p style="margin:0 0 14px 0;font-size:13px;color:#64748B;">${escText(sig.title || '')}</p>\r\n${rows.length ? `<table style="border-collapse:collapse;line-height:1.7;">${rows.join('')}</table>` : ''}</div>`;
}

/**
 * Build a plain-text signature block with -- separator.
 */
function renderSignaturePlain(sig) {
    if (!sig || !sig.name) return '';
    const lines = ['\n--', sig.name];
    if (sig.title)    lines.push(sig.title);
    if (sig.email)    lines.push(`Mail: ${sig.email}`);
    if (sig.linkedin) lines.push(`LinkedIn: ${sig.linkedin}`);
    if (sig.teams)    lines.push(`Teams: ${sig.teams}`);
    if (sig.website)  lines.push(`Website: ${sig.website}`);
    return lines.join('\n');
}

/**
 * Build a base64url-encoded MIME email with both plain text and HTML parts.
 * Supports threading via In-Reply-To / References headers.
 * Supports **bold** markdown in body.
 * Appends a structured HTML signature if provided.
 */
function buildRawEmail({ name, from, to, subject, body, inReplyTo, references, signature }) {
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

    // HTML body: split by paragraphs, parse **bold**, wrap in <p> tags
    const htmlBody = body.trim().split(/\n\s*\n/).filter(p => p.trim()).map(para => {
        const cleanPara = parseBold(para.trim().replace(/\r?\n/g, '<br>'));
        return `<p style="margin: 0 0 10px 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #000000;">${cleanPara}</p>`;
    }).join('');

    const signatureHtml  = renderSignatureHtml(signature);
    const signaturePlain = renderSignaturePlain(signature);

    const email = [
        ...headers,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        ``,
        body + signaturePlain,
        ``,
        `--${boundary}`,
        `Content-Type: text/html; charset="UTF-8"`,
        ``,
        `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #000000;">`,
        htmlBody + signatureHtml,
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
