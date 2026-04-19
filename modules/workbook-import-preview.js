// ═══════════════════════════════════════════════════════════════
// WORKBOOK IMPORT — Modern single-progress-bar UI
// ═══════════════════════════════════════════════════════════════

async function showWorkbookImportPreview(file, systemId) {
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        showUpdateFeedback('XLSX library not loaded', 'error');
        return;
    }

    // Show minimal processing modal immediately
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-md w-full text-center">
            <div style="width:56px;height:56px;margin:0 auto 20px;background:#E6F7F7;border-radius:50%;display:flex;align-items:center;justify-content:center">
                <i class="fas fa-file-import" style="font-size:22px;color:#0D7377"></i>
            </div>
            <h2 class="text-lg font-bold text-slate-900 mb-1">Importing POAMs</h2>
            <p id="import-status-text" class="text-sm text-slate-500 mb-6">${escapeHtml(file.name)}</p>
            <div style="background:#F3F4F6;border-radius:999px;height:8px;overflow:hidden;margin-bottom:8px">
                <div id="import-progress-bar" style="width:0%;height:100%;background:#0D7377;border-radius:999px;transition:width 0.3s ease"></div>
            </div>
            <div id="import-percent" class="text-xs font-semibold text-slate-500">0%</div>
        </div>
    `;
    document.body.appendChild(modal);

    const bar = modal.querySelector('#import-progress-bar');
    const pct = modal.querySelector('#import-percent');
    const statusText = modal.querySelector('#import-status-text');

    const setProgress = (p, text) => {
        const val = Math.min(100, Math.max(0, Math.round(p)));
        bar.style.width = val + '%';
        pct.textContent = val + '%';
        if (text) statusText.textContent = text;
    };

    try {
        setProgress(10, 'Reading file...');
        await new Promise(r => setTimeout(r, 80)); // allow UI to paint

        const result = await window.poamWorkbookImportXlsxSimple(file, systemId, (progress) => {
            // Optional progress callback from import function
            if (progress) setProgress(progress.pct, progress.text);
        });

        setProgress(100, 'Complete');
        await new Promise(r => setTimeout(r, 300));

        // Show summary
        const hasErrors = result.errors && result.errors.length > 0;
        const hasWarnings = result.warnings && result.warnings.length > 0;

        const content = modal.querySelector('.bg-white');
        content.style.maxWidth = '520px';
        content.style.textAlign = 'left';
        content.innerHTML = `
            <div class="flex items-start justify-between mb-5">
                <div class="flex items-center gap-3">
                    <div style="width:40px;height:40px;background:#E6F7F7;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <i class="fas fa-check" style="color:#0D7377;font-size:16px"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-slate-900">Import Complete</h2>
                        <p class="text-xs text-slate-500">${escapeHtml(file.name)}</p>
                    </div>
                </div>
                <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">
                <div style="background:#E6F7F7;border-radius:8px;padding:12px;text-align:center">
                    <div style="font-size:22px;font-weight:800;color:#0D7377">${result.saved}</div>
                    <div style="font-size:10px;font-weight:700;color:#0A5E62;text-transform:uppercase;letter-spacing:0.5px">New</div>
                </div>
                <div style="background:#FFF7ED;border-radius:8px;padding:12px;text-align:center">
                    <div style="font-size:22px;font-weight:800;color:#B45309">${result.updated}</div>
                    <div style="font-size:10px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:0.5px">Updated</div>
                </div>
                <div style="background:#F3F4F6;border-radius:8px;padding:12px;text-align:center">
                    <div style="font-size:22px;font-weight:800;color:#374151">${result.total}</div>
                    <div style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px">Total Rows</div>
                </div>
            </div>

            ${hasErrors ? `
            <div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:8px;padding:12px;margin-bottom:12px">
                <div style="font-size:12px;font-weight:700;color:#991B1B;margin-bottom:6px"><i class="fas fa-exclamation-circle" style="margin-right:4px"></i>${result.errors.length} row(s) skipped</div>
                <div style="max-height:80px;overflow-y:auto;font-size:11px;color:#DC2626">
                    ${result.errors.map(e => `<div>Row ${e.row}: ${escapeHtml(e.message)}</div>`).join('')}
                </div>
            </div>` : ''}

            ${hasWarnings ? `
            <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:12px;margin-bottom:12px">
                <div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:6px"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>${result.warnings.length} row(s) with warnings</div>
                <div style="max-height:100px;overflow-y:auto;font-size:11px;color:#B45309">
                    ${result.warnings.map(w => `<div style="margin-bottom:4px"><strong>${escapeHtml(w.id)}</strong> (row ${w.row}): ${w.issues.map(i => escapeHtml(i)).join('; ')}</div>`).join('')}
                </div>
            </div>` : ''}

            <div style="display:flex;justify-content:flex-end;padding-top:16px;border-top:1px solid #F3F4F6">
                <button onclick="this.closest('.fixed').remove()" style="padding:8px 20px;background:#0D7377;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Done</button>
            </div>
        `;

        // Refresh workbook views
        await renderWorkbookSidebarSystems();
        await renderWorkbookOverview();
        if (window.poamWorkbookState.activeTab === 'system') {
            await renderWorkbookSystemTable(window.poamWorkbookState.activeSystemId);
        }

    } catch (error) {
        console.error('Import failed:', error);
        modal.remove();
        showUpdateFeedback(`Import failed: ${error.message}`, 'error');
    }
}

function poamWorkbookHandleImportInputWithPreview(evt) {
    const file = evt?.target?.files?.[0];
    if (!file) return;

    const systemId = window.poamWorkbookState?.activeSystemId;
    if (!systemId) {
        showUpdateFeedback('Select a system before importing', 'error');
        evt.target.value = '';
        return;
    }

    showWorkbookImportPreview(file, systemId);
    evt.target.value = '';
}

window.showWorkbookImportPreview = showWorkbookImportPreview;
window.poamWorkbookHandleImportInputWithPreview = poamWorkbookHandleImportInputWithPreview;
