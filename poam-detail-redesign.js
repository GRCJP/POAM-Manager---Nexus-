// ═══════════════════════════════════════════════════════════════
// POAM DETAIL VIEW - FOCUSED EDITABLE EXPERIENCE
// ═══════════════════════════════════════════════════════════════

let currentPOAMDetail = null;

async function showPOAMDetails(poamId) {
    console.log(`🔍 Loading POAM details for: ${poamId}`);
    
    // Ensure database is initialized
    if (!poamDB || !poamDB.db) {
        console.log('⏳ Waiting for database to initialize...');
        try {
            await poamDB.init();
        } catch (error) {
            console.error('Failed to initialize database:', error);
            showUpdateFeedback('Database not ready. Please refresh the page and try again.', 'error');
            return;
        }
    }
    
    // Get POAM from IndexedDB
    const poam = await poamDB.getPOAM(poamId);
    if (!poam) {
        console.error('POAM not found:', poamId);
        showUpdateFeedback('POAM not found. It may have been deleted.', 'error');
        return;
    }
    
    console.log('📋 POAM data structure:', poam);
    
    // Try to get latest scan summary for this POAM
    let scanSummary = null;
    if (poam.latestScanId) {
        scanSummary = await poamDB.getPoamScanSummary(poamId, poam.latestScanId);
    } else {
        // Fallback: get the latest scan summary for this POAM
        scanSummary = await poamDB.getLatestPoamScanSummary(poamId);
    }
    
    console.log('📸 Scan summary:', scanSummary);
    
    // Extract data from scan summary if available, otherwise use POAM data
    let findingDescription = poam.findingDescription || poam.description || '';
    let affectedAssets = poam.affectedAssets || poam.assets || [];
    let solutionText = poam.mitigation || '';
    let firstDetected = null;
    let lastDetected = null;
    let resultsSamples = [];
    
    if (scanSummary) {
        console.log('🔍 Using data from scan summary');
        findingDescription = scanSummary.rawFindings[0]?.results || scanSummary.rawFindings[0]?.description || scanSummary.rawFindings[0]?.title || findingDescription;
        affectedAssets = scanSummary.affectedAssets || affectedAssets;
        solutionText = scanSummary.solutionText || solutionText;
        firstDetected = scanSummary.firstDetectedMin;
        lastDetected = scanSummary.lastDetectedMax;
        resultsSamples = scanSummary.resultsSamples || [];
        
        console.log('🔍 Extracted finding description from raw data:', findingDescription.substring(0, 100) + '...');
        console.log('🔍 Extracted affected assets:', affectedAssets.length, 'assets');
        console.log('🔍 Extracted solution text:', solutionText.substring(0, 100) + '...');
    } else {
        console.log('🔍 No scan summary available, using POAM data');
    }
    
    console.log('🔍 Final finding description:', findingDescription.substring(0, 100) + '...');
    console.log('🔍 Final affected assets:', affectedAssets.length, 'assets');
    
    // Calculate asset count for display
    const assetCount = scanSummary ? scanSummary.totalAffectedAssets : (poam.totalAffectedAssets || affectedAssets.length || 0);
    
    currentPOAMDetail = poam;
    
    // Load milestones and comments
    const [milestones, comments] = await Promise.all([
        poamDB.getMilestones(poamId),
        poamDB.getComments(poamId)
    ]);
    
    poam.milestones = milestones;
    poam.comments = comments;
    
    // Render the focused POAM detail view with extracted data
    renderFocusedPOAMDetailPage(poam, {
        findingDescription,
        affectedAssets,
        solutionText,
        firstDetected,
        lastDetected,
        resultsSamples,
        scanSummary,
        assetCount
    });
    
    // Show the detail modal
    document.getElementById('poam-detail-page').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Add click outside to close functionality
    setupModalCloseHandlers();
}

