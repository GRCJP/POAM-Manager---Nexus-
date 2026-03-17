// ═══════════════════════════════════════════════════════════════
// POAM LIFECYCLE MANAGER
// Backup/Restore, Re-import Merge, Status History Tracking
// ═══════════════════════════════════════════════════════════════

console.log('🔄 poam-lifecycle.js loading...');

// ═══════════════════════════════════════════════════════════════
// 1. BACKUP & RESTORE
// ═══════════════════════════════════════════════════════════════

async function exportPOAMBackup() {
    if (!poamDB || !poamDB.db) await poamDB.init();

    const poams = await poamDB.getAllPOAMs();
    const scanRuns = await poamDB.getAllScanRuns().catch(() => []);
    const systems = await poamDB.getSystems().catch(() => []);

    // Collect scan summaries for each POAM
    const scanSummaries = [];
    for (const p of poams) {
        try {
            const summary = await poamDB.getLatestPoamScanSummary(p.id);
            if (summary) scanSummaries.push(summary);
        } catch (e) { /* ignore */ }
    }

    // Strip heavy payload fields to keep backup size manageable
    const lightPoams = poams.map(p => {
        const copy = { ...p };
        delete copy.rawFindings;
        delete copy.evidenceSamples;
        // Keep affectedAssets but trim per-asset raw/solution to 200 chars
        if (Array.isArray(copy.affectedAssets)) {
            copy.affectedAssets = copy.affectedAssets.map(a => {
                const ac = { ...a };
                if (ac.raw && ac.raw.length > 200) ac.raw = ac.raw.substring(0, 200) + '…';
                if (ac.solution && ac.solution.length > 200) ac.solution = ac.solution.substring(0, 200) + '…';
                if (ac.result && ac.result.length > 200) ac.result = ac.result.substring(0, 200) + '…';
                return ac;
            });
        }
        return copy;
    });

    const backup = {
        exportVersion: 2,
        exportedAt: new Date().toISOString(),
        source: 'POAM Nexus',
        counts: {
            poams: lightPoams.length,
            scanRuns: scanRuns.length,
            systems: systems.length,
            scanSummaries: scanSummaries.length
        },
        data: {
            poams: lightPoams,
            scanRuns,
            systems,
            scanSummaries
        }
    };

    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poam-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    if (typeof showUpdateFeedback === 'function') {
        showUpdateFeedback(`Backup exported: ${poams.length} POAMs`, 'success');
    }
    return backup;
}

async function importPOAMBackup(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const backup = JSON.parse(e.target.result);

                if (!backup.data || !backup.data.poams) {
                    throw new Error('Invalid backup file: missing data.poams');
                }

                if (!poamDB || !poamDB.db) await poamDB.init();

                const poams = backup.data.poams;
                const result = await poamDB.addPOAMsBatch(poams);

                // Restore scan runs
                if (Array.isArray(backup.data.scanRuns)) {
                    for (const run of backup.data.scanRuns) {
                        try { await poamDB.saveScanRun(run); } catch (err) { /* skip */ }
                    }
                }

                // Restore systems
                if (Array.isArray(backup.data.systems)) {
                    for (const sys of backup.data.systems) {
                        try { await poamDB.addSystem(sys); } catch (err) { /* skip */ }
                    }
                }

                // Restore scan summaries
                if (Array.isArray(backup.data.scanSummaries)) {
                    for (const summary of backup.data.scanSummaries) {
                        try { await poamDB.savePoamScanSummary(summary); } catch (err) { /* skip */ }
                    }
                }

                const msg = `Restored ${result.saved || poams.length} POAMs from backup`;
                console.log(`✅ ${msg}`);
                if (typeof showUpdateFeedback === 'function') {
                    showUpdateFeedback(msg, 'success');
                }

                // Refresh views
                if (typeof displayVulnerabilityPOAMs === 'function') await displayVulnerabilityPOAMs();
                if (typeof loadDashboardMetrics === 'function') loadDashboardMetrics();

                resolve({ restored: result.saved || poams.length });
            } catch (err) {
                console.error('❌ Backup restore failed:', err);
                if (typeof showUpdateFeedback === 'function') {
                    showUpdateFeedback(`Restore failed: ${err.message}`, 'error');
                }
                reject(err);
            }
        };
        reader.readAsText(file);
    });
}

