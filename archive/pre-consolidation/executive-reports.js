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
    const getStatus = p => (p.findingStatus || p.status || 'open').toLowerCase();
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
    const getStatus = p => (p.findingStatus || p.status || 'open').toLowerCase();
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
    const getStatus = p => (p.findingStatus || p.status || 'open').toLowerCase();
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
    const getStatus = p => (p.findingStatus || p.status || 'open').toLowerCase();
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
    const getStatus = p => (p.findingStatus || p.status || 'open').toLowerCase();
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
    const getStatus = p => (p.findingStatus || p.status || 'open').toLowerCase();
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
                <button onclick="exportReportCSV()" class="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 font-medium">
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
                <td class="py-2 px-3 font-mono text-xs text-indigo-600">${r.id}</td>
                <td class="py-2 px-3 text-sm font-medium text-slate-700">${typeLabels[r.type] || r.type}</td>
                <td class="py-2 px-3 text-xs text-slate-500">${date}</td>
                <td class="py-2 px-3 text-xs text-slate-500">${r.poamCount} POAMs</td>
                <td class="py-2 px-3">
                    <button onclick="viewHistoricReport('${r.id}')" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium mr-2"><i class="fas fa-eye mr-1"></i>View</button>
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