function renderFocusedPOAMDetailPage(poam, scanData) {
    const detailContainer = document.getElementById('poam-detail-page');
    if (!detailContainer) return;
    
    // Helper function to format date for HTML input
    const formatDateForInput = (dateValue) => {
        if (!dateValue) return '';
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
    };
    
    // Map formal fields to display fields using scan summary data
    const displayPOAM = {
        ...poam,
        risk: poam.riskLevel || poam.risk || 'medium',
        status: poam.findingStatus || poam.status || 'Open',
        vulnerability: poam.vulnerabilityName || poam.vulnerability || poam.title || 'Unknown',
        description: scanData.findingDescription, // Use description from scan summary or POAM
        dueDate: formatDateForInput(poam.updatedScheduledCompletionDate || poam.dueDate),
        poc: poam.poc || 'Unassigned',
        controlFamily: poam.controlFamily || 'CM',
        findingSource: poam.findingSource || 'Vulnerability Scan',
        initialScheduledCompletionDate: formatDateForInput(poam.initialScheduledCompletionDate),
        actualCompletionDate: formatDateForInput(poam.actualCompletionDate),
        mitigation: scanData.solutionText, // Use solution from scan summary
        resourcesRequired: poam.resourcesRequired || '',
        notes: poam.notes || '',
        // Use assets from scan summary
        assets: scanData.affectedAssets,
        // Add scan metadata
        firstDetected: scanData.firstDetected,
        lastDetected: scanData.lastDetected,
        resultsSamples: scanData.resultsSamples,
        hasScanData: !!scanData.scanSummary
    };
    
    const assetCount = scanData.assetCount; // Use the assetCount passed as parameter
    
    detailContainer.innerHTML = `
        <!-- Modal Background -->
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50" onclick="closePOAMDetails()"></div>
        
        <!-- Modal Content - Smaller, focused size -->
        <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-11/12 max-w-6xl max-h-[90vh] bg-white rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
            
            <!-- Header - Compact -->
            <div class="bg-slate-900 text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
                <div class="flex items-center gap-4">
                    <!-- POAM ID -->
                    <span class="text-sm font-mono bg-slate-700 px-2 py-1 rounded">${poam.id}</span>
                    
                    <!-- Title -->
                    <h1 class="text-base font-semibold truncate" title="${displayPOAM.vulnerability}">
                        ${displayPOAM.vulnerability}
                    </h1>
                </div>
                
                <div class="flex items-center gap-4">
                    <!-- Risk Badge -->
                    ${getRiskBadge(displayPOAM.risk)}
                    
                    <!-- Asset Count -->
                    <span class="text-sm">${assetCount} assets</span>
                    
                    <!-- Close Button -->
                    <button onclick="closePOAMDetails()" 
                            class="text-slate-400 hover:text-white transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-6">
                
                <!-- Key Information Grid -->
                <div class="grid grid-cols-2 gap-6 mb-6">
                    <!-- Left Column -->
                    <div class="space-y-4">
                        <!-- Status -->
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Status</label>
                            <select class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    onchange="updatePOAMField('${poam.id}', 'findingStatus', this.value)">
                                ${getStatusOptions(displayPOAM.status)}
                            </select>
                        </div>
                        
                        <!-- Risk Level -->
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Risk Level</label>
                            <select class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    onchange="updatePOAMField('${poam.id}', 'riskLevel', this.value)">
                                ${getRiskOptions(displayPOAM.risk)}
                            </select>
                        </div>
                        
                        <!-- POC -->
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Point of Contact</label>
                            <input type="text" 
                                   value="${displayPOAM.poc}" 
                                   placeholder="Assign POC"
                                   class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                   onchange="updatePOAMField('${poam.id}', 'poc', this.value)">
                        </div>
                        
                        <!-- Control Family -->
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Control Family</label>
                            <select class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    onchange="updatePOAMField('${poam.id}', 'controlFamily', this.value)">
                                ${getControlFamilyOptions(displayPOAM.controlFamily)}
                            </select>
                        </div>
                    </div>
                    
                    <!-- Right Column -->
                    <div class="space-y-4">
                        <!-- Initial Scheduled Completion -->
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Initial Scheduled Completion</label>
                            <input type="date" 
                                   value="${displayPOAM.initialScheduledCompletionDate}" 
                                   class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                   onchange="updatePOAMField('${poam.id}', 'initialScheduledCompletionDate', this.value)">
                        </div>
                        
                        <!-- Updated Scheduled Completion -->
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Updated Scheduled Completion</label>
                            <input type="date" 
                                   value="${displayPOAM.dueDate}" 
                                   class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                   onchange="updatePOAMField('${poam.id}', 'updatedScheduledCompletionDate', this.value)">
                        </div>
                        
                        <!-- Actual Completion -->
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Actual Completion</label>
                            <input type="date" 
                                   value="${displayPOAM.actualCompletionDate}" 
                                   class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                   onchange="updatePOAMField('${poam.id}', 'actualCompletionDate', this.value)">
                        </div>
                        
                        <!-- Finding Source -->
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Finding Source</label>
                            <input type="text" 
                                   value="${displayPOAM.findingSource}" 
                                   readonly
                                   class="w-full px-3 py-2 border border-slate-300 rounded bg-slate-50">
                        </div>
                    </div>
                </div>
                
                <!-- Description -->
                <div class="mb-6">
                    <label class="block text-sm font-medium text-slate-700 mb-1">Finding Description</label>
                    <textarea rows="3" 
                              class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                              placeholder="Describe the finding..."
                              onchange="updatePOAMField('${poam.id}', 'description', this.value)">${displayPOAM.description}</textarea>
                </div>
                
                <!-- AFFECTED ASSETS - Always Visible -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-slate-900 mb-3">Affected Assets (${assetCount})</h3>
                    <div class="border border-slate-200 rounded-lg overflow-hidden">
                        ${renderAssetsList(poam.assets || [])}
                    </div>
                </div>
                
                <!-- Mitigation & Resources -->
                <div class="grid grid-cols-2 gap-6 mb-6">
                    <!-- Mitigation -->
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Mitigation Strategy</label>
                        <textarea rows="4" 
                                  class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                  placeholder="Describe mitigation approach..."
                                  onchange="updatePOAMField('${poam.id}', 'mitigation', this.value)">${displayPOAM.mitigation}</textarea>
                    </div>
                    
                    <!-- Resources Required -->
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Resources Required</label>
                        <input type="text" 
                               value="${displayPOAM.resourcesRequired}" 
                               placeholder="Personnel, tools, budget..."
                               class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                               onchange="updatePOAMField('${poam.id}', 'resourcesRequired', this.value)">
                        
                        <label class="block text-sm font-medium text-slate-700 mb-1 mt-3">Notes</label>
                        <textarea rows="2" 
                                  class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                  placeholder="Additional notes..."
                                  onchange="updatePOAMField('${poam.id}', 'notes', this.value)">${displayPOAM.notes}</textarea>
                    </div>
                </div>
                
            </div>
            
            <!-- Footer Actions -->
            <div class="bg-slate-50 px-6 py-3 flex justify-end gap-3 border-t border-slate-200">
                <button onclick="closePOAMDetails()" 
                        class="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors">
                    Cancel
                </button>
                <button onclick="savePOAMChanges()" 
                        class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
                    <i class="fas fa-save mr-2"></i>Save Changes
                </button>
            </div>
        </div>
    `;
}

