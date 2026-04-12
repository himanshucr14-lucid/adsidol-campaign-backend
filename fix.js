const fs = require('fs');

const filePath = 'e:\\\\111\\\\adsidol-campaign-backend-main\\\\adsidol-campaign-manager-v6.html';
let content = fs.readFileSync(filePath, 'utf-8');

const badFix = "updateHistoryDashboard();\\n                    updateStats();";
if (content.includes(badFix)) {
    content = content.replace(badFix, "updateHistoryDashboard();\\n                    updateStats();".replace('\\\\n', '\\n'));
    console.log("Fixed the trailing slash n string");
}

const historyHtml = `
        <!-- Sent Emails History Section -->
        <div class="card" id="historySection">
            <div class="card-header">
                <h2 class="card-title">
                    <span class="step-badge">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M2 9v4a2 2 0 002 2h10a2 2 0 002-2V9M9 12V2M5 6l4-4 4 4" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </span>
                    Sent Emails History
                </h2>
                <div style="font-size:13px; color:var(--text-muted);">Pulled live from Cloud Storage</div>
            </div>

            <div class="table-controls">
                <div class="search-box">
                    <span class="search-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="7" cy="7" r="4.5" stroke="var(--text-muted)" stroke-width="1.5" />
                            <path d="M10.5 10.5l3 3" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" />
                        </svg>
                    </span>
                    <input type="text" id="searchHistory" placeholder="Search history...">
                </div>

                <select id="historyVerticalFilter" style="width: auto; min-width: 150px;">
                    <option value="">All Verticals</option>
                    <option value="Fintech (DC & CC Disbursal)">Fintech (DC & CC)</option>
                    <option value="Fintech (FTD)">Fintech (FTD)</option>
                    <option value="iGaming (FTD)">iGaming (FTD)</option>
                    <option value="Crypto (FTD)">Crypto (FTD)</option>
                    <option value="Ecommerce (AOV)">Ecommerce (AOV)</option>
                    <option value="VPN">VPN</option>
                </select>

                <select id="historyDateFilter" style="width: auto; min-width: 150px;">
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="14days">Last 14 Days</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="thismonth">This Month</option>
                    <option value="lastmonth">Last Month</option>
                    <option value="custom">Custom Range...</option>
                </select>

                <div id="customDateRange" style="display: none; align-items: center; gap: 8px;">
                    <input type="date" id="historyStartDate" class="btn" style="padding: 6px; height: 38px;">
                    <span style="color:var(--text-light);font-size:13px;">to</span>
                    <input type="date" id="historyEndDate" class="btn" style="padding: 6px; height: 38px;">
                </div>
            </div>

            <div class="table-container">
                <table class="contacts-table">
                    <thead>
                        <tr>
                            <th>Sent Date</th>
                            <th>Name</th>
                            <th>Email Address</th>
                            <th>Vertical</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="historyTableBody">
                        <tr><td colspan="5"><div style="text-align:center;padding:32px;color:var(--text-muted);">Loading history...</div></td></tr>
                    </tbody>
                </table>
            </div>
            
            <div id="historyPagination" class="pagination" style="display: none; padding:16px;">
                <button class="btn btn-secondary" id="historyPrevBtn" disabled>Previous</button>
                <div class="page-info" style="font-size:14px;color:var(--text-muted);">Page <span id="historyCurrentPage" style="font-weight:600;color:var(--text);">1</span> of <span id="historyTotalPages" style="font-weight:600;color:var(--text);">1</span></div>
                <button class="btn btn-secondary" id="historyNextBtn" disabled>Next</button>
            </div>
        </div>
`;

if (!content.includes('id="historySection"')) {
    const target = "    <!-- Edit Contact Modal -->";
    const idx = content.indexOf(target);
    if (idx !== -1) {
        let slice = content.slice(0, idx);
        const lastDivIndex = slice.lastIndexOf("    </div>");
        if (lastDivIndex !== -1) {
            content = slice.slice(0, lastDivIndex) + historyHtml + "\\n    </div>\\n\\n" + content.slice(idx);
            console.log("Injected HTML successfully");
        } else console.log("Failed to find division");
    } else console.log("Failed to find Editor Modal");
}

fs.writeFileSync(filePath, content, 'utf-8');
