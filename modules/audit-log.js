// ═══════════════════════════════════════════════════════════════
// AUDIT LOG MODULE
// Records and displays system events: scan imports, POAM changes,
// settings updates, evidence uploads, Jira actions.
// ═══════════════════════════════════════════════════════════════

console.log('Audit log module loading...');

const AUDIT_STORAGE_KEY = 'trace_audit_log';
const AUDIT_MAX_EVENTS = 500;
let _auditDisplayCount = 50;

// ═══════════════════════════════════════════════════════════════
// EVENT RECORDING
// ═══════════════════════════════════════════════════════════════

function recordAuditEvent(event) {
    const entry = {
        id: `AE-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        type: event.type || 'unknown',
        action: event.action || '',
        details: event.details || '',
        user: event.user || 'System',
        metadata: event.metadata || {}
    };

    const log = getAuditLog();
    log.unshift(entry);
    if (log.length > AUDIT_MAX_EVENTS) log.length = AUDIT_MAX_EVENTS;
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(log));
    return entry;
}

function getAuditLog() {
    try {
        return JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE LOGGERS
// ═══════════════════════════════════════════════════════════════

function auditScanImport(filename, findingCount, poamCount) {
    return recordAuditEvent({
        type: 'scan_import',
        action: `Scan imported: ${filename}`,
        details: `${findingCount} findings processed, ${poamCount} POAMs created/updated`,
        metadata: { filename, findingCount, poamCount }
    });
}

function auditStatusChange(poamId, fromStatus, toStatus) {
    return recordAuditEvent({
        type: 'status_change',
        action: `POAM ${poamId} status changed`,
        details: `${fromStatus} → ${toStatus}`,
        metadata: { poamId, fromStatus, toStatus }
    });
}

function auditPOAMCreated(poamId, title) {
    return recordAuditEvent({
        type: 'poam_created',
        action: `POAM created: ${poamId}`,
        details: title || '',
        metadata: { poamId }
    });
}

function auditPOAMUpdated(poamId, fields) {
    return recordAuditEvent({
        type: 'poam_updated',
        action: `POAM updated: ${poamId}`,
        details: `Fields changed: ${fields.join(', ')}`,
        metadata: { poamId, fields }
    });
}

function auditJiraTicket(poamId, ticketKey, action) {
    return recordAuditEvent({
        type: 'jira_ticket',
        action: `Jira ${action}: ${ticketKey}`,
        details: `Linked to POAM ${poamId}`,
        metadata: { poamId, ticketKey }
    });
}

function auditSettingsChange(setting, oldValue, newValue) {
    return recordAuditEvent({
        type: 'settings_change',
        action: `Setting changed: ${setting}`,
        details: `${oldValue} → ${newValue}`,
        metadata: { setting }
    });
}

function auditEvidenceUpload(poamId, filename) {
    return recordAuditEvent({
        type: 'evidence_upload',
        action: `Evidence uploaded for ${poamId}`,
        details: filename || '',
        metadata: { poamId, filename }
    });
}

// ═══════════════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════════════

const AUDIT_ICONS = {
    scan_import: { icon: 'fa-file-import', color: 'text-blue-500', bg: 'bg-blue-50' },
    status_change: { icon: 'fa-exchange-alt', color: 'text-green-500', bg: 'bg-green-50' },
    poam_created: { icon: 'fa-plus-circle', color: 'text-teal-600', bg: 'bg-teal-50' },
    poam_updated: { icon: 'fa-edit', color: 'text-amber-600', bg: 'bg-amber-50' },
    jira_ticket: { icon: 'fa-ticket-alt', color: 'text-blue-600', bg: 'bg-blue-50' },
    settings_change: { icon: 'fa-cog', color: 'text-slate-500', bg: 'bg-slate-100' },
    evidence_upload: { icon: 'fa-paperclip', color: 'text-green-600', bg: 'bg-green-50' },
    unknown: { icon: 'fa-info-circle', color: 'text-slate-400', bg: 'bg-slate-50' }
};

function loadAuditModule() {
    const log = getAuditLog();
    renderAuditSummary(log);
    renderAuditFeed(log);
}

function renderAuditSummary(log) {
    const counts = { total: log.length, scans: 0, statusChanges: 0, settings: 0 };
    log.forEach(e => {
        if (e.type === 'scan_import') counts.scans++;
        if (e.type === 'status_change') counts.statusChanges++;
        if (e.type === 'settings_change') counts.settings++;
    });

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('audit-total-events', counts.total);
    el('audit-scan-count', counts.scans);
    el('audit-status-changes', counts.statusChanges);
    el('audit-settings-changes', counts.settings);
}

function renderAuditFeed(events) {
    const feed = document.getElementById('audit-log-feed');
    const showCount = document.getElementById('audit-showing-count');
    const loadMore = document.getElementById('audit-load-more');
    if (!feed) return;

    if (events.length === 0) {
        feed.innerHTML = `<div class="text-center py-8 text-slate-400 text-sm">
            <i class="fas fa-clipboard-list text-3xl text-slate-300 mb-3 block"></i>
            No audit events recorded yet. Events will appear here as you import scans, update POAMs, and make changes.
        </div>`;
        if (showCount) showCount.textContent = 'Showing 0 events';
        if (loadMore) loadMore.classList.add('hidden');
        return;
    }

    const displayed = events.slice(0, _auditDisplayCount);
    if (showCount) showCount.textContent = `Showing ${displayed.length} of ${events.length} events`;
    if (loadMore) {
        if (events.length > _auditDisplayCount) loadMore.classList.remove('hidden');
        else loadMore.classList.add('hidden');
    }

    feed.innerHTML = displayed.map(e => {
        const style = AUDIT_ICONS[e.type] || AUDIT_ICONS.unknown;
        const timeAgo = formatTimeAgo(new Date(e.timestamp));
        const fullDate = new Date(e.timestamp).toLocaleString();

        return `<div class="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
            <div class="p-2 rounded-lg ${style.bg} ${style.color} flex-shrink-0">
                <i class="fas ${style.icon} text-sm"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-slate-800">${escapeAuditHtml(e.action)}</p>
                ${e.details ? `<p class="text-xs text-slate-500 mt-0.5">${escapeAuditHtml(e.details)}</p>` : ''}
            </div>
            <div class="text-right flex-shrink-0">
                <p class="text-[10px] text-slate-400" title="${fullDate}">${timeAgo}</p>
                <p class="text-[10px] text-slate-300 mt-0.5">${e.user}</p>
            </div>
        </div>`;
    }).join('');
}

function filterAuditLogs() {
    const typeFilter = document.getElementById('audit-filter-type')?.value || 'all';
    const fromDate = document.getElementById('audit-filter-from')?.value;
    const toDate = document.getElementById('audit-filter-to')?.value;
    const search = (document.getElementById('audit-filter-search')?.value || '').toLowerCase();

    let log = getAuditLog();

    if (typeFilter !== 'all') {
        log = log.filter(e => e.type === typeFilter);
    }
    if (fromDate) {
        log = log.filter(e => new Date(e.timestamp) >= new Date(fromDate));
    }
    if (toDate) {
        log = log.filter(e => new Date(e.timestamp) <= new Date(toDate + 'T23:59:59'));
    }
    if (search) {
        log = log.filter(e =>
            (e.action || '').toLowerCase().includes(search) ||
            (e.details || '').toLowerCase().includes(search) ||
            (e.type || '').toLowerCase().includes(search)
        );
    }

    _auditDisplayCount = 50;
    renderAuditFeed(log);
}

function clearAuditFilters() {
    const typeEl = document.getElementById('audit-filter-type');
    const fromEl = document.getElementById('audit-filter-from');
    const toEl = document.getElementById('audit-filter-to');
    const searchEl = document.getElementById('audit-filter-search');
    if (typeEl) typeEl.value = 'all';
    if (fromEl) fromEl.value = '';
    if (toEl) toEl.value = '';
    if (searchEl) searchEl.value = '';
    _auditDisplayCount = 50;
    loadAuditModule();
}

function loadMoreAuditEvents() {
    _auditDisplayCount += 50;
    filterAuditLogs();
}

function exportAuditLog() {
    const log = getAuditLog();
    if (log.length === 0) {
        alert('No audit events to export.');
        return;
    }

    const headers = ['Timestamp', 'Type', 'Action', 'Details', 'User'];
    const rows = [headers.join(',')];
    log.forEach(e => {
        rows.push([
            e.timestamp,
            e.type,
            `"${(e.action || '').replace(/"/g, '""')}"`,
            `"${(e.details || '').replace(/"/g, '""')}"`,
            e.user
        ].join(','));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function formatTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
}

function escapeAuditHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
