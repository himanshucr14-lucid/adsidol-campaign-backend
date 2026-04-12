const fs = require('fs');

const htmlPath = 'e:\\\\111\\\\adsidol-campaign-backend-main\\\\adsidol-campaign-manager-v6.html';
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// 1. Extract Styles
// We will look for all <style> tags and extract them
let remainingHtml = htmlContent;
let combinedCss = '';

let styleCount = 0;
while (remainingHtml.includes('<style>')) {
    const startIdx = remainingHtml.indexOf('<style>');
    const endIdx = remainingHtml.indexOf('</style>', startIdx);
    
    if (endIdx !== -1) {
        const cssContent = remainingHtml.substring(startIdx + 7, endIdx).trim(); // +7 for <style> 
        combinedCss += cssContent + '\\n\\n';
        
        // Remove from HTML.
        // We will replace the first style tag with our link, the remaining we just remove.
        if (styleCount === 0) {
            remainingHtml = remainingHtml.substring(0, startIdx) + '<link rel="stylesheet" href="style.css">' + remainingHtml.substring(endIdx + 8);
        } else {
            remainingHtml = remainingHtml.substring(0, startIdx) + remainingHtml.substring(endIdx + 8);
        }
        
        styleCount++;
    } else {
        break;
    }
}

// 2. Extract Scripts
let combinedJs = '';
let scriptCount = 0;

while (remainingHtml.includes('<script>')) {
    const startIdx = remainingHtml.indexOf('<script>');
    const endIdx = remainingHtml.indexOf('</script>', startIdx);
    
    if (endIdx !== -1) {
        const jsContent = remainingHtml.substring(startIdx + 8, endIdx).trim(); // +8 for <script> 
        combinedJs += jsContent + '\\n\\n';
        
        // Remove from HTML.
        // We will drop the external script link right before </body>
        remainingHtml = remainingHtml.substring(0, startIdx) + remainingHtml.substring(endIdx + 9);
        
        scriptCount++;
    } else {
        break;
    }
}

// We need to inject the script at the bottom
const bodyIdx = remainingHtml.lastIndexOf('</body>');
if (bodyIdx !== -1) {
    remainingHtml = remainingHtml.substring(0, bodyIdx) + '    <script src="app.js"></script>\\n' + remainingHtml.substring(bodyIdx);
}

// Write the files
fs.writeFileSync('e:\\\\111\\\\adsidol-campaign-backend-main\\\\style.css', combinedCss, 'utf-8');
fs.writeFileSync('e:\\\\111\\\\adsidol-campaign-backend-main\\\\app.js', combinedJs, 'utf-8');
fs.writeFileSync('e:\\\\111\\\\adsidol-campaign-backend-main\\\\index.html', remainingHtml, 'utf-8');

console.log('Files generated successfully.');
