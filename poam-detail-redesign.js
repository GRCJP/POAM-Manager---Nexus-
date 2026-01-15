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
    const colors = {
        'critical': 'bg-red-100 text-red-700 border-red-200',
        'high': 'bg-orange-100 text-orange-700 border-orange-200',
        'medium': 'bg-yellow-100 text-yellow-700 border-yellow-200',
        'low': 'bg-green-100 text-green-700 border-green-200'
    };
    const colorClass = colors[risk?.toLowerCase()] || 'bg-slate-100 text-slate-700 border-slate-200';
    return `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold border ${colorClass}">${(risk || 'Medium').toUpperCase()}</span>`;
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
        await poamDB.updatePOAM(poamId, updates);
        
        // Visual feedback
        showUpdateFeedback('Saved', 'success');

        // Refresh dashboard metrics
        if (typeof updateVulnerabilityModuleMetrics === 'function') {
            await updateVulnerabilityModuleMetrics();
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
        toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg z-[100] transition-all ${type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white text-sm`;
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
        readonlyDiv.add('hidden');
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
    const [milestones, comments] = await Promise.all([
        poamDB.getMilestones(poamId),
        poamDB.getComments(poamId)
    ]);
    poam.milestones = milestones;
    poam.comments = comments;
    
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
                    <button onclick="switchMainTab('details')" id="main-tab-details" class="px-1 py-4 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 transition-all flex items-center gap-2">
                        <i class="fas fa-edit"></i> POAM Details
                    </button>
                    <button onclick="switchMainTab('assets')" id="main-tab-assets" class="px-1 py-4 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-all flex items-center gap-2">
                        <i class="fas fa-server"></i> Affected Assets (${displayPOAM.totalAffectedAssets || 0})
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
                                <div class="bg-emerald-50/60 border border-emerald-100 rounded-lg p-4">
                                    <label class="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Mitigation Strategy</label>
                                    <div data-edit="display" class="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap">${displayPOAM.mitigation || 'No mitigation specified'}</div>
                                    <textarea data-edit="input" disabled
                                              rows="3" class="hidden w-full text-sm text-emerald-900 border border-emerald-200 rounded px-3 py-2 resize-none"
                                              onchange="updatePOAMField('${poam.id}', 'mitigation', this.value)">${displayPOAM.mitigation || ''}</textarea>
                                </div>
                            </div>
                            <div class="border border-slate-200 rounded-lg p-4 space-y-4">
                                <div>
                                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Impacted Components / URL Details</label>
                                    <div data-edit="display" class="text-sm text-slate-700 whitespace-pre-wrap">${displayPOAM.impactedComponents || 'Not specified'}</div>
                                    <button type="button" onclick="switchMainTab('assets')" class="mt-2 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">See affected assets</button>
                                    <textarea data-edit="input" disabled
                                              rows="2" class="hidden w-full text-sm text-slate-700 border border-slate-200 rounded px-3 py-2 resize-none"
                                              onchange="updatePOAMField('${poam.id}', 'impactedComponents', this.value)">${displayPOAM.impactedComponents || ''}</textarea>
                                </div>
                                <div>
                                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Internal Notes</label>
                                    <textarea rows="3" class="w-full text-sm text-slate-700 border border-slate-200 rounded px-3 py-2 resize-none"
                                              onchange="updatePOAMField('${poam.id}', 'notes', this.value)">${displayPOAM.notes || ''}</textarea>
                                </div>
                                <div>
                                    <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Milestones</div>
                                    <div class="mt-3">${renderMilestonesList(poam.milestones || [])}</div>
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
                            </div>
                        </div>
                    </div>
                </div>

                <div id="section-assets" class="main-tab-section hidden h-full">
                    <div class="h-full border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex justify-between items-center">
                            <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Affected Asset Inventory</span>
                            <button onclick="exportAssetScanData('${poam.id}')" 
                                    class="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
                                <i class="fas fa-file-export"></i> Export Scan Data (Filtered)
                            </button>
                        </div>
                        <div class="flex-1 overflow-y-auto">${renderAssetsList(displayPOAM.affectedAssets || [])}</div>
                    </div>
                </div>

            </div>
            
            <div class="bg-slate-50 px-6 py-3 flex justify-end gap-3 border-t border-slate-200">
                <button onclick="closePOAMDetails()" class="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
                <button onclick="saveAndClosePOAMDetails('${poam.id}')" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold transition-all flex items-center gap-2">
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
    ['details', 'assets'].forEach(t => {
        const btn = document.getElementById(`main-tab-${t}`);
        if (btn) {
            btn.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600', 'font-bold');
            btn.classList.add('text-slate-500', 'font-medium', 'border-transparent');
        }
    });
    const target = document.getElementById(`section-${tabName}`);
    if (target) target.classList.remove('hidden');
    const activeBtn = document.getElementById(`main-tab-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600', 'font-bold');
        activeBtn.classList.remove('text-slate-500', 'font-medium', 'border-transparent');
    }
}

function renderAssetsList(assets) {
    if (!assets || assets.length === 0) return '<div class="p-8 text-center text-slate-500 italic">No assets identified for this POAM</div>';
    
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
                ${assets.map(asset => `
                    <tr class="hover:bg-indigo-50/30 transition-colors">
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

function renderMilestonesList(milestones) {
    if (!milestones || milestones.length === 0) {
        return '<div class="text-xs text-slate-500 italic">No milestones added</div>';
    }

    return `
        <div class="space-y-3">
            ${milestones.map((milestone, index) => {
                const status = milestone.status || 'pending';
                const statusClass = status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : status === 'in-progress'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200';
                return `
                    <div class="border border-slate-200 rounded-lg p-3">
                        <div class="flex items-center justify-between">
                            <div class="text-xs font-semibold text-slate-800">${milestone.name || milestone.step || `Milestone ${index + 1}`}</div>
                            <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusClass}">${status}</span>
                        </div>
                        <div class="mt-1 text-[11px] text-slate-500">${milestone.targetDate || milestone.date || 'No target date'}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function getSeverityColor(s) {
    if (!s) return 'bg-slate-100 text-slate-700';
    const l = s.toLowerCase();
    if (l.includes('critical')) return 'bg-red-100 text-red-700';
    if (l.includes('high')) return 'bg-orange-100 text-orange-700';
    if (l.includes('medium')) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
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
            showUpdateFeedback('No scan data found for this POAM', 'error');
            return;
        }

        const findings = poam.rawFindings;
        
        // Extract all unique headers from all raw findings
        const headerSet = new Set();
        findings.forEach(f => {
            const raw = f.raw || f;
            Object.keys(raw).forEach(key => headerSet.add(key));
        });
        const headers = Array.from(headerSet);

        // Create CSV rows
        const csvRows = [headers.join(',')];
        
        findings.forEach(f => {
            const raw = f.raw || f;
            const rowValues = headers.map(header => {
                const val = raw[header] || '';
                // Escape quotes and commas
                return `"${String(val).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
            });
            csvRows.push(rowValues.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        
        a.href = url;
        a.download = `POAM_Asset_Scan_Data_${poamId}_${timestamp}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showUpdateFeedback(`Exported ${findings.length} scan records`, 'success');
    } catch (error) {
        console.error('Failed to export asset scan data:', error);
        showUpdateFeedback('Export failed', 'error');
    }
}
