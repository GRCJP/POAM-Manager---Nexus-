// ═══════════════════════════════════════════════════════════════
// POAM DETAIL VIEW - FOCUSED EDITABLE EXPERIENCE
// ═══════════════════════════════════════════════════════════════

let currentPOAMDetail = null;
let isPOAMEditMode = false;
if (!window.pocTeams) {
    window.pocTeams = [
        'Unassigned',
        'Windows Systems Team',
        'Linux Systems Team',
        'Network Security Team',
        'Application Security Team',
        'Database Security Team',
        'Cloud Security Team',
        'Endpoint Security Team',
        'Critical Systems Team'
    ];
}

// UI Helpers for Detail View
function getRiskBadge(risk) {
    const styles = {
        'critical': 'background:#FEF2F2;color:#991B1B;border-color:#FECACA',
        'high':     'background:#FFFBEB;color:#B45309;border-color:#FDE68A',
        'medium':   'background:#E6F7F7;color:#0D7377;border-color:#CCEEEE',
        'low':      'background:#F3F4F6;color:#6B7280;border-color:#E2E4E8'
    };
    const style = styles[risk?.toLowerCase()] || styles['medium'];
    return `<span style="display:inline-block;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;border:1px solid;${style}">${(risk || 'Medium').toUpperCase()}</span>`;
}

function getStatusOptions(currentStatus) {
    const statuses = ['open', 'in-progress', 'risk-accepted', 'extended', 'completed', 'closed'];
    return statuses.map(s => `<option value="${s}" ${currentStatus?.toLowerCase() === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</option>`).join('');
}

function getRiskOptions(currentRisk) {
    const risks = ['critical', 'high', 'medium', 'low'];
    return risks.map(r => `<option value="${r}" ${currentRisk?.toLowerCase() === r ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('');
}

function getControlFamilyOptions(currentFamily) {
    const families = ['AC', 'AU', 'CM', 'IA', 'IR', 'MA', 'MP', 'PS', 'PE', 'PL', 'PM', 'SA', 'SC', 'SI'];
    return families.map(f => `<option value="${families.indexOf(f)}" ${currentFamily === f ? 'selected' : ''}>${f}</option>`).join('');
}

function isPOAMDelayedForAction(poam) {
    const status = String(poam.findingStatus || poam.status || 'open').toLowerCase();
    if (status === 'completed' || status === 'closed' || status === 'risk-accepted' || status === 'ignored') return false;
    const due = new Date(poam.updatedScheduledCompletionDate || poam.dueDate);
    return !isNaN(due.getTime()) && due < new Date();
}

function getDelayedJustificationOptions(controlFamily, actionType) {
    const family = String(controlFamily || 'CM').toUpperCase();
    const extensionByFamily = {
        AC: [
            'Dependency on enterprise IAM integration window approved by governance board.',
            'Privileged access redesign requires staged validation to avoid production outage.',
            'Compensating controls active while access control baseline hardening is completed.'
        ],
        CM: [
            'Configuration baseline change requires CAB approval and maintenance window scheduling.',
            'Patch and configuration sequencing needed to prevent service instability.',
            'Compensating configuration monitoring is in place pending controlled rollout.'
        ],
        IR: [
            'Incident response playbook update requires cross-team tabletop validation.',
            'SOC tooling integration is pending vendor release and acceptance testing.',
            'Temporary detective controls are operating while response workflow is finalized.'
        ],
        SC: [
            'Network segmentation or encryption updates require phased deployment and validation.',
            'Boundary control changes require coordinated outage window with operations.',
            'Compensating security controls are documented and monitored during extension period.'
        ],
        SI: [
            'Vulnerability remediation depends on upstream vendor patch availability.',
            'Security tooling tuning requires false-positive reduction before enforcement.',
            'Interim monitoring and alerting controls are active until full remediation.'
        ]
    };

    const riskAcceptOptions = [
        'Residual risk is formally accepted by Authorizing Official with compensating controls documented.',
        'Remediation is not technically feasible in current architecture; continuous monitoring is implemented.',
        'Operational mission impact outweighs immediate remediation; risk acceptance approved per RMF process.'
    ];

    if (actionType === 'risk-accepted') return riskAcceptOptions;
    return extensionByFamily[family] || extensionByFamily.CM;
}

function buildDelayedJustificationOptionsHTML(controlFamily, actionType, selectedValue = '') {
    const options = getDelayedJustificationOptions(controlFamily, actionType);
    return [
        '<option value="">Select justification...</option>',
        ...options.map(opt => `<option value="${opt.replace(/"/g, '&quot;')}" ${selectedValue === opt ? 'selected' : ''}>${opt}</option>`)
    ].join('');
}

function updateDelayedActionForm(poamId, controlFamily) {
    const actionEl = document.getElementById(`delayed-action-type-${poamId}`);
    const justificationEl = document.getElementById(`delayed-justification-${poamId}`);
    const durationWrap = document.getElementById(`delayed-duration-wrap-${poamId}`);
    if (!actionEl || !justificationEl) return;

    const action = actionEl.value || 'extend';
    justificationEl.innerHTML = buildDelayedJustificationOptionsHTML(controlFamily, action);
    if (durationWrap) {
        durationWrap.classList.toggle('hidden', action !== 'extend');
    }
}

