// Bulk Operations for POAM Management
// Handles selection, bulk actions, and export functionality

// Track selected POAMs
let selectedPOAMs = new Set();

// Toggle individual POAM selection
function togglePOAMSelection(poamId, isChecked) {
    if (isChecked) {
        selectedPOAMs.add(poamId);
    } else {
        selectedPOAMs.delete(poamId);
    }
    updateBulkActionsToolbar();
}

// Toggle select all POAMs
function toggleSelectAll(isChecked) {
    const checkboxes = document.querySelectorAll('.poam-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const poamId = cb.getAttribute('data-poam-id');
        if (isChecked) {
            selectedPOAMs.add(poamId);
        } else {
            selectedPOAMs.delete(poamId);
        }
    });
    updateBulkActionsToolbar();
}

// Clear selection
function clearSelection() {
    selectedPOAMs.clear();
    document.querySelectorAll('.poam-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('select-all-poams').checked = false;
    updateBulkActionsToolbar();
}

// Update bulk actions toolbar visibility and count
function updateBulkActionsToolbar() {
    const toolbar = document.getElementById('bulk-actions-toolbar');
    const countSpan = document.getElementById('selected-count');
    
    if (selectedPOAMs.size > 0) {
        toolbar.classList.remove('hidden');
        countSpan.textContent = selectedPOAMs.size;
    } else {
        toolbar.classList.add('hidden');
    }
}

// ═══════════════════════════════════════════════════════════════
// BULK ASSIGN POC
// ═══════════════════════════════════════════════════════════════

function showBulkAssignPOC() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h2 class="text-2xl font-bold text-slate-900 mb-4">Bulk Assign POC</h2>
            <p class="text-sm text-slate-600 mb-6">Assign a Point of Contact to ${selectedPOAMs.size} selected POAMs</p>
            
            <label class="block text-sm font-semibold text-slate-700 mb-2">Select POC Team</label>
            <select id="bulk-poc-select" class="w-full px-3 py-2 border border-slate-300 rounded-lg mb-6">
                <option value="">Select a team...</option>
                <option value="Windows Systems Team">Windows Systems Team</option>
                <option value="Linux Systems Team">Linux Systems Team</option>
                <option value="Network Engineering Team">Network Engineering Team</option>
                <option value="Desktop Engineering Team">Desktop Engineering Team</option>
                <option value="Application Development Team">Application Development Team</option>
                <option value="Web Infrastructure Team">Web Infrastructure Team</option>
                <option value="Network Security Team">Network Security Team</option>
                <option value="End User Computing Team">End User Computing Team</option>
                <option value="Security Operations Team">Security Operations Team</option>
                <option value="PCI Compliance Team">PCI Compliance Team</option>
                <option value="Critical Systems Team">Critical Systems Team</option>
            </select>
            
            <div class="flex gap-3">
                <button onclick="this.closest('.fixed').remove()" class="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                    Cancel
                </button>
                <button onclick="executeBulkAssignPOC()" class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    Assign POC
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function executeBulkAssignPOC() {
    const select = document.getElementById('bulk-poc-select');
    const pocTeam = select.value;
    
    if (!pocTeam) {
        showUpdateFeedback('Please select a POC team', 'error');
        return;
    }
    
    try {
        let successCount = 0;
        for (const poamId of selectedPOAMs) {
            try {
                const poam = await poamDB.getPOAM(poamId);
                if (poam) {
                    poam.poc = pocTeam;
                    poam.pocTeam = pocTeam;
                    await poamDB.savePOAM(poam);
                    successCount++;
                }
            } catch (error) {
                console.error(`Failed to update POAM ${poamId}:`, error);
            }
        }
        
        showUpdateFeedback(`Successfully assigned POC to ${successCount} POAMs`, 'success');
    } catch (error) {
        console.error('Bulk assign POC operation failed:', error);
        showUpdateFeedback('Operation failed: ' + error.message, 'error');
    } finally {
        // Always close modal, even if there was an error
        const modal = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
        if (modal) {
            modal.remove();
        }
        
        // Always refresh display and clear selection
        await displayVulnerabilityPOAMs();
        clearSelection();
    }
}

// ═══════════════════════════════════════════════════════════════
// BULK CHANGE STATUS
// ═══════════════════════════════════════════════════════════════

function showBulkChangeStatus() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h2 class="text-2xl font-bold text-slate-900 mb-4">Bulk Change Status</h2>
            <p class="text-sm text-slate-600 mb-6">Change status for ${selectedPOAMs.size} selected POAMs</p>
            
            <label class="block text-sm font-semibold text-slate-700 mb-2">Select Status</label>
            <select id="bulk-status-select" class="w-full px-3 py-2 border border-slate-300 rounded-lg mb-6">
                <option value="">Select a status...</option>
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="risk-accepted">Risk Accepted</option>
                <option value="extended">Extended</option>
                <option value="completed">Completed</option>
                <option value="closed">Closed</option>
            </select>
            
            <div class="flex gap-3">
                <button onclick="this.closest('.fixed').remove()" class="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                    Cancel
                </button>
                <button onclick="executeBulkChangeStatus()" class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    Change Status
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function executeBulkChangeStatus() {
    const select = document.getElementById('bulk-status-select');
    const status = select.value;
    
    if (!status) {
        showUpdateFeedback('Please select a status', 'error');
        return;
    }
    
    try {
        let successCount = 0;
        for (const poamId of selectedPOAMs) {
            try {
                const poam = await poamDB.getPOAM(poamId);
                if (poam) {
                    poam.status = status;
                    await poamDB.savePOAM(poam);
                    successCount++;
                }
            } catch (error) {
                console.error(`Failed to update POAM ${poamId}:`, error);
            }
        }
        
        showUpdateFeedback(`Successfully changed status for ${successCount} POAMs`, 'success');
    } catch (error) {
        console.error('Bulk change status operation failed:', error);
        showUpdateFeedback('Operation failed: ' + error.message, 'error');
    } finally {
        // Always close modal, even if there was an error
        const modal = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
        if (modal) {
            modal.remove();
        }
        
        // Always refresh display and clear selection
        await displayVulnerabilityPOAMs();
        clearSelection();
    }
}

// ═══════════════════════════════════════════════════════════════
// BULK ADD NOTE
// ═══════════════════════════════════════════════════════════════

function showBulkAddNote() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4">
            <h2 class="text-2xl font-bold text-slate-900 mb-4">Bulk Add Note</h2>
            <p class="text-sm text-slate-600 mb-6">Add a note/comment to ${selectedPOAMs.size} selected POAMs</p>
            
            <label class="block text-sm font-semibold text-slate-700 mb-2">Note</label>
            <textarea 
                id="bulk-note-text" 
                rows="4"
                placeholder="Enter note or comment..."
                class="w-full px-3 py-2 border border-slate-300 rounded-lg mb-6 focus:ring-2 focus:ring-indigo-500"></textarea>
            
            <div class="flex gap-3">
                <button onclick="this.closest('.fixed').remove()" class="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                    Cancel
                </button>
                <button onclick="executeBulkAddNote()" class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    Add Note
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function executeBulkAddNote() {
    const textarea = document.getElementById('bulk-note-text');
    const note = textarea.value.trim();
    
    if (!note) {
        showUpdateFeedback('Please enter a note', 'error');
        return;
    }
    
    try {
        const timestamp = new Date().toISOString();
        let successCount = 0;
        
        for (const poamId of selectedPOAMs) {
            try {
                const poam = await poamDB.getPOAM(poamId);
                if (poam) {
                    // Initialize notes array if it doesn't exist
                    if (!poam.notes) {
                        poam.notes = [];
                    }
                    
                    // Add note with timestamp
                    poam.notes.push({
                        text: note,
                        timestamp: timestamp,
                        author: 'Admin User'
                    });
                    
                    await poamDB.savePOAM(poam);
                    successCount++;
                }
            } catch (error) {
                console.error(`Failed to update POAM ${poamId}:`, error);
            }
        }
        
        showUpdateFeedback(`Successfully added note to ${successCount} POAMs`, 'success');
    } catch (error) {
        console.error('Bulk add note operation failed:', error);
        showUpdateFeedback('Operation failed: ' + error.message, 'error');
    } finally {
        // Always close modal, even if there was an error
        const modal = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
        if (modal) {
            modal.remove();
        }
        
        // Always refresh display and clear selection
        await displayVulnerabilityPOAMs();
        clearSelection();
    }
}

// ═══════════════════════════════════════════════════════════════
// BULK EXPORT
// ═══════════════════════════════════════════════════════════════

async function bulkExportPOAMs() {
    const poamsToExport = [];
    
    for (const poamId of selectedPOAMs) {
        try {
            const poam = await poamDB.getPOAM(poamId);
            if (poam) {
                poamsToExport.push(poam);
            }
        } catch (error) {
            console.error(`Failed to get POAM ${poamId}:`, error);
        }
    }
    
    if (poamsToExport.length === 0) {
        showUpdateFeedback('No POAMs to export', 'error');
        return;
    }
    
    // Create CSV content
    const headers = [
        'POAM ID',
        'Title',
        'Risk Level',
        'Status',
        'Due Date',
        'POC',
        'Asset Count',
        'Breached Assets',
        'Active Assets',
        'Description',
        'Tags',
        'Notes'
    ];
    
    const rows = poamsToExport.map(poam => [
        poam.id || '',
        (poam.title || poam.vulnerability || '').replace(/"/g, '""'),
        poam.risk || '',
        poam.status || '',
        poam.dueDate || '',
        poam.poc || poam.pocTeam || '',
        poam.totalAffectedAssets || poam.assetCount || '',
        poam.breachedAssets || '',
        poam.activeAssets || '',
        (poam.description || '').replace(/"/g, '""').substring(0, 500),
        (poam.tags || []).join('; '),
        (poam.notes || []).map(n => `${n.timestamp}: ${n.text}`).join('; ').replace(/"/g, '""')
    ]);
    
    // Build CSV
    let csv = headers.map(h => `"${h}"`).join(',') + '\n';
    csv += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    // Create download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `poams_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showUpdateFeedback(`Successfully exported ${poamsToExport.length} POAMs`, 'success');
    
    // Clear selection
    clearSelection();
}
