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

function dashNormalizeStatus(raw) {
    const s = String(raw || 'open').toLowerCase().trim().replace('_', '-');
    if (s === 'risk accepted') return 'risk-accepted';
    return s;
}

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
        
        // Load POAM Activity Monitor widget
        try { 
            if (typeof renderPOAMActivityWidget === 'function') {
                await renderPOAMActivityWidget('poam-activity-widget'); 
            }
        } catch (e) { 
            console.warn('⚠️ renderPOAMActivityWidget:', e.message); 
        }

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

    const normalizeStatus = (raw) => {
        const s = String(raw || 'open').toLowerCase().trim().replace('_', '-');
        if (s === 'risk accepted') return 'risk-accepted';
        return s;
    };
    const getStatus = p => normalizeStatus(p.findingStatus || p.status || 'open');
    const getRisk = p => (p.riskLevel || p.risk || 'medium').toLowerCase();
    const getDueDate = p => {
        const d = new Date(p.updatedScheduledCompletionDate || p.dueDate);
        return Number.isNaN(d.getTime()) ? null : d;
    };
    const isOpen = p => { const s = getStatus(p); return s !== 'completed' && s !== 'closed' && s !== 'risk-accepted' && s !== 'ignored'; };
    const isClosed = p => { const s = getStatus(p); return s === 'completed' || s === 'closed'; };

    const openPOAMs = poams.filter(isOpen);
    const closedPOAMs = poams.filter(isClosed);

    const totalOpen = openPOAMs.length;
    const overdue = openPOAMs.filter(p => { const d = getDueDate(p); return d && d < now; }).length;
    const comingDue = openPOAMs.filter(p => { const d = getDueDate(p); return d && d >= now && d <= thirtyDays; }).length;
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
    const normalizeStatus = (raw) => {
        const s = String(raw || 'open').toLowerCase().trim().replace('_', '-');
        if (s === 'risk accepted') return 'risk-accepted';
        return s;
    };
    const open = poams.filter(p => {
        const s = normalizeStatus(p.findingStatus || p.status || 'open');
        return s !== 'completed' && s !== 'closed' && s !== 'risk-accepted' && s !== 'ignored';
    });
    if (open.length === 0) return 100;
    const now = new Date();
    const withinSLA = open.filter(p => {
        const d = new Date(p.updatedScheduledCompletionDate || p.dueDate);
        return !Number.isNaN(d.getTime()) && d >= now;
    }).length;
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

    const getStatus = p => dashNormalizeStatus(p.findingStatus || p.status || 'open');
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
                    borderColor: '#0D7377',
                    backgroundColor: 'rgba(13,115,119,0.1)',
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
            btn.className = 'trend-range-btn text-xs px-3 py-1 rounded-lg bg-teal-50 text-teal-700 font-medium';
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
    const textColors = { critical: 'text-red-700', high: 'text-amber-800', medium: 'text-amber-700', low: 'text-green-700' };

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

    const getStatus = p => dashNormalizeStatus(p.findingStatus || p.status || 'open');
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
                backgroundColor: ['#0D7377', '#f59e0b', '#6B7280', '#ef4444', '#94a3b8'],
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
    const getStatus = p => dashNormalizeStatus(p.findingStatus || p.status || 'open');
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
                    <span class="text-xs font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">${family}</span>
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

    const getStatus = p => dashNormalizeStatus(p.findingStatus || p.status || 'open');
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
            <tr class="border-b border-slate-100 hover:bg-teal-50 cursor-pointer transition-colors" onclick="dashboardDrillDown('poc-team-${encodeURIComponent(team)}')">
                <td class="py-2.5 px-3 font-medium text-slate-800">${escapeHtmlDash(team)}</td>
                <td class="py-2.5 px-3 text-center"><span class="font-bold ${data.open > 0 ? 'text-teal-700' : 'text-slate-400'}">${data.open}</span></td>
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
    const riskColors = { critical: 'bg-red-100 text-red-700', high: 'bg-amber-50 text-amber-800', medium: 'bg-amber-100 text-amber-700', low: 'bg-green-100 text-green-700' };

    container.innerHTML = matches.map(p => {
        const risk = getRisk(p);
        const color = riskColors[risk] || 'bg-slate-100 text-slate-700';
        const title = p.vulnerabilityName || p.title || p.findingDescription || 'Untitled';
        return `
            <div class="flex items-center gap-3 p-2 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors" onclick="showPOAMDetails('${p.id}')">
                <span class="font-mono text-xs font-bold text-teal-700 w-28 truncate">${p.id}</span>
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

    const getStatus = p => dashNormalizeStatus(p.findingStatus || p.status || 'open');
    const isOpen = p => { const s = getStatus(p); return s !== 'completed' && s !== 'closed' && s !== 'risk-accepted' && s !== 'ignored'; };
    const getRisk = p => (p.riskLevel || p.risk || 'medium').toLowerCase();

    if (criticalAssets.length === 0) {
        kpiEl.textContent = '—';
        if (subEl) subEl.textContent = 'No critical assets registered';
        if (tableEl) tableEl.innerHTML = '<p class="text-sm text-slate-400 py-3">No critical assets registered. <a href="#" onclick="showModule(\'settings\'); setTimeout(() => showSettingsTab(\'critical-assets\'), 200)" class="text-teal-700 hover:underline">Add critical assets in Settings</a></p>';
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

    const sevColors = { critical: 'bg-red-100 text-red-700', high: 'bg-amber-50 text-amber-800', medium: 'bg-amber-100 text-amber-700', low: 'bg-green-100 text-green-700', none: 'bg-slate-100 text-slate-500' };
    const tagColors = { 'publicly-exposed': 'bg-red-50 text-red-600', 'critical-infrastructure': 'bg-teal-50 text-teal-700', 'pii-phi': 'bg-blue-50 text-blue-600', 'high-value-target': 'bg-amber-50 text-amber-600' };

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
// ═══════════════════════════════════════════════════════════════
// EXECUTIVE REPORTS ENGINE
// Live report generation, search, history, and export.
// Primary formats: Excel (XLSX) and CSV. Secondary: OSCAL JSON.
// ═══════════════════════════════════════════════════════════════

console.log('📋 executive-reports.js loading...');

let _reportHistory = [];

// ═══════════════════════════════════════════════════════════════
// MODULE INITIALIZATION
// ═══════════════════════════════════════════════════════════════

async function loadReportingModule() {
    console.log('📋 Loading reporting module...');
    try {
        if (!poamDB || !poamDB.db) await poamDB.init();
        await loadReportHistory();
        renderReportHistory();
        console.log('✅ Reporting module loaded');
    } catch (err) {
        console.error('❌ Reporting module error:', err);
    }
}

// ═══════════════════════════════════════════════════════════════
// REPORT GENERATION
// ═══════════════════════════════════════════════════════════════

async function generateReport(reportType) {
    console.log(`📋 Generating report: ${reportType}`);
    const statusEl = document.getElementById('report-gen-status');
    if (statusEl) {
        statusEl.textContent = 'Generating report...';
        statusEl.classList.remove('hidden');
    }

    try {
        if (!poamDB || !poamDB.db) await poamDB.init();
        const poams = await poamDB.getAllPOAMs();
        const scanRuns = await poamDB.getAllScanRuns();

        const dateFrom = document.getElementById('report-date-from')?.value || '';
        const dateTo = document.getElementById('report-date-to')?.value || '';

        let filteredPOAMs = poams;
        if (dateFrom) {
            filteredPOAMs = filteredPOAMs.filter(p => new Date(p.createdDate) >= new Date(dateFrom));
        }
        if (dateTo) {
            filteredPOAMs = filteredPOAMs.filter(p => new Date(p.createdDate) <= new Date(dateTo + 'T23:59:59'));
        }

        let reportData;
        switch (reportType) {
            case 'status-summary':
                reportData = generateStatusSummary(filteredPOAMs, scanRuns);
                break;
            case 'quarterly-compliance':
                reportData = generateQuarterlyCompliance(filteredPOAMs, scanRuns);
                break;
            case 'executive-summary':
                reportData = generateExecutiveSummary(filteredPOAMs, scanRuns);
                break;
            case 'risk-assessment':
                reportData = generateRiskAssessment(filteredPOAMs);
                break;
            case 'team-performance':
                reportData = generateTeamPerformance(filteredPOAMs);
                break;
            case 'control-family':
                reportData = generateControlFamilyReport(filteredPOAMs);
                break;
            default:
                throw new Error(`Unknown report type: ${reportType}`);
        }

        renderReportViewer(reportData);

        const snapshot = {
            id: `RPT-${Date.now()}`,
            type: reportType,
            title: reportData.title,
            generatedAt: new Date().toISOString(),
            dateRange: { from: dateFrom, to: dateTo },
            poamCount: filteredPOAMs.length,
            summary: reportData.summary || '',
            data: reportData
        };

        await saveReportSnapshot(snapshot);
        await loadReportHistory();
        renderReportHistory();

        if (statusEl) statusEl.classList.add('hidden');
    } catch (err) {
        console.error('❌ Report generation error:', err);
        if (statusEl) {
            statusEl.textContent = `Error: ${err.message}`;
            statusEl.className = 'text-sm text-red-600 mt-2';
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// REPORT TYPE GENERATORS
// ═══════════════════════════════════════════════════════════════

function generateStatusSummary(poams, scanRuns) {
    const now = new Date();
    const getStatus = p => dashNormalizeStatus(p.findingStatus || p.status || 'open');
    const getRisk = p => (p.riskLevel || p.risk || 'medium').toLowerCase();
    const isOpen = p => { const s = getStatus(p); return s !== 'completed' && s !== 'closed' && s !== 'risk-accepted'; };

    const open = poams.filter(isOpen);
    const closed = poams.filter(p => getStatus(p) === 'completed' || getStatus(p) === 'closed');
    const overdue = open.filter(p => new Date(p.updatedScheduledCompletionDate || p.dueDate) < now);

    const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    poams.forEach(p => { const r = getRisk(p); if (riskCounts.hasOwnProperty(r)) riskCounts[r]++; });

    return {
        type: 'status-summary',
        title: 'POAM Status Summary Report',
        summary: `${poams.length} total POAMs: ${open.length} open, ${closed.length} closed, ${overdue.length} overdue`,
        sections: [
            { heading: 'Overview', rows: [
                ['Total POAMs', poams.length], ['Open', open.length], ['Closed', closed.length],
                ['Overdue', overdue.length], ['Last Scan', scanRuns[0]?.importedAt || 'N/A']
            ]},
            { heading: 'Risk Distribution', rows: Object.entries(riskCounts).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v]) },
            { heading: 'Status Breakdown', rows: [
                ['Open', open.length], ['Closed', closed.length], ['Overdue', overdue.length],
                ['Risk Accepted', poams.filter(p => getStatus(p) === 'risk-accepted').length]
            ]}
        ],
        exportRows: poams.map(p => ({
            'POAM ID': p.id, 'Vulnerability': p.vulnerabilityName || p.title || '', 'Status': p.findingStatus || p.status || '',
            'Risk Level': p.riskLevel || p.risk || '', 'Control Family': p.controlFamily || '', 'POC': p.poc || '',
            'Due Date': p.updatedScheduledCompletionDate || p.dueDate || '', 'Created': p.createdDate || ''
        }))
    };
}

function generateQuarterlyCompliance(poams, scanRuns) {
    const now = new Date();
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const getStatus = p => dashNormalizeStatus(p.findingStatus || p.status || 'open');
    const isOpen = p => { const s = getStatus(p); return s !== 'completed' && s !== 'closed'; };

    const open = poams.filter(isOpen);
    const withinSLA = open.filter(p => new Date(p.updatedScheduledCompletionDate || p.dueDate) >= now);
    const slaCompliance = open.length > 0 ? Math.round(withinSLA.length / open.length * 100) : 100;
    const mttr = computeMTTR(poams.filter(p => getStatus(p) === 'completed' || getStatus(p) === 'closed'));

    return {
        type: 'quarterly-compliance',
        title: `Quarterly Compliance Report — Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`,
        summary: `SLA Compliance: ${slaCompliance}%, MTTR: ${mttr || 'N/A'} days, ${scanRuns.length} scans processed`,
        sections: [
            { heading: 'Compliance Metrics', rows: [
                ['SLA Compliance Rate', `${slaCompliance}%`], ['Mean Time to Remediate', mttr ? `${mttr} days` : 'N/A'],
                ['Total Scans Processed', scanRuns.length], ['Quarter Start', qStart.toLocaleDateString()]
            ]},
            { heading: 'POAM Inventory', rows: [
                ['Total POAMs', poams.length], ['Open', open.length], ['Within SLA', withinSLA.length],
                ['Outside SLA', open.length - withinSLA.length]
            ]}
        ],
        exportRows: poams.map(p => ({
            'POAM ID': p.id, 'Vulnerability': p.vulnerabilityName || '', 'Status': p.findingStatus || p.status || '',
            'Risk': p.riskLevel || p.risk || '', 'Control Family': p.controlFamily || '', 'POC': p.poc || '',
            'Initial Due': p.initialScheduledCompletionDate || '', 'Current Due': p.updatedScheduledCompletionDate || p.dueDate || '',
            'Actual Completion': p.actualCompletionDate || '', 'SLA Status': new Date(p.updatedScheduledCompletionDate || p.dueDate) >= now ? 'Within SLA' : 'Outside SLA'
        }))
    };
}

function generateExecutiveSummary(poams, scanRuns) {
    const now = new Date();
    const getStatus = p => dashNormalizeStatus(p.findingStatus || p.status || 'open');
    const getRisk = p => (p.riskLevel || p.risk || 'medium').toLowerCase();
    const isOpen = p => { const s = getStatus(p); return s !== 'completed' && s !== 'closed'; };

    const open = poams.filter(isOpen);
    const critical = open.filter(p => getRisk(p) === 'critical').length;
    const overdue = open.filter(p => new Date(p.updatedScheduledCompletionDate || p.dueDate) < now).length;

    return {
        type: 'executive-summary',
        title: 'Executive Security Summary',
        summary: `${open.length} open POAMs, ${critical} critical, ${overdue} overdue`,
        sections: [
            { heading: 'Key Metrics', rows: [
                ['Total Open POAMs', open.length], ['Critical Findings', critical], ['Overdue Items', overdue],
                ['Total Scans', scanRuns.length]
            ]},
            { heading: 'Risk Posture', rows: [
                ['Critical', poams.filter(p => getRisk(p) === 'critical').length],
                ['High', poams.filter(p => getRisk(p) === 'high').length],
                ['Medium', poams.filter(p => getRisk(p) === 'medium' || getRisk(p) === 'moderate').length],
                ['Low', poams.filter(p => getRisk(p) === 'low').length]
            ]}
        ],
        exportRows: [{ 'Metric': 'Open POAMs', 'Value': open.length }, { 'Metric': 'Critical', 'Value': critical }, { 'Metric': 'Overdue', 'Value': overdue }]
    };
}

function generateRiskAssessment(poams) {
    const getRisk = p => (p.riskLevel || p.risk || 'medium').toLowerCase();
    const getStatus = p => dashNormalizeStatus(p.findingStatus || p.status || 'open');
    const now = new Date();

    const openPoams = poams.filter(p => { const s = getStatus(p); return s !== 'completed' && s !== 'closed'; });
    const ages = openPoams.filter(p => p.createdDate).map(p => Math.round((now - new Date(p.createdDate)) / 86400000));
    const avgAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;

    const patchable = computePatchable(openPoams);

    return {
        type: 'risk-assessment',
        title: 'Risk Assessment Report',
        summary: `${openPoams.length} open POAMs, avg age ${avgAge} days, ${patchable.patchable} patchable`,
        sections: [
            { heading: 'Risk Overview', rows: [
                ['Open POAMs', openPoams.length], ['Average Age (days)', avgAge],
                ['Patchable / Easy Wins', patchable.patchable], ['Requires Coordination', patchable.coordination]
            ]},
            { heading: 'Severity Breakdown', rows: ['critical', 'high', 'medium', 'low'].map(r => [
                r.charAt(0).toUpperCase() + r.slice(1), poams.filter(p => getRisk(p) === r).length
            ])}
        ],
        exportRows: poams.map(p => ({
            'POAM ID': p.id, 'Vulnerability': p.vulnerabilityName || '', 'Risk': p.riskLevel || p.risk || '',
            'Status': p.findingStatus || p.status || '', 'Age (days)': p.createdDate ? Math.round((now - new Date(p.createdDate)) / 86400000) : '',
            'Due Date': p.updatedScheduledCompletionDate || p.dueDate || ''
        }))
    };
}

function generateTeamPerformance(poams) {
    const getStatus = p => dashNormalizeStatus(p.findingStatus || p.status || 'open');
    const isOpen = p => { const s = getStatus(p); return s !== 'completed' && s !== 'closed'; };
    const now = new Date();

    const teams = {};
    poams.forEach(p => {
        const team = p.poc || p.pocTeam || 'Unassigned';
        if (!teams[team]) teams[team] = { open: 0, overdue: 0, closed: 0, ages: [], mttrDays: [] };
        if (isOpen(p)) {
            teams[team].open++;
            if (new Date(p.updatedScheduledCompletionDate || p.dueDate) < now) teams[team].overdue++;
            if (p.createdDate) teams[team].ages.push(Math.round((now - new Date(p.createdDate)) / 86400000));
        } else {
            teams[team].closed++;
            if (p.createdDate && p.actualCompletionDate) {
                const d = Math.round((new Date(p.actualCompletionDate) - new Date(p.createdDate)) / 86400000);
                if (d > 0 && d < 3650) teams[team].mttrDays.push(d);
            }
        }
    });

    const rows = Object.entries(teams).sort(([, a], [, b]) => b.open - a.open).map(([team, d]) => {
        const avgAge = d.ages.length > 0 ? Math.round(d.ages.reduce((a, b) => a + b, 0) / d.ages.length) : '—';
        const mttr = d.mttrDays.length > 0 ? Math.round(d.mttrDays.reduce((a, b) => a + b, 0) / d.mttrDays.length) : '—';
        return [team, d.open, d.overdue, d.closed, avgAge, mttr];
    });

    return {
        type: 'team-performance',
        title: 'POC Team Performance Report',
        summary: `${Object.keys(teams).length} teams tracked`,
        sections: [{ heading: 'Team Metrics', tableHeaders: ['Team', 'Open', 'Overdue', 'Closed', 'Avg Age', 'MTTR'], rows }],
        exportRows: rows.map(r => ({ 'Team': r[0], 'Open': r[1], 'Overdue': r[2], 'Closed': r[3], 'Avg Age (days)': r[4], 'MTTR (days)': r[5] }))
    };
}

function generateControlFamilyReport(poams) {
    const getRisk = p => (p.riskLevel || p.risk || 'medium').toLowerCase();
    const getStatus = p => dashNormalizeStatus(p.findingStatus || p.status || 'open');
    const now = new Date();

    const families = {};
    poams.forEach(p => {
        const cf = p.controlFamily || 'Unknown';
        if (!families[cf]) families[cf] = { total: 0, critical: 0, high: 0, medium: 0, low: 0, overdue: 0, open: 0 };
        families[cf].total++;
        const r = getRisk(p);
        if (families[cf].hasOwnProperty(r)) families[cf][r]++;
        const s = getStatus(p);
        if (s !== 'completed' && s !== 'closed') {
            families[cf].open++;
            if (new Date(p.updatedScheduledCompletionDate || p.dueDate) < now) families[cf].overdue++;
        }
    });

    const rows = Object.entries(families).sort(([, a], [, b]) => b.total - a.total)
        .map(([cf, d]) => [cf, d.total, d.open, d.critical, d.high, d.medium, d.low, d.overdue]);

    return {
        type: 'control-family',
        title: 'Control Family Analysis Report',
        summary: `${Object.keys(families).length} control families analyzed`,
        sections: [{ heading: 'Control Family Breakdown', tableHeaders: ['Family', 'Total', 'Open', 'Critical', 'High', 'Medium', 'Low', 'Overdue'], rows }],
        exportRows: rows.map(r => ({ 'Control Family': r[0], 'Total': r[1], 'Open': r[2], 'Critical': r[3], 'High': r[4], 'Medium': r[5], 'Low': r[6], 'Overdue': r[7] }))
    };
}

// ═══════════════════════════════════════════════════════════════
// REPORT VIEWER
// ═══════════════════════════════════════════════════════════════

function renderReportViewer(reportData) {
    const viewer = document.getElementById('report-viewer');
    if (!viewer) return;

    let html = `
        <div class="flex items-center justify-between mb-4">
            <div>
                <h3 class="text-lg font-bold text-slate-900">${reportData.title}</h3>
                <p class="text-sm text-slate-500">${reportData.summary}</p>
                <p class="text-xs text-slate-400 mt-1">Generated: ${new Date().toLocaleString()}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="exportReportCSV()" class="text-xs px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 font-medium">
                    <i class="fas fa-file-csv mr-1"></i>Export CSV
                </button>
                <button onclick="exportReportXLSX()" class="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium">
                    <i class="fas fa-file-excel mr-1"></i>Export XLSX
                </button>
                <button onclick="exportOSCALPOAM()" class="text-xs px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 font-medium" title="Secondary format for tool interoperability">
                    <i class="fas fa-code mr-1"></i>OSCAL JSON
                </button>
            </div>
        </div>`;

    reportData.sections.forEach(section => {
        html += `<div class="mb-6"><h4 class="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">${section.heading}</h4>`;
        if (section.tableHeaders) {
            html += `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="border-b border-slate-200">`;
            section.tableHeaders.forEach(h => { html += `<th class="text-left py-2 px-3 font-semibold text-slate-600">${h}</th>`; });
            html += `</tr></thead><tbody>`;
            section.rows.forEach(row => {
                html += `<tr class="border-b border-slate-100 hover:bg-slate-50">`;
                row.forEach(cell => { html += `<td class="py-2 px-3 text-slate-700">${cell}</td>`; });
                html += `</tr>`;
            });
            html += `</tbody></table></div>`;
        } else {
            html += `<div class="grid grid-cols-2 gap-2">`;
            section.rows.forEach(([label, value]) => {
                html += `<div class="flex justify-between p-2 bg-slate-50 rounded"><span class="text-slate-600">${label}</span><span class="font-bold text-slate-800">${value}</span></div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;
    });

    viewer.innerHTML = html;
    viewer.classList.remove('hidden');

    window._lastReportData = reportData;
}

