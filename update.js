const fs = require('fs');

const filePath = 'e:\\\\111\\\\adsidol-campaign-backend-main\\\\adsidol-campaign-manager-v6.html';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. empty state fix
const markerStart = "const first = contacts.length === 0;";
const markerEnd = "return;";

const idx1 = content.indexOf(markerStart);
const idx2 = content.indexOf(markerEnd, idx1);

if (idx1 !== -1 && idx2 !== -1) {
    const replacement = `const first = contacts.length === 0;
                tbody.innerHTML = first
                    ? '<tr><td colspan="9"><div class="empty-state"><div class="empty-text">No active contacts loaded in this session.</div></div></td></tr>'
                    : '<tr><td colspan="9"><div class="empty-state"><div class="empty-text">No contacts match your filters.</div></div></td></tr>';
                `;
    content = content.slice(0, idx1) + replacement + content.slice(idx2);
}

// 2. Insert HTML at the end of .container (line 3399 approx)
let htmlInsertMarker = '        </div>\\n    </div>\\n\\n    <!-- Edit Contact Modal -->';
if (content.indexOf(htmlInsertMarker) === -1) {
    htmlInsertMarker = '        </div>\\r\\n    </div>\\r\\n\\r\\n    <!-- Edit Contact Modal -->';
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

if (content.indexOf(htmlInsertMarker) !== -1) {
    content = content.replace(htmlInsertMarker, historyHtml + htmlInsertMarker);
}

// 3. Insert JS logic
const jsInjectMarker = "        async function fetchCloudAnalytics() {";
const jsHistoryCode = `
        // ═══════════════════════════════════════════════
        // HISTORY DASHBOARD LOGIC
        // ═══════════════════════════════════════════════
        let historyCurrentPage = 1;
        const historyPerPage = 20;
        
        function updateHistoryDashboard() {
            const tbody = document.getElementById('historyTableBody');
            
            if (!analyticsData || analyticsData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-text">No sent emails found in your cloud history.</div></div></td></tr>';
                document.getElementById('historyPagination').style.display = 'none';
                return;
            }

            const searchVal = document.getElementById('searchHistory').value.toLowerCase();
            const verticalVal = document.getElementById('historyVerticalFilter').value;
            const dateFilter = document.getElementById('historyDateFilter').value;
            const customStart = document.getElementById('historyStartDate').value;
            const customEnd = document.getElementById('historyEndDate').value;

            // Date calculations
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const yesterday = today - 86400000;
            const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();

            // Filter data
            const filtered = analyticsData.filter(e => {
                // Search filter
                const nameStr = (e.name || '').toLowerCase();
                const emailStr = (e.email || '').toLowerCase();
                if (searchVal && !nameStr.includes(searchVal) && !emailStr.includes(searchVal)) return false;
                
                // Vertical filter
                if (verticalVal && e.vertical !== verticalVal) return false;
                
                // Date filter
                if (e.date && dateFilter !== 'all') {
                    if (dateFilter === 'today' && e.date < today) return false;
                    if (dateFilter === 'yesterday' && (e.date < yesterday || e.date >= today)) return false;
                    if (dateFilter === '7days' && e.date < (now.getTime() - 7 * 86400000)) return false;
                    if (dateFilter === '14days' && e.date < (now.getTime() - 14 * 86400000)) return false;
                    if (dateFilter === '30days' && e.date < (now.getTime() - 30 * 86400000)) return false;
                    if (dateFilter === 'thismonth' && e.date < startOfThisMonth) return false;
                    if (dateFilter === 'lastmonth' && (e.date < startOfLastMonth || e.date > endOfLastMonth)) return false;
                    
                    if (dateFilter === 'custom') {
                        if (customStart && e.date < new Date(customStart).getTime()) return false;
                        if (customEnd) {
                            const endT = new Date(customEnd);
                            endT.setHours(23, 59, 59, 999);
                            if (e.date > endT.getTime()) return false;
                        }
                    }
                }
                return true;
            });
            
            // Sort by descending date
            filtered.sort((a, b) => (b.date || 0) - (a.date || 0));

            const totalPages = Math.max(1, Math.ceil(filtered.length / historyPerPage));
            if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;

            const startIndex = (historyCurrentPage - 1) * historyPerPage;
            const pageData = filtered.slice(startIndex, startIndex + historyPerPage);

            if (pageData.length === 0) {
                 tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-text">No history matches your filters.</div></div></td></tr>';
                 document.getElementById('historyPagination').style.display = 'none';
                 return;
            }

            tbody.innerHTML = pageData.map(e => {
                const dateStr = e.date ? new Date(e.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'Unknown Date';
                const typeIndicator = e.type === 'followup' ? '<span style="background:var(--indigo-500);color:white;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;margin-left:8px;">Follow-up</span>' : '';
                return '<tr><td style="font-weight:600;color:var(--text);">' + dateStr + '</td><td style="font-weight:600;">' + escHtml(e.name || '—') + '</td><td style="color:var(--text-light);">' + escHtml(e.email || '—') + ' ' + typeIndicator + '</td><td style="color:var(--blue-600);font-weight:600;">' + escHtml(e.vertical || '—') + '</td><td><span class="status status-sent"><span class="status-icon"></span>Sent</span></td></tr>';
            }).join('');
            
            // Pagination controls
            if (filtered.length > historyPerPage) {
                document.getElementById('historyPagination').style.display = 'flex';
                document.getElementById('historyPagination').style.alignItems = 'center';
                document.getElementById('historyPagination').style.justifyContent = 'space-between';
                document.getElementById('historyCurrentPage').textContent = historyCurrentPage;
                document.getElementById('historyTotalPages').textContent = totalPages;
                document.getElementById('historyPrevBtn').disabled = historyCurrentPage === 1;
                document.getElementById('historyNextBtn').disabled = historyCurrentPage === totalPages;
            } else {
                document.getElementById('historyPagination').style.display = 'none';
            }
        }
        
        document.getElementById('historyDateFilter').addEventListener('change', (ev) => {
            document.getElementById('customDateRange').style.display = ev.target.value === 'custom' ? 'flex' : 'none';
            historyCurrentPage = 1;
            updateHistoryDashboard();
        });
        
        ['searchHistory', 'historyVerticalFilter', 'historyStartDate', 'historyEndDate'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => { historyCurrentPage = 1; updateHistoryDashboard(); });
        });
        
        document.getElementById('historyPrevBtn').addEventListener('click', () => {
            if (historyCurrentPage > 1) { historyCurrentPage--; updateHistoryDashboard(); }
        });
        
        document.getElementById('historyNextBtn').addEventListener('click', () => {
             historyCurrentPage++; updateHistoryDashboard();
        });

`;

if (content.indexOf(jsInjectMarker) !== -1) {
    content = content.replace(jsInjectMarker, jsHistoryCode + jsInjectMarker);
}

// 4. Hook updateHistoryDashboard() into fetchCloudAnalytics
const fetchFnTarget = "updateStats();";
if (content.indexOf(fetchFnTarget) !== -1) {
    content = content.replace(fetchFnTarget, "updateHistoryDashboard();\\n                    updateStats();");
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Update Finished!');
