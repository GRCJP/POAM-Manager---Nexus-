// ═══════════════════════════════════════════════════════════════
// EXECUTIVE DASHBOARD METRICS ENGINE
// Computes and renders all dashboard KPIs from IndexedDB data.
// Every tile is clickable and drills down to source POAMs.
// ═══════════════════════════════════════════════════════════════

console.log('📊 dashboard-metrics.js loading...');

let _dashTrendChart = null;
let _dashStatusDonut = null;
let _dashAllPOAMs = [];
let _dashTrendRange = 30;

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════

async function loadDashboardMetrics() {
    console.log('📊 Loading executive dashboard metrics...');
    try {
        if (!poamDB) { console.error('❌ poamDB not defined'); return; }
        try {
            if (!poamDB.db) await poamDB.init();
            // Test if connection is still alive
            poamDB.db.transaction(['poams'], 'readonly');
        } catch (e) {
            console.warn('⚠️ DB connection stale, re-initializing...', e.message);
            poamDB.db = null;
            await poamDB.init();
        }

        const poams = await poamDB.getAllPOAMs();
        _dashAllPOAMs = poams;

        let scanRuns = [];
        try { scanRuns = await poamDB.getAllScanRuns(); } catch (e) { console.warn('⚠️ getAllScanRuns failed:', e.message || e); }

        let criticalAssets = [];
        try { criticalAssets = await poamDB.getCriticalAssets(); } catch (e) { console.warn('⚠️ getCriticalAssets failed:', e.message || e); }

        console.log(`📊 Dashboard: ${poams.length} POAMs, ${scanRuns.length} scan runs, ${criticalAssets.length} critical assets`);

        computeAndRenderKPIs(poams);
        try { renderCriticalAssetSection(poams, criticalAssets); } catch (e) { console.warn('⚠️ renderCriticalAssetSection:', e.message); }
        try { renderTrendChart(poams, scanRuns); } catch (e) { console.warn('⚠️ renderTrendChart:', e.message); }
        try { renderRiskDistribution(poams); } catch (e) { console.warn('⚠️ renderRiskDistribution:', e.message); }
        try { renderStatusDonut(poams); } catch (e) { console.warn('⚠️ renderStatusDonut:', e.message); }
        try { renderControlFamilyHeatmap(poams); } catch (e) { console.warn('⚠️ renderControlFamilyHeatmap:', e.message); }
        try { renderTeamTable(poams); } catch (e) { console.warn('⚠️ renderTeamTable:', e.message); }
        try { renderModuleBadges(poams); } catch (e) { console.warn('⚠️ renderModuleBadges:', e.message); }

        const ts = new Date().toLocaleTimeString();
        const el = document.getElementById('dash-last-updated');
        if (el) el.textContent = `Updated ${ts}`;

        console.log('✅ Dashboard metrics loaded');
    } catch (err) {
        console.error('❌ Dashboard metrics error:', err.message || String(err), err.stack || '');
    }
}

// ═══════════════════════════════════════════════════════════════
// KPI COMPUTATION
// ═══════════════════════════════════════════════════════════════