// ═══════════════════════════════════════════════════════════════
// 2. RE-IMPORT MERGE (update existing POAMs, don't duplicate)
// ═══════════════════════════════════════════════════════════════

// User-editable fields that should NOT be overwritten by a re-import
const PRESERVED_FIELDS = [
    'findingStatus', 'status',
    'poc', 'pocTeam',
    'resourcesRequired',
    'mitigation',
    'notes',
    'milestones',
    'controlFamily',
    'updatedScheduledCompletionDate',
    'actualCompletionDate',
    'statusHistory'
];

// Scan-derived fields that SHOULD be updated from new scan data
const SCAN_UPDATED_FIELDS = [
    'affectedAssets', 'totalAffectedAssets',
    'activeAssets', 'breachedAssets',
    'assetCount', 'assetCountBreached', 'assetCountActive', 'assetCountWithinSLA',
    'breachedAssetsList', 'activeAssetsList', 'withinSlaAssets',
    'findingCount',
    'cves', 'qids', 'advisoryIds',
    'evidenceSamples',
    'oldestDetectionDate', 'breachDate',
    'daysOverdue', 'breachedAssetCount',
    'slaBreached', 'slaDays',
    'risk', 'riskLevel',
    'firstDetectedDate',
    'title', 'vulnerabilityName',
    'description', 'findingDescription',
    'rawFindings',
    'confidenceScore',
    'scanId',
    'lastScanDate'
];

