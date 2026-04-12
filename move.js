const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<!-- Follow-up Dashboard -->[\s\S]*?<div class="btn-group"[^>]*>[\s\S]*?<\/div>\s*<\/div>/;
const match = regex.exec(html);

if (match) {
    let followupHtml = match[0];
    
    // Remove from old location
    html = html.replace(followupHtml, '');
    
    // Modify to be its own card
    followupHtml = followupHtml.replace('class="followup-dashboard" id="followupDashboard"', 'class="card" id="followupQueueSection"');
    
    const oldHeaderRegex = /<div class="followup-dashboard-title">([\s\S]*?)Follow-up Queue\s*<\/div>/;
    const newHeader = '<div class="card-header">\n<h2 class="card-title">\n<span class="step-badge"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 9h14M12 5l4 4-4 4" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg></span>Follow-up Queue</h2>\n<div class="card-subtitle">Monitor and manage scheduled follow-ups</div>\n</div>';
    followupHtml = followupHtml.replace(oldHeaderRegex, newHeader);

    // Insert before analytics
    html = html.replace('<!-- Analytics Section -->', "<!-- Follow-up Queue Section -->\n" + followupHtml + '\n\n        <!-- Analytics Section -->');

    fs.writeFileSync('index.html', html, 'utf8');
    console.log('Moved successfully!');
} else {
    console.log('Not found');
}
