// ═══════════════════════════════════════════════════════════════
// POAM WORKBOOK ENHANCEMENTS
// Enhanced import validation, inline editing, bulk operations
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ENHANCED IMPORT VALIDATION
// ═══════════════════════════════════════════════════════════════

async function poamWorkbookValidateImportData(parsedData, systemId) {
    const validationResults = {
        valid: [],
        warnings: [],
        errors: [],
        summary: {
            totalRows: parsedData.accepted.length,
            validRows: 0,
            rowsWithWarnings: 0,
            rowsWithErrors: 0
        }
    };

    const requiredFields = ['Vulnerability Name', 'POC Name', 'Severity Value'];
    const dateFields = ['Detection Date', 'Scheduled Completion Date'];
    const severityValues = ['Critical', 'High', 'Medium', 'Low', 'Informational'];

    for (let i = 0; i < parsedData.accepted.length; i++) {
        const row = parsedData.accepted[i].obj;
        const rowNum = i + 1;
        const rowValidation = {
            rowNumber: rowNum,
            data: row,
            errors: [],
            warnings: []
        };

        // Check required fields
        requiredFields.forEach(field => {
            const value = String(row[field] || '').trim();
            if (!value) {
                rowValidation.errors.push(`Missing required field: ${field}`);
            }
        });

        // Validate severity
        const severity = String(row['Severity Value'] || '').trim();
        if (severity && !severityValues.some(v => v.toLowerCase() === severity.toLowerCase())) {
            rowValidation.warnings.push(`Unknown severity value: "${severity}". Expected: ${severityValues.join(', ')}`);
        }

        // Validate dates
        dateFields.forEach(field => {
            const value = String(row[field] || '').trim();
            if (value) {
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    rowValidation.warnings.push(`Invalid date format in ${field}: "${value}"`);
                }
            }
        });

        // Check for duplicate POAM IDs within import
        const itemNumber = String(row['Item number'] || '').trim();
        if (itemNumber) {
            const duplicates = parsedData.accepted.filter((r, idx) => 
                idx !== i && String(r.obj['Item number'] || '').trim() === itemNumber
            );
            if (duplicates.length > 0) {
                rowValidation.warnings.push(`Duplicate POAM ID "${itemNumber}" found in import`);
            }
        }

        // Categorize row
        if (rowValidation.errors.length > 0) {
            validationResults.errors.push(rowValidation);
            validationResults.summary.rowsWithErrors++;
        } else if (rowValidation.warnings.length > 0) {
            validationResults.warnings.push(rowValidation);
            validationResults.summary.rowsWithWarnings++;
        } else {
            validationResults.valid.push(rowValidation);
            validationResults.summary.validRows++;
        }
    }

    return validationResults;
}