async function mergePOAMsFromScan(newPOAMs) {
    if (!poamDB || !poamDB.db) await poamDB.init();

    const existingPOAMs = await poamDB.getAllPOAMs();

    // Build lookup of existing POAMs by remediationSignature
    const existingBySig = new Map();
    existingPOAMs.forEach(p => {
        if (p.remediationSignature) {
            existingBySig.set(p.remediationSignature, p);
        }
    });

    // Track signatures seen in new scan (to detect closed POAMs)
    const newSignatures = new Set();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    const mergedPOAMs = [];

    for (const newPoam of newPOAMs) {
        const sig = newPoam.remediationSignature;
        if (sig) newSignatures.add(sig);

        const existing = sig ? existingBySig.get(sig) : null;

        if (existing) {
            // MERGE: Preserve user edits, update scan-derived fields
            const merged = { ...existing };

            // Update scan-derived fields
            for (const field of SCAN_UPDATED_FIELDS) {
                if (newPoam[field] !== undefined) {
                    merged[field] = newPoam[field];
                }
            }

            // Keep the existing stable ID
            merged.id = existing.id;

            // Track the update
            merged.lastModifiedDate = new Date().toISOString();
            merged.lastScanDate = new Date().toISOString();

            // Append to status history
            merged.statusHistory = existing.statusHistory || [];
            merged.statusHistory.push({
                date: new Date().toISOString(),
                action: 'scan_update',
                details: `Re-import updated scan data. Assets: ${newPoam.totalAffectedAssets || 0}, Risk: ${newPoam.risk || 'unknown'}`,
                previousRisk: existing.risk || existing.riskLevel,
                newRisk: newPoam.risk || newPoam.riskLevel,
                scanId: newPoam.scanId
            });

            // If risk changed, log it
            const oldRisk = (existing.risk || existing.riskLevel || '').toLowerCase();
            const newRisk = (newPoam.risk || newPoam.riskLevel || '').toLowerCase();
            if (oldRisk && newRisk && oldRisk !== newRisk) {
                merged.statusHistory.push({
                    date: new Date().toISOString(),
                    action: 'risk_change',
                    details: `Risk changed from ${oldRisk} to ${newRisk}`,
                    previousRisk: oldRisk,
                    newRisk: newRisk
                });
            }

            // Update due date only if risk escalated (shorter SLA)
            const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            if ((riskOrder[newRisk] || 0) > (riskOrder[oldRisk] || 0)) {
                merged.dueDate = newPoam.dueDate;
                merged.updatedScheduledCompletionDate = newPoam.dueDate;
            }

            mergedPOAMs.push(merged);
            updated++;
        } else {
            // NEW POAM: Use as-is with empty status history
            newPoam.statusHistory = [{
                date: new Date().toISOString(),
                action: 'created',
                details: `POAM created from scan import. Risk: ${newPoam.risk || 'unknown'}, Assets: ${newPoam.totalAffectedAssets || 0}`,
                scanId: newPoam.scanId
            }];
            newPoam.lastScanDate = new Date().toISOString();
            mergedPOAMs.push(newPoam);
            created++;
        }
    }

    // Check for POAMs no longer in scan (potential closures)
    const closureCandidates = [];
    const previouslyOpenPOAMs = [];
    
    for (const existing of existingPOAMs) {
        if (!existing.remediationSignature) continue;
        if (newSignatures.has(existing.remediationSignature)) continue;

        const status = (existing.findingStatus || existing.status || '').toLowerCase();
        if (status === 'completed' || status === 'closed' || status === 'risk-accepted') continue;

        // This POAM was in the previous scan but not in the new one — mark as closure candidate
        closureCandidates.push(existing);
        previouslyOpenPOAMs.push({
            id: existing.id,
            title: existing.title || existing.vulnerabilityName || 'Unknown',
            signature: existing.remediationSignature,
            status: existing.findingStatus || existing.status
        });
    }
    
    // Log detailed analysis of what changed
    console.log(`📊 SCAN ANALYSIS REPORT:`);
    console.log(`   - New POAMs created: ${created}`);
    console.log(`   - Existing POAMs updated: ${updated}`);
    console.log(`   - POAMs no longer in scan (to be closed): ${closureCandidates.length}`);
    
    if (closureCandidates.length > 0) {
        console.log(`   📋 POAMs that will be AUTO-CLOSED:`);
        closureCandidates.forEach((p, i) => {
            console.log(`      ${i + 1}. ${p.id}: ${p.title || p.vulnerabilityName || 'Unknown'}`);
        });
    }
    
    if (updated > 0) {
        console.log(`   📋 Existing POAMs updated with new scan data:`);
        mergedPOAMs.filter(p => p.lastScanDate && p.statusHistory && 
            p.statusHistory.some(h => h.action === 'scan_update')).forEach((p, i) => {
            console.log(`      ${i + 1}. ${p.id}: ${p.title || p.vulnerabilityName || 'Unknown'}`);
        });
    }

    // Auto-close POAMs not found in new scan
    const autoClosedIds = [];
    for (const candidate of closureCandidates) {
        candidate.statusHistory = candidate.statusHistory || [];
        candidate.statusHistory.push({
            date: new Date().toISOString(),
            action: 'auto_resolved',
            details: `Finding no longer detected in latest scan. Marking as completed.`,
            previousStatus: candidate.findingStatus || candidate.status,
            scanId: newPOAMs[0]?.scanId || 'unknown'
        });
        candidate.findingStatus = 'Completed';
        candidate.status = 'completed';
        candidate.actualCompletionDate = new Date().toISOString().split('T')[0];
        candidate.lastModifiedDate = new Date().toISOString();
        candidate.lastScanDate = new Date().toISOString();
        mergedPOAMs.push(candidate);
        autoClosedIds.push(candidate.id);
    }
    
    // Store scan analysis for UI display
    window.lastScanAnalysis = {
        timestamp: new Date().toISOString(),
        newPOAMs: created,
        updatedPOAMs: updated,
        autoClosedPOAMs: closureCandidates.length,
        autoClosedIds: autoClosedIds,
        previouslyOpenPOAMs: previouslyOpenPOAMs
    };

    console.log(`🔄 Merge results: ${created} new, ${updated} updated, ${closureCandidates.length} auto-resolved`);

    return {
        mergedPOAMs,
        stats: {
            created,
            updated,
            unchanged,
            autoResolved: closureCandidates.length,
            total: mergedPOAMs.length
        }
    };
}

// ═══════════════════════════════════════════════════════════════
// 3. STATUS HISTORY TRACKING
// ═══════════════════════════════════════════════════════════════