function computeAndRenderKPIs(poams) {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const getStatus = p => (p.findingStatus || p.status || 'open').toLowerCase();
    const getRisk = p => (p.riskLevel || p.risk || 'medium').toLowerCase();
    const getDueDate = p => new Date(p.updatedScheduledCompletionDate || p.dueDate);
    const isOpen = p => { const s = getStatus(p); return s !== 'completed' && s !== 'closed' && s !== 'risk-accepted' && s !== 'ignored'; };
    const isClosed = p => { const s = getStatus(p); return s === 'completed' || s === 'closed'; };

    const openPOAMs = poams.filter(isOpen);
    const closedPOAMs = poams.filter(isClosed);

    const totalOpen = openPOAMs.length;
    const overdue = openPOAMs.filter(p => getDueDate(p) < now).length;
    const comingDue = openPOAMs.filter(p => { const d = getDueDate(p); return d >= now && d <= thirtyDays; }).length;
    const closedThisMonth = closedPOAMs.filter(p => {
        const d = new Date(p.actualCompletionDate || p.lastModifiedDate);
        return d >= monthStart;
    }).length;

    const critHigh = openPOAMs.filter(p => { const r = getRisk(p); return r === 'critical' || r === 'high'; }).length;
    const mttr = computeMTTR(closedPOAMs);
    const patchable = computePatchable(openPOAMs);
    const delayed = computeDelayed(poams);
    const slaCompliance = computeSLACompliance(poams);

    setText('dash-total-open', totalOpen);
    setText('dash-total-open-sub', totalOpen === 0 ? 'No open POAMs' : `${((totalOpen - overdue) / Math.max(totalOpen, 1) * 100).toFixed(0)}% within SLA`);
    setText('dash-overdue', overdue);
    setText('dash-overdue-sub', overdue === 0 ? 'All on track' : 'Requires attention');
    setText('dash-coming-due', comingDue);
    setText('dash-coming-due-sub', `Next 30 days workload`);
    setText('dash-closed-month', closedThisMonth);
    setText('dash-closed-month-sub', closedPOAMs.length > 0 ? `${closedPOAMs.length} total closed` : 'Velocity indicator');

    setText('dash-crit-high', critHigh);
    setText('dash-crit-high-sub', `${poams.filter(p => getRisk(p) === 'critical').length} critical, ${poams.filter(p => getRisk(p) === 'high').length} high`);
    setText('dash-mttr', mttr === null ? 'N/A' : `${mttr}d`);
    setText('dash-mttr-sub', mttr === null ? 'No closed POAMs' : `Avg days to close`);
    setText('dash-patchable', patchable.patchable);
    setText('dash-patchable-sub', `${patchable.coordination} require coordination`);
    setText('dash-delayed', delayed);
    setText('dash-delayed-sub', delayed === 0 ? 'No schedule slippage' : 'Schedule extended');
    setText('dash-sla-compliance', `${slaCompliance}%`);
    setText('dash-sla-compliance-sub', slaCompliance === 100 ? 'All POAMs within SLA' : `${100 - slaCompliance}% breached SLA`);
}

