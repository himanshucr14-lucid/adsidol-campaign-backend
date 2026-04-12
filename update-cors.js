const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'api');
const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));

const corsLogicBlock = `
    // Secure Dynamic CORS for Adsidol
    const reqOrigin = req.headers.origin || req.headers.referer || '';
    if (reqOrigin.includes('adsidol.com') || reqOrigin.includes('localhost') || reqOrigin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', reqOrigin.replace(/\\/$/, ""));
    } else {
        res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://www.adsidol.com');
    }
`;

for (const file of files) {
    const filePath = path.join(apiDir, file);
    let code = fs.readFileSync(filePath, 'utf8');

    let modified = false;

    // Special handling for login.js which had complex logic
    if (file === 'login.js') {
        const regexLogin = /const origin = req\.headers\.origin[\s\S]*?res\.setHeader\('Access-Control-Allow-Origin', process\.env\.ALLOWED_ORIGIN \|\| 'https:\/\/www\.adsidol\.com'\);\n    \}/m;
        if (regexLogin.test(code)) {
            code = code.replace(regexLogin, corsLogicBlock.trim());
            modified = true;
        }
    } 
    // Special handling for templates.js
    else if (file === 'templates.js') {
        const regexTemplates = /function cors\(res\) {[\s\S]*?res\.setHeader\('Access-Control-Allow-Origin', process\.env\.ALLOWED_ORIGIN \|\| '\*'\);/;
        if (regexTemplates.test(code)) {
            code = code.replace(regexTemplates, `function cors(req, res) {\n${corsLogicBlock}`);
            code = code.replace('cors(res);', 'cors(req, res);');
            modified = true;
        }
    }
    else {
        // Standard replacement for the typical 2-liner:
        // res.setHeader('Access-Control-Allow-Origin', origin.replace(/\/$/, ""));
        // res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
        const regexStandard = /res\.setHeader\('Access-Control-Allow-Origin'.*?\n\s*res\.setHeader\('Access-Control-Allow-Origin'.*?\n/m;
        
        // Also look for single liners
        const regexSingle = /res\.setHeader\('Access-Control-Allow-Origin', process\.env\.ALLOWED_ORIGIN \|\| '\*'\);/m;

        if (regexStandard.test(code)) {
            code = code.replace(regexStandard, corsLogicBlock + '\n');
            modified = true;
        } else if (regexSingle.test(code)) {
            code = code.replace(regexSingle, corsLogicBlock.trim());
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, code, 'utf8');
        console.log(`Updated CORS logic in ${file}`);
    } else {
        console.log(`No match found in ${file}`);
    }
}