async function appendStatusHistory(poamId, action, details, extraData) {
    if (!poamDB || !poamDB.db) await poamDB.init();

    const poam = await poamDB.getPOAM(poamId);
    if (!poam) {
        console.warn(`⚠️ Cannot append history: POAM ${poamId} not found`);
        return;
    }

    const history = poam.statusHistory || [];
    history.push({
        date: new Date().toISOString(),
        action: action,
        details: details,
        ...extraData
    });

    await poamDB.updatePOAM(poamId, { statusHistory: history });
    return history;
}

function renderStatusHistory(statusHistory) {
    if (!Array.isArray(statusHistory) || statusHistory.length === 0) {
        return '<div class="text-sm text-slate-400 italic py-3">No status history recorded yet</div>';
    }

    const actionIcons = {
        'created': '🆕',
        'status_change': '🔄',
        'risk_change': '⚠️',
        'scan_update': '📡',
        'auto_resolved': '✅',
        'manual_edit': '✏️',
        'milestone_update': '📋',
        'note_added': '📝'
    };

    const actionColors = {
        'created': 'border-indigo-300 bg-indigo-50',
        'status_change': 'border-blue-300 bg-blue-50',
        'risk_change': 'border-amber-300 bg-amber-50',
        'scan_update': 'border-slate-300 bg-slate-50',
        'auto_resolved': 'border-green-300 bg-green-50',
        'manual_edit': 'border-purple-300 bg-purple-50',
        'milestone_update': 'border-cyan-300 bg-cyan-50',
        'note_added': 'border-slate-200 bg-white'
    };

    // Show newest first
    const sorted = [...statusHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

    return `
        <div class="space-y-2 max-h-64 overflow-y-auto">
            ${sorted.map(entry => {
                const icon = actionIcons[entry.action] || '📌';
                const color = actionColors[entry.action] || 'border-slate-200 bg-white';
                const date = new Date(entry.date);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                return `
                    <div class="flex items-start gap-2 p-2 rounded-lg border ${color}">
                        <span class="text-sm mt-0.5">${icon}</span>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-semibold text-slate-700 capitalize">${(entry.action || '').replace(/_/g, ' ')}</div>
                            <div class="text-xs text-slate-600 mt-0.5">${escapeHtmlLifecycle(entry.details || '')}</div>
                            <div class="text-[10px] text-slate-400 mt-1">${dateStr} ${timeStr}</div>
                        </div>
                    </div>`;
            }).join('')}
        </div>`;
}

// ═══════════════════════════════════════════════════════════════
// 4. CLEAR ALL POAMs (with backup prompt)
// ═══════════════════════════════════════════════════════════════

async function clearAllPOAMsWithBackup() {
    try {
        console.log('🗑️ clearAllPOAMsWithBackup called');
        if (!poamDB || !poamDB.db) {
            if (poamDB) await poamDB.init();
            else { alert('Database not available. Please refresh.'); return; }
        }

        const poams = await poamDB.getAllPOAMs();
        console.log(`🗑️ Found ${poams.length} POAMs`);

        if (poams.length === 0) {
            if (typeof showUpdateFeedback === 'function') {
                showUpdateFeedback('No POAMs to clear', 'success');
            } else {
                alert('No POAMs to clear.');
            }
            return;
        }

        const confirmed = confirm(
            `This will delete all ${poams.length} POAMs from the database.\n\n` +
            `A backup will be downloaded first.\n\n` +
            `Continue?`
        );
        if (!confirmed) return;

        // Auto-backup before clearing
        await exportPOAMBackup();

        // Wait a moment for download to start
        await new Promise(r => setTimeout(r, 500));

        await poamDB.clearAllPOAMs();
        console.log('✅ All POAMs cleared');

        if (typeof showUpdateFeedback === 'function') {
            showUpdateFeedback(`Cleared ${poams.length} POAMs (backup downloaded)`, 'success');
        }

        // Refresh views
        if (typeof displayVulnerabilityPOAMs === 'function') await displayVulnerabilityPOAMs();
        if (typeof loadDashboardMetrics === 'function') loadDashboardMetrics();
    } catch (err) {
        console.error('❌ clearAllPOAMsWithBackup error:', err.message, err.stack);
        alert('Clear failed: ' + err.message);
    }
}

// ═══════════════════════════════════════════════════════════════
// 5. HOOK INTO EXISTING updatePOAM TO TRACK CHANGES
// ═══════════════════════════════════════════════════════════════

// Wrap the existing poamDB.updatePOAM to auto-track status changes
(function patchUpdatePOAMForHistory() {
    if (!window.poamDB || typeof window.poamDB.updatePOAM !== 'function') {
        console.warn('⚠️ poamDB.updatePOAM not available at load time; history patch deferred');
        return;
    }

    const originalUpdate = window.poamDB.updatePOAM.bind(window.poamDB);

    window.poamDB.updatePOAM = async function(id, updates) {
        // Get current state before update
        let previousState = null;
        try {
            previousState = await this.getPOAM(id);
        } catch (e) { /* ignore */ }

        // Perform the actual update
        const result = await originalUpdate(id, updates);

        // Auto-append status history for tracked field changes
        if (previousState) {
            const history = previousState.statusHistory || [];
            let changed = false;

            // Track status changes
            if (updates.findingStatus && updates.findingStatus !== previousState.findingStatus) {
                history.push({
                    date: new Date().toISOString(),
                    action: 'status_change',
                    details: `Status changed from "${previousState.findingStatus || 'Open'}" to "${updates.findingStatus}"`,
                    previousStatus: previousState.findingStatus,
                    newStatus: updates.findingStatus
                });
                changed = true;
            }
            if (updates.status && updates.status !== previousState.status) {
                history.push({
                    date: new Date().toISOString(),
                    action: 'status_change',
                    details: `Status changed from "${previousState.status || 'open'}" to "${updates.status}"`,
                    previousStatus: previousState.status,
                    newStatus: updates.status
                });
                changed = true;
            }

            // Track POC changes
            if (updates.poc && updates.poc !== previousState.poc) {
                history.push({
                    date: new Date().toISOString(),
                    action: 'manual_edit',
                    details: `POC changed from "${previousState.poc || 'Unassigned'}" to "${updates.poc}"`
                });
                changed = true;
            }

            // Track risk changes
            if (updates.riskLevel && updates.riskLevel !== previousState.riskLevel) {
                history.push({
                    date: new Date().toISOString(),
                    action: 'risk_change',
                    details: `Risk changed from "${previousState.riskLevel || 'unknown'}" to "${updates.riskLevel}"`,
                    previousRisk: previousState.riskLevel,
                    newRisk: updates.riskLevel
                });
                changed = true;
            }

            // Track due date changes
            if (updates.updatedScheduledCompletionDate &&
                updates.updatedScheduledCompletionDate !== previousState.updatedScheduledCompletionDate) {
                history.push({
                    date: new Date().toISOString(),
                    action: 'manual_edit',
                    details: `Due date changed from "${previousState.updatedScheduledCompletionDate || 'none'}" to "${updates.updatedScheduledCompletionDate}"`
                });
                changed = true;
            }

            // Track notes/mitigation changes
            if (updates.notes && updates.notes !== previousState.notes) {
                history.push({
                    date: new Date().toISOString(),
                    action: 'note_added',
                    details: 'Notes updated'
                });
                changed = true;
            }

            if (updates.mitigation && updates.mitigation !== previousState.mitigation) {
                history.push({
                    date: new Date().toISOString(),
                    action: 'manual_edit',
                    details: 'Mitigation strategy updated'
                });
                changed = true;
            }

            // Persist history if anything changed
            if (changed) {
                try {
                    await originalUpdate(id, { statusHistory: history });
                } catch (e) {
                    console.warn('⚠️ Failed to persist status history:', e.message);
                }
            }
        }

        return result;
    };

    console.log('✅ poamDB.updatePOAM patched for automatic status history tracking');
})();

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function escapeHtmlLifecycle(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// Expose globally
window.exportPOAMBackup = exportPOAMBackup;
window.importPOAMBackup = importPOAMBackup;
window.mergePOAMsFromScan = mergePOAMsFromScan;
window.appendStatusHistory = appendStatusHistory;
window.renderStatusHistory = renderStatusHistory;
window.clearAllPOAMsWithBackup = clearAllPOAMsWithBackup;

console.log('✅ poam-lifecycle.js loaded');