function renderAssetsList(assets) {
    if (!assets || assets.length === 0) {
        return '<div class="p-4 text-center text-slate-500">No affected assets found</div>';
    }
    
    const headers = ['Asset', 'Status', 'OS', 'First Detected', 'Last Detected'];
    
    let html = `
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-slate-100 border-b border-slate-200">
                    <tr>
                        ${headers.map(header => `<th class="px-4 py-2 text-left font-semibold text-slate-700">${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
    `;
    
    assets.forEach((asset, index) => {
        const assetId = asset.id || asset.name || `asset-${index}`;
        
        html += `
            <tr class="hover:bg-slate-50">
                <td class="px-4 py-3 font-medium text-slate-900">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-server text-slate-400"></i>
                        ${asset.name || asset.assetId || 'Unknown'}
                    </div>
                </td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 rounded-full text-xs font-semibold ${getAssetStatusColor(asset.status)}">
                        ${asset.status || 'affected'}
                    </span>
                </td>
                <td class="px-4 py-3 text-slate-600">${asset.operatingSystem || asset.os || 'Unknown'}</td>
                <td class="px-4 py-3 text-slate-600">${asset.firstDetected || 'N/A'}</td>
                <td class="px-4 py-3 text-slate-600">${asset.lastDetected || 'N/A'}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

// Helper Functions
function getRiskBadge(risk) {
    const riskColors = {
        'critical': 'bg-red-600 text-white',
        'high': 'bg-orange-600 text-white',
        'medium': 'bg-yellow-600 text-white',
        'low': 'bg-blue-600 text-white'
    };
    
    return `<span class="px-3 py-1 rounded-full text-xs font-semibold ${riskColors[risk] || riskColors.medium}">${risk.toUpperCase()}</span>`;
}

function getStatusOptions(currentStatus) {
    const statuses = ['Open', 'In Progress', 'Completed', 'Closed', 'Risk Accepted'];
    return statuses.map(status => {
        const value = status.toLowerCase().replace(' ', '-');
        const isSelected = currentStatus.toLowerCase() === status.toLowerCase() || 
                          (status === 'Risk Accepted' && currentStatus.toLowerCase() === 'risk-accepted');
        return `<option value="${value}" ${isSelected ? 'selected' : ''}>${status}</option>`;
    }).join('');
}

function getRiskOptions(currentRisk) {
    const risks = ['Critical', 'High', 'Medium', 'Low'];
    return risks.map(risk => {
        const value = risk.toLowerCase();
        const isSelected = currentRisk.toLowerCase() === value;
        return `<option value="${value}" ${isSelected ? 'selected' : ''}>${risk}</option>`;
    }).join('');
}

function getControlFamilyOptions(currentFamily) {
    const families = ['AC', 'AU', 'CM', 'IA', 'IR', 'MA', 'PE', 'SC', 'SI'];
    return families.map(family => {
        const isSelected = currentFamily === family;
        return `<option value="${family}" ${isSelected ? 'selected' : ''}>${family}</option>`;
    }).join('');
}

function getAssetStatusColor(status) {
    const colors = {
        'affected': 'bg-red-100 text-red-700',
        'vulnerable': 'bg-orange-100 text-orange-700',
        'fixed': 'bg-green-100 text-green-700',
        'mitigated': 'bg-blue-100 text-blue-700'
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
}

function closePOAMDetails() {
    document.getElementById('poam-detail-page').classList.add('hidden');
    document.body.style.overflow = 'auto';
    currentPOAMDetail = null;
}

function setupModalCloseHandlers() {
    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePOAMDetails();
        }
    });
}

