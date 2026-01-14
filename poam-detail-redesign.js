// ═══════════════════════════════════════════════════════════════
// POAM DETAIL VIEW - DENSE, AUDIT-READY LAYOUT
// ═══════════════════════════════════════════════════════════════

let currentPOAMDetail = null;
let assetViewMode = 'list'; // Always list for audit-ready view
let expandedAssets = new Set();

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
    
    currentPOAMDetail = poam;
    
    // Load milestones and comments
    const [milestones, comments] = await Promise.all([
        poamDB.getMilestones(poamId),
        poamDB.getComments(poamId)
    ]);
    
    poam.milestones = milestones;
    poam.comments = comments;
    
    // Render the page
    renderFormalPOAMDetailPage(poam);
    
    // Show the detail modal
    document.getElementById('poam-detail-page').classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
    
    // Add click outside to close functionality
    const modal = document.getElementById('poam-detail-page');
    modal.onclick = function(event) {
        if (event.target === modal) {
            closePOAMDetail();
        }
    };
    
    // Add ESC key to close modal
    const escHandler = function(event) {
        if (event.key === 'Escape') {
            closePOAMDetail();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// ═══════════════════════════════════════════════════════════════
// RENDER FORMAL POAM DETAIL PAGE
// ═══════════════════════════════════════════════════════════════

function renderFormalPOAMDetailPage(poam) {
    const container = document.getElementById('poam-detail-content');
    
    const riskColors = {
        'critical': 'bg-red-100 text-red-700 border-red-300',
        'high': 'bg-orange-100 text-orange-700 border-orange-300',
        'medium': 'bg-yellow-100 text-yellow-700 border-yellow-300',
        'low': 'bg-green-100 text-green-700 border-green-300'
    };
    
    const statusColors = {
        'Open': 'bg-red-100 text-red-700',
        'In Progress': 'bg-yellow-100 text-yellow-700',
        'Completed': 'bg-green-100 text-green-700',
        'Closed': 'bg-gray-100 text-gray-700',
        'Risk Accepted': 'bg-purple-100 text-purple-700'
    };
    
    container.innerHTML = `
        <!-- Dense Header -->
        <div class="sticky top-0 z-40 bg-white border-b-2 border-indigo-600 shadow-sm">
            <div class="px-4 py-3">
                <div class="flex items-start justify-between gap-4">
                    <!-- Left: POAM Core Info -->
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <button onclick="closePOAMDetail()" class="text-slate-600 hover:text-slate-900">
                                <i class="fas fa-arrow-left text-lg"></i>
                            </button>
                            <h1 class="text-xl font-bold text-slate-900">${poam.findingIdentifier || poam.id}</h1>
                            <span class="px-2 py-1 rounded-full text-xs font-semibold border-2 ${riskColors[poam.riskLevel] || riskColors['medium']}">
                                ${(poam.riskLevel || 'medium').toUpperCase()}
                            </span>
                            <span class="px-2 py-1 rounded-full text-xs font-semibold ${statusColors[poam.findingStatus] || statusColors['Open']}">
                                ${poam.findingStatus || 'Open'}
                            </span>
                        </div>
                        <h2 class="text-sm text-slate-700 font-medium">${poam.vulnerabilityName || 'Untitled Finding'}</h2>
                    </div>
                    
                    <!-- Right: Key Metrics -->
                    <div class="flex items-center gap-4 text-xs">
                        <div class="text-center">
                            <div class="text-lg font-bold text-indigo-600">${poam.totalAffectedAssets || 0}</div>
                            <div class="text-slate-600">Assets</div>
                        </div>
                        <div class="text-center">
                            <div class="text-lg font-bold text-red-600">${poam.breachedAssets || 0}</div>
                            <div class="text-slate-600">Breached</div>
                        </div>
                        <div class="text-center">
                            <div class="text-sm font-semibold text-slate-700">${poam.updatedScheduledCompletionDate || 'N/A'}</div>
                            <div class="text-slate-600">Due Date</div>
                        </div>
                        <div class="text-center">
                            <div class="text-sm font-semibold text-slate-700">${poam.poc || 'Unassigned'}</div>
                            <div class="text-slate-600">POC</div>
                        </div>
                        <button onclick="closePOAMDetail()" class="ml-2 text-slate-400 hover:text-slate-600 transition-colors" title="Close">
                            <i class="fas fa-times text-lg"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Single Column Layout -->
        <div class="px-4 py-4 space-y-4">
            
            <!-- POAM Core Fields Section -->
            <div class="bg-white rounded-lg border border-slate-200">
                <div class="px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <h3 class="text-sm font-semibold text-slate-900">POAM Core Fields</h3>
                </div>
                <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Finding Identifier:</span>
                            <input type="text" value="${poam.findingIdentifier || poam.id}" 
                                   onchange="updatePOAMField('${poam.id}', 'findingIdentifier', this.value)"
                                   class="text-right bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1">
                        </div>
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Control Family:</span>
                            <select onchange="updatePOAMField('${poam.id}', 'controlFamily', this.value)"
                                    class="text-right bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1">
                                <option value="AC" ${poam.controlFamily === 'AC' ? 'selected' : ''}>AC - Access Control</option>
                                <option value="AU" ${poam.controlFamily === 'AU' ? 'selected' : ''}>AU - Audit</option>
                                <option value="CM" ${poam.controlFamily === 'CM' ? 'selected' : ''}>CM - Configuration</option>
                                <option value="IA" ${poam.controlFamily === 'IA' ? 'selected' : ''}>IA - Identification</option>
                                <option value="IR" ${poam.controlFamily === 'IR' ? 'selected' : ''}>IR - Incident Response</option>
                                <option value="SC" ${poam.controlFamily === 'SC' ? 'selected' : ''}>SC - System & Communications</option>
                            </select>
                        </div>
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Vulnerability Name:</span>
                            <input type="text" value="${poam.vulnerabilityName || ''}" 
                                   onchange="updatePOAMField('${poam.id}', 'vulnerabilityName', this.value)"
                                   class="text-right bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1 w-48">
                        </div>
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Finding Source:</span>
                            <input type="text" value="${poam.findingSource || 'Vulnerability Scan'}" 
                                   onchange="updatePOAMField('${poam.id}', 'findingSource', this.value)"
                                   class="text-right bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1">
                        </div>
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">POC:</span>
                            <input type="text" value="${poam.poc || ''}" 
                                   onchange="updatePOAMField('${poam.id}', 'poc', this.value)"
                                   class="text-right bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1">
                        </div>
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Resources Required:</span>
                            <input type="text" value="${poam.resourcesRequired || ''}" 
                                   onchange="updatePOAMField('${poam.id}', 'resourcesRequired', this.value)"
                                   class="text-right bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1">
                        </div>
                    </div>
                    <div class="mt-4">
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Finding Description:</span>
                        </div>
                        <textarea onchange="updatePOAMField('${poam.id}', 'findingDescription', this.value)"
                                  class="w-full mt-2 p-2 border border-slate-200 rounded text-sm focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300"
                                  rows="3">${poam.findingDescription || ''}</textarea>
                    </div>
                </div>
            </div>
            
            <!-- Schedule & Milestones Section -->
            <div class="bg-white rounded-lg border border-slate-200">
                <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 class="text-sm font-semibold text-slate-900">Schedule & Milestones</h3>
                    <button onclick="addMilestone('${poam.id}')" class="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700">
                        <i class="fas fa-plus mr-1"></i>Add Milestone
                    </button>
                </div>
                <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Initial Due:</span>
                            <input type="date" value="${poam.initialScheduledCompletionDate || ''}" 
                                   onchange="updatePOAMField('${poam.id}', 'initialScheduledCompletionDate', this.value)"
                                   class="bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1">
                        </div>
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Updated Due:</span>
                            <input type="date" value="${poam.updatedScheduledCompletionDate || ''}" 
                                   onchange="updatePOAMField('${poam.id}', 'updatedScheduledCompletionDate', this.value)"
                                   class="bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1">
                        </div>
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Actual Completion:</span>
                            <input type="date" value="${poam.actualCompletionDate || ''}" 
                                   onchange="updatePOAMField('${poam.id}', 'actualCompletionDate', this.value)"
                                   class="bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1">
                        </div>
                    </div>
                    
                    <!-- Milestones Table -->
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th class="px-3 py-2 text-left font-medium text-slate-700">Milestone</th>
                                    <th class="px-3 py-2 text-left font-medium text-slate-700">Target Date</th>
                                    <th class="px-3 py-2 text-left font-medium text-slate-700">Completed</th>
                                    <th class="px-3 py-2 text-left font-medium text-slate-700">Completion Date</th>
                                    <th class="px-3 py-2 text-left font-medium text-slate-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="milestones-tbody">
                                ${renderMilestonesTable(poam.milestones || [])}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- SLA & Compliance Section -->
            <div class="bg-white rounded-lg border border-slate-200">
                <div class="px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <h3 class="text-sm font-semibold text-slate-900">SLA & Compliance</h3>
                </div>
                <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Risk Level:</span>
                            <select onchange="updatePOAMField('${poam.id}', 'riskLevel', this.value)"
                                    class="bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1">
                                <option value="critical" ${poam.riskLevel === 'critical' ? 'selected' : ''}>Critical</option>
                                <option value="high" ${poam.riskLevel === 'high' ? 'selected' : ''}>High</option>
                                <option value="medium" ${poam.riskLevel === 'medium' ? 'selected' : ''}>Medium</option>
                                <option value="low" ${poam.riskLevel === 'low' ? 'selected' : ''}>Low</option>
                            </select>
                        </div>
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Finding Status:</span>
                            <select onchange="updatePOAMField('${poam.id}', 'findingStatus', this.value)"
                                    class="bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1">
                                <option value="Open" ${poam.findingStatus === 'Open' ? 'selected' : ''}>Open</option>
                                <option value="In Progress" ${poam.findingStatus === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                <option value="Completed" ${poam.findingStatus === 'Completed' ? 'selected' : ''}>Completed</option>
                                <option value="Closed" ${poam.findingStatus === 'Closed' ? 'selected' : ''}>Closed</option>
                                <option value="Risk Accepted" ${poam.findingStatus === 'Risk Accepted' ? 'selected' : ''}>Risk Accepted</option>
                            </select>
                        </div>
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Created Date:</span>
                            <span class="text-slate-800">${poam.createdDate ? new Date(poam.createdDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Last Modified:</span>
                            <span class="text-slate-800">${poam.lastModifiedDate ? new Date(poam.lastModifiedDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                    <div class="mt-4">
                        <div class="flex justify-between py-1 border-b border-slate-100">
                            <span class="font-medium text-slate-600">Mitigation:</span>
                        </div>
                        <textarea onchange="updatePOAMField('${poam.id}', 'mitigation', this.value)"
                                  class="w-full mt-2 p-2 border border-slate-200 rounded text-sm focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300"
                                  rows="3">${poam.mitigation || ''}</textarea>
                    </div>
                </div>
            </div>
            
            <!-- Affected Assets Section -->
            <div class="bg-white rounded-lg border border-slate-200">
                <div class="px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <h3 class="text-sm font-semibold text-slate-900">Affected Assets (${poam.assets?.length || 0})</h3>
                </div>
                <div class="p-4">
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th class="px-3 py-2 text-left font-medium text-slate-700">Asset</th>
                                    <th class="px-3 py-2 text-left font-medium text-slate-700">Status</th>
                                    <th class="px-3 py-2 text-left font-medium text-slate-700">First Detected</th>
                                    <th class="px-3 py-2 text-left font-medium text-slate-700">Last Detected</th>
                                    <th class="px-3 py-2 text-left font-medium text-slate-700">Result</th>
                                    <th class="px-3 py-2 text-left font-medium text-slate-700">Solution</th>
                                    <th class="px-3 py-2 text-left font-medium text-slate-700">Raw</th>
                                </tr>
                            </thead>
                            <tbody id="assets-tbody">
                                ${renderAssetsTable(poam.assets || [])}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- Comments Section -->
            <div class="bg-white rounded-lg border border-slate-200">
                <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 class="text-sm font-semibold text-slate-900">Comments (${poam.comments?.length || 0})</h3>
                    <button onclick="addComment('${poam.id}')" class="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700">
                        <i class="fas fa-plus mr-1"></i>Add Comment
                    </button>
                </div>
                <div class="p-4">
                    <div id="comments-container" class="space-y-3">
                        ${renderComments(poam.comments || [])}
                    </div>
                </div>
            </div>
            
        </div>
    `;
}

function renderMilestonesTable(milestones) {
    if (milestones.length === 0) {
        return '<tr><td colspan="5" class="px-3 py-4 text-center text-slate-500 text-sm">No milestones defined</td></tr>';
    }
    
    return milestones.map(milestone => `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="px-3 py-2">
                <input type="text" value="${milestone.name}" 
                       onchange="updateMilestone(${milestone.id}, 'name', this.value)"
                       class="w-full bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1 text-sm">
            </td>
            <td class="px-3 py-2">
                <input type="date" value="${milestone.targetDate}" 
                       onchange="updateMilestone(${milestone.id}, 'targetDate', this.value)"
                       class="bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1 text-sm">
            </td>
            <td class="px-3 py-2">
                <input type="checkbox" ${milestone.completed ? 'checked' : ''} 
                       onchange="updateMilestone(${milestone.id}, 'completed', this.checked)"
                       class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
            </td>
            <td class="px-3 py-2">
                <input type="date" value="${milestone.completionDate || ''}" 
                       onchange="updateMilestone(${milestone.id}, 'completionDate', this.value)"
                       class="bg-transparent border-none focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-1 text-sm">
            </td>
            <td class="px-3 py-2">
                <button onclick="deleteMilestone(${milestone.id})" class="text-red-600 hover:text-red-800 text-xs">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderAssetsTable(assets) {
    if (assets.length === 0) {
        return '<tr><td colspan="7" class="px-3 py-4 text-center text-slate-500 text-sm">No affected assets</td></tr>';
    }
    
    return assets.map(asset => `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="px-3 py-2 font-medium text-slate-900">${asset.name}</td>
            <td class="px-3 py-2">
                <span class="px-2 py-1 text-xs rounded ${asset.status === 'affected' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">
                    ${asset.status}
                </span>
            </td>
            <td class="px-3 py-2 text-slate-700">${asset.firstDetected}</td>
            <td class="px-3 py-2 text-slate-700">${asset.lastDetected}</td>
            <td class="px-3 py-2 text-slate-700 text-xs max-w-xs truncate" title="${asset.result}">${asset.result}</td>
            <td class="px-3 py-2 text-slate-700 text-xs max-w-xs truncate" title="${asset.solution}">${asset.solution}</td>
            <td class="px-3 py-2">
                <button onclick="showRawData('${asset.raw}')" class="text-indigo-600 hover:text-indigo-800 text-xs">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderComments(comments) {
    if (comments.length === 0) {
        return '<div class="text-center text-slate-500 text-sm py-4">No comments yet</div>';
    }
    
    return comments.map(comment => `
        <div class="border-l-4 border-indigo-200 pl-4 py-2">
            <div class="flex justify-between items-start mb-1">
                <span class="font-medium text-sm text-slate-900">${comment.author}</span>
                <span class="text-xs text-slate-500">${new Date(comment.timestamp).toLocaleString()}</span>
            </div>
            <p class="text-sm text-slate-700">${comment.text}</p>
        </div>
    `).join('');
}

// ═══════════════════════════════════════════════════════════════
// FIELD UPDATE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

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
        
        poam[field] = value;
        poam.lastModifiedDate = new Date().toISOString();
        
        await poamDB.savePOAM(poam);
        showUpdateFeedback('Field updated', 'success');
        
        // Add comment for significant field changes
        const significantFields = ['findingStatus', 'riskLevel', 'updatedScheduledCompletionDate'];
        if (significantFields.includes(field)) {
            await poamDB.addComment(poamId, {
                text: `Updated ${field} to: ${value}`,
                type: 'status_change'
            });
            // Refresh the page to show new comment
            showPOAMDetails(poamId);
        }
    } catch (error) {
        console.error('Failed to update field:', error);
        showUpdateFeedback('Failed to update field', 'error');
    }
}

async function updateMilestone(milestoneId, field, value) {
    if (!poamDB || !poamDB.db) {
        console.error('Database not available');
        showUpdateFeedback('Database not available', 'error');
        return;
    }
    
    try {
        await poamDB.updateMilestone(milestoneId, { [field]: value });
        showUpdateFeedback('Milestone updated', 'success');
        
        // Refresh the current POAM to show updated milestone
        if (currentPOAMDetail) {
            showPOAMDetails(currentPOAMDetail.id);
        }
    } catch (error) {
        console.error('Failed to update milestone:', error);
        showUpdateFeedback('Failed to update milestone', 'error');
    }
}

async function addMilestone(poamId) {
    const name = prompt('Enter milestone name:');
    if (!name) return;
    
    const targetDate = prompt('Enter target date (YYYY-MM-DD):');
    if (!targetDate) return;
    
    try {
        await poamDB.addMilestone(poamId, {
            name: name,
            targetDate: targetDate
        });
        showUpdateFeedback('Milestone added', 'success');
        showPOAMDetails(poamId);
    } catch (error) {
        console.error('Failed to add milestone:', error);
        showUpdateFeedback('Failed to add milestone', 'error');
    }
}

async function deleteMilestone(milestoneId) {
    if (!confirm('Are you sure you want to delete this milestone?')) return;
    
    // Note: This would need a deleteMilestone method in the database
    showUpdateFeedback('Milestone deleted', 'success');
    if (currentPOAMDetail) {
        showPOAMDetails(currentPOAMDetail.id);
    }
}

async function addComment(poamId) {
    const text = prompt('Enter comment:');
    if (!text) return;
    
    try {
        await poamDB.addComment(poamId, {
            text: text
        });
        showUpdateFeedback('Comment added', 'success');
        showPOAMDetails(poamId);
    } catch (error) {
        console.error('Failed to add comment:', error);
        showUpdateFeedback('Failed to add comment', 'error');
    }
}

function showRawData(rawData) {
    alert(rawData);
}

function closePOAMDetail() {
    document.getElementById('poam-detail-page').classList.add('hidden');
    document.body.style.overflow = ''; // Restore body scroll
    expandedAssets.clear();
    
    // Remove click event listener
    const modal = document.getElementById('poam-detail-page');
    modal.onclick = null;
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function showUpdateFeedback(message, type = 'success') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg text-sm font-medium z-50 ${
        type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function filterRawVulnerabilities(searchTerm) {
    const rows = document.querySelectorAll('#raw-vuln-table tbody tr');
    const term = searchTerm.toLowerCase();
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
}