// ═══════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function exportReportCSV() {
    const data = window._lastReportData;
    if (!data || !data.exportRows || data.exportRows.length === 0) {
        alert('No report data to export. Generate a report first.');
        return;
    }

    const headers = Object.keys(data.exportRows[0]);
    const csvRows = [headers.join(',')];
    data.exportRows.forEach(row => {
        csvRows.push(headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `${data.type}_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportReportXLSX() {
    const data = window._lastReportData;
    if (!data || !data.exportRows || data.exportRows.length === 0) {
        alert('No report data to export. Generate a report first.');
        return;
    }

    if (typeof XLSX === 'undefined') {
        alert('XLSX library not loaded. Please refresh the page.');
        return;
    }

    const ws = XLSX.utils.json_to_sheet(data.exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, data.type || 'Report');

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    XLSX.writeFile(wb, `${data.type}_${ts}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════
// REPORT HISTORY (IndexedDB)
// ═══════════════════════════════════════════════════════════════

async function saveReportSnapshot(snapshot) {
    try {
        if (!poamDB || !poamDB.db) await poamDB.init();
        if (!poamDB.hasStore('reports')) {
            console.warn('⚠️ reports store not available — saving to localStorage');
            const history = JSON.parse(localStorage.getItem('reportHistory') || '[]');
            history.unshift(snapshot);
            if (history.length > 50) history.length = 50;
            localStorage.setItem('reportHistory', JSON.stringify(history));
            return;
        }
        const tx = poamDB.db.transaction(['reports'], 'readwrite');
        const store = tx.objectStore('reports');
        await new Promise((resolve, reject) => {
            const req = store.put(snapshot);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('⚠️ Failed to save report snapshot to IndexedDB, using localStorage:', err);
        const history = JSON.parse(localStorage.getItem('reportHistory') || '[]');
        history.unshift(snapshot);
        if (history.length > 50) history.length = 50;
        localStorage.setItem('reportHistory', JSON.stringify(history));
    }
}

async function loadReportHistory() {
    try {
        if (!poamDB || !poamDB.db) await poamDB.init();
        if (poamDB.hasStore('reports')) {
            const tx = poamDB.db.transaction(['reports'], 'readonly');
            const store = tx.objectStore('reports');
            _reportHistory = await new Promise((resolve, reject) => {
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
            _reportHistory.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
        } else {
            _reportHistory = JSON.parse(localStorage.getItem('reportHistory') || '[]');
        }
    } catch (err) {
        console.warn('⚠️ Failed to load report history from IndexedDB:', err);
        _reportHistory = JSON.parse(localStorage.getItem('reportHistory') || '[]');
    }
}

function renderReportHistory() {
    const container = document.getElementById('report-history-body');
    if (!container) return;

    if (_reportHistory.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-400">No reports generated yet</td></tr>';
        return;
    }

    container.innerHTML = _reportHistory.slice(0, 20).map(r => {
        const date = new Date(r.generatedAt).toLocaleString();
        const typeLabels = {
            'status-summary': 'Status Summary', 'quarterly-compliance': 'Quarterly Compliance',
            'executive-summary': 'Executive Summary', 'risk-assessment': 'Risk Assessment',
            'team-performance': 'Team Performance', 'control-family': 'Control Family'
        };
        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="py-2 px-3 font-mono text-xs text-teal-700">${r.id}</td>
                <td class="py-2 px-3 text-sm font-medium text-slate-700">${typeLabels[r.type] || r.type}</td>
                <td class="py-2 px-3 text-xs text-slate-500">${date}</td>
                <td class="py-2 px-3 text-xs text-slate-500">${r.poamCount} POAMs</td>
                <td class="py-2 px-3">
                    <button onclick="viewHistoricReport('${r.id}')" class="text-xs text-teal-700 hover:text-teal-800 font-medium mr-2"><i class="fas fa-eye mr-1"></i>View</button>
                    <button onclick="deleteReport('${r.id}')" class="text-xs text-red-400 hover:text-red-600 font-medium"><i class="fas fa-trash mr-1"></i></button>
                </td>
            </tr>`;
    }).join('');
}

async function viewHistoricReport(reportId) {
    const report = _reportHistory.find(r => r.id === reportId);
    if (report && report.data) {
        renderReportViewer(report.data);
    }
}

async function deleteReport(reportId) {
    if (!confirm('Delete this report?')) return;
    try {
        if (poamDB && poamDB.db && poamDB.hasStore('reports')) {
            const tx = poamDB.db.transaction(['reports'], 'readwrite');
            tx.objectStore('reports').delete(reportId);
        }
        const lsHistory = JSON.parse(localStorage.getItem('reportHistory') || '[]');
        localStorage.setItem('reportHistory', JSON.stringify(lsHistory.filter(r => r.id !== reportId)));
    } catch (err) {
        console.warn('Delete error:', err);
    }
    await loadReportHistory();
    renderReportHistory();
}

function searchReports(query) {
    const container = document.getElementById('report-history-body');
    if (!container || !query) {
        renderReportHistory();
        return;
    }
    const q = query.toLowerCase();
    const filtered = _reportHistory.filter(r =>
        (r.id || '').toLowerCase().includes(q) ||
        (r.type || '').toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.summary || '').toLowerCase().includes(q)
    );
    const origHistory = _reportHistory;
    _reportHistory = filtered;
    renderReportHistory();
    _reportHistory = origHistory;
}
// ═══════════════════════════════════════════════════════════════
// OSCAL POA&M EXPORT (v1.1.2)
// Secondary export format for tool interoperability.
// Generates a valid OSCAL plan-of-action-and-milestones JSON.
// Primary formats remain Excel (XLSX) and CSV.
// ═══════════════════════════════════════════════════════════════

console.log('🔄 oscal-export.js loading...');

// ═══════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════════════

async function exportOSCALPOAM(options = {}) {
    console.log('🔄 Generating OSCAL POA&M JSON...');
    try {
        if (!poamDB || !poamDB.db) await poamDB.init();

        let poams = await poamDB.getAllPOAMs();
        if (options.systemId) {
            poams = poams.filter(p => p.systemId === options.systemId || p.scanId === options.systemId);
        }

        if (poams.length === 0) {
            alert('No POAMs found to export. Import scan data first.');
            return;
        }

        const documentUUID = generateOSCALUUID();
        const now = new Date().toISOString();

        const parties = buildParties(poams);
        const risks = [];
        const observations = [];
        const poamItems = [];
        const inventoryItems = [];
        const components = [];

        const componentMap = new Map();
        const partyMap = new Map();
        parties.forEach(p => partyMap.set(p._originalName, p.uuid));

        poams.forEach(p => {
            const riskUUID = generateOSCALUUID();
            const obsUUID = generateOSCALUUID();
            const poamItemUUID = generateOSCALUUID();

            // Build observation
            const observation = {
                uuid: obsUUID,
                title: p.vulnerabilityName || p.title || 'Vulnerability Finding',
                description: p.findingDescription || p.description || 'No description available',
                methods: ['TEST'],
                types: ['finding'],
                collected: p.createdDate || now,
                origins: [{
                    actors: [{
                        type: 'tool',
                        'actor-uuid': generateOSCALUUID(),
                        props: [{ name: 'tool-name', value: p.findingSource || 'Vulnerability Scanner', ns: 'https://trace.local' }]
                    }]
                }]
            };
            observations.push(observation);

            // Build risk
            const risk = {
                uuid: riskUUID,
                title: p.vulnerabilityName || p.title || 'Identified Risk',
                description: p.findingDescription || p.description || 'No description',
                statement: `Risk identified for ${p.controlFamily || 'unknown'} control family with ${p.riskLevel || p.risk || 'medium'} severity.`,
                props: [
                    { name: 'risk-level', value: p.riskLevel || p.risk || 'medium', ns: 'https://trace.local' }
                ],
                status: mapStatusToOSCAL(p.findingStatus || p.status || 'open'),
                characterizations: [{
                    facets: [{
                        name: 'likelihood',
                        system: 'https://trace.local',
                        value: mapRiskToLikelihood(p.riskLevel || p.risk || 'medium')
                    }, {
                        name: 'impact',
                        system: 'https://trace.local',
                        value: p.riskLevel || p.risk || 'medium'
                    }]
                }],
                'related-observations': [{ 'observation-uuid': obsUUID }]
            };

            // Add remediation if mitigation exists
            if (p.mitigation || p.dueDate) {
                const remediation = {
                    uuid: generateOSCALUUID(),
                    lifecycle: 'planned',
                    title: `Remediation for ${p.id}`,
                    description: p.mitigation || 'Remediation plan pending',
                    props: []
                };
                if (p.dueDate || p.updatedScheduledCompletionDate) {
                    remediation.props.push({ name: 'planned-completion-date', value: p.updatedScheduledCompletionDate || p.dueDate, ns: 'https://trace.local' });
                }
                if (p.initialScheduledCompletionDate) {
                    remediation.props.push({ name: 'original-completion-date', value: p.initialScheduledCompletionDate, ns: 'https://trace.local' });
                }
                if (p.updatedScheduledCompletionDate && p.initialScheduledCompletionDate && p.updatedScheduledCompletionDate !== p.initialScheduledCompletionDate) {
                    remediation.props.push({ name: 'adjusted-completion-date', value: p.updatedScheduledCompletionDate, ns: 'https://trace.local' });
                }
                if (p.actualCompletionDate) {
                    remediation.props.push({ name: 'actual-completion-date', value: p.actualCompletionDate, ns: 'https://trace.local' });
                }

                // Add milestones as tasks
                if (Array.isArray(p.milestones) && p.milestones.length > 0) {
                    remediation['required-assets'] = p.milestones.map(m => ({
                        uuid: generateOSCALUUID(),
                        description: m.name || m.description || 'Milestone',
                        props: m.targetDate ? [{ name: 'target-date', value: m.targetDate, ns: 'https://trace.local' }] : []
                    }));
                }

                risk.remediations = [remediation];
            }

            risks.push(risk);

            // Build POAM item
            const poamItem = {
                uuid: poamItemUUID,
                title: p.vulnerabilityName || p.title || `POAM Item ${p.id}`,
                description: p.findingDescription || p.description || 'No description',
                props: [
                    { name: 'finding-id', value: p.id || '', ns: 'https://trace.local' },
                    { name: 'status', value: p.findingStatus || p.status || 'open', ns: 'https://trace.local' },
                    { name: 'control-id', value: p.controlFamily || '', ns: 'https://trace.local' },
                    { name: 'date-created', value: p.createdDate || now, ns: 'https://trace.local' }
                ],
                'related-risks': [{ 'risk-uuid': riskUUID }]
            };

            if (p.notes) {
                poamItem.remarks = p.notes;
            }

            // Link POC as responsible party
            const pocName = p.poc || p.pocTeam;
            if (pocName && partyMap.has(pocName)) {
                poamItem.origins = [{
                    actors: [{
                        type: 'party',
                        'actor-uuid': partyMap.get(pocName)
                    }]
                }];
            }

            poamItems.push(poamItem);

            // Build inventory items from affected assets
            if (Array.isArray(p.affectedAssets)) {
                p.affectedAssets.forEach(asset => {
                    const assetStr = typeof asset === 'string' ? asset : (asset.hostname || asset.ip || JSON.stringify(asset));
                    if (!componentMap.has(assetStr)) {
                        const compUUID = generateOSCALUUID();
                        componentMap.set(assetStr, compUUID);
                        components.push({
                            uuid: compUUID,
                            type: 'software',
                            title: assetStr,
                            description: `Component identified from POAM ${p.id}`,
                            status: { state: 'operational' }
                        });
                        inventoryItems.push({
                            uuid: generateOSCALUUID(),
                            description: `Asset: ${assetStr}`,
                            'implemented-components': [{ 'component-uuid': compUUID }]
                        });
                    }
                });
            }
        });

        // Build the full OSCAL document
        const oscalDocument = {
            'plan-of-action-and-milestones': {
                uuid: documentUUID,
                metadata: buildOSCALMetadata(parties, now),
                'system-id': {
                    'identifier-type': 'https://trace.local',
                    id: options.systemId || 'trace-default-system'
                },
                'poam-items': poamItems,
                risks: risks,
                observations: observations
            }
        };

        // Add local definitions if we have components/inventory
        if (components.length > 0 || inventoryItems.length > 0) {
            oscalDocument['plan-of-action-and-milestones']['local-definitions'] = {};
            if (components.length > 0) {
                oscalDocument['plan-of-action-and-milestones']['local-definitions'].components = components;
            }
            if (inventoryItems.length > 0) {
                oscalDocument['plan-of-action-and-milestones']['local-definitions']['inventory-items'] = inventoryItems;
            }
        }

        downloadOSCALJSON(oscalDocument, options.systemId);
        console.log(`✅ OSCAL export complete: ${poams.length} POAMs, ${risks.length} risks, ${observations.length} observations`);

    } catch (err) {
        console.error('❌ OSCAL export error:', err);
        alert(`OSCAL export failed: ${err.message}`);
    }
}

// ═══════════════════════════════════════════════════════════════
// METADATA BUILDER
// ═══════════════════════════════════════════════════════════════

function buildOSCALMetadata(parties, timestamp) {
    const cleanParties = parties.map(p => {
        const { _originalName, ...rest } = p;
        return rest;
    });

    return {
        title: 'TRACE — Plan of Action and Milestones Export',
        'last-modified': timestamp,
        version: '1.0',
        'oscal-version': '1.1.2',
        roles: [
            { id: 'poc', title: 'Point of Contact' },
            { id: 'system-owner', title: 'System Owner' },
            { id: 'tool', title: 'Assessment Tool' }
        ],
        parties: cleanParties.length > 0 ? cleanParties : [{
            uuid: generateOSCALUUID(),
            type: 'organization',
            name: 'TRACE Export'
        }]
    };
}

function buildParties(poams) {
    const pocSet = new Map();
    poams.forEach(p => {
        const poc = p.poc || p.pocTeam;
        if (poc && !pocSet.has(poc)) {
            pocSet.set(poc, {
                uuid: generateOSCALUUID(),
                type: 'organization',
                name: poc,
                _originalName: poc
            });
        }
    });
    return Array.from(pocSet.values());
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function mapStatusToOSCAL(status) {
    const s = (status || 'open').toLowerCase();
    if (s === 'completed' || s === 'closed') return 'closed';
    if (s === 'risk-accepted' || s === 'ignored') return 'deviation-approved';
    if (s === 'in-progress' || s === 'in_progress') return 'open';
    return 'open';
}

function mapRiskToLikelihood(risk) {
    const r = (risk || 'medium').toLowerCase();
    if (r === 'critical') return 'high';
    if (r === 'high') return 'moderate';
    if (r === 'medium' || r === 'moderate') return 'low';
    return 'low';
}

function generateOSCALUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function downloadOSCALJSON(data, systemId) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const sysLabel = systemId ? `_${systemId}` : '';
    a.href = url;
    a.download = `POAM_OSCAL${sysLabel}_${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
// EXECUTIVE REPORTING PAGE — KPIs & Tables
// Populates the redesigned reporting module with live data.
// ═══════════════════════════════════════════════════════════════

async function loadReportingPageMetrics() {
    try {
        if (!poamDB) return;
        if (!poamDB.db) await poamDB.init();
        const poams = await poamDB.getAllPOAMs();
        if (!poams || poams.length === 0) return;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const getStatus = p => dashNormalizeStatus(p.findingStatus || p.status || 'open');
        const getRisk = p => (p.riskLevel || p.risk || 'medium').toLowerCase();
        const isOpen = p => { const s = getStatus(p); return s !== 'completed' && s !== 'closed' && s !== 'risk-accepted' && s !== 'ignored'; };
        const isClosed = p => { const s = getStatus(p); return s === 'completed' || s === 'closed'; };

        const openPOAMs = poams.filter(isOpen);
        const closedPOAMs = poams.filter(isClosed);
        const overdue = openPOAMs.filter(p => { const d = new Date(p.updatedScheduledCompletionDate || p.dueDate); return d && d < now; });
        const closedMTD = closedPOAMs.filter(p => { const d = new Date(p.actualCompletionDate || p.lastModifiedDate); return d >= monthStart; });
        const riskAccepted = poams.filter(p => getStatus(p) === 'risk-accepted' || getStatus(p) === 'ignored');

        // KPIs
        setText('rpt-total-open', openPOAMs.length);
        setText('rpt-total-open-sub', openPOAMs.length === 0 ? 'No open POAMs' : `${poams.length} total tracked`);
        setText('rpt-overdue', overdue.length);
        setText('rpt-overdue-sub', overdue.length === 0 ? 'All on track' : 'Requires attention');
        setText('rpt-closed-mtd', closedMTD.length);
        setText('rpt-closed-sub', `${closedPOAMs.length} total closed`);

        const mttr = computeMTTR(closedPOAMs);
        setText('rpt-mttr', mttr === null ? 'N/A' : `${mttr}d`);

        const withinSLA = openPOAMs.filter(p => { const d = new Date(p.updatedScheduledCompletionDate || p.dueDate); return d >= now; });
        const slaRate = openPOAMs.length > 0 ? Math.round(withinSLA.length / openPOAMs.length * 100) : 100;
        setText('rpt-sla', `${slaRate}%`);
        setText('rpt-sla-sub', slaRate === 100 ? 'All within SLA' : `${100 - slaRate}% breached`);
        setText('rpt-risk-accepted', riskAccepted.length);

        // Priority breakdown (from priorityScore if available, else derive from risk)
        const tiers = { P1: 0, P2: 0, P3: 0, P4: 0 };
        openPOAMs.forEach(p => {
            const tier = p.priorityScore?.tier;
            if (tier && tiers.hasOwnProperty(tier)) { tiers[tier]++; return; }
            const r = getRisk(p);
            if (r === 'critical') tiers.P1++;
            else if (r === 'high') tiers.P2++;
            else if (r === 'medium' || r === 'moderate') tiers.P3++;
            else tiers.P4++;
        });
        const maxTier = Math.max(tiers.P1, tiers.P2, tiers.P3, tiers.P4, 1);
        setText('rpt-p1-count', tiers.P1);
        setText('rpt-p2-count', tiers.P2);
        setText('rpt-p3-count', tiers.P3);
        setText('rpt-p4-count', tiers.P4);
        const p1Bar = document.getElementById('rpt-p1-bar');
        const p2Bar = document.getElementById('rpt-p2-bar');
        const p3Bar = document.getElementById('rpt-p3-bar');
        const p4Bar = document.getElementById('rpt-p4-bar');
        if (p1Bar) p1Bar.style.width = `${Math.round(tiers.P1 / maxTier * 100)}%`;
        if (p2Bar) p2Bar.style.width = `${Math.round(tiers.P2 / maxTier * 100)}%`;
        if (p3Bar) p3Bar.style.width = `${Math.round(tiers.P3 / maxTier * 100)}%`;
        if (p4Bar) p4Bar.style.width = `${Math.round(tiers.P4 / maxTier * 100)}%`;

        // POC Team table
        const teamBody = document.getElementById('rpt-team-table');
        if (teamBody) {
            const teams = {};
            poams.forEach(p => {
                const team = p.poc || p.pocTeam || 'Unassigned';
                if (!teams[team]) teams[team] = { open: 0, overdue: 0, mttrDays: [] };
                if (isOpen(p)) {
                    teams[team].open++;
                    const d = new Date(p.updatedScheduledCompletionDate || p.dueDate);
                    if (d < now) teams[team].overdue++;
                }
                if (isClosed(p) && p.createdDate) {
                    const days = Math.round((new Date(p.actualCompletionDate || p.lastModifiedDate) - new Date(p.createdDate)) / 86400000);
                    if (days > 0 && days < 3650) teams[team].mttrDays.push(days);
                }
            });
            const sorted = Object.entries(teams).sort(([,a],[,b]) => b.open - a.open);
            teamBody.innerHTML = sorted.slice(0, 8).map(([team, d]) => {
                const mttrVal = d.mttrDays.length > 0 ? Math.round(d.mttrDays.reduce((a,b) => a+b, 0) / d.mttrDays.length) + 'd' : '--';
                return `<tr class="border-b border-slate-100 hover:bg-slate-50">
                    <td class="py-2 px-2 text-sm font-medium text-slate-800">${escapeHtmlDash(team)}</td>
                    <td class="py-2 px-2 text-center"><span class="font-bold ${d.open > 0 ? 'text-teal-700' : 'text-slate-400'}">${d.open}</span></td>
                    <td class="py-2 px-2 text-center"><span class="font-bold ${d.overdue > 0 ? 'text-red-600' : 'text-slate-400'}">${d.overdue}</span></td>
                    <td class="py-2 px-2 text-center text-slate-600">${mttrVal}</td>
                </tr>`;
            }).join('') || '<tr><td colspan="4" class="py-4 text-center text-slate-400 text-xs">No data</td></tr>';
        }

        // Top Overdue POAMs table
        const overdueBody = document.getElementById('rpt-overdue-table');
        const overdueBadge = document.getElementById('rpt-overdue-badge');
        if (overdueBadge) overdueBadge.textContent = `${overdue.length} overdue`;
        if (overdueBody) {
            const sevColors = { critical: 'bg-red-100 text-red-700', high: 'bg-amber-100 text-amber-800', medium: 'bg-teal-50 text-teal-700', low: 'bg-slate-100 text-slate-600' };
            const sorted = overdue.sort((a, b) => {
                const da = new Date(a.updatedScheduledCompletionDate || a.dueDate);
                const db = new Date(b.updatedScheduledCompletionDate || b.dueDate);
                return da - db;
            });
            overdueBody.innerHTML = sorted.slice(0, 15).map(p => {
                const risk = getRisk(p);
                const due = new Date(p.updatedScheduledCompletionDate || p.dueDate);
                const daysOver = Math.max(0, Math.round((now - due) / 86400000));
                const title = p.vulnerabilityName || p.title || p.findingDescription || 'Untitled';
                const assets = p.totalAffectedAssets || (Array.isArray(p.affectedAssets) ? p.affectedAssets.length : '--');
                return `<tr class="border-b border-slate-100 hover:bg-red-50 cursor-pointer" onclick="if(typeof showPOAMDetails==='function') showPOAMDetails('${p.id}')">
                    <td class="py-2 px-2 text-sm text-slate-800 max-w-xs truncate" title="${escapeHtmlDash(title)}">${escapeHtmlDash(title.substring(0, 60))}${title.length > 60 ? '...' : ''}</td>
                    <td class="py-2 px-2"><span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${sevColors[risk] || sevColors.medium} capitalize">${risk}</span></td>
                    <td class="py-2 px-2 text-sm text-slate-600">${escapeHtmlDash(p.poc || p.pocTeam || '--')}</td>
                    <td class="py-2 px-2 text-center text-sm font-medium text-slate-700">${assets}</td>
                    <td class="py-2 px-2 text-center"><span class="text-sm font-bold text-red-600">${daysOver}d</span></td>
                    <td class="py-2 px-2 text-xs text-slate-500">${p.controlFamily || '--'}</td>
                </tr>`;
            }).join('') || '<tr><td colspan="6" class="py-6 text-center text-slate-400 text-xs">No overdue POAMs</td></tr>';
        }

        // Scan history table
        const scanBody = document.getElementById('rpt-scan-history');
        if (scanBody) {
            let scanRuns = [];
            try { scanRuns = await poamDB.getAllScanRuns(); } catch (e) {}
            if (scanRuns.length > 0) {
                scanRuns.sort((a, b) => new Date(b.importedAt || b.timestamp) - new Date(a.importedAt || a.timestamp));
                scanBody.innerHTML = scanRuns.slice(0, 10).map(s => {
                    const date = new Date(s.importedAt || s.timestamp).toLocaleDateString();
                    return `<tr class="border-b border-slate-100 hover:bg-slate-50">
                        <td class="py-2 px-2 text-sm text-slate-700">${date}</td>
                        <td class="py-2 px-2 text-xs text-slate-500">${s.source || s.scanType || 'CSV'}</td>
                        <td class="py-2 px-2 text-center text-sm font-medium text-slate-700">${s.totalFindings || s.totalParsed || '--'}</td>
                        <td class="py-2 px-2 text-center text-sm font-medium text-green-600">${s.newIdentities || s.newPOAMs || '--'}</td>
                        <td class="py-2 px-2 text-center text-sm font-medium text-slate-500">${s.closedIdentities || s.closedPOAMs || '--'}</td>
                    </tr>`;
                }).join('');
            }
        }

    } catch (err) {
        console.warn('Reporting page metrics error:', err);
    }
}
