// Pipeline Progress UI — Clean single-bar progress + tile-based summary
console.log('pipeline-progress-ui.js loading...');

class PipelineProgressUI {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.currentState = null;
    }

    show() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.error(`Container ${this.containerId} not found`);
            return;
        }
        this.container.innerHTML = this.renderProgressUI();
        this.container.classList.remove('hidden');
    }

    hide() {
        if (this.container) this.container.classList.add('hidden');
    }

    renderProgressUI() {
        return `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="pipeline-progress-overlay">
                <div class="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-8" id="pipeline-progress-content">
                    <div style="width:56px;height:56px;margin:0 auto 20px;background:#E6F7F7;border-radius:50%;display:flex;align-items:center;justify-content:center">
                        <i class="fas fa-radar" style="font-size:22px;color:#0D7377"></i>
                    </div>
                    <h2 style="text-align:center;font-size:18px;font-weight:700;color:#111827;margin-bottom:4px">Processing Scan Data</h2>
                    <p id="status-text" style="text-align:center;font-size:13px;color:#6B7280;margin-bottom:24px">Initializing pipeline...</p>

                    <div style="background:#F3F4F6;border-radius:999px;height:8px;overflow:hidden;margin-bottom:8px">
                        <div id="overall-progress-bar" style="width:0%;height:100%;background:#0D7377;border-radius:999px;transition:width 0.3s ease"></div>
                    </div>
                    <div id="overall-progress-percent" style="text-align:center;font-size:11px;font-weight:600;color:#6B7280;margin-bottom:24px">0%</div>

                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
                        <div style="background:#E6F7F7;border-radius:8px;padding:10px;text-align:center">
                            <div id="count-total" style="font-size:20px;font-weight:800;color:#0D7377">0</div>
                            <div style="font-size:9px;font-weight:700;color:#0A5E62;text-transform:uppercase;letter-spacing:0.5px">Findings</div>
                        </div>
                        <div style="background:#E6F7F7;border-radius:8px;padding:10px;text-align:center">
                            <div id="count-eligible" style="font-size:20px;font-weight:800;color:#0D7377">0</div>
                            <div style="font-size:9px;font-weight:700;color:#0A5E62;text-transform:uppercase;letter-spacing:0.5px">Eligible</div>
                        </div>
                        <div style="background:#F3F4F6;border-radius:8px;padding:10px;text-align:center">
                            <div id="count-groups" style="font-size:20px;font-weight:800;color:#374151">0</div>
                            <div style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px">Groups</div>
                        </div>
                        <div style="background:#E6F7F7;border-radius:8px;padding:10px;text-align:center">
                            <div id="count-poams" style="font-size:20px;font-weight:800;color:#0D7377">0</div>
                            <div style="font-size:9px;font-weight:700;color:#0A5E62;text-transform:uppercase;letter-spacing:0.5px">POAMs</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    updateProgress(state) {
        this.currentState = state;
        if (!this.container) this.show();

        this.updateOverallProgress(state.overallProgress);
        this.updateCounts(state.counts);
        this.updateStatusText(state.phaseName, state.phaseProgress);
    }

    updateOverallProgress(progress) {
        const percent = Math.floor(progress * 100);
        const bar = document.getElementById('overall-progress-bar');
        const text = document.getElementById('overall-progress-percent');
        if (bar) bar.style.width = percent + '%';
        if (text) text.textContent = percent + '%';
    }

    updateCounts(counts) {
        const map = {
            'count-total': counts.totalRows,
            'count-eligible': counts.eligibleCount,
            'count-groups': counts.groupCount,
            'count-poams': counts.poamsCreated
        };
        for (const [id, value] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value || 0;
        }
    }

    updateStatusText(phaseName, progress) {
        const el = document.getElementById('status-text');
        if (el) {
            const percent = Math.floor((progress || 0) * 100);
            el.textContent = `${phaseName || 'Processing'}... ${percent}%`;
        }
    }

    // Keep these as no-ops for backward compat (pipeline.js may still call them)
    updatePhaseIndicators() {}
    updateCurrentPhaseProgress() {}

    showComplete(counts) {
        const content = document.getElementById('pipeline-progress-content');
        if (!content) return;

        this.updateOverallProgress(1);

        const analysis = window.lastScanAnalysis || {};
        const isReImport = (counts.poamsMerged > 0 || counts.poamsAutoResolved > 0 || analysis.autoClosedPOAMs > 0);

        const created = counts.poamsCreated || 0;
        const updated = counts.poamsMerged || analysis.updatedPOAMs || 0;
        const reopened = analysis.reopenedPOAMs || 0;
        const closed = counts.poamsAutoResolved || analysis.autoClosedPOAMs || 0;
        const totalRows = counts.totalRows || 0;
        const excluded = counts.excludedCount || 0;
        const eligible = counts.eligibleCount || totalRows - excluded;

        content.innerHTML = `
            <div style="text-align:center;margin-bottom:20px">
                <div style="width:48px;height:48px;margin:0 auto 14px;background:#E6F7F7;border-radius:50%;display:flex;align-items:center;justify-content:center">
                    <i class="fas fa-check" style="font-size:20px;color:#0D7377"></i>
                </div>
                <h2 style="font-size:18px;font-weight:700;color:#111827;margin-bottom:2px">Scan Processing Complete</h2>
                <p style="font-size:12px;color:#6B7280">${totalRows.toLocaleString()} findings processed, ${eligible.toLocaleString()} eligible</p>
            </div>

            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px">
                <div style="background:#E6F7F7;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:9px;font-weight:700;color:#0A5E62;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Findings</div>
                    <div style="font-size:22px;font-weight:800;color:#0D7377">${totalRows.toLocaleString()}</div>
                </div>
                <div style="background:#E6F7F7;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:9px;font-weight:700;color:#0A5E62;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Eligible</div>
                    <div style="font-size:22px;font-weight:800;color:#0D7377">${eligible.toLocaleString()}</div>
                </div>
                <div style="background:#F3F4F6;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Groups</div>
                    <div style="font-size:22px;font-weight:800;color:#374151">${(counts.groupCount || 0).toLocaleString()}</div>
                </div>
                <div style="background:#E6F7F7;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:9px;font-weight:700;color:#0A5E62;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">POAMs</div>
                    <div style="font-size:22px;font-weight:800;color:#0D7377">${(created + updated).toLocaleString()}</div>
                </div>
            </div>

            ${isReImport ? `
            <div style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">Import Summary</div>
            <div style="display:grid;grid-template-columns:repeat(${reopened > 0 ? 4 : 3},1fr);gap:8px;margin-bottom:20px">
                <div style="background:#E6F7F7;border:1px solid #CCEEEE;border-radius:8px;padding:12px;text-align:center">
                    <div style="font-size:24px;font-weight:800;color:#0D7377">${created}</div>
                    <div style="font-size:10px;font-weight:700;color:#0A5E62;text-transform:uppercase">New</div>
                </div>
                <div style="background:#FFF7ED;border:1px solid #FDE68A;border-radius:8px;padding:12px;text-align:center">
                    <div style="font-size:24px;font-weight:800;color:#B45309">${updated}</div>
                    <div style="font-size:10px;font-weight:700;color:#92400E;text-transform:uppercase">Updated</div>
                </div>
                ${reopened > 0 ? `
                <div style="background:#FFF7ED;border:1px solid #FDE68A;border-radius:8px;padding:12px;text-align:center">
                    <div style="font-size:24px;font-weight:800;color:#B45309">${reopened}</div>
                    <div style="font-size:10px;font-weight:700;color:#92400E;text-transform:uppercase">Reopened</div>
                </div>` : ''}
                <div style="background:#F3F4F6;border:1px solid #E2E4E8;border-radius:8px;padding:12px;text-align:center">
                    <div style="font-size:24px;font-weight:800;color:#374151">${closed}</div>
                    <div style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase">Closed</div>
                </div>
            </div>
            ` : `
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:20px">
                <div style="background:#E6F7F7;border:1px solid #CCEEEE;border-radius:8px;padding:14px;text-align:center">
                    <div style="font-size:28px;font-weight:800;color:#0D7377">${created}</div>
                    <div style="font-size:10px;font-weight:700;color:#0A5E62;text-transform:uppercase">POAMs Created</div>
                </div>
                <div style="background:#F3F4F6;border:1px solid #E2E4E8;border-radius:8px;padding:14px;text-align:center">
                    <div style="font-size:28px;font-weight:800;color:#374151">${excluded}</div>
                    <div style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase">Excluded</div>
                </div>
            </div>
            `}

            ${analysis.partialRemediationPOAMs && analysis.partialRemediationPOAMs.length > 0 ? `
            <div style="background:#FFF7ED;border:1px solid #FDE68A;border-radius:8px;padding:10px;margin-bottom:12px">
                <div style="font-size:11px;font-weight:700;color:#92400E;margin-bottom:4px"><i class="fas fa-chart-line" style="margin-right:4px"></i>${analysis.partialRemediationPOAMs.length} POAM(s) show remediation progress</div>
                <div style="font-size:10px;color:#B45309;max-height:60px;overflow-y:auto">
                    ${analysis.partialRemediationPOAMs.slice(0, 5).map(p => `<div>${p.title.substring(0, 50)} — ${p.remediationPercent}% fewer assets</div>`).join('')}
                </div>
            </div>` : ''}

            ${analysis.riskChangedPOAMs && analysis.riskChangedPOAMs.length > 0 ? `
            <div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:8px;padding:10px;margin-bottom:12px">
                <div style="font-size:11px;font-weight:700;color:#991B1B;margin-bottom:4px"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>${analysis.riskChangedPOAMs.length} POAM(s) changed risk level</div>
                <div style="font-size:10px;color:#DC2626;max-height:60px;overflow-y:auto">
                    ${analysis.riskChangedPOAMs.slice(0, 5).map(p => `<div>${p.title.substring(0, 50)} — ${p.previousRisk} to ${p.newRisk}</div>`).join('')}
                </div>
            </div>` : ''}

            <div style="display:flex;gap:8px;justify-content:center;padding-top:12px;border-top:1px solid #F3F4F6">
                <button type="button" onclick="showModule('vulnerability-tracking'); document.getElementById('pipeline-progress-container')?.classList.add('hidden'); document.getElementById('pipeline-progress-overlay')?.remove();"
                    style="padding:8px 20px;background:#0D7377;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
                    <i class="fas fa-list" style="margin-right:5px"></i>View Findings
                </button>
                <button type="button" onclick="showModule('dashboard'); document.getElementById('pipeline-progress-container')?.classList.add('hidden'); document.getElementById('pipeline-progress-overlay')?.remove();"
                    style="padding:8px 20px;background:#F3F4F6;color:#374151;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
                    <i class="fas fa-chart-line" style="margin-right:5px"></i>Dashboard
                </button>
            </div>
        `;
    }

    showError(error) {
        const content = document.getElementById('pipeline-progress-content');
        if (!content) return;
        content.innerHTML = `
            <div style="text-align:center;margin-bottom:16px">
                <div style="width:48px;height:48px;margin:0 auto 14px;background:#FFF5F5;border-radius:50%;display:flex;align-items:center;justify-content:center">
                    <i class="fas fa-times" style="font-size:20px;color:#DC2626"></i>
                </div>
                <h2 style="font-size:18px;font-weight:700;color:#111827;margin-bottom:4px">Pipeline Failed</h2>
                <p style="font-size:12px;color:#DC2626">${error.message || 'Unknown error'}</p>
                ${error.phase ? `<p style="font-size:11px;color:#6B7280;margin-top:4px">Phase: ${error.phase}</p>` : ''}
            </div>
            <div style="display:flex;justify-content:center">
                <button type="button" onclick="document.getElementById('pipeline-progress-container')?.classList.add('hidden'); document.getElementById('pipeline-progress-overlay')?.remove();"
                    style="padding:8px 20px;background:#DC2626;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Close</button>
            </div>
        `;
    }
}

if (typeof window !== 'undefined') {
    window.PipelineProgressUI = PipelineProgressUI;
}