function computeMTTR(closedPOAMs) {
    const durations = closedPOAMs
        .filter(p => p.createdDate && (p.actualCompletionDate || p.lastModifiedDate))
        .map(p => {
            const start = new Date(p.createdDate);
            const end = new Date(p.actualCompletionDate || p.lastModifiedDate);
            return Math.max(0, Math.round((end - start) / 86400000));
        })
        .filter(d => d > 0 && d < 3650);

    if (durations.length === 0) return null;
    return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

function computePatchable(openPOAMs) {
    let patchable = 0;
    let coordination = 0;
    openPOAMs.forEach(p => {
        const rt = (p.remediationType || p.remediation_type || '').toLowerCase();
        if (rt.includes('patch') || rt.includes('kb_install') || rt.includes('update') || rt.includes('upgrade')) {
            patchable++;
        } else if (rt) {
            coordination++;
        } else {
            const desc = (p.findingDescription || p.description || p.mitigation || '').toLowerCase();
            if (desc.includes('patch') || desc.includes('update') || desc.includes('upgrade') || desc.includes('install')) {
                patchable++;
            } else {
                coordination++;
            }
        }
    });
    return { patchable, coordination };
}

function computeDelayed(poams) {
    return poams.filter(p => {
        if (!p.initialScheduledCompletionDate || !p.updatedScheduledCompletionDate) return false;
        return new Date(p.updatedScheduledCompletionDate) > new Date(p.initialScheduledCompletionDate);
    }).length;
}

function computeSLACompliance(poams) {
    const open = poams.filter(p => {
        const s = (p.findingStatus || p.status || 'open').toLowerCase();
        return s !== 'completed' && s !== 'closed';
    });
    if (open.length === 0) return 100;
    const now = new Date();
    const withinSLA = open.filter(p => new Date(p.updatedScheduledCompletionDate || p.dueDate) >= now).length;
    return Math.round(withinSLA / open.length * 100);
}

// ═══════════════════════════════════════════════════════════════
// TREND CHART
// ═══════════════════════════════════════════════════════════════

function renderTrendChart(poams, scanRuns) {
    const canvas = document.getElementById('dash-trend-chart');
    const emptyMsg = document.getElementById('dash-trend-empty');
    if (!canvas) return;

    if (poams.length === 0) {
        canvas.style.display = 'none';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    canvas.style.display = 'block';
    if (emptyMsg) emptyMsg.classList.add('hidden');

    const now = new Date();
    const rangeStart = new Date(now.getTime() - _dashTrendRange * 86400000);
    const labels = [];
    const openData = [];
    const newData = [];
    const closedData = [];

    const getStatus = p => (p.findingStatus || p.status || 'open').toLowerCase();
    const isClosed = s => s === 'completed' || s === 'closed';

    const dayMs = 86400000;
    const step = _dashTrendRange <= 30 ? 1 : (_dashTrendRange <= 60 ? 2 : 3);

    for (let d = new Date(rangeStart); d <= now; d = new Date(d.getTime() + step * dayMs)) {
        const dayStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

        let openCount = 0;
        let newCount = 0;
        let closedCount = 0;

        poams.forEach(p => {
            const created = new Date(p.createdDate || p.lastModifiedDate);
            const status = getStatus(p);
            const closedDate = p.actualCompletionDate ? new Date(p.actualCompletionDate) : null;

            if (created <= d && (!isClosed(status) || (closedDate && closedDate > d))) {
                openCount++;
            }
            const createdDay = created.toISOString().split('T')[0];
            if (createdDay === dayStr) newCount++;
            if (closedDate) {
                const closedDay = closedDate.toISOString().split('T')[0];
                if (closedDay === dayStr) closedCount++;
            }
        });

        openData.push(openCount);
        newData.push(newCount);
        closedData.push(closedCount);
    }

    if (_dashTrendChart) _dashTrendChart.destroy();

    _dashTrendChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Total Open',
                    data: openData,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99,102,241,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2
                },
                {
                    label: 'New',
                    data: newData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 2
                },
                {
                    label: 'Closed',
                    data: closedData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.1)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 10 } },
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

function setTrendRange(days) {
    _dashTrendRange = days;
    document.querySelectorAll('.trend-range-btn').forEach(btn => {
        if (parseInt(btn.dataset.range) === days) {
            btn.className = 'trend-range-btn text-xs px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 font-medium';
        } else {
            btn.className = 'trend-range-btn text-xs px-3 py-1 rounded-lg bg-slate-100 text-slate-500 font-medium';
        }
    });
    if (_dashAllPOAMs.length > 0) {
        poamDB.getAllScanRuns().then(runs => renderTrendChart(_dashAllPOAMs, runs));
    }
}

// ═══════════════════════════════════════════════════════════════
// RISK DISTRIBUTION (CSS bars)
// ═══════════════════════════════════════════════════════════════

