// ═══════════════════════════════════════════════════════════════
// POAM DETAIL VIEW - FOCUSED EDITABLE EXPERIENCE
// ═══════════════════════════════════════════════════════════════

let currentPOAMDetail = null;

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
                    <span class="text-[10px] text-slate-400 font-mono ml-4">
                        rawFindings=${displayPOAM.rawFindings?.length || 0} 
                        affectedAssets=${displayPOAM.affectedAssets?.length || 0} 
                        totalAffectedAssets=${displayPOAM.totalAffectedAssets || 0}
                    </span>
                </div>
                <div class="flex items-center gap-4">
                    ${getRiskBadge(displayPOAM.risk)}
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
                    <button onclick="switchMainTab('raw')" id="main-tab-raw" class="px-1 py-4 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-all flex items-center gap-2">
                        <i class="fas fa-bug"></i> Raw Findings (${displayPOAM.rawFindings?.length || 0})
                    </button>
                </nav>
            </div>
            
            <div class="flex-1 overflow-y-auto p-6 bg-white">
                <div id="section-details" class="main-tab-section space-y-6">
                    <!-- Key Information Grid -->
                    <div class="grid grid-cols-2 gap-6">
                        <!-- Left Column -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label for="poam-status-${poam.id}" class="block text-sm font-semibold text-slate-700 mb-1">Finding Status</label>
                                <select id="poam-status-${poam.id}" 
                                        class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                                        onchange="updatePOAMField('${poam.id}', 'findingStatus', this.value)">
                                    <option value="open" ${displayPOAM.findingStatus === 'open' ? 'selected' : ''}>Open</option>
                                    <option value="in-progress" ${displayPOAM.findingStatus === 'in-progress' ? 'selected' : ''}>In Progress</option>
                                    <option value="completed" ${displayPOAM.findingStatus === 'completed' ? 'selected' : ''}>Completed</option>
                                    <option value="risk-accepted" ${displayPOAM.findingStatus === 'risk-accepted' ? 'selected' : ''}>Risk Accepted</option>
                                </select>
                            </div>
                            <div>
                                <label for="poam-system-${poam.id}" class="block text-sm font-semibold text-slate-700 mb-1">Assigned System</label>
                                <select id="poam-system-${poam.id}" 
                                        class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                                        onchange="updatePOAMField('${poam.id}', 'systemId', this.value)">
                                    <option value="">Unassigned</option>
                                    ${settingsManager.systems.map(sys => `
                                        <option value="${sys.id}" ${displayPOAM.systemId === sys.id ? 'selected' : ''}>${sys.name}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        <!-- Right Column -->
                        <div class="space-y-4">
                            <div>
                                <label for="poam-risk-${poam.id}" class="block text-sm font-medium text-slate-700 mb-1">Risk Level</label>
                                <select id="poam-risk-${poam.id}" 
                                        class="w-full px-3 py-2 border border-slate-300 rounded" 
                                        onchange="updatePOAMField('${poam.id}', 'riskLevel', this.value)">
                                    ${getRiskOptions(displayPOAM.risk)}
                                </select>
                            </div>
                            <div>
                                <label for="poam-poc-${poam.id}" class="block text-sm font-medium text-slate-700 mb-1">Point of Contact</label>
                                <input id="poam-poc-${poam.id}" 
                                       type="text" value="${displayPOAM.poc}" 
                                       class="w-full px-3 py-2 border border-slate-300 rounded" 
                                       onchange="updatePOAMField('${poam.id}', 'poc', this.value)">
                            </div>
                            <div>
                                <label for="poam-family-${poam.id}" class="block text-sm font-medium text-slate-700 mb-1">Control Family</label>
                                <select id="poam-family-${poam.id}" 
                                        class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                                        onchange="updatePOAMField('${poam.id}', 'controlFamily', this.value)">
                                    ${getControlFamilyOptions(displayPOAM.controlFamily)}
                                </select>
                            </div>
                        </div>
                        <!-- Right Column -->
                        <div class="space-y-4">
                            <div>
                                <label for="poam-initial-date-${poam.id}" class="block text-sm font-medium text-slate-700 mb-1">Initial Scheduled Completion</label>
                                <input id="poam-initial-date-${poam.id}" 
                                       type="date" value="${displayPOAM.initialDate}" 
                                       class="w-full px-3 py-2 border border-slate-300 rounded" 
                                       onchange="updatePOAMField('${poam.id}', 'initialScheduledCompletionDate', this.value)">
                            </div>
                            <div>
                                <label for="poam-due-date-${poam.id}" class="block text-sm font-medium text-slate-700 mb-1">Updated Scheduled Completion</label>
                                <input id="poam-due-date-${poam.id}" 
                                       type="date" value="${displayPOAM.dueDate}" 
                                       class="w-full px-3 py-2 border border-slate-300 rounded" 
                                       onchange="updatePOAMField('${poam.id}', 'updatedScheduledCompletionDate', this.value)">
                            </div>
                            <div>
                                <label for="poam-actual-date-${poam.id}" class="block text-sm font-medium text-slate-700 mb-1">Actual Completion</label>
                                <input id="poam-actual-date-${poam.id}" 
                                       type="date" value="${displayPOAM.actualDate}" 
                                       class="w-full px-3 py-2 border border-slate-300 rounded" 
                                       onchange="updatePOAMField('${poam.id}', 'actualCompletionDate', this.value)">
                            </div>
                            <div>
                                <label for="poam-resources-${poam.id}" class="block text-sm font-medium text-slate-700 mb-1">Resources Required</label>
                                <select id="poam-resources-${poam.id}" 
                                        class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                                        onchange="updatePOAMField('${poam.id}', 'resourcesRequired', this.value)">
                                    <option value="Human Capital" ${displayPOAM.resources === 'Human Capital' ? 'selected' : ''}>Human Capital</option>
                                    <option value="Application Coordination and Testing" ${displayPOAM.resources === 'Application Coordination and Testing' ? 'selected' : ''}>Application Coordination and Testing</option>
                                    <option value="Financial / Budgetary Resources" ${displayPOAM.resources === 'Financial / Budgetary Resources' ? 'selected' : ''}>Financial / Budgetary Resources</option>
                                    <option value="Third-Party or Vendor Resources" ${displayPOAM.resources === 'Third-Party or Vendor Resources' ? 'selected' : ''}>Third-Party or Vendor Resources</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <label for="desc-editable-${poam.id}" class="block text-sm font-medium text-slate-700">Finding Description</label>
                            <button onclick="toggleDescriptionEdit('${poam.id}')" class="text-xs text-indigo-600 font-medium flex items-center gap-1">
                                <i class="fas fa-edit"></i> <span id="desc-edit-btn-${poam.id}">Edit</span>
                            </button>
                        </div>
                        <div id="desc-readonly-${poam.id}" class="w-full px-3 py-2 border border-slate-200 rounded bg-slate-50 text-slate-700 min-h-[72px] whitespace-pre-wrap">${displayPOAM.description || 'No description available'}</div>
                        <textarea id="desc-editable-${poam.id}" rows="3" class="hidden w-full px-3 py-2 border border-slate-300 rounded resize-none" onblur="saveDescriptionEdit('${poam.id}')">${displayPOAM.description || ''}</textarea>
                    </div>
                    <div>
                        <label for="poam-mitigation-${poam.id}" class="block text-sm font-medium text-slate-700 mb-1">Mitigation Strategy</label>
                        <textarea id="poam-mitigation-${poam.id}" 
                                  rows="6" class="w-full px-3 py-2 border border-slate-300 rounded resize-y min-h-[150px]" 
                                  onchange="updatePOAMField('${poam.id}', 'mitigation', this.value)">${displayPOAM.mitigation || ''}</textarea>
                    </div>
                    <div>
                        <label for="poam-impacted-components-${poam.id}" class="block text-sm font-semibold text-slate-700 mb-1">Impacted Components / URL Details</label>
                        <textarea id="poam-impacted-components-${poam.id}" 
                                  rows="2" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                  onchange="updatePOAMField('${poam.id}', 'impactedComponents', this.value)"
                                  placeholder="List affected servers, applications, or URLs...">${displayPOAM.impactedComponents || ''}</textarea>
                    </div>
                    <div>
                        <label for="poam-notes-${poam.id}" class="block text-sm font-semibold text-slate-700 mb-1">Internal Notes / Comments</label>
                        <textarea id="poam-notes-${poam.id}" 
                                  rows="4" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none resize-y" 
                                  onchange="updatePOAMField('${poam.id}', 'notes', this.value)">${displayPOAM.notes}</textarea>
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

                <div id="section-raw" class="main-tab-section hidden h-full">
                    <div class="h-full border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2"><span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Source Scan Records</span></div>
                        <div class="flex-1 overflow-y-auto">${renderRawFindings(displayPOAM.rawFindings || [])}</div>
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
}

function switchMainTab(tabName) {
    document.querySelectorAll('.main-tab-section').forEach(s => s.classList.add('hidden'));
    ['details', 'assets', 'raw'].forEach(t => {
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

function renderRawFindings(findings) {
    if (!findings || findings.length === 0) return '<div class="p-4 text-center text-slate-500">No raw findings</div>';
    let html = `<div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-slate-100 border-b border-slate-200"><tr><th class="px-4 py-2 text-left font-semibold text-slate-700">Finding</th><th class="px-4 py-2 text-left font-semibold text-slate-700">Severity</th><th class="px-4 py-2 text-left font-semibold text-slate-700">First Detected</th></tr></thead><tbody class="divide-y divide-slate-100">`;
    findings.forEach(f => {
        html += `<tr class="hover:bg-slate-50"><td class="px-4 py-3"><div class="font-medium text-slate-900">${f.title || 'Unknown'}</div><div class="text-xs text-slate-500 mt-1">${f.description || 'No description'}</div></td><td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(f.severity)}">${f.severity || 'Unknown'}</span></td><td class="px-4 py-3 text-slate-600">${f.firstDetected || 'N/A'}</td></tr>`;
    });
    return html + '</tbody></table></div>';
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