function addDaysISO(dateString, days) {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

async function applyDelayedPOAMAction(poamId, controlFamily) {
    try {
        if (!poamDB || !poamDB.db) await poamDB.init();

        const action = document.getElementById(`delayed-action-type-${poamId}`)?.value;
        const justification = document.getElementById(`delayed-justification-${poamId}`)?.value;
        const extensionDays = parseInt(document.getElementById(`delayed-extension-days-${poamId}`)?.value || '30', 10);
        const notesInput = document.getElementById(`delayed-action-notes-${poamId}`)?.value?.trim() || '';

        if (!action) {
            showUpdateFeedback('Select an action first', 'error');
            return;
        }
        if (!justification) {
            showUpdateFeedback('Select an audit justification', 'error');
            return;
        }

        const poam = await poamDB.getPOAM(poamId);
        if (!poam) return;

        const nowIso = new Date().toISOString();
        const today = nowIso.split('T')[0];
        poam.statusHistory = poam.statusHistory || [];
        poam.milestones = Array.isArray(poam.milestones) ? poam.milestones : [];

        if (action === 'extend') {
            const baseDate = poam.updatedScheduledCompletionDate || poam.dueDate || today;
            const newDate = addDaysISO(baseDate, extensionDays);
            if (!newDate) {
                showUpdateFeedback('Unable to calculate extension date', 'error');
                return;
            }

            poam.initialScheduledCompletionDate = poam.initialScheduledCompletionDate || poam.dueDate || baseDate;
            poam.updatedScheduledCompletionDate = newDate;
            poam.findingStatus = 'extended';
            poam.status = 'extended';
            poam.delayAction = 'extend';
            poam.delayJustification = justification;
            poam.delayExtensionDays = extensionDays;
            poam.delayControlFamily = controlFamily;
            poam.delayDecisionDate = today;

            if (poam.milestones.length > 0) {
                poam.milestones = poam.milestones.map(ms => {
                    const oldDate = ms.targetDate || ms.date;
                    const shifted = oldDate ? addDaysISO(oldDate, extensionDays) : oldDate;
                    const updated = { ...ms, targetDate: shifted || oldDate };
                    updated.changeLog = Array.isArray(updated.changeLog) ? updated.changeLog : [];
                    updated.changeLog.push({
                        fieldName: 'targetDate',
                        oldValue: oldDate || '',
                        newValue: shifted || oldDate || '',
                        changedAt: nowIso,
                        reason: `POAM extension (${extensionDays} days): ${justification}`
                    });
                    return updated;
                });
            } else {
                poam.milestones = [{
                    name: 'Extended Remediation Completion',
                    description: `POAM extension approved for ${extensionDays} days`,
                    targetDate: newDate,
                    status: 'pending',
                    weight: 100,
                    changeLog: [{
                        fieldName: 'targetDate',
                        oldValue: baseDate,
                        newValue: newDate,
                        changedAt: nowIso,
                        reason: `POAM extension (${extensionDays} days): ${justification}`
                    }]
                }];
            }

            poam.statusHistory.push({
                date: nowIso,
                action: 'extended',
                details: `Extended by ${extensionDays} days. Justification: ${justification}`,
                controlFamily: controlFamily || poam.controlFamily || '',
                notes: notesInput
            });
        } else if (action === 'risk-accepted') {
            poam.findingStatus = 'risk-accepted';
            poam.status = 'risk-accepted';
            poam.resourcesRequired = 'Risk Acceptance (No Additional Resources)';
            poam.delayAction = 'risk-accepted';
            poam.delayJustification = justification;
            poam.delayControlFamily = controlFamily;
            poam.delayDecisionDate = today;

            poam.statusHistory.push({
                date: nowIso,
                action: 'risk_accepted',
                details: `Risk accepted. Justification: ${justification}`,
                controlFamily: controlFamily || poam.controlFamily || '',
                notes: notesInput
            });
        }

        if (notesInput) {
            const line = `[${today}] Delayed POAM decision: ${action}. ${justification}. Notes: ${notesInput}`;
            poam.notes = poam.notes ? `${poam.notes}\n${line}` : line;
        }

        poam.lastModifiedDate = nowIso;
        await poamDB.savePOAM(poam);

        showUpdateFeedback(action === 'extend' ? 'POAM extended and milestones updated' : 'POAM marked as risk accepted', 'success');
        if (typeof displayVulnerabilityPOAMs === 'function') await displayVulnerabilityPOAMs();
        if (typeof updateVulnerabilityModuleMetrics === 'function') await updateVulnerabilityModuleMetrics();
        if (typeof loadDashboardMetrics === 'function') loadDashboardMetrics();
        await showPOAMDetails(poamId);
    } catch (error) {
        console.error('Failed delayed POAM action:', error);
        showUpdateFeedback('Failed to apply delayed POAM action', 'error');
    }
}

async function updatePOAMField(poamId, field, value) {
    console.log(`Update POAM ${poamId}: ${field} = ${value}`);
    
    // Robust check for database availability (Phase 6.19)
    if (!poamDB || !poamDB.db) {
        try {
            await poamDB.init();
        } catch (e) {
            console.error('❌ Failed to re-init database during update:', e);
            showUpdateFeedback('Database connection lost. Please refresh.', 'error');
            return;
        }
    }

    try {
        const updates = { [field]: value };
        if (field === 'findingStatus') {
            updates.status = value;
        } else if (field === 'status') {
            updates.findingStatus = value;
        }
        await poamDB.updatePOAM(poamId, updates);
        
        // Visual feedback
        showUpdateFeedback('Saved', 'success');

        // Refresh dashboard metrics
        if (typeof updateVulnerabilityModuleMetrics === 'function') {
            await updateVulnerabilityModuleMetrics();
        }
        if (typeof loadDashboardMetrics === 'function') {
            loadDashboardMetrics();
        }

        // Keep Generated POAMs list in sync for status edits made in detail view
        if (field === 'findingStatus' || field === 'status') {
            if (typeof allVulnerabilityPOAMs !== 'undefined') {
                allVulnerabilityPOAMs = [];
            }
            if (typeof displayVulnerabilityPOAMs === 'function') {
                await displayVulnerabilityPOAMs();
            }
        }
    } catch (error) {
        console.error('❌ Failed to update POAM:', error);
        showUpdateFeedback('Failed to save', 'error');
    }
}

// Global feedback helper if missing
if (typeof showUpdateFeedback === 'undefined') {
    window.showUpdateFeedback = function(message, type) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Simple temporary toast if no UI container exists
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-600' : type === 'info' ? 'bg-blue-600' : 'bg-red-600';
        toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg z-[100] transition-all ${bgColor} text-white text-sm`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };
}

// Get description for Resources Required options
function getResourcesDescription(resourceType) {
    const descriptions = {
        'Human Capital': 'Remediation requires allocation of internal personnel time to plan, implement, and validate corrective actions.',
        'Application Coordination and Testing': 'Remediation requires coordination with application teams and testing to ensure successful implementation.',
        'Financial / Budgetary Resources': 'Remediation requires approved funding to support software upgrades, licensing, or infrastructure changes.',
        'Risk Acceptance (No Additional Resources)': 'No additional remediation resources are required as the risk has been formally accepted in accordance with organizational risk management procedures.',
        'Third-Party or Vendor Resources': 'Remediation requires engagement with third-party or vendor resources to implement corrective actions.'
    };
    return descriptions[resourceType] || descriptions['Human Capital'];
}

// Toggle description edit mode
function toggleDescriptionEdit(poamId) {
    const readonlyDiv = document.getElementById(`desc-readonly-${poamId}`);
    const editableTextarea = document.getElementById(`desc-editable-${poamId}`);
    const editBtn = document.getElementById(`desc-edit-btn-${poamId}`);
    
    if (readonlyDiv.classList.contains('hidden')) {
        readonlyDiv.classList.remove('hidden');
        editableTextarea.classList.add('hidden');
        editBtn.textContent = 'Edit';
    } else {
        readonlyDiv.classList.add('hidden');
        editableTextarea.classList.remove('hidden');
        editableTextarea.focus();
        editBtn.textContent = 'Cancel';
    }
}

// Save description edit
async function saveDescriptionEdit(poamId) {
    const readonlyDiv = document.getElementById(`desc-readonly-${poamId}`);
    const editableTextarea = document.getElementById(`desc-editable-${poamId}`);
    const editBtn = document.getElementById(`desc-edit-btn-${poamId}`);
    const newDescription = editableTextarea.value.trim();
    readonlyDiv.textContent = newDescription || 'No description available';
    readonlyDiv.classList.remove('hidden');
    editableTextarea.classList.add('hidden');
    editBtn.textContent = 'Edit';
    await updatePOAMField(poamId, 'description', newDescription);
}

async function showPOAMDetails(poamId) {
    console.log(`🔍 Loading POAM details for: ${poamId}`);
    if (!poamDB || !poamDB.db) await poamDB.init();
    
    const poam = await poamDB.getPOAM(poamId);
    if (!poam) return;
    
    currentPOAMDetail = poam;
    const comments = await poamDB.getComments(poamId);
    poam.comments = comments;

    // Milestones are now stored on the POAM record (embedded) for the detail view.
    // Do NOT overwrite embedded milestones with the legacy milestones store.
    // Fallback: if the POAM record has no milestones, try the legacy store.
    if (!Array.isArray(poam.milestones) || poam.milestones.length === 0) {
        const legacyMilestones = await poamDB.getMilestones(poamId);
        if (Array.isArray(legacyMilestones) && legacyMilestones.length > 0) {
            poam.milestones = legacyMilestones;
        }
    }
    
    renderFocusedPOAMDetailPage(poam);
    document.getElementById('poam-detail-page').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function renderFocusedPOAMDetailPage(poam) {
    const detailContainer = document.getElementById('poam-detail-page');
    if (!detailContainer) return;
    
    const formatDateForInput = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
    
    const displayPOAM = {
        ...poam,
        risk: poam.riskLevel || poam.risk || 'medium',
        status: poam.findingStatus || poam.status || 'Open',
        vulnerability: poam.vulnerabilityName || poam.vulnerability || poam.title || 'Unknown',
        description: poam.findingDescription || poam.description || '',
        dueDate: formatDateForInput(poam.updatedScheduledCompletionDate || poam.dueDate),
        initialDate: formatDateForInput(poam.initialScheduledCompletionDate),
        actualDate: formatDateForInput(poam.actualCompletionDate),
        poc: poam.poc || 'Unassigned',
        controlFamily: poam.controlFamily || 'CM',
        resources: poam.resourcesRequired || 'Human Capital',
        notes: poam.notes || ''
    };
    const delayedActionVisible = isPOAMDelayedForAction(poam) || String(displayPOAM.status || '').toLowerCase() === 'extended';
    const delayedJustificationOptions = buildDelayedJustificationOptionsHTML(displayPOAM.controlFamily || poam.controlFamily || 'CM', 'extend');
    
    detailContainer.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50" onclick="closePOAMDetails()"></div>
        <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-11/12 max-w-6xl max-h-[90vh] bg-white rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
            <div class="bg-slate-900 text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
                <div class="flex items-center gap-4">
                    <span class="text-sm font-mono bg-slate-700 px-2 py-1 rounded">${poam.id}</span>
                    <h1 class="text-base font-semibold truncate" title="${displayPOAM.vulnerability}">${displayPOAM.vulnerability}</h1>
                </div>
                <div class="flex items-center gap-3">
                    ${getRiskBadge(displayPOAM.risk)}
                    <button id="poam-edit-toggle" onclick="togglePOAMEditMode()" class="text-xs font-semibold px-3 py-1 rounded bg-slate-700 text-white hover:bg-slate-600">Edit</button>
                    <button onclick="closePOAMDetails()" class="text-slate-400 hover:text-white transition-colors"><i class="fas fa-times"></i></button>
                </div>
            </div>

            <div class="bg-slate-100 border-b border-slate-200 px-6 flex-shrink-0">
                <nav class="flex -mb-px gap-6">
                    <button onclick="switchMainTab('details')" id="main-tab-details" class="px-1 py-4 text-sm font-bold border-b-2 border-teal-700 text-teal-700 transition-all flex items-center gap-2">
                        <i class="fas fa-edit"></i> POAM Details
                    </button>
                    <button onclick="switchMainTab('milestones')" id="main-tab-milestones" class="px-1 py-4 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-all flex items-center gap-2">
                        <i class="fas fa-flag-checkered"></i> Milestones (${poam.milestones ? poam.milestones.length : 0})
                    </button>
                    <button onclick="switchMainTab('assets')" id="main-tab-assets" class="px-1 py-4 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-all flex items-center gap-2">
                        <i class="fas fa-server"></i> Affected Assets (${displayPOAM.totalAffectedAssets || 0})
                    </button>
                    <button onclick="switchMainTab('history')" id="main-tab-history" class="px-1 py-4 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-all flex items-center gap-2">
                        <i class="fas fa-history"></i> History (${(poam.statusHistory || []).length})
                    </button>
                </nav>
            </div>
            
            <div class="flex-1 overflow-y-auto p-6 bg-white">
                <div id="section-details" class="main-tab-section space-y-6">
                    <div class="grid grid-cols-12 gap-6">
                        <div class="col-span-12 lg:col-span-8 space-y-4">
                            <div class="border border-slate-200 rounded-lg p-4 space-y-4">
                                <div>
                                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vulnerability Title</label>
                                    <div data-edit="display" class="text-base font-semibold text-slate-900">${displayPOAM.vulnerability}</div>
                                    <input data-edit="input" disabled
                                           class="hidden w-full text-base font-semibold text-slate-900 border border-slate-200 rounded px-3 py-2"
                                           value="${displayPOAM.vulnerability}" 
                                           onchange="updatePOAMField('${poam.id}', 'vulnerabilityName', this.value)">
                                </div>
                                <div>
                                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Finding Description</label>
                                    <div data-edit="display" class="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">${displayPOAM.description || 'No description available'}</div>
                                    <textarea data-edit="input" disabled
                                              rows="4" class="hidden w-full text-sm text-slate-700 border border-slate-200 rounded px-3 py-2 resize-none"
                                              onchange="updatePOAMField('${poam.id}', 'description', this.value)">${displayPOAM.description || ''}</textarea>
                                </div>
                                <div class="bg-teal-50 border border-teal-100 rounded-lg p-4">
                                    <label class="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Mitigation Strategy</label>
                                    <div data-edit="display" class="text-sm text-teal-900 leading-relaxed whitespace-pre-wrap">${displayPOAM.mitigation || 'No mitigation specified'}</div>
                                    <textarea data-edit="input" disabled
                                              rows="3" class="hidden w-full text-sm text-teal-900 border border-teal-200 rounded px-3 py-2 resize-none"
                                              onchange="updatePOAMField('${poam.id}', 'mitigation', this.value)">${displayPOAM.mitigation || ''}</textarea>
                                </div>
                            </div>
                            <div class="border border-slate-200 rounded-lg p-4 space-y-4">
                                <div>
                                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Impacted Components / URL Details</label>
                                    <div data-edit="display" class="text-sm text-slate-700 whitespace-pre-wrap">${displayPOAM.impactedComponents || 'Not specified'}</div>
                                    <button type="button" onclick="switchMainTab('assets')" class="mt-2 text-[11px] font-semibold text-teal-700 hover:text-teal-900">See affected assets</button>
                                    <textarea data-edit="input" disabled
                                              rows="2" class="hidden w-full text-sm text-slate-700 border border-slate-200 rounded px-3 py-2 resize-none"
                                              onchange="updatePOAMField('${poam.id}', 'impactedComponents', this.value)">${displayPOAM.impactedComponents || ''}</textarea>
                                </div>
                                <div>
                                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Internal Notes</label>
                                    <textarea rows="3" class="w-full text-sm text-slate-700 border border-slate-200 rounded px-3 py-2 resize-none"
                                              onchange="updatePOAMField('${poam.id}', 'notes', this.value)">${displayPOAM.notes || ''}</textarea>
                                </div>
                            </div>
                        </div>
                        <div class="col-span-12 lg:col-span-4 space-y-4">
                            <div class="border border-slate-200 rounded-lg p-4 space-y-4">
                                <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Admin & Timeline</div>
                                <div>
                                    <label class="text-[10px] font-bold text-slate-500 uppercase">POC</label>
                                    <div data-edit="display" class="text-sm font-semibold text-slate-800">${displayPOAM.poc || 'Unassigned'}</div>
                                    <select data-edit="input" disabled
                                            class="hidden w-full text-sm font-semibold text-slate-800 border border-slate-200 rounded px-3 py-2"
                                            onchange="updatePOAMField('${poam.id}', 'poc', this.value)">
                                        ${(window.pocTeams || ['Unassigned']).map(team => `
                                            <option value="${team}" ${displayPOAM.poc === team ? 'selected' : ''}>${team}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] font-bold text-slate-500 uppercase">Finding Status</label>
                                    <div data-edit="display" class="text-sm font-semibold text-slate-800">${displayPOAM.status}</div>
                                    <select data-edit="input" disabled
                                            class="hidden w-full text-sm font-semibold text-slate-800 border border-slate-200 rounded px-3 py-2"
                                            onchange="updatePOAMField('${poam.id}', 'findingStatus', this.value)">
                                        <option value="open" ${displayPOAM.findingStatus === 'open' ? 'selected' : ''}>Open</option>
                                        <option value="in-progress" ${displayPOAM.findingStatus === 'in-progress' ? 'selected' : ''}>In Progress</option>
                                        <option value="completed" ${displayPOAM.findingStatus === 'completed' ? 'selected' : ''}>Completed</option>
                                        <option value="risk-accepted" ${displayPOAM.findingStatus === 'risk-accepted' ? 'selected' : ''}>Risk Accepted</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] font-bold text-slate-500 uppercase">Risk Level</label>
                                    <div data-edit="display" class="text-sm font-semibold text-slate-800">${displayPOAM.risk}</div>
                                    <select data-edit="input" disabled
                                            class="hidden w-full text-sm font-semibold text-slate-800 border border-slate-200 rounded px-3 py-2"
                                            onchange="updatePOAMField('${poam.id}', 'riskLevel', this.value)">
                                        ${getRiskOptions(displayPOAM.risk)}
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] font-bold text-slate-500 uppercase">Control Family</label>
                                    <div data-edit="display" class="text-sm font-semibold text-slate-800">${displayPOAM.controlFamily}</div>
                                    <select data-edit="input" disabled
                                            class="hidden w-full text-sm font-semibold text-slate-800 border border-slate-200 rounded px-3 py-2"
                                            onchange="updatePOAMField('${poam.id}', 'controlFamily', this.value)">
                                        ${getControlFamilyOptions(displayPOAM.controlFamily)}
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] font-bold text-slate-500 uppercase">Resources Required</label>
                                    <div data-edit="display" class="text-sm text-slate-700">${displayPOAM.resources}</div>
                                    <select data-edit="input" disabled
                                            class="hidden w-full text-sm text-slate-700 border border-slate-200 rounded px-3 py-2"
                                            onchange="updatePOAMField('${poam.id}', 'resourcesRequired', this.value)">
                                        <option value="Human Capital" ${displayPOAM.resources === 'Human Capital' ? 'selected' : ''}>Human Capital</option>
                                        <option value="Application Coordination and Testing" ${displayPOAM.resources === 'Application Coordination and Testing' ? 'selected' : ''}>Application Coordination and Testing</option>
                                        <option value="Financial / Budgetary Resources" ${displayPOAM.resources === 'Financial / Budgetary Resources' ? 'selected' : ''}>Financial / Budgetary Resources</option>
                                        <option value="Third-Party or Vendor Resources" ${displayPOAM.resources === 'Third-Party or Vendor Resources' ? 'selected' : ''}>Third-Party or Vendor Resources</option>
                                    </select>
                                </div>
                                <div class="grid grid-cols-1 gap-3 pt-2">
                                    <div>
                                        <label class="text-[10px] font-bold text-slate-500 uppercase">Initial Completion</label>
                                        <div data-edit="display" class="text-sm font-semibold text-slate-800">${displayPOAM.initialDate || 'N/A'}</div>
                                        <input data-edit="input" disabled
                                               type="date" value="${displayPOAM.initialDate}"
                                               class="hidden w-full text-sm font-semibold text-slate-800 border border-slate-200 rounded px-3 py-2"
                                               onchange="updatePOAMField('${poam.id}', 'initialScheduledCompletionDate', this.value)">
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-bold text-slate-500 uppercase">Updated Completion</label>
                                        <div data-edit="display" class="text-sm font-semibold text-slate-800">${displayPOAM.dueDate || 'N/A'}</div>
                                        <input data-edit="input" disabled
                                               type="date" value="${displayPOAM.dueDate}"
                                               class="hidden w-full text-sm font-semibold text-slate-800 border border-slate-200 rounded px-3 py-2"
                                               onchange="updatePOAMField('${poam.id}', 'updatedScheduledCompletionDate', this.value)">
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-bold text-slate-500 uppercase">Actual Completion</label>
                                        <div data-edit="display" class="text-sm font-semibold text-slate-800">${displayPOAM.actualDate || 'N/A'}</div>
                                        <input data-edit="input" disabled
                                               type="date" value="${displayPOAM.actualDate}"
                                               class="hidden w-full text-sm font-semibold text-slate-800 border border-slate-200 rounded px-3 py-2"
                                               onchange="updatePOAMField('${poam.id}', 'actualCompletionDate', this.value)">
                                    </div>
                                </div>
                                ${delayedActionVisible ? `
                                <div class="mt-3 p-3 border border-amber-200 bg-amber-50 rounded-lg">
                                    <div class="text-[10px] font-bold text-amber-800 uppercase mb-2">Delayed POAM Decision</div>
                                    <div class="grid grid-cols-1 gap-2">
                                        <div>
                                            <label class="text-[10px] font-bold text-slate-500 uppercase">Action</label>
                                            <select id="delayed-action-type-${poam.id}"
                                                    class="w-full text-sm border border-slate-200 rounded px-3 py-2"
                                                    onchange="updateDelayedActionForm('${poam.id}', '${displayPOAM.controlFamily || poam.controlFamily || 'CM'}')">
                                                <option value="extend">Extend</option>
                                                <option value="risk-accepted">Risk Accept</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label class="text-[10px] font-bold text-slate-500 uppercase">Audit Justification (${displayPOAM.controlFamily || poam.controlFamily || 'CM'})</label>
                                            <select id="delayed-justification-${poam.id}" class="w-full text-sm border border-slate-200 rounded px-3 py-2">
                                                ${delayedJustificationOptions}
                                            </select>
                                        </div>
                                        <div id="delayed-duration-wrap-${poam.id}">
                                            <label class="text-[10px] font-bold text-slate-500 uppercase">Extension Duration</label>
                                            <select id="delayed-extension-days-${poam.id}" class="w-full text-sm border border-slate-200 rounded px-3 py-2">
                                                <option value="30">30 Days</option>
                                                <option value="60">60 Days</option>
                                                <option value="90">90 Days</option>
                                                <option value="120">120 Days</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label class="text-[10px] font-bold text-slate-500 uppercase">Decision Notes</label>
                                            <textarea id="delayed-action-notes-${poam.id}" rows="2"
                                                      class="w-full text-sm border border-slate-200 rounded px-3 py-2 resize-none"
                                                      placeholder="Optional notes for evidence and audit trail"></textarea>
                                        </div>
                                        <button onclick="applyDelayedPOAMAction('${poam.id}', '${displayPOAM.controlFamily || poam.controlFamily || 'CM'}')"
                                                class="w-full px-3 py-2 text-sm font-semibold bg-amber-700 text-white rounded hover:bg-amber-800">
                                            Apply Delayed POAM Decision
                                        </button>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>

                <div id="section-milestones" class="main-tab-section hidden h-full">
                    <div class="h-full border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex justify-between items-center">
                            <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Milestone Management</span>
                            <div class="flex gap-2">
                                <button onclick="addMilestoneToPOAM('${poam.id}')" 
                                        class="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 transition-colors">
                                    <i class="fas fa-plus"></i> ${poam.milestones && poam.milestones.length > 0 ? 'Add Milestone' : 'Generate Milestones'}
                                </button>
                                <button onclick="recalculateMilestoneDates('${poam.id}')" 
                                        class="text-xs font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1 transition-colors">
                                    <i class="fas fa-calculator"></i> Recalculate Dates
                                </button>
                            </div>
                        </div>
                        <div class="flex-1 overflow-y-auto p-4" data-section="milestones">
                            ${renderMilestonesList(poam)}
                        </div>
                    </div>
                </div>

                <div id="section-assets" class="main-tab-section hidden h-full">
                    <div class="h-full border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex justify-between items-center">
                            <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Affected Asset Inventory</span>
                            <button onclick="exportAssetScanData('${poam.id}')" 
                                    class="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 transition-colors">
                                <i class="fas fa-file-export"></i> Export Scan Data (Filtered)
                            </button>
                        </div>
                        <div class="flex-1 overflow-y-auto">${renderAssetsList(displayPOAM.affectedAssets || [])}</div>
                    </div>
                </div>

                <div id="section-history" class="main-tab-section hidden h-full">
                    <div class="h-full border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex justify-between items-center">
                            <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Status & Change History</span>
                            <span class="text-[10px] text-slate-400">${(poam.statusHistory || []).length} entries</span>
                        </div>
                        <div class="flex-1 overflow-y-auto p-4">
                            ${typeof renderStatusHistory === 'function' ? renderStatusHistory(poam.statusHistory) : '<div class="text-sm text-slate-400 italic">History tracking not available</div>'}
                        </div>
                    </div>
                </div>

            </div>
            
            <div class="bg-slate-50 px-6 py-3 flex justify-end gap-3 border-t border-slate-200">
                <button onclick="closePOAMDetails()" class="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
                <button onclick="saveAndClosePOAMDetails('${poam.id}')" class="px-4 py-2 bg-teal-700 text-white rounded hover:bg-teal-800 font-bold transition-all flex items-center gap-2">
                    <i class="fas fa-save"></i> Save Changes
                </button>
            </div>
        </div>
    `;

    isPOAMEditMode = false;
    const editBtn = document.getElementById('poam-edit-toggle');
    if (editBtn) editBtn.textContent = 'Edit';
}