function renderRiskDistribution(poams) {
    const container = document.getElementById('dash-risk-bars');
    if (!container) return;

    const getRisk = p => (p.riskLevel || p.risk || 'medium').toLowerCase();
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    poams.forEach(p => {
        const r = getRisk(p);
        if (counts.hasOwnProperty(r)) counts[r]++;
        else if (r === 'moderate') counts.medium++;
    });

    const total = poams.length || 1;
    const colors = { critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-amber-400', low: 'bg-green-400' };
    const textColors = { critical: 'text-red-700', high: 'text-orange-700', medium: 'text-amber-700', low: 'text-green-700' };

    if (poams.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400">No POAMs to display</p>';
        return;
    }

    container.innerHTML = Object.entries(counts).map(([level, count]) => {
        const pct = Math.round(count / total * 100);
        return `
            <div class="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors" onclick="dashboardDrillDown('${level}')">
                <div class="w-20 text-right">
                    <span class="text-xs font-bold ${textColors[level]} capitalize">${level}</span>
                </div>
                <div class="flex-1">
                    <div class="w-full bg-slate-100 rounded-full h-3">
                        <div class="${colors[level]} h-3 rounded-full transition-all" style="width: ${Math.max(pct, 2)}%"></div>
                    </div>
                </div>
                <div class="w-16 text-right">
                    <span class="text-sm font-bold text-slate-700">${count}</span>
                    <span class="text-xs text-slate-400 ml-1">(${pct}%)</span>
                </div>
            </div>`;
    }).join('');
}

// ═══════════════════════════════════════════════════════════════
// STATUS DONUT (Chart.js)
// ═══════════════════════════════════════════════════════════════

function renderStatusDonut(poams) {
    const canvas = document.getElementById('dash-status-donut');
    const emptyMsg = document.getElementById('dash-status-empty');
    if (!canvas) return;

    if (poams.length === 0) {
        canvas.style.display = 'none';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    canvas.style.display = 'block';
    if (emptyMsg) emptyMsg.classList.add('hidden');

    const getStatus = p => (p.findingStatus || p.status || 'open').toLowerCase();
    const now = new Date();
    const statusCounts = { open: 0, 'in-progress': 0, completed: 0, overdue: 0, 'risk-accepted': 0 };

    poams.forEach(p => {
        const s = getStatus(p);
        if (s === 'completed' || s === 'closed') {
            statusCounts.completed++;
        } else if (s === 'risk-accepted' || s === 'ignored') {
            statusCounts['risk-accepted']++;
        } else if (s === 'in-progress' || s === 'in_progress') {
            statusCounts['in-progress']++;
        } else {
            const due = new Date(p.updatedScheduledCompletionDate || p.dueDate);
            if (due < now) statusCounts.overdue++;
            else statusCounts.open++;
        }
    });

    if (_dashStatusDonut) _dashStatusDonut.destroy();

    _dashStatusDonut = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Open', 'In Progress', 'Completed', 'Overdue', 'Risk Accepted'],
            datasets: [{
                data: [statusCounts.open, statusCounts['in-progress'], statusCounts.completed, statusCounts.overdue, statusCounts['risk-accepted']],
                backgroundColor: ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#94a3b8'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 }, padding: 12 } }
            },
            onClick: (evt, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const filters = ['open', 'in-progress', 'closed', 'overdue', 'risk-accepted'];
                    dashboardDrillDown(filters[idx]);
                }
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// CONTROL FAMILY HEATMAP
// ═══════════════════════════════════════════════════════════════

function renderControlFamilyHeatmap(poams) {
    const container = document.getElementById('dash-control-family-heatmap');
    if (!container) return;

    if (poams.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400">No POAMs to display</p>';
        return;
    }

    const getRisk = p => (p.riskLevel || p.risk || 'medium').toLowerCase();
    const getStatus = p => (p.findingStatus || p.status || 'open').toLowerCase();
    const now = new Date();
    const families = {};

    poams.forEach(p => {
        const cf = p.controlFamily || 'Unknown';
        if (!families[cf]) families[cf] = { total: 0, critical: 0, high: 0, medium: 0, low: 0, overdue: 0 };
        families[cf].total++;
        const r = getRisk(p);
        if (r === 'critical') families[cf].critical++;
        else if (r === 'high') families[cf].high++;
        else if (r === 'medium' || r === 'moderate') families[cf].medium++;
        else families[cf].low++;

        const s = getStatus(p);
        if (s !== 'completed' && s !== 'closed') {
            const due = new Date(p.updatedScheduledCompletionDate || p.dueDate);
            if (due < now) families[cf].overdue++;
        }
    });

    const sorted = Object.entries(families).sort(([, a], [, b]) => b.total - a.total);
    const maxCount = sorted[0]?.[1]?.total || 1;

    const familyNames = {
        'AC': 'Access Control', 'AU': 'Audit & Accountability', 'AT': 'Awareness & Training',
        'CM': 'Configuration Mgmt', 'CP': 'Contingency Planning', 'IA': 'Identification & Auth',
        'IR': 'Incident Response', 'MA': 'Maintenance', 'MP': 'Media Protection',
        'PE': 'Physical & Environmental', 'PL': 'Planning', 'PS': 'Personnel Security',
        'RA': 'Risk Assessment', 'CA': 'Assessment & Authorization', 'SC': 'System & Comms Protection',
        'SI': 'System & Info Integrity', 'SA': 'System & Services Acquisition', 'PM': 'Program Management'
    };

    container.innerHTML = sorted.slice(0, 12).map(([family, data]) => {
        const pct = Math.round(data.total / maxCount * 100);
        const critW = Math.round(data.critical / data.total * 100);
        const highW = Math.round(data.high / data.total * 100);
        const medW = Math.round(data.medium / data.total * 100);
        const lowW = 100 - critW - highW - medW;
        const name = familyNames[family] || family;

        return `
            <div class="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors" onclick="dashboardDrillDown('control-family-${family}')">
                <div class="w-10 text-center">
                    <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">${family}</span>
                </div>
                <div class="w-40 text-sm text-slate-600 truncate" title="${name}">${name}</div>
                <div class="flex-1">
                    <div class="w-full bg-slate-100 rounded-full h-3 flex overflow-hidden" style="width: ${Math.max(pct, 10)}%">
                        ${data.critical > 0 ? `<div class="bg-red-500 h-3" style="width:${critW}%"></div>` : ''}
                        ${data.high > 0 ? `<div class="bg-orange-500 h-3" style="width:${highW}%"></div>` : ''}
                        ${data.medium > 0 ? `<div class="bg-amber-400 h-3" style="width:${medW}%"></div>` : ''}
                        ${data.low > 0 ? `<div class="bg-green-400 h-3" style="width:${lowW}%"></div>` : ''}
                    </div>
                </div>
                <div class="w-12 text-right">
                    <span class="text-sm font-bold text-slate-700">${data.total}</span>
                </div>
                ${data.overdue > 0 ? `<span class="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">${data.overdue} overdue</span>` : '<span class="w-16"></span>'}
            </div>`;
    }).join('');
}

// ═══════════════════════════════════════════════════════════════
// POC TEAM TABLE
// ═══════════════════════════════════════════════════════════════

function renderTeamTable(poams) {
    const tbody = document.getElementById('dash-team-table-body');
    if (!tbody) return;

    if (poams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-400">No POAMs to display</td></tr>';
        return;
    }

    const getStatus = p => (p.findingStatus || p.status || 'open').toLowerCase();
    const isOpen = p => { const s = getStatus(p); return s !== 'completed' && s !== 'closed' && s !== 'risk-accepted' && s !== 'ignored'; };
    const isClosed = p => { const s = getStatus(p); return s === 'completed' || s === 'closed'; };
    const now = new Date();

    const teams = {};
    poams.forEach(p => {
        const team = p.poc || p.pocTeam || 'Unassigned';
        if (!teams[team]) teams[team] = { open: 0, overdue: 0, ages: [], mttrDays: [] };

        if (isOpen(p)) {
            teams[team].open++;
            const due = new Date(p.updatedScheduledCompletionDate || p.dueDate);
            if (due < now) teams[team].overdue++;
            if (p.createdDate) {
                teams[team].ages.push(Math.round((now - new Date(p.createdDate)) / 86400000));
            }
        }
        if (isClosed(p) && p.createdDate) {
            const end = new Date(p.actualCompletionDate || p.lastModifiedDate);
            const days = Math.round((end - new Date(p.createdDate)) / 86400000);
            if (days > 0 && days < 3650) teams[team].mttrDays.push(days);
        }
    });

    const sorted = Object.entries(teams).sort(([, a], [, b]) => b.open - a.open);

    tbody.innerHTML = sorted.map(([team, data]) => {
        const avgAge = data.ages.length > 0 ? Math.round(data.ages.reduce((a, b) => a + b, 0) / data.ages.length) : '—';
        const mttr = data.mttrDays.length > 0 ? Math.round(data.mttrDays.reduce((a, b) => a + b, 0) / data.mttrDays.length) + 'd' : '—';

        return `
            <tr class="border-b border-slate-100 hover:bg-indigo-50 cursor-pointer transition-colors" onclick="dashboardDrillDown('poc-team-${encodeURIComponent(team)}')">
                <td class="py-2.5 px-3 font-medium text-slate-800">${escapeHtmlDash(team)}</td>
                <td class="py-2.5 px-3 text-center"><span class="font-bold ${data.open > 0 ? 'text-indigo-600' : 'text-slate-400'}">${data.open}</span></td>
                <td class="py-2.5 px-3 text-center"><span class="font-bold ${data.overdue > 0 ? 'text-red-600' : 'text-slate-400'}">${data.overdue}</span></td>
                <td class="py-2.5 px-3 text-center text-slate-600">${avgAge}${typeof avgAge === 'number' ? 'd' : ''}</td>
                <td class="py-2.5 px-3 text-center text-slate-600">${mttr}</td>
            </tr>`;
    }).join('');
}

// ═══════════════════════════════════════════════════════════════
// MODULE BADGES
// ═══════════════════════════════════════════════════════════════

function renderModuleBadges(poams) {
    const vulnBadge = document.getElementById('dash-badge-vuln');
    if (vulnBadge && poams.length > 0) {
        vulnBadge.textContent = `${poams.length} POAMs`;
        vulnBadge.classList.remove('hidden');
    }

    const evidenceData = JSON.parse(localStorage.getItem('evidenceFiles') || '[]');
    const evidenceBadge = document.getElementById('dash-badge-evidence');
    if (evidenceBadge && evidenceData.length > 0) {
        evidenceBadge.textContent = `${evidenceData.length} artifacts`;
        evidenceBadge.classList.remove('hidden');
    }
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL SEARCH
// ═══════════════════════════════════════════════════════════════

function dashboardGlobalSearch(query) {
    const container = document.getElementById('dash-search-results');
    if (!container) return;

    if (!query || query.length < 2) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    const q = query.toLowerCase();
    const matches = _dashAllPOAMs.filter(p => {
        return (p.id || '').toLowerCase().includes(q) ||
               (p.vulnerabilityName || p.title || '').toLowerCase().includes(q) ||
               (p.findingDescription || p.description || '').toLowerCase().includes(q) ||
               (p.controlFamily || '').toLowerCase().includes(q) ||
               (p.poc || p.pocTeam || '').toLowerCase().includes(q);
    }).slice(0, 10);

    if (matches.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400 py-2">No matching POAMs found</p>';
        container.classList.remove('hidden');
        return;
    }

    const getRisk = p => (p.riskLevel || p.risk || 'medium').toLowerCase();
    const riskColors = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-green-100 text-green-700' };

    container.innerHTML = matches.map(p => {
        const risk = getRisk(p);
        const color = riskColors[risk] || 'bg-slate-100 text-slate-700';
        const title = p.vulnerabilityName || p.title || p.findingDescription || 'Untitled';
        return `
            <div class="flex items-center gap-3 p-2 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors" onclick="showPOAMDetails('${p.id}')">
                <span class="font-mono text-xs font-bold text-indigo-600 w-28 truncate">${p.id}</span>
                <span class="text-sm text-slate-700 flex-1 truncate">${escapeHtmlDash(title)}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded ${color} capitalize">${risk}</span>
                <span class="text-xs text-slate-400">${p.controlFamily || '—'}</span>
            </div>`;
    }).join('');
    container.classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL ASSET EXPOSURE
// ═══════════════════════════════════════════════════════════════

let _dashCriticalAssets = [];

function poamAffectsCriticalAsset(poam, criticalAssets) {
    if (!Array.isArray(poam.affectedAssets) || poam.affectedAssets.length === 0) return false;
    for (const ca of criticalAssets) {
        const caName = (ca.name || '').toLowerCase();
        const caHostname = (ca.hostname || '').toLowerCase();
        const caIp = (ca.ip || '').toLowerCase();
        for (const asset of poam.affectedAssets) {
            const aName = (asset.name || asset.asset_name || '').toLowerCase();
            const aId = (asset.id || asset.asset_id || '').toLowerCase();
            const aIp = (asset.ip || asset.ipv4 || '').toLowerCase();
            if ((caName && (aName.includes(caName) || aId.includes(caName))) ||
                (caHostname && (aName.includes(caHostname) || aId.includes(caHostname))) ||
                (caIp && caIp === aIp)) {
                return true;
            }
        }
    }
    return false;
}

function getCriticalAssetsForPOAM(poam, criticalAssets) {
    const matched = [];
    if (!Array.isArray(poam.affectedAssets)) return matched;
    for (const ca of criticalAssets) {
        const caName = (ca.name || '').toLowerCase();
        const caHostname = (ca.hostname || '').toLowerCase();
        const caIp = (ca.ip || '').toLowerCase();
        for (const asset of poam.affectedAssets) {
            const aName = (asset.name || asset.asset_name || '').toLowerCase();
            const aId = (asset.id || asset.asset_id || '').toLowerCase();
            const aIp = (asset.ip || asset.ipv4 || '').toLowerCase();
            if ((caName && (aName.includes(caName) || aId.includes(caName))) ||
                (caHostname && (aName.includes(caHostname) || aId.includes(caHostname))) ||
                (caIp && caIp === aIp)) {
                if (!matched.find(m => m.id === ca.id)) matched.push(ca);
                break;
            }
        }
    }
    return matched;
}

function renderCriticalAssetSection(poams, criticalAssets) {
    _dashCriticalAssets = criticalAssets;
    const kpiEl = document.getElementById('dash-critical-asset-poams');
    const subEl = document.getElementById('dash-critical-asset-sub');
    const tableEl = document.getElementById('dash-critical-asset-table');

    if (!kpiEl) return;

    const getStatus = p => (p.findingStatus || p.status || 'open').toLowerCase();
    const isOpen = p => { const s = getStatus(p); return s !== 'completed' && s !== 'closed' && s !== 'risk-accepted' && s !== 'ignored'; };
    const getRisk = p => (p.riskLevel || p.risk || 'medium').toLowerCase();

    if (criticalAssets.length === 0) {
        kpiEl.textContent = '—';
        if (subEl) subEl.textContent = 'No critical assets registered';
        if (tableEl) tableEl.innerHTML = '<p class="text-sm text-slate-400 py-3">No critical assets registered. <a href="#" onclick="showModule(\'settings\'); setTimeout(() => showSettingsTab(\'critical-assets\'), 200)" class="text-indigo-600 hover:underline">Add critical assets in Settings</a></p>';
        return;
    }

    const openPOAMs = poams.filter(isOpen);
    const affectedPOAMs = openPOAMs.filter(p => poamAffectsCriticalAsset(p, criticalAssets));

    kpiEl.textContent = affectedPOAMs.length;
    if (subEl) {
        const critCount = affectedPOAMs.filter(p => getRisk(p) === 'critical' || getRisk(p) === 'high').length;
        subEl.textContent = affectedPOAMs.length === 0
            ? `${criticalAssets.length} assets monitored, all clear`
            : `${critCount} critical/high severity across ${criticalAssets.length} assets`;
    }

    if (!tableEl) return;

    // Build per-asset summary
    const assetSummaries = criticalAssets.map(ca => {
        const matching = openPOAMs.filter(p => poamAffectsCriticalAsset(p, [ca]));
        const sources = new Set();
        matching.forEach(p => {
            const src = (p.findingSource || 'Unknown').toLowerCase();
            if (src.includes('scan')) sources.add('Scan');
            else if (src.includes('pen') || src.includes('test')) sources.add('Pen Test');
            else if (src.includes('assess')) sources.add('Assessment');
            else if (src.includes('cm') || src.includes('continuous') || src.includes('monitor')) sources.add('CM');
            else sources.add(p.findingSource || 'Other');
        });
        const topSeverity = matching.reduce((top, p) => {
            const r = getRisk(p);
            const order = { critical: 4, high: 3, medium: 2, low: 1 };
            return (order[r] || 0) > (order[top] || 0) ? r : top;
        }, 'none');
        return { asset: ca, openCount: matching.length, topSeverity, sources: Array.from(sources) };
    }).sort((a, b) => b.openCount - a.openCount);

    const sevColors = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-green-100 text-green-700', none: 'bg-slate-100 text-slate-500' };
    const tagColors = { 'publicly-exposed': 'bg-red-50 text-red-600', 'critical-infrastructure': 'bg-purple-50 text-purple-600', 'pii-phi': 'bg-blue-50 text-blue-600', 'high-value-target': 'bg-amber-50 text-amber-600' };

    tableEl.innerHTML = `
        <table class="w-full text-xs">
            <thead><tr class="border-b border-slate-200">
                <th class="text-left py-1.5 px-2 font-semibold text-slate-500">Asset</th>
                <th class="text-center py-1.5 px-2 font-semibold text-slate-500">Open POAMs</th>
                <th class="text-center py-1.5 px-2 font-semibold text-slate-500">Top Severity</th>
                <th class="text-left py-1.5 px-2 font-semibold text-slate-500">Tags</th>
                <th class="text-left py-1.5 px-2 font-semibold text-slate-500">Sources</th>
            </tr></thead>
            <tbody>${assetSummaries.slice(0, 8).map(s => `
                <tr class="border-b border-slate-50 hover:bg-rose-50 cursor-pointer" onclick="dashboardDrillDown('critical-assets')">
                    <td class="py-1.5 px-2 font-medium text-slate-700">${escapeHtmlDash(s.asset.name || s.asset.hostname)}</td>
                    <td class="py-1.5 px-2 text-center"><span class="font-bold ${s.openCount > 0 ? 'text-rose-600' : 'text-slate-400'}">${s.openCount}</span></td>
                    <td class="py-1.5 px-2 text-center"><span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${sevColors[s.topSeverity] || sevColors.none} capitalize">${s.topSeverity}</span></td>
                    <td class="py-1.5 px-2">${s.asset.tags.map(t => `<span class="text-[9px] font-medium px-1 py-0.5 rounded ${tagColors[t] || 'bg-slate-100 text-slate-500'} mr-1">${t}</span>`).join('')}</td>
                    <td class="py-1.5 px-2 text-slate-500">${s.sources.join(', ') || '—'}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
}

// ═══════════════════════════════════════════════════════════════
// DRILL-DOWN NAVIGATION
// ═══════════════════════════════════════════════════════════════

function dashboardDrillDown(filterType) {
    console.log(`📊 Dashboard drill-down: ${filterType}`);
    showModule('vulnerability-tracking');
    setTimeout(() => {
        if (typeof filterPOAMsByMetric === 'function') {
            filterPOAMsByMetric(filterType);
        }
    }, 300);
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function escapeHtmlDash(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
