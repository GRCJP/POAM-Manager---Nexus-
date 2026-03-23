// ═══════════════════════════════════════════════════════════════
// WORKBOOK IMPORT PREVIEW & COLUMN MAPPING
// Shows what will be imported before committing
// ═══════════════════════════════════════════════════════════════

async function showWorkbookImportPreview(file, systemId) {
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        showUpdateFeedback('XLSX library not loaded', 'error');
        return;
    }

    try {
        // Read the Excel file
        const wb = await file.arrayBuffer().then(buf => XLSX.read(buf, { type: 'array', cellDates: true }));
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error('Workbook has no sheets');

        const ws = wb.Sheets[sheetName];
        const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
        
        if (!Array.isArray(matrix) || matrix.length < 2) {
            throw new Error('No data rows found in workbook');
        }

        // Assume first row is headers
        const headerRow = matrix[0];
        const dataRows = matrix.slice(1, 6); // Show first 5 rows as preview

        // Show preview modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-6 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h2 class="text-xl font-bold text-slate-900">Import Preview</h2>
                        <p class="text-sm text-slate-500 mt-1">File: ${escapeHtml(file.name)} → System: ${escapeHtml(systemId)}</p>
                    </div>
                    <button id="close-preview-btn" class="text-slate-400 hover:text-slate-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
                    <i class="fas fa-info-circle mr-2"></i>
                    <strong>Preview:</strong> Showing first 5 rows. Total rows in file: ${matrix.length - 1}
                </div>

                <!-- Data Preview Table -->
                <div class="flex-1 overflow-auto border border-slate-200 rounded-lg mb-4">
                    <table class="min-w-full text-xs">
                        <thead class="bg-slate-100 sticky top-0">
                            <tr>
                                ${headerRow.map((h, idx) => `
                                    <th class="px-3 py-2 text-left font-semibold text-slate-700 border-r border-slate-200">
                                        <div class="text-[10px] text-slate-500 mb-1">Col ${String.fromCharCode(65 + idx)}</div>
                                        <div class="font-semibold">${escapeHtml(String(h || '').substring(0, 30))}</div>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${dataRows.map((row, rowIdx) => `
                                <tr class="border-t border-slate-100 hover:bg-slate-50">
                                    ${headerRow.map((h, colIdx) => `
                                        <td class="px-3 py-2 border-r border-slate-100 text-slate-700">
                                            ${escapeHtml(String(row[colIdx] || '').substring(0, 50))}
                                        </td>
                                    `).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Column Mapping Info -->
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                    <h3 class="font-semibold text-slate-800 mb-2">Expected Column Headers:</h3>
                    <div class="grid grid-cols-3 gap-2 text-xs">
                        ${(window.POAM_WORKBOOK_COLUMNS || []).map(col => `
                            <div class="bg-white px-2 py-1 rounded border border-slate-200">
                                <i class="fas fa-check-circle text-green-600 mr-1"></i>${escapeHtml(col)}
                            </div>
                        `).join('')}
                    </div>
                    <p class="text-xs text-slate-600 mt-3">
                        <i class="fas fa-lightbulb text-amber-500 mr-1"></i>
                        <strong>Tip:</strong> Column headers should match these names (case-insensitive, flexible matching).
                    </p>
                </div>

                <!-- Actions -->
                <div class="flex justify-between items-center gap-3 pt-4 border-t">
                    <div class="text-sm text-slate-600">
                        Ready to import <strong>${matrix.length - 1}</strong> rows into system <strong>${escapeHtml(systemId)}</strong>
                    </div>
                    <div class="flex gap-3">
                        <button id="cancel-import-btn" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                            Cancel
                        </button>
                        <button id="proceed-import-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                            <i class="fas fa-upload mr-2"></i>Proceed with Import
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Handle close button
        modal.querySelector('#close-preview-btn').onclick = () => {
            modal.remove();
        };

        // Handle cancel button
        modal.querySelector('#cancel-import-btn').onclick = () => {
            modal.remove();
        };

        // Handle clicking outside modal
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        };

        // Handle proceed button
        modal.querySelector('#proceed-import-btn').onclick = async () => {
            modal.remove();
            
            // Now do the actual import using the simple direct importer
            try {
                const result = await window.poamWorkbookImportXlsxSimple(file, systemId);
                const msg = `Imported ${result.saved} workbook POAMs`;
                showUpdateFeedback(msg, 'success');
                await renderWorkbookSidebarSystems();
                await renderWorkbookOverview();
                if (window.poamWorkbookState.activeTab === 'system') {
                    await renderWorkbookSystemTable(window.poamWorkbookState.activeSystemId);
                }
            } catch (e) {
                console.error('Import failed:', e);
                showUpdateFeedback(`Import failed: ${e.message}`, 'error');
            }
        };

    } catch (error) {
        console.error('Preview failed:', error);
        showUpdateFeedback(`Preview failed: ${error.message}`, 'error');
    }
}

// Replace the existing import handler
async function poamWorkbookHandleImportInputWithPreview(evt) {
    const input = evt.target;
    const file = input.files && input.files[0];
    if (!file) return;

    const systemId = window.poamWorkbookState.activeSystemId || 'default';
    
    try {
        await showWorkbookImportPreview(file, systemId);
    } catch (e) {
        console.error(e);
        showUpdateFeedback(`Preview failed: ${e.message}`, 'error');
    } finally {
        input.value = '';
    }
}

// Export functions
window.showWorkbookImportPreview = showWorkbookImportPreview;
window.poamWorkbookHandleImportInputWithPreview = poamWorkbookHandleImportInputWithPreview;