function showImportValidationModal(validationResults, onProceed, onCancel) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    
    const { summary, errors, warnings } = validationResults;
    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0;

    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div class="flex items-start justify-between mb-4">
                <div>
                    <h2 class="text-xl font-bold text-slate-900">Import Validation Results</h2>
                    <p class="text-sm text-slate-500 mt-1">Review validation issues before importing</p>
                </div>
                <button onclick="this.closest('.modal').remove()" class="text-slate-400 hover:text-slate-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-4 gap-3 mb-4">
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <div class="text-2xl font-bold text-slate-900">${summary.totalRows}</div>
                    <div class="text-xs text-slate-600">Total Rows</div>
                </div>
                <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div class="text-2xl font-bold text-green-600">${summary.validRows}</div>
                    <div class="text-xs text-green-700">Valid</div>
                </div>
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                    <div class="text-2xl font-bold text-amber-600">${summary.rowsWithWarnings}</div>
                    <div class="text-xs text-amber-700">Warnings</div>
                </div>
                <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <div class="text-2xl font-bold text-red-600">${summary.rowsWithErrors}</div>
                    <div class="text-xs text-red-700">Errors</div>
                </div>
            </div>

            <!-- Validation Details -->
            <div class="flex-1 overflow-y-auto space-y-4">
                ${hasErrors ? `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h3 class="font-semibold text-red-900 mb-2 flex items-center gap-2">
                            <i class="fas fa-exclamation-circle"></i>
                            Errors (${errors.length} rows)
                        </h3>
                        <div class="space-y-2 max-h-48 overflow-y-auto">
                            ${errors.slice(0, 10).map(row => `
                                <div class="text-sm bg-white rounded p-2">
                                    <div class="font-semibold text-red-800">Row ${row.rowNumber}: ${escapeHtml(row.data['Vulnerability Name'] || 'Unnamed')}</div>
                                    <ul class="list-disc list-inside text-red-700 text-xs mt-1">
                                        ${row.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}
                                    </ul>
                                </div>
                            `).join('')}
                            ${errors.length > 10 ? `<div class="text-xs text-red-600 italic">... and ${errors.length - 10} more</div>` : ''}
                        </div>
                    </div>
                ` : ''}

                ${hasWarnings ? `
                    <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <h3 class="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                            <i class="fas fa-exclamation-triangle"></i>
                            Warnings (${warnings.length} rows)
                        </h3>
                        <div class="space-y-2 max-h-48 overflow-y-auto">
                            ${warnings.slice(0, 10).map(row => `
                                <div class="text-sm bg-white rounded p-2">
                                    <div class="font-semibold text-amber-800">Row ${row.rowNumber}: ${escapeHtml(row.data['Vulnerability Name'] || 'Unnamed')}</div>
                                    <ul class="list-disc list-inside text-amber-700 text-xs mt-1">
                                        ${row.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
                                    </ul>
                                </div>
                            `).join('')}
                            ${warnings.length > 10 ? `<div class="text-xs text-amber-600 italic">... and ${warnings.length - 10} more</div>` : ''}
                        </div>
                    </div>
                ` : ''}

                ${!hasErrors && !hasWarnings ? `
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <i class="fas fa-check-circle text-green-600 text-3xl mb-2"></i>
                        <p class="text-green-800 font-semibold">All rows passed validation!</p>
                        <p class="text-sm text-green-700 mt-1">Ready to import ${summary.totalRows} POAMs</p>
                    </div>
                ` : ''}
            </div>

            <!-- Actions -->
            <div class="flex justify-between items-center gap-3 mt-4 pt-4 border-t">
                <div class="text-sm text-slate-600">
                    ${hasErrors ? '<span class="text-red-600 font-semibold">⚠️ Errors must be fixed before importing</span>' : ''}
                </div>
                <div class="flex gap-3">
                    <button onclick="this.closest('.modal').remove()" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                        Cancel
                    </button>
                    ${!hasErrors ? `
                        <button id="proceed-import-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                            <i class="fas fa-upload mr-2"></i>Import ${summary.validRows + summary.rowsWithWarnings} POAMs
                        </button>
                    ` : `
                        <button disabled class="px-4 py-2 bg-slate-300 text-slate-500 rounded-lg cursor-not-allowed">
                            <i class="fas fa-ban mr-2"></i>Cannot Import (Errors Present)
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const proceedBtn = modal.querySelector('#proceed-import-btn');
    if (proceedBtn) {
        proceedBtn.onclick = () => {
            modal.remove();
            if (typeof onProceed === 'function') onProceed();
        };
    }

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
            if (typeof onCancel === 'function') onCancel();
        }
    };
}

// ═══════════════════════════════════════════════════════════════
// INLINE POAM EDITING
// ═══════════════════════════════════════════════════════════════

function showQuickEditPOAMModal(poamId, systemId) {
    if (!window.poamWorkbookDB) {
        showUpdateFeedback('Workbook DB not available', 'error');
        return;
    }

    window.poamWorkbookDB.getItemById(poamId).then(poam => {
        if (!poam) {
            showUpdateFeedback('POAM not found', 'error');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-bold text-slate-900">Quick Edit POAM</h2>
                        <p class="text-sm text-slate-500 mt-1">ID: ${escapeHtml(poam['Item number'] || poamId)}</p>
                    </div>
                    <button onclick="this.closest('.modal').remove()" class="text-slate-400 hover:text-slate-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <form id="quick-edit-form" class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="col-span-2">
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Vulnerability Name *</label>
                            <input type="text" id="edit-vuln-name" required class="w-full px-3 py-2 border border-slate-300 rounded-lg" value="${escapeAttr(poam['Vulnerability Name'] || '')}">
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">POC Name *</label>
                            <input type="text" id="edit-poc" required class="w-full px-3 py-2 border border-slate-300 rounded-lg" value="${escapeAttr(poam['POC Name'] || '')}">
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Office/Org</label>
                            <input type="text" id="edit-office" class="w-full px-3 py-2 border border-slate-300 rounded-lg" value="${escapeAttr(poam['Office/Org'] || '')}">
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Severity *</label>
                            <select id="edit-severity" required class="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                <option value="">Select...</option>
                                <option value="Critical" ${poam['Severity Value'] === 'Critical' ? 'selected' : ''}>Critical</option>
                                <option value="High" ${poam['Severity Value'] === 'High' ? 'selected' : ''}>High</option>
                                <option value="Medium" ${poam['Severity Value'] === 'Medium' ? 'selected' : ''}>Medium</option>
                                <option value="Low" ${poam['Severity Value'] === 'Low' ? 'selected' : ''}>Low</option>
                                <option value="Informational" ${poam['Severity Value'] === 'Informational' ? 'selected' : ''}>Informational</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                            <select id="edit-status" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                <option value="">Select...</option>
                                <option value="Open" ${poam['Status'] === 'Open' ? 'selected' : ''}>Open</option>
                                <option value="In Progress" ${poam['Status'] === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                <option value="Completed" ${poam['Status'] === 'Completed' ? 'selected' : ''}>Completed</option>
                                <option value="Risk Accepted" ${poam['Status'] === 'Risk Accepted' ? 'selected' : ''}>Risk Accepted</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Detection Date</label>
                            <input type="date" id="edit-detection-date" class="w-full px-3 py-2 border border-slate-300 rounded-lg" value="${poam['Detection Date'] ? new Date(poam['Detection Date']).toISOString().split('T')[0] : ''}">
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Scheduled Completion Date</label>
                            <input type="date" id="edit-completion-date" class="w-full px-3 py-2 border border-slate-300 rounded-lg" value="${poam['Scheduled Completion Date'] ? new Date(poam['Scheduled Completion Date']).toISOString().split('T')[0] : ''}">
                        </div>

                        <div class="col-span-2">
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Vulnerability Description</label>
                            <textarea id="edit-description" rows="3" class="w-full px-3 py-2 border border-slate-300 rounded-lg">${escapeHtml(poam['Vulnerability Description'] || '')}</textarea>
                        </div>

                        <div class="col-span-2">
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Mitigations</label>
                            <textarea id="edit-mitigations" rows="3" class="w-full px-3 py-2 border border-slate-300 rounded-lg">${escapeHtml(poam['Mitigations'] || '')}</textarea>
                        </div>

                        <div class="col-span-2">
                            <label class="block text-sm font-semibold text-slate-700 mb-1">Comments</label>
                            <textarea id="edit-comments" rows="2" class="w-full px-3 py-2 border border-slate-300 rounded-lg">${escapeHtml(poam['Comments'] || '')}</textarea>
                        </div>
                    </div>

                    <div class="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onclick="this.closest('.modal').remove()" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                            Cancel
                        </button>
                        <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                            <i class="fas fa-save mr-2"></i>Save Changes
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#quick-edit-form').onsubmit = async (e) => {
            e.preventDefault();

            const updatedPoam = {
                ...poam,
                'Vulnerability Name': modal.querySelector('#edit-vuln-name').value.trim(),
                'POC Name': modal.querySelector('#edit-poc').value.trim(),
                'Office/Org': modal.querySelector('#edit-office').value.trim(),
                'Severity Value': modal.querySelector('#edit-severity').value,
                'Status': modal.querySelector('#edit-status').value,
                'Detection Date': modal.querySelector('#edit-detection-date').value,
                'Scheduled Completion Date': modal.querySelector('#edit-completion-date').value,
                'Vulnerability Description': modal.querySelector('#edit-description').value.trim(),
                'Mitigations': modal.querySelector('#edit-mitigations').value.trim(),
                'Comments': modal.querySelector('#edit-comments').value.trim(),
                updatedAt: new Date().toISOString()
            };

            try {
                await window.poamWorkbookDB.saveItem(updatedPoam);
                showUpdateFeedback('POAM updated successfully', 'success');
                modal.remove();
                
                // Refresh the table if we're viewing this system
                if (window.poamWorkbookState.activeTab === 'system' && window.poamWorkbookState.activeSystemId === systemId) {
                    await renderWorkbookSystemTable(systemId);
                }
                await renderWorkbookOverview();
            } catch (error) {
                console.error('Failed to update POAM:', error);
                showUpdateFeedback(`Failed to update: ${error.message}`, 'error');
            }
        };
    }).catch(error => {
        console.error('Failed to load POAM:', error);
        showUpdateFeedback(`Failed to load POAM: ${error.message}`, 'error');
    });
}

// Export functions globally
window.poamWorkbookValidateImportData = poamWorkbookValidateImportData;
window.showImportValidationModal = showImportValidationModal;
window.showQuickEditPOAMModal = showQuickEditPOAMModal;