function togglePOAMEditMode() {
    isPOAMEditMode = !isPOAMEditMode;
    document.querySelectorAll('[data-edit="display"]').forEach(el => {
        el.classList.toggle('hidden', isPOAMEditMode);
    });
    document.querySelectorAll('[data-edit="input"]').forEach(el => {
        el.classList.toggle('hidden', !isPOAMEditMode);
        if ('disabled' in el) {
            el.disabled = !isPOAMEditMode;
        }
    });

    const editBtn = document.getElementById('poam-edit-toggle');
    if (editBtn) editBtn.textContent = isPOAMEditMode ? 'Done' : 'Edit';
}

function switchMainTab(tabName) {
    document.querySelectorAll('.main-tab-section').forEach(s => s.classList.add('hidden'));
    ['details', 'milestones', 'assets', 'history'].forEach(t => {
        const btn = document.getElementById(`main-tab-${t}`);
        if (btn) {
            btn.classList.remove('text-teal-700', 'border-b-2', 'border-teal-700', 'font-bold');
            btn.classList.add('text-slate-500', 'font-medium', 'border-transparent');
        }
    });
    const target = document.getElementById(`section-${tabName}`);
    if (target) target.classList.remove('hidden');
    const activeBtn = document.getElementById(`main-tab-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('text-teal-700', 'border-b-2', 'border-teal-700', 'font-bold');
        activeBtn.classList.remove('text-slate-500', 'font-medium', 'border-transparent');
    }
}

function renderAssetsList(assets) {
    console.log('🔍 renderAssetsList called with:', assets);
    if (assets && assets.length > 0) {
        console.log('📊 First asset structure:', JSON.stringify(assets[0], null, 2));
    }
    
    // Normalize assets to handle both old and new field naming conventions
    const normalizedAssets = (assets || []).map(asset => ({
        asset_name: asset.asset_name || asset.assetName || asset.name || asset.hostname || 'N/A',
        ipv4: asset.ipv4 || asset.ip || 'N/A',
        os: asset.os || asset.operatingSystem || 'Unknown',
        results: asset.results || asset.findingResults || 'N/A'
    }));
    
    if (!normalizedAssets || normalizedAssets.length === 0) return '<div class="p-8 text-center text-slate-500 italic">No assets identified for this POAM</div>';
    
    return `
        <table class="w-full text-left border-collapse">
            <thead class="bg-slate-50 sticky top-0">
                <tr>
                    <th class="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">Asset Name</th>
                    <th class="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">IP Address</th>
                    <th class="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">Operating System</th>
                    <th class="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">Results</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                ${normalizedAssets.map(asset => `
                    <tr class="hover:bg-teal-50/30 transition-colors">
                        <td class="px-4 py-2 text-xs font-medium text-slate-700">${asset.asset_name || asset.name || 'N/A'}</td>
                        <td class="px-4 py-2 text-xs font-mono text-slate-600">${asset.ipv4 || asset.ip || 'N/A'}</td>
                        <td class="px-4 py-2 text-xs text-slate-600">${asset.os || 'Unknown'}</td>
                        <td class="px-4 py-2 text-xs text-slate-600">
                            <div class="max-w-xs truncate" title="${(asset.results || 'N/A').replace(/"/g, '&quot;')}">
                                ${asset.results || 'N/A'}
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderMilestonesList(poam) {
    const milestones = poam.milestones || [];
    
    if (!milestones || milestones.length === 0) {
        return `
            <div class="space-y-3">
                <div class="text-xs text-slate-500 italic">No milestones added</div>
                <button onclick="addMilestoneToPOAM('${poam.id}')" class="text-xs bg-teal-700 text-white px-3 py-1 rounded hover:bg-teal-800">
                    <i class="fas fa-plus"></i> Generate Milestones
                </button>
            </div>
        `;
    }

    return `
        <div class="space-y-3">
            ${milestones.map((milestone, index) => {
                const status = milestone.status || 'pending';
                const statusClass = status === 'completed'
                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                    : status === 'in-progress'
                        ? 'bg-teal-50 text-teal-700 border-teal-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200';
                
                return `
                    <div class="border border-slate-200 rounded-lg p-3 hover:border-teal-200 transition-colors">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex-1">
                                <input type="text" 
                                       value="${milestone.name || `Milestone ${index + 1}`}" 
                                       onchange="updateMilestoneField('${poam.id}', ${index}, 'name', this.value)"
                                       class="text-xs font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-700 focus:outline-none w-full"
                                       placeholder="Milestone name">
                            </div>
                            <div class="flex items-center gap-2">
                                <select onchange="updateMilestoneField('${poam.id}', ${index}, 'status', this.value)"
                                        class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusClass} cursor-pointer">
                                    <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                                    <option value="in-progress" ${status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                                    <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
                                </select>
                                <button onclick="removeMilestoneFromPOAM('${poam.id}', ${index})" 
                                        class="text-red-500 hover:text-red-700 text-xs">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-2 mb-2">
                            <div>
                                <label class="text-[10px] text-slate-500 uppercase">Target Date</label>
                                <input type="date" 
                                       value="${milestone.targetDate || milestone.date || ''}" 
                                       onchange="updateMilestoneField('${poam.id}', ${index}, 'targetDate', this.value)"
                                       class="w-full text-xs text-slate-700 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-teal-700">
                            </div>
                            <div>
                                <label class="text-[10px] text-slate-500 uppercase">Weight (%)</label>
                                <input type="number" 
                                       value="${milestone.weight || 0}" 
                                       min="0" max="100"
                                       onchange="updateMilestoneField('${poam.id}', ${index}, 'weight', parseInt(this.value))"
                                       class="w-full text-xs text-slate-700 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-teal-700">
                            </div>
                        </div>
                        
                        <div>
                            <label class="text-[10px] text-slate-500 uppercase">Description</label>
                            <textarea onchange="updateMilestoneField('${poam.id}', ${index}, 'description', this.value)"
                                      class="w-full text-xs text-slate-700 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-teal-700 resize-none"
                                      rows="2"
                                      placeholder="Milestone description">${milestone.description || ''}</textarea>
                        </div>
                    </div>
                `;
            }).join('')}
            
            <div class="flex justify-between items-center pt-2 border-t border-slate-200">
                <button onclick="addMilestoneToPOAM('${poam.id}')" class="text-xs bg-teal-700 text-white px-3 py-1 rounded hover:bg-teal-800">
                    <i class="fas fa-plus"></i> ${poam.milestones && poam.milestones.length > 0 ? 'Add Milestone' : 'Generate Milestones'}
                </button>
                <button onclick="recalculateMilestoneDates('${poam.id}')" class="text-xs bg-slate-600 text-white px-3 py-1 rounded hover:bg-slate-700">
                    <i class="fas fa-calculator"></i> Recalculate Dates
                </button>
            </div>
        </div>
    `;
}

function getSeverityColor(s) {
    if (!s) return 'bg-slate-100 text-slate-700';
    const l = s.toLowerCase();
    if (l.includes('critical')) return 'bg-red-100 text-red-700';
    if (l.includes('high')) return 'bg-amber-50 text-amber-800';
    if (l.includes('medium')) return 'bg-teal-50 text-teal-800';
    return 'bg-slate-100 text-slate-700';
}

async function closePOAMDetails() {
    document.getElementById('poam-detail-page').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

async function saveAndClosePOAMDetails(poamId) {
    // Every field is already saved instantly onchange/onblur via updatePOAMField
    // But we provide this explicit button for UX and final confirmation
    showUpdateFeedback('All changes saved successfully', 'success');
    closePOAMDetails();
    
    // Refresh the main table to ensure everything is in sync
    if (typeof displayVulnerabilityPOAMs === 'function') {
        await displayVulnerabilityPOAMs();
    }
}

function viewPOAMDetails(poamId) {
    return showPOAMDetails(poamId);
}

function closePOAMDetailsModal() {
    return closePOAMDetails();
}

async function exportAssetScanData(poamId) {
    try {
        if (!poamDB || !poamDB.db) await poamDB.init();
        const poam = await poamDB.getPOAM(poamId);
        
        if (!poam || !poam.rawFindings || poam.rawFindings.length === 0) {
            showUpdateFeedback('No scan data available for export', 'error');
            return;
        }
        
        // Create CSV content from raw findings
        const headers = Object.keys(poam.rawFindings[0]);
        const csvContent = [
            headers.join(','),
            ...poam.rawFindings.map(finding => 
                headers.map(header => `"${finding[header] || ''}"`).join(',')
            )
        ].join('\n');
        
        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `poam-${poamId}-scan-data.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        showUpdateFeedback('Scan data exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting scan data:', error);
        showUpdateFeedback('Error exporting scan data', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// MILESTONE MANAGEMENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function updateMilestoneField(poamId, milestoneIndex, field, value) {
    try {
        if (!poamDB || !poamDB.db) await poamDB.init();
        
        const poam = await poamDB.getPOAM(poamId);
        if (!poam) return;
        
        // Ensure milestones array exists
        if (!poam.milestones) poam.milestones = [];
        
        // Ensure milestone exists at index
        if (!poam.milestones[milestoneIndex]) {
            poam.milestones[milestoneIndex] = {};
        }
        
        // Update the field
        const oldValue = poam.milestones[milestoneIndex][field];
        poam.milestones[milestoneIndex][field] = value;
        
        // Save to database
        await poamDB.savePOAM(poam);
        
        // Update current display
        if (currentPOAMDetail && currentPOAMDetail.id === poamId) {
            currentPOAMDetail.milestones = poam.milestones;
            
            // Refresh the milestones section
            const milestonesContainer = document.querySelector('#section-milestones [data-section="milestones"]');
            if (milestonesContainer) {
                milestonesContainer.innerHTML = renderMilestonesList(poam);
            }
            
            // Update milestone count in tab
            const milestonesTab = document.getElementById('main-tab-milestones');
            if (milestonesTab) {
                milestonesTab.innerHTML = `<i class="fas fa-flag-checkered"></i> Milestones (${poam.milestones.length})`;
            }
        }
        
        console.log(`✅ Updated milestone ${milestoneIndex + 1} ${field}: ${oldValue} → ${value}`);
        
    } catch (error) {
        console.error('Error updating milestone field:', error);
        showUpdateFeedback('Error updating milestone', 'error');
    }
}

async function addMilestoneToPOAM(poamId) {
    try {
        if (!poamDB || !poamDB.db) await poamDB.init();
        
        const poam = await poamDB.getPOAM(poamId);
        if (!poam) return;
        
        // Ensure milestones array exists
        if (!poam.milestones) poam.milestones = [];
        
        let newMilestone;
        
        // If this is the first milestone (no existing milestones), generate the full set
        if (poam.milestones.length === 0) {
            console.log('🎯 Generating complete milestone set for POAM');
            
            // Generate milestones based on control family and dates
            const startDate = poam.createdDate || poam.initialScheduledCompletionDate || new Date().toISOString().split('T')[0];
            const dueDate = poam.dueDate || poam.updatedScheduledCompletionDate;
            
            if (startDate && dueDate) {
                const generatedMilestones = generateMilestonesForControlFamily(
                    poam.controlFamily || 'CM', 
                    startDate, 
                    dueDate
                );
                
                if (generatedMilestones && generatedMilestones.length > 0) {
                    // Add all generated milestones
                    poam.milestones = generatedMilestones;
                    console.log(`✅ Generated ${generatedMilestones.length} milestones for ${poam.controlFamily} control family`);
                } else {
                    // Fallback to single milestone if generation fails
                    newMilestone = createFallbackMilestone(poam, 1);
                    poam.milestones.push(newMilestone);
                }
            } else {
                // Fallback to single milestone if dates missing
                newMilestone = createFallbackMilestone(poam, 1);
                poam.milestones.push(newMilestone);
            }
        } else {
            // Add a single additional milestone to existing set
            console.log('➕ Adding single milestone to existing set');
            newMilestone = createAdditionalMilestone(poam);
            poam.milestones.push(newMilestone);
        }
        
        // Save to database
        await poamDB.savePOAM(poam);
        
        // Update current display
        if (currentPOAMDetail && currentPOAMDetail.id === poamId) {
            currentPOAMDetail.milestones = poam.milestones;
            
            // Refresh the milestones section
            const milestonesContainer = document.querySelector('#section-milestones [data-section="milestones"]');
            if (milestonesContainer) {
                milestonesContainer.innerHTML = renderMilestonesList(poam);
            }
            
            // Update milestone count in tab
            const milestonesTab = document.getElementById('main-tab-milestones');
            if (milestonesTab) {
                milestonesTab.innerHTML = `<i class="fas fa-flag-checkered"></i> Milestones (${poam.milestones.length})`;
            }
        }
        
        const action = poam.milestones.length > 1 ? 'Milestones added' : 'Milestone added';
        showUpdateFeedback(`${action} successfully`, 'success');
        console.log(`✅ Added milestones to POAM ${poamId}. Total: ${poam.milestones.length}`);
        
    } catch (error) {
        console.error('Error adding milestone:', error);
        showUpdateFeedback('Error adding milestone', 'error');
    }
}

function createFallbackMilestone(poam, index) {
    return {
        name: `Milestone ${index}`,
        description: 'Complete vulnerability remediation',
        targetDate: poam.dueDate || new Date().toISOString().split('T')[0],
        status: 'pending',
        weight: 100
    };
}

function createAdditionalMilestone(poam) {
    const nextIndex = poam.milestones.length + 1;
    const lastMilestone = poam.milestones[poam.milestones.length - 1];
    
    // Use the last milestone's date as a starting point, or use due date
    const baseDate = lastMilestone?.targetDate || poam.dueDate || new Date().toISOString().split('T')[0];
    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + 7); // Add 7 days to last milestone
    
    return {
        name: `Milestone ${nextIndex}`,
        description: 'Additional remediation task',
        targetDate: targetDate.toISOString().split('T')[0],
        status: 'pending',
        weight: 0
    };
}

async function removeMilestoneFromPOAM(poamId, milestoneIndex) {
    try {
        if (!confirm('Are you sure you want to remove this milestone?')) return;
        
        if (!poamDB || !poamDB.db) await poamDB.init();
        
        const poam = await poamDB.getPOAM(poamId);
        if (!poam || !poam.milestones) return;
        
        // Remove milestone
        poam.milestones.splice(milestoneIndex, 1);
        
        // Save to database
        await poamDB.savePOAM(poam);
        
        // Update current display
        if (currentPOAMDetail && currentPOAMDetail.id === poamId) {
            currentPOAMDetail.milestones = poam.milestones;
            
            // Refresh the milestones section
            const milestonesContainer = document.querySelector('#section-milestones [data-section="milestones"]');
            if (milestonesContainer) {
                milestonesContainer.innerHTML = renderMilestonesList(poam);
            }
            
            // Update milestone count in tab
            const milestonesTab = document.getElementById('main-tab-milestones');
            if (milestonesTab) {
                milestonesTab.innerHTML = `<i class="fas fa-flag-checkered"></i> Milestones (${poam.milestones.length})`;
            }
        }
        
        showUpdateFeedback('Milestone removed successfully', 'success');
        console.log(`✅ Removed milestone ${milestoneIndex + 1} from POAM ${poamId}`);
        
    } catch (error) {
        console.error('Error removing milestone:', error);
        showUpdateFeedback('Error removing milestone', 'error');
    }
}

async function recalculateMilestoneDates(poamId) {
    try {
        if (!poamDB || !poamDB.db) await poamDB.init();
        
        const poam = await poamDB.getPOAM(poamId);
        if (!poam || !poam.milestones || poam.milestones.length === 0) {
            showUpdateFeedback('No milestones to recalculate', 'error');
            return;
        }
        
        const startDate = poam.createdDate || poam.initialScheduledCompletionDate || new Date().toISOString().split('T')[0];
        const dueDate = poam.dueDate || poam.updatedScheduledCompletionDate;
        
        if (!startDate || !dueDate) {
            showUpdateFeedback('Missing start or due date for recalculation', 'error');
            return;
        }
        
        // Use the milestone generation function to recalculate dates
        const recalculatedMilestones = generateMilestonesForControlFamily(
            poam.controlFamily || 'CM', 
            startDate, 
            dueDate
        );
        
        // Preserve existing milestone names, descriptions, and statuses but update dates and weights
        poam.milestones.forEach((milestone, index) => {
            if (recalculatedMilestones[index]) {
                milestone.targetDate = recalculatedMilestones[index].targetDate;
                milestone.weight = recalculatedMilestones[index].weight;
                // Keep existing name, description, and status
            }
        });
        
        // Save to database
        await poamDB.savePOAM(poam);
        
        // Update current display
        if (currentPOAMDetail && currentPOAMDetail.id === poamId) {
            currentPOAMDetail.milestones = poam.milestones;
            
            // Refresh the milestones section
            const milestonesContainer = document.querySelector('#section-milestones [data-section="milestones"]');
            if (milestonesContainer) {
                milestonesContainer.innerHTML = renderMilestonesList(poam);
            }
            
            // Update milestone count in tab
            const milestonesTab = document.getElementById('main-tab-milestones');
            if (milestonesTab) {
                milestonesTab.innerHTML = `<i class="fas fa-flag-checkered"></i> Milestones (${poam.milestones.length})`;
            }
        }
        
        showUpdateFeedback('Milestone dates recalculated successfully', 'success');
        console.log(`✅ Recalculated milestone dates for POAM ${poamId}`);
        
    } catch (error) {
        console.error('Error recalculating milestone dates:', error);
        showUpdateFeedback('Error recalculating milestone dates', 'error');
    }
}
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
        source: 'TRACE',
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

async function mergePOAMsFromScan(newPOAMs, existingPOAMsOverride) {
    // Accept pre-loaded existing POAMs (e.g. from in-memory snapshot when DB
    // was wiped for quota). Fall back to reading from DB if not provided.
    let existingPOAMs;
    if (Array.isArray(existingPOAMsOverride) && existingPOAMsOverride.length > 0) {
        existingPOAMs = existingPOAMsOverride;
    } else {
        if (!poamDB || !poamDB.db) await poamDB.init();
        existingPOAMs = await poamDB.getAllPOAMs();
    }

    // Build lookup of existing POAMs by remediationSignature (including completed ones for re-open)
    const existingBySig = new Map();
    const completedBySig = new Map();
    existingPOAMs.forEach(p => {
        if (!p.remediationSignature) return;
        const st = (p.findingStatus || p.status || '').toLowerCase();
        if (st === 'completed' || st === 'closed') {
            completedBySig.set(p.remediationSignature, p);
        } else {
            existingBySig.set(p.remediationSignature, p);
        }
    });

    // (A) Scan scope: collect all assets seen in this scan for scope-aware auto-resolve
    const scannedAssets = new Set();
    const extractAssetName = (a) => {
        if (!a) return '';
        if (typeof a === 'string') return a.trim().toLowerCase();
        // Handle asset objects from analysis engine: {asset_name, ipv4, os, ...}
        return String(a.asset_name || a.hostname || a.ipv4 || a.ip || a.name || a).trim().toLowerCase();
    };
    for (const p of newPOAMs) {
        const assets = p.affectedAssets || p.rawAssets || [];
        if (Array.isArray(assets)) assets.forEach(a => { const n = extractAssetName(a); if (n && n !== '[object object]') scannedAssets.add(n); });
        if (p.host) scannedAssets.add(String(p.host).trim().toLowerCase());
    }

    // Track signatures seen in new scan (to detect closed POAMs)
    const newSignatures = new Set();
    let created = 0;
    let updated = 0;
    let reopened = 0;
    let unchanged = 0;

    const mergedPOAMs = [];

    for (const newPoam of newPOAMs) {
        const sig = newPoam.remediationSignature;
        if (sig) newSignatures.add(sig);

        // (C) First-import timestamp fallback: if firstDetectedDate is missing, use now
        if (!newPoam.firstDetectedDate && !newPoam.oldestDetectionDate) {
            newPoam.firstDetectedDate = new Date().toISOString().split('T')[0];
            newPoam._firstDetectedFallback = true;
        }

        const existing = sig ? existingBySig.get(sig) : null;

        // (B) Re-open flow: check if this was previously completed
        const previouslyCompleted = !existing && sig ? completedBySig.get(sig) : null;

        if (previouslyCompleted) {
            // REOPEN: Restore the existing POAM instead of creating a new one
            const merged = { ...previouslyCompleted };
            merged.findingStatus = 'open';
            merged.status = 'open';
            merged.actualCompletionDate = '';
            merged.lastModifiedDate = new Date().toISOString();
            merged.lastScanDate = new Date().toISOString();

            // Update scan-derived fields
            for (const field of SCAN_UPDATED_FIELDS) {
                if (newPoam[field] !== undefined) merged[field] = newPoam[field];
            }

            merged.statusHistory = merged.statusHistory || [];
            merged.statusHistory.push({
                date: new Date().toISOString(),
                action: 'reopened',
                details: `Finding reappeared in scan after previously being auto-resolved. Reopening POAM.`,
                previousStatus: previouslyCompleted.findingStatus || previouslyCompleted.status,
                newAssetCount: newPoam.totalAffectedAssets || 0,
                scanId: newPoam.scanId
            });

            mergedPOAMs.push(merged);
            reopened++;
            continue;
        }

        if (existing) {
            // MERGE: Preserve user edits, update scan-derived fields
            const merged = { ...existing };
            
            // Track previous values for comparison
            const previousAssetCount = existing.totalAffectedAssets || 0;
            const previousRisk = (existing.risk || existing.riskLevel || '').toLowerCase();

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

            // Calculate asset count change
            const newAssetCount = newPoam.totalAffectedAssets || 0;
            const assetCountChange = newAssetCount - previousAssetCount;
            const assetChangePercent = previousAssetCount > 0 
                ? Math.round((assetCountChange / previousAssetCount) * 100) 
                : 0;

            // Append to status history
            merged.statusHistory = existing.statusHistory || [];
            
            // Build detailed scan update message
            let scanUpdateDetails = `Re-import updated scan data. Assets: ${newAssetCount}`;
            if (assetCountChange !== 0) {
                scanUpdateDetails += ` (${assetCountChange > 0 ? '+' : ''}${assetCountChange}, ${assetChangePercent > 0 ? '+' : ''}${assetChangePercent}%)`;
            }
            scanUpdateDetails += `, Risk: ${newPoam.risk || 'unknown'}`;
            
            merged.statusHistory.push({
                date: new Date().toISOString(),
                action: 'scan_update',
                details: scanUpdateDetails,
                previousAssetCount: previousAssetCount,
                newAssetCount: newAssetCount,
                assetCountChange: assetCountChange,
                previousRisk: previousRisk,
                newRisk: newPoam.risk || newPoam.riskLevel,
                scanId: newPoam.scanId
            });

            // Track partial remediation (asset count decreased significantly)
            if (assetCountChange < 0 && Math.abs(assetChangePercent) >= 25) {
                merged.statusHistory.push({
                    date: new Date().toISOString(),
                    action: 'partial_remediation',
                    details: `Partial remediation detected: ${Math.abs(assetCountChange)} fewer assets affected (${Math.abs(assetChangePercent)}% reduction)`,
                    previousAssetCount: previousAssetCount,
                    newAssetCount: newAssetCount,
                    remediationPercent: Math.abs(assetChangePercent)
                });
                
                // Mark for review if significant progress
                if (!merged.needsReview && Math.abs(assetChangePercent) >= 50) {
                    merged.needsReview = true;
                    merged.statusHistory.push({
                        date: new Date().toISOString(),
                        action: 'flagged_for_review',
                        details: `Flagged for review: ${Math.abs(assetChangePercent)}% asset reduction suggests significant remediation progress`
                    });
                }
            }

            // If risk changed, log it
            const newRisk = (newPoam.risk || newPoam.riskLevel || '').toLowerCase();
            if (previousRisk && newRisk && previousRisk !== newRisk) {
                merged.statusHistory.push({
                    date: new Date().toISOString(),
                    action: 'risk_change',
                    details: `Risk changed from ${previousRisk} to ${newRisk}`,
                    previousRisk: previousRisk,
                    newRisk: newRisk
                });
            }

            // Update due date only if risk escalated (shorter SLA)
            const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            if ((riskOrder[newRisk] || 0) > (riskOrder[previousRisk] || 0)) {
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
    // (A) Scan-scope-aware: only auto-resolve if the POAM's assets were in scan scope
    const closureCandidates = [];
    const scopeSkipped = [];
    const previouslyOpenPOAMs = [];

    // Collect scope IDs from this import for scope-aware auto-resolve
    const importScopeIds = new Set();
    for (const p of newPOAMs) {
        if (p.scopeId) importScopeIds.add(p.scopeId);
    }
    const hasScopes = importScopeIds.size > 0;

    for (const existing of existingPOAMs) {
        if (!existing.remediationSignature) continue;
        if (newSignatures.has(existing.remediationSignature)) continue;

        const status = (existing.findingStatus || existing.status || '').toLowerCase();
        if (status === 'completed' || status === 'closed' || status === 'risk-accepted') continue;

        // Scope check: only auto-resolve POAMs within the same scope as this import
        if (hasScopes) {
            const existingScope = existing.scopeId || null;
            if (!existingScope || !importScopeIds.has(existingScope)) {
                // POAM is unassigned or belongs to a different scope — don't auto-close
                scopeSkipped.push(existing);
                mergedPOAMs.push(existing);
                continue;
            }
        }

        // (A) Asset scope check: if we know scanned assets, verify this POAM's assets were scanned
        if (scannedAssets.size > 0) {
            const poamAssets = existing.affectedAssets || [];
            const assetList = Array.isArray(poamAssets) ? poamAssets : [poamAssets];
            const anyInScope = assetList.length === 0 || assetList.some(a =>
                scannedAssets.has(extractAssetName(a))
            );
            if (!anyInScope) {
                // POAM's assets weren't in this scan — don't auto-close, it's out of scope
                scopeSkipped.push(existing);
                existing.statusHistory = existing.statusHistory || [];
                existing.statusHistory.push({
                    date: new Date().toISOString(),
                    action: 'scan_scope_skip',
                    details: `Finding not in scan but assets not in scan scope — not auto-resolved.`
                });
                existing.lastScanDate = new Date().toISOString();
                mergedPOAMs.push(existing);
                continue;
            }
        }

        // This POAM was in scope and not found — mark as closure candidate
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
        candidate.findingStatus = 'completed';
        candidate.status = 'completed';
        candidate.actualCompletionDate = new Date().toISOString().split('T')[0];
        candidate.lastModifiedDate = new Date().toISOString();
        candidate.lastScanDate = new Date().toISOString();
        mergedPOAMs.push(candidate);
        autoClosedIds.push(candidate.id);
    }
    
    // Track POAMs with significant asset count changes
    const partialRemediationPOAMs = mergedPOAMs.filter(p => 
        p.statusHistory && p.statusHistory.some(h => h.action === 'partial_remediation')
    ).map(p => ({
        id: p.id,
        title: p.title || p.vulnerabilityName || 'Unknown',
        previousAssetCount: p.statusHistory.find(h => h.action === 'partial_remediation')?.previousAssetCount || 0,
        newAssetCount: p.statusHistory.find(h => h.action === 'partial_remediation')?.newAssetCount || 0,
        remediationPercent: p.statusHistory.find(h => h.action === 'partial_remediation')?.remediationPercent || 0
    }));

    const riskChangedPOAMs = mergedPOAMs.filter(p =>
        p.statusHistory && p.statusHistory.some(h => h.action === 'risk_change')
    ).map(p => ({
        id: p.id,
        title: p.title || p.vulnerabilityName || 'Unknown',
        previousRisk: p.statusHistory.find(h => h.action === 'risk_change')?.previousRisk || 'unknown',
        newRisk: p.statusHistory.find(h => h.action === 'risk_change')?.newRisk || 'unknown'
    }));

    // Store scan analysis for UI display
    window.lastScanAnalysis = {
        timestamp: new Date().toISOString(),
        newPOAMs: created,
        updatedPOAMs: updated,
        reopenedPOAMs: reopened,
        autoClosedPOAMs: closureCandidates.length,
        scopeSkippedPOAMs: scopeSkipped.length,
        autoClosedIds: autoClosedIds,
        previouslyOpenPOAMs: previouslyOpenPOAMs,
        partialRemediationPOAMs: partialRemediationPOAMs,
        riskChangedPOAMs: riskChangedPOAMs,
        scannedAssetCount: scannedAssets.size
    };

    // Persist scan analysis to localStorage for history viewing
    try {
        const analyses = JSON.parse(localStorage.getItem('scanAnalyses') || '[]');
        analyses.push(window.lastScanAnalysis);
        // Keep last 20 analyses
        if (analyses.length > 20) analyses.splice(0, analyses.length - 20);
        localStorage.setItem('scanAnalyses', JSON.stringify(analyses));
    } catch(e) { /* localStorage full or unavailable */ }

    console.log(`🔄 Merge results: ${created} new, ${updated} updated, ${reopened} reopened, ${closureCandidates.length} auto-resolved, ${scopeSkipped.length} out-of-scope skipped`);

    return {
        mergedPOAMs,
        stats: {
            created,
            updated,
            reopened,
            unchanged,
            autoResolved: closureCandidates.length,
            scopeSkipped: scopeSkipped.length,
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
        'created': 'border-teal-200 bg-teal-50',
        'status_change': 'border-teal-300 bg-teal-50',
        'risk_change': 'border-amber-300 bg-amber-50',
        'scan_update': 'border-slate-300 bg-slate-50',
        'auto_resolved': 'border-slate-300 bg-slate-50',
        'manual_edit': 'border-slate-300 bg-slate-50',
        'milestone_update': 'border-teal-200 bg-teal-50',
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

        // Ask if user wants to backup first
        const wantBackup = confirm(
            `⚠️ WARNING: This will delete all ${poams.length} POAMs from the database.\n\n` +
            `Do you want to download a backup first?\n\n` +
            `Click OK to backup before clearing, or Cancel to clear without backup.`
        );

        if (wantBackup) {
            console.log('📦 User requested backup before clearing');
            await exportPOAMBackup();
            // Wait for download to start
            await new Promise(r => setTimeout(r, 500));
        } else {
            // Final confirmation if they chose not to backup
            const finalConfirm = confirm(
                `⚠️ FINAL WARNING: You chose NOT to backup.\n\n` +
                `All ${poams.length} POAMs will be permanently deleted.\n\n` +
                `Are you absolutely sure?`
            );
            if (!finalConfirm) {
                console.log('🚫 User cancelled clear operation');
                return;
            }
        }

        await poamDB.clearAllPOAMs();
        console.log('✅ All POAMs cleared');

        const message = wantBackup 
            ? `Cleared ${poams.length} POAMs (backup downloaded)` 
            : `Cleared ${poams.length} POAMs (no backup)`;

        if (typeof showUpdateFeedback === 'function') {
            showUpdateFeedback(message, 'success');
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
                <button onclick="executeBulkAssignPOC()" class="flex-1 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800">
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
        console.log('🔍 Closing bulk assign POC modal...');
        const modals = document.querySelectorAll('.fixed.inset-0.bg-black.bg-opacity-50');
        console.log(`🔍 Found ${modals.length} modals to close`);
        modals.forEach(modal => {
            console.log('🔍 Removing modal:', modal);
            modal.remove();
        });
        
        // Always refresh display and clear selection
        await displayVulnerabilityPOAMs();
        clearSelection();
    }
}

// ═══════════════════════════════════════════════════════════════
// BULK ASSIGN SCOPE
// ═══════════════════════════════════════════════════════════════

async function showBulkAssignScope() {
    // Build scope options from existing scopes
    let scopeOptions = '<option value="">Select a scope...</option>';
    try {
        const scopes = await window.poamDB.getAllScopes();
        scopes.forEach(s => {
            scopeOptions += `<option value="${s.id}">${s.displayName || s.id}</option>`;
        });
    } catch (e) {}
    scopeOptions += '<option value="__new__">+ Create New Scope...</option>';

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h2 class="text-lg font-bold text-slate-900 mb-2">Assign Scope to ${selectedPOAMs.size} POAMs</h2>
            <p class="text-sm text-slate-500 mb-6">Group selected POAMs under an application scope for filtering and scoped auto-resolve.</p>

            <label class="block text-xs font-semibold text-slate-600 uppercase mb-1">Select Scope</label>
            <select id="bulk-scope-select" class="w-full px-3 py-2 border border-slate-300 rounded-lg mb-3 text-sm" onchange="if(this.value==='__new__'){document.getElementById('new-scope-row').classList.remove('hidden')}else{document.getElementById('new-scope-row').classList.add('hidden')}">
                ${scopeOptions}
            </select>

            <div id="new-scope-row" class="hidden mb-3">
                <label class="block text-xs font-semibold text-slate-600 uppercase mb-1">New Scope Name</label>
                <input type="text" id="bulk-scope-new-name" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. EBRS Production">
            </div>

            <div class="flex gap-3 mt-4">
                <button onclick="this.closest('.fixed').remove()" class="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-medium">
                    Cancel
                </button>
                <button onclick="executeBulkAssignScope()" class="flex-1 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm font-medium">
                    Assign Scope
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function executeBulkAssignScope() {
    const select = document.getElementById('bulk-scope-select');
    let scopeId = select.value;

    if (scopeId === '__new__') {
        const newName = document.getElementById('bulk-scope-new-name')?.value?.trim();
        if (!newName) {
            alert('Please enter a scope name.');
            return;
        }
        scopeId = window.scopeRegistry.normalizeId(newName);
        await window.poamDB.saveScope({
            id: scopeId,
            displayName: newName,
            description: '',
            createdAt: new Date().toISOString(),
            autoCreated: false
        });
    }

    if (!scopeId) {
        alert('Please select a scope.');
        return;
    }

    try {
        let successCount = 0;
        for (const poamId of selectedPOAMs) {
            try {
                const poam = await poamDB.getPOAM(poamId);
                if (poam) {
                    poam.scopeId = scopeId;
                    poam.scopeSource = 'manual';
                    await poamDB.savePOAM(poam);
                    successCount++;
                }
            } catch (error) {
                console.error(`Failed to update POAM ${poamId}:`, error);
            }
        }
        showUpdateFeedback(`Assigned scope to ${successCount} POAMs`, 'success');
    } catch (error) {
        console.error('Bulk assign scope failed:', error);
        showUpdateFeedback('Operation failed: ' + error.message, 'error');
    } finally {
        document.querySelectorAll('.fixed.inset-0.bg-black.bg-opacity-50').forEach(m => m.remove());
        await displayVulnerabilityPOAMs();
        clearSelection();
    }
}

window.showBulkAssignScope = showBulkAssignScope;
window.executeBulkAssignScope = executeBulkAssignScope;

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
                <button onclick="executeBulkChangeStatus()" class="flex-1 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800">
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
        console.log('🔍 Closing bulk change status modal...');
        const modals = document.querySelectorAll('.fixed.inset-0.bg-black.bg-opacity-50');
        console.log(`🔍 Found ${modals.length} modals to close`);
        modals.forEach(modal => {
            console.log('🔍 Removing modal:', modal);
            modal.remove();
        });
        
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
                class="w-full px-3 py-2 border border-slate-300 rounded-lg mb-6 focus:ring-2 focus:ring-teal-500"></textarea>
            
            <div class="flex gap-3">
                <button onclick="this.closest('.fixed').remove()" class="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                    Cancel
                </button>
                <button onclick="executeBulkAddNote()" class="flex-1 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800">
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
        console.log('🔍 Closing bulk add note modal...');
        const modals = document.querySelectorAll('.fixed.inset-0.bg-black.bg-opacity-50');
        console.log(`🔍 Found ${modals.length} modals to close`);
        modals.forEach(modal => {
            console.log('🔍 Removing modal:', modal);
            modal.remove();
        });
        
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
// Column Filter Functions for POAM Table
// Handles inline column header filtering with dropdowns

// Toggle column filter dropdown
function toggleColumnFilter(columnName) {
    const dropdown = document.getElementById(`${columnName}-filter-dropdown`);
    
    // Close other dropdowns
    if (openFilterDropdown && openFilterDropdown !== dropdown) {
        openFilterDropdown.classList.add('hidden');
    }
    
    // Toggle current dropdown
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        openFilterDropdown = dropdown.classList.contains('hidden') ? null : dropdown;
        
        // Initialize POC options if opening POC filter
        if (columnName === 'poc' && !dropdown.classList.contains('hidden')) {
            initializePOCOptions();
        }
        // Initialize PCA options if opening PCA filter
        if (columnName === 'pca' && !dropdown.classList.contains('hidden')) {
            populatePCAFilterOptions();
        }
    }
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.relative.group')) {
        const dropdowns = document.querySelectorAll('[id$="-filter-dropdown"]');
        dropdowns.forEach(d => d.classList.add('hidden'));
        openFilterDropdown = null;
    }
});

// Risk Filter (Multi-Select)
function applyRiskFilter() {
    const checkboxes = document.querySelectorAll('#risk-filter-dropdown input[type="checkbox"]:checked');
    activeFilters.risk = Array.from(checkboxes).map(cb => cb.value);
    
    updateFilterIndicator('risk', activeFilters.risk.length);
    updateFilterChips();
    currentPOAMPage = 1;
    displayVulnerabilityPOAMs();
}

// Status Filter
function applyStatusFilter(value) {
    activeFilters.status = value;
    updateFilterIndicator('status', value ? 1 : 0);
    updateFilterChips();
    currentPOAMPage = 1;
    displayVulnerabilityPOAMs();
}

// Asset Range Filter
function applyAssetFilter(value) {
    activeFilters.assetRange = value;
    updateFilterIndicator('asset', value ? 1 : 0);
    updateFilterChips();
    currentPOAMPage = 1;
    displayVulnerabilityPOAMs();
}

// Due Date Filter
function applyDueDateFilter(value) {
    activeFilters.dueDate = value;
    updateFilterIndicator('duedate', value ? 1 : 0);
    updateFilterChips();
    currentPOAMPage = 1;
    displayVulnerabilityPOAMs();
}

// PCA Code / Scope Filter
function applyPCAFilter(value) {
    activeFilters.pca = value;
    updateFilterIndicator('pca', value ? 1 : 0);
    updateFilterChips();
    currentPOAMPage = 1;
    displayVulnerabilityPOAMs();
}

async function populatePCAFilterOptions() {
    const container = document.getElementById('pca-filter-options');
    if (!container) return;
    try {
        const allPoams = await poamDB.getAllPOAMs();
        const pcaCodes = [...new Set(allPoams.map(p => p.pcaCode).filter(Boolean))].sort();
        container.innerHTML = '<label class="flex items-center gap-2 text-sm font-normal"><input type="radio" name="pca-filter" value="" onchange="applyPCAFilter(this.value)" checked><span>All</span></label>';
        pcaCodes.forEach(code => {
            const count = allPoams.filter(p => p.pcaCode === code).length;
            container.innerHTML += `<label class="flex items-center gap-2 text-sm font-normal"><input type="radio" name="pca-filter" value="${code}" onchange="applyPCAFilter(this.value)" ${activeFilters.pca === code ? 'checked' : ''}><span>${code} (${count})</span></label>`;
        });
    } catch (e) {}
}

window.applyPCAFilter = applyPCAFilter;
window.populatePCAFilterOptions = populatePCAFilterOptions;

// POC Filter with Typeahead
const pocTeams = [
    'Unassigned',
    'Windows Systems Team',
    'Linux Systems Team',
    'Network Engineering Team',
    'Desktop Engineering Team',
    'Application Development Team',
    'Web Infrastructure Team',
    'Network Security Team',
    'End User Computing Team',
    'Security Operations Team',
    'PCI Compliance Team',
    'Critical Systems Team'
];

function initializePOCOptions() {
    filterPOCOptions('');
}

function filterPOCOptions(searchTerm) {
    const container = document.getElementById('poc-options');
    if (!container) return;
    
    const filtered = pocTeams.filter(team => 
        team.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    container.innerHTML = filtered.map(team => `
        <label class="flex items-center gap-2 text-sm font-normal px-2 py-1 hover:bg-slate-100 rounded cursor-pointer">
            <input 
                type="radio" 
                name="poc-filter" 
                value="${team}" 
                ${activeFilters.poc === team ? 'checked' : ''}
                onchange="applyPOCFilter('${team}')">
            <span>${team}</span>
        </label>
    `).join('');
}

function applyPOCFilter(value) {
    activeFilters.poc = value;
    updateFilterIndicator('poc', value ? 1 : 0);
    updateFilterChips();
    currentPOAMPage = 1;
    displayVulnerabilityPOAMs();
}

// Update filter chips display
function updateFilterChips() {
    const container = document.getElementById('filter-chips-container');
    const chipsDiv = document.getElementById('filter-chips');
    
    if (!container || !chipsDiv) return;
    
    const chips = [];
    
    // Risk chips (multi-select)
    if (activeFilters.risk.length > 0) {
        activeFilters.risk.forEach(risk => {
            const colors = {
                'critical': 'bg-red-100 text-red-700',
                'high': 'bg-amber-50 text-amber-800',
                'medium': 'bg-teal-50 text-teal-800',
                'low': 'bg-slate-100 text-slate-700'
            };
            chips.push({
                label: `Risk: ${risk.charAt(0).toUpperCase() + risk.slice(1)}`,
                color: colors[risk] || 'bg-slate-100 text-slate-700',
                onRemove: () => removeRiskFilter(risk)
            });
        });
    }
    
    // Status chip
    if (activeFilters.status) {
        chips.push({
            label: `Status: ${activeFilters.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
            color: 'bg-teal-50 text-teal-700',
            onRemove: () => { applyStatusFilter(''); }
        });
    }
    
    // POC chip
    if (activeFilters.poc) {
        chips.push({
            label: `POC: ${activeFilters.poc}`,
            color: 'bg-slate-100 text-slate-700',
            onRemove: () => { applyPOCFilter(''); }
        });
    }
    
    // Asset range chip
    if (activeFilters.assetRange) {
        chips.push({
            label: `Assets: > ${activeFilters.assetRange}`,
            color: 'bg-teal-50 text-teal-800',
            onRemove: () => { applyAssetFilter(''); }
        });
    }
    
    // Due date chip
    if (activeFilters.dueDate) {
        const labels = {
            'overdue': 'Overdue',
            '7days': 'Due in 7 days',
            '30days': 'Due in 30 days'
        };
        chips.push({
            label: `Due: ${labels[activeFilters.dueDate] || activeFilters.dueDate}`,
            color: activeFilters.dueDate === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700',
            onRemove: () => { applyDueDateFilter(''); }
        });
    }
    
    // Show/hide container
    if (chips.length > 0) {
        container.classList.remove('hidden');
        chipsDiv.innerHTML = chips.map((chip, index) => `
            <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${chip.color}">
                ${chip.label}
                <button 
                    onclick="removeFilterChipByIndex(${index})"
                    class="hover:opacity-70">
                    <i class="fas fa-times text-xs"></i>
                </button>
            </span>
        `).join('');
        
        // Store chip removal functions for access by index
        window.filterChipRemovers = chips.map(c => c.onRemove);
    } else {
        container.classList.add('hidden');
        chipsDiv.innerHTML = '';
    }
}

// Remove filter chip by index
function removeFilterChipByIndex(index) {
    if (window.filterChipRemovers && window.filterChipRemovers[index]) {
        window.filterChipRemovers[index]();
    }
}

// Remove individual risk filter
function removeRiskFilter(riskValue) {
    const checkbox = document.querySelector(`#risk-filter-dropdown input[value="${riskValue}"]`);
    if (checkbox) {
        checkbox.checked = false;
    }
    applyRiskFilter();
}

// Update filter indicator (icon highlight and count badge)
function updateFilterIndicator(columnName, count) {
    const icon = document.getElementById(`${columnName}-filter-icon`);
    const badge = document.getElementById(`${columnName}-filter-count`);
    
    if (icon) {
        if (count > 0) {
            icon.classList.add('text-teal-700');
            icon.classList.remove('text-slate-600');
        } else {
            icon.classList.remove('text-teal-700');
            icon.classList.add('text-slate-600');
        }
    }
    
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// Enhanced matchesFilters to include new column filters
function matchesColumnFilters(poam) {
    // Search filter (from header)
    if (activeFilters.search) {
        const searchLower = activeFilters.search;
        const matchesSearch = 
            (poam.id && poam.id.toLowerCase().includes(searchLower)) ||
            (poam.title && poam.title.toLowerCase().includes(searchLower)) ||
            (poam.vulnerability && poam.vulnerability.toLowerCase().includes(searchLower)) ||
            (poam.asset && poam.asset.toLowerCase().includes(searchLower)) ||
            (poam.affectedAssets && poam.affectedAssets.some(a => a.toLowerCase().includes(searchLower)));
        
        if (!matchesSearch) return false;
    }
    
    // Risk filter (multi-select)
    if (activeFilters.risk.length > 0) {
        if (!activeFilters.risk.includes(poam.risk)) {
            return false;
        }
    }
    
    // Status filter
    if (activeFilters.status && poam.status !== activeFilters.status) {
        return false;
    }
    
    // POC filter
    if (activeFilters.poc) {
        const poamPOC = poam.poc || poam.pocTeam || 'Unassigned';
        if (poamPOC !== activeFilters.poc) {
            return false;
        }
    }
    
    // Asset range filter
    if (activeFilters.assetRange) {
        const assetCount = poam.assetCount || poam.totalAffectedAssets || 0;
        const threshold = parseInt(activeFilters.assetRange);
        if (assetCount <= threshold) {
            return false;
        }
    }
    
    // Due date filter
    if (activeFilters.dueDate) {
        const dueDate = new Date(poam.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        switch (activeFilters.dueDate) {
            case 'overdue':
                if (dueDate >= today) return false;
                break;
            case '7days':
                const sevenDays = new Date(today);
                sevenDays.setDate(sevenDays.getDate() + 7);
                if (dueDate < today || dueDate > sevenDays) return false;
                break;
            case '30days':
                const thirtyDays = new Date(today);
                thirtyDays.setDate(thirtyDays.getDate() + 30);
                if (dueDate < today || dueDate > thirtyDays) return false;
                break;
        }
    }
    
    return true;
}

// Clear all column filters
function clearAllColumnFilters() {
    // Reset filter state
    activeFilters = {
        search: activeFilters.search, // Keep search
        risk: [],
        status: '',
        poc: '',
        assetRange: '',
        dueDate: ''
    };
    
    // Reset UI elements
    document.querySelectorAll('#risk-filter-dropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="status-filter"]').forEach(r => r.checked = r.value === '');
    document.querySelectorAll('input[name="asset-range"]').forEach(r => r.checked = r.value === '');
    document.querySelectorAll('input[name="duedate-filter"]').forEach(r => r.checked = r.value === '');
    document.querySelectorAll('input[name="poc-filter"]').forEach(r => r.checked = false);
    
    // Update indicators
    updateFilterIndicator('risk', 0);
    updateFilterIndicator('status', 0);
    updateFilterIndicator('asset', 0);
    updateFilterIndicator('duedate', 0);
    updateFilterIndicator('poc', 0);
    
    // Update chips display
    updateFilterChips();
    
    // Refresh display
    currentPOAMPage = 1;
    displayVulnerabilityPOAMs();
}