// POAM Field Updates
async function updatePOAMField(poamId, field, value) {
    if (!poamDB || !poamDB.db) {
        console.error('Database not available');
        showUpdateFeedback('Database not available', 'error');
        return;
    }
    
    try {
        const poam = await poamDB.getPOAM(poamId);
        if (!poam) {
            console.error('POAM not found:', poamId);
            return;
        }
        
        console.log('📋 POAM data:', poam);
        console.log('🔍 POAM.description:', poam.description);
        console.log('🔍 POAM.affectedAssets:', poam.affectedAssets);
        console.log('🔍 POAM.assets:', poam.assets);
        console.log('🔍 Available POAM fields:', Object.keys(poam));
        
        poam[field] = value;
        poam.lastModifiedDate = new Date().toISOString();
        
        await poamDB.savePOAM(poam);
        showUpdateFeedback('Field updated', 'success');
        
        // Refresh if needed
        if (currentPOAMDetail && currentPOAMDetail.id === poamId) {
            currentPOAMDetail = poam;
        }
        
    } catch (error) {
        console.error('Failed to update field:', error);
        showUpdateFeedback('Failed to update field', 'error');
    }
}

async function savePOAMChanges() {
    if (!currentPOAMDetail) return;
    
    try {
        await poamDB.savePOAM(currentPOAMDetail);
        showUpdateFeedback('POAM saved successfully', 'success');
        closePOAMDetails();
        
        // Refresh the main POAM list
        if (typeof displayVulnerabilityPOAMs === 'function') {
            await displayVulnerabilityPOAMs();
        }
        
    } catch (error) {
        console.error('Failed to save POAM:', error);
        showUpdateFeedback('Failed to save POAM', 'error');
    }
}

function showUpdateFeedback(message, type = 'info') {
    // Simple feedback implementation
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Create the detail page container if it doesn't exist
    if (!document.getElementById('poam-detail-page')) {
        const detailPage = document.createElement('div');
        detailPage.id = 'poam-detail-page';
        detailPage.className = 'hidden fixed inset-0 z-50';
        document.body.appendChild(detailPage);
    }
});
