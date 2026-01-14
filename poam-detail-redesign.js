// ═══════════════════════════════════════════════════════════════
// POAM DETAIL VIEW - HYBRID INVESTIGATIVE EXPERIENCE
// ═══════════════════════════════════════════════════════════════

let currentPOAMDetail = null;
let assetViewMode = 'list'; // Default to list for >20 assets
let expandedAssets = new Set();
let expandedSections = new Set(['assets']); // Assets expanded by default

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
    
    // Determine asset view mode based on count
    assetViewMode = (poam.assets?.length || 0) > 20 ? 'list' : 'grid';
    
    // Render the hybrid POAM detail page
    renderHybridPOAMDetailPage(poam);
    
    // Show the detail modal
    document.getElementById('poam-detail-page').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Add click outside to close functionality
    setupModalCloseHandlers();
}

function renderHybridPOAMDetailPage(poam) {
    const detailContainer = document.getElementById('poam-detail-page');
    if (!detailContainer) return;
    
    // Map formal fields to display fields
    const displayPOAM = {
        ...poam,
        risk: poam.riskLevel || poam.risk || 'medium',
        status: poam.findingStatus || poam.status || 'Open',
        vulnerability: poam.vulnerabilityName || poam.vulnerability || poam.title || 'Unknown',
        description: poam.findingDescription || poam.description || '',
        dueDate: poam.updatedScheduledCompletionDate || poam.dueDate || '',
        poc: poam.poc || 'Unassigned',
        controlFamily: poam.controlFamily || 'CM',
        findingSource: poam.findingSource || 'Vulnerability Scan'
    };
    
    const assetCount = poam.totalAffectedAssets || poam.assets?.length || 0;
    
    detailContainer.innerHTML = `
        <!-- Modal Background -->
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50" onclick="closePOAMDetails()"></div>
        
        <!-- Modal Content -->
        <div class="fixed inset-4 bg-white rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
            
            <!-- LAYER 1: COMMAND STRIP (Always Visible) -->
            <div class="bg-slate-900 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div class="flex items-center gap-4">
                    <!-- POAM ID -->
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-mono bg-slate-700 px-2 py-1 rounded">${poam.id}</span>
                    </div>
                    
                    <!-- Title -->
                    <div class="max-w-md">
                        <h1 class="text-lg font-semibold truncate" title="${displayPOAM.vulnerability}">
                            ${displayPOAM.vulnerability}
                        </h1>
                    </div>
                </div>
                
                <div class="flex items-center gap-6">
                    <!-- Risk Badge -->
                    <div class="flex items-center gap-2">
                        ${getRiskBadge(displayPOAM.risk)}
                    </div>
                    
                    <!-- Status (Inline Editable) -->
                    <div class="flex items-center gap-2">
                        <label class="text-xs text-slate-400">Status:</label>
                        <select class="bg-slate-700 text-white text-sm px-3 py-1 rounded border-0 cursor-pointer"
                                onchange="updatePOAMField('${poam.id}', 'findingStatus', this.value)">
                            ${getStatusOptions(displayPOAM.status)}
                        </select>
                    </div>
                    
                    <!-- Asset Count -->
                    <div class="flex items-center gap-2">
                        <i class="fas fa-server text-slate-400"></i>
                        <span class="text-sm">${assetCount} assets</span>
                    </div>
                    
                    <!-- Due Date (Inline Editable) -->
                    <div class="flex items-center gap-2">
                        <label class="text-xs text-slate-400">Due:</label>
                        <input type="date" 
                               value="${displayPOAM.dueDate}" 
                               class="bg-slate-700 text-white text-sm px-2 py-1 rounded border-0 cursor-pointer"
                               onchange="updatePOAMField('${poam.id}', 'updatedScheduledCompletionDate', this.value)">
                    </div>
                    
                    <!-- POC (Inline Editable) -->
                    <div class="flex items-center gap-2">
                        <label class="text-xs text-slate-400">POC:</label>
                        <input type="text" 
                               value="${displayPOAM.poc}" 
                               placeholder="Assign POC"
                               class="bg-slate-700 text-white text-sm px-2 py-1 rounded border-0 cursor-pointer w-24"
                               onchange="updatePOAMField('${poam.id}', 'poc', this.value)">
                    </div>
                    
                    <!-- Close Button -->
                    <button onclick="closePOAMDetails()" 
                            class="text-slate-400 hover:text-white transition-colors">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
            </div>
            
            <!-- Scrollable Content Area -->
            <div class="flex-1 overflow-y-auto">
                
                <!-- LAYER 2: FINDING CONTEXT (Read-Only, Compact) -->
                <div class="bg-slate-50 border-b border-slate-200 px-6 py-4">
                    <div class="grid grid-cols-4 gap-4 text-sm">
                        <!-- Finding Summary -->
                        <div class="col-span-2">
                            <div class="font-semibold text-slate-700 mb-1">Finding Summary</div>
                            <div class="text-slate-600 line-clamp-3">${displayPOAM.description}</div>
                        </div>
                        
                        <!-- Finding Source -->
                        <div>
                            <div class="font-semibold text-slate-700 mb-1">Source</div>
                            <div class="text-slate-600">${displayPOAM.findingSource}</div>
                        </div>
                        
                        <!-- Control Family -->
                        <div>
                            <div class="font-semibold text-slate-700 mb-1">Control Family</div>
                            <div class="text-slate-600">${displayPOAM.controlFamily}</div>
                        </div>
                    </div>
                </div>
                
                <!-- AFFECTED ASSETS (Primary Section) -->
                <div class="px-6 py-4">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-lg font-semibold text-slate-900">Affected Assets (${assetCount})</h2>
                        <div class="flex items-center gap-2">
                            <button onclick="toggleAssetView()" 
                                    class="text-sm px-3 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors">
                                <i class="fas fa-${assetViewMode === 'list' ? 'th-list' : 'th'} mr-1"></i>
                                ${assetViewMode === 'list' ? 'List' : 'Grid'} View
                            </button>
                        </div>
                    </div>
                    
                    ${renderAssetsSection(poam.assets || [])}
                </div>
                
                <!-- LAYER 3: POAM CONTROLS (Secondary, Collapsible) -->
                <div class="px-6 py-4 border-t border-slate-200">
                    <div class="space-y-4">
                        <!-- Schedule & Milestones -->
                        <div class="border border-slate-200 rounded-lg">
                            <button onclick="toggleSection('schedule')" 
                                    class="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between">
                                <span class="font-semibold text-slate-900">
                                    <i class="fas fa-calendar-alt mr-2"></i>Schedule & Milestones
                                </span>
                                <i class="fas fa-chevron-${expandedSections.has('schedule') ? 'up' : 'down'} text-slate-400"></i>
                            </button>
                            ${expandedSections.has('schedule') ? renderScheduleSection(poam) : ''}
                        </div>
                        
                        <!-- Mitigation -->
                        <div class="border border-slate-200 rounded-lg">
                            <button onclick="toggleSection('mitigation')" 
                                    class="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between">
                                <span class="font-semibold text-slate-900">
                                    <i class="fas fa-shield-alt mr-2"></i>Mitigation
                                </span>
                                <i class="fas fa-chevron-${expandedSections.has('mitigation') ? 'up' : 'down'} text-slate-400"></i>
                            </button>
                            ${expandedSections.has('mitigation') ? renderMitigationSection(poam) : ''}
                        </div>
                        
                        <!-- Resources & Completion -->
                        <div class="border border-slate-200 rounded-lg">
                            <button onclick="toggleSection('resources')" 
                                    class="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between">
                                <span class="font-semibold text-slate-900">
                                    <i class="fas fa-tools mr-2"></i>Resources & Completion
                                </span>
                                <i class="fas fa-chevron-${expandedSections.has('resources') ? 'up' : 'down'} text-slate-400"></i>
                            </button>
                            ${expandedSections.has('resources') ? renderResourcesSection(poam) : ''}
                        </div>
                        
                        <!-- Comments -->
                        <div class="border border-slate-200 rounded-lg">
                            <button onclick="toggleSection('comments')" 
                                    class="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between">
                                <span class="font-semibold text-slate-900">
                                    <i class="fas fa-comments mr-2"></i>Comments (${poam.comments?.length || 0})
                                </span>
                                <i class="fas fa-chevron-${expandedSections.has('comments') ? 'up' : 'down'} text-slate-400"></i>
                            </button>
                            ${expandedSections.has('comments') ? renderCommentsSection(poam) : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderAssetsSection(assets) {
    if (!assets || assets.length === 0) {
        return '<div class="text-center text-slate-500 py-8">No affected assets found</div>';
    }
    
    if (assetViewMode === 'list' || assets.length > 20) {
        return renderAssetsList(assets);
    } else {
        return renderAssetsGrid(assets);
    }
}

function renderAssetsList(assets) {
    const headers = ['Asset', 'Status', 'First Detected', 'Last Detected', 'Result', 'Solution', 'Actions'];
    
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
        const isExpanded = expandedAssets.has(asset.id || index);
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
                <td class="px-4 py-3 text-slate-600">${asset.firstDetected || 'N/A'}</td>
                <td class="px-4 py-3 text-slate-600">${asset.lastDetected || 'N/A'}</td>
                <td class="px-4 py-3 text-slate-600">
                    <div class="max-w-xs truncate" title="${asset.result || 'No result data'}">
                        ${asset.result || 'No result data'}
                    </div>
                </td>
                <td class="px-4 py-3 text-slate-600">
                    <div class="max-w-xs truncate" title="${asset.solution || 'No solution data'}">
                        ${asset.solution || 'No solution data'}
                    </div>
                </td>
                <td class="px-4 py-3">
                    <button onclick="toggleAssetExpansion('${assetId}')" 
                            class="text-indigo-600 hover:text-indigo-800 text-sm">
                        <i class="fas fa-${isExpanded ? 'compress' : 'expand'} mr-1"></i>
                        ${isExpanded ? 'Hide' : 'Show'} Raw
                    </button>
                </td>
            </tr>
        `;
        
        if (isExpanded) {
            html += `
                <tr class="bg-slate-50">
                    <td colspan="7" class="px-4 py-3">
                        <div class="bg-slate-900 text-slate-100 p-4 rounded font-mono text-xs overflow-x-auto">
                            <div class="mb-2 font-semibold text-slate-300">Raw Scan Data:</div>
                            <pre>${JSON.stringify(asset.raw || asset, null, 2)}</pre>
                        </div>
                    </td>
                </tr>
            `;
        }
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

function renderAssetsGrid(assets) {
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
    
    assets.forEach((asset, index) => {
        const assetId = asset.id || asset.name || `asset-${index}`;
        
        html += `
            <div class="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-server text-slate-400"></i>
                        <span class="font-medium text-slate-900">${asset.name || asset.assetId || 'Unknown'}</span>
                    </div>
                    <span class="px-2 py-1 rounded-full text-xs font-semibold ${getAssetStatusColor(asset.status)}">
                        ${asset.status || 'affected'}
                    </span>
                </div>
                
                <div class="space-y-1 text-sm text-slate-600">
                    <div><strong>First:</strong> ${asset.firstDetected || 'N/A'}</div>
                    <div><strong>Last:</strong> ${asset.lastDetected || 'N/A'}</div>
                    <div class="truncate"><strong>Result:</strong> ${asset.result || 'No data'}</div>
                </div>
                
                <button onclick="toggleAssetExpansion('${assetId}')" 
                        class="mt-3 text-indigo-600 hover:text-indigo-800 text-sm">
                    <i class="fas fa-expand mr-1"></i>View Raw Data
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function renderScheduleSection(poam) {
    const milestones = poam.milestones || [];
    
    return `
        <div class="p-4 space-y-4">
            <!-- Key Dates -->
            <div class="grid grid-cols-3 gap-4 text-sm">
                <div>
                    <label class="block text-slate-600 mb-1">Initial Scheduled</label>
                    <input type="date" 
                           value="${poam.initialScheduledCompletionDate || ''}" 
                           class="w-full px-3 py-2 border border-slate-300 rounded"
                           onchange="updatePOAMField('${poam.id}', 'initialScheduledCompletionDate', this.value)">
                </div>
                <div>
                    <label class="block text-slate-600 mb-1">Updated Scheduled</label>
                    <input type="date" 
                           value="${poam.updatedScheduledCompletionDate || ''}" 
                           class="w-full px-3 py-2 border border-slate-300 rounded"
                           onchange="updatePOAMField('${poam.id}', 'updatedScheduledCompletionDate', this.value)">
                </div>
                <div>
                    <label class="block text-slate-600 mb-1">Actual Completion</label>
                    <input type="date" 
                           value="${poam.actualCompletionDate || ''}" 
                           class="w-full px-3 py-2 border border-slate-300 rounded"
                           onchange="updatePOAMField('${poam.id}', 'actualCompletionDate', this.value)">
                </div>
            </div>
            
            <!-- Milestones -->
            <div>
                <div class="flex items-center justify-between mb-3">
                    <h4 class="font-semibold text-slate-900">Milestones</h4>
                    <button onclick="addMilestone('${poam.id}')" 
                            class="text-sm px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                        <i class="fas fa-plus mr-1"></i>Add Milestone
                    </button>
                </div>
                
                ${milestones.length === 0 ? 
                    '<div class="text-center text-slate-500 py-4">No milestones defined</div>' :
                    renderMilestonesList(poam.id, milestones)
                }
            </div>
        </div>
    `;
}

function renderMitigationSection(poam) {
    return `
        <div class="p-4">
            <label class="block text-slate-600 mb-2">Mitigation Strategy</label>
            <textarea rows="4" 
                      class="w-full px-3 py-2 border border-slate-300 rounded resize-none"
                      placeholder="Describe mitigation approach..."
                      onchange="updatePOAMField('${poam.id}', 'mitigation', this.value)">${poam.mitigation || ''}</textarea>
        </div>
    `;
}

function renderResourcesSection(poam) {
    return `
        <div class="p-4 space-y-4">
            <div>
                <label class="block text-slate-600 mb-2">Resources Required</label>
                <input type="text" 
                       value="${poam.resourcesRequired || ''}" 
                       placeholder="Personnel, tools, budget..."
                       class="w-full px-3 py-2 border border-slate-300 rounded"
                       onchange="updatePOAMField('${poam.id}', 'resourcesRequired', this.value)">
            </div>
            
            <div>
                <label class="block text-slate-600 mb-2">Notes</label>
                <textarea rows="3" 
                          class="w-full px-3 py-2 border border-slate-300 rounded resize-none"
                          placeholder="Additional notes..."
                          onchange="updatePOAMField('${poam.id}', 'notes', this.value)">${poam.notes || ''}</textarea>
            </div>
        </div>
    `;
}

function renderCommentsSection(poam) {
    const comments = poam.comments || [];
    
    return `
        <div class="p-4">
            <div class="mb-4">
                <textarea rows="2" 
                          id="new-comment-${poam.id}"
                          class="w-full px-3 py-2 border border-slate-300 rounded resize-none"
                          placeholder="Add a comment..."></textarea>
                <button onclick="addComment('${poam.id}')" 
                        class="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                    <i class="fas fa-comment mr-1"></i>Add Comment
                </button>
            </div>
            
            ${comments.length === 0 ? 
                '<div class="text-center text-slate-500 py-4">No comments yet</div>' :
                renderCommentsList(comments)
            }
        </div>
    `;
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
    return statuses.map(status => 
        `<option value="${status.toLowerCase().replace(' ', '-')}" ${currentStatus.toLowerCase() === status.toLowerCase() ? 'selected' : ''}>${status}</option>`
    ).join('');
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

function toggleSection(sectionId) {
    if (expandedSections.has(sectionId)) {
        expandedSections.delete(sectionId);
    } else {
        expandedSections.add(sectionId);
    }
    renderHybridPOAMDetailPage(currentPOAMDetail);
}

function toggleAssetView() {
    assetViewMode = assetViewMode === 'list' ? 'grid' : 'list';
    renderHybridPOAMDetailPage(currentPOAMDetail);
}

function toggleAssetExpansion(assetId) {
    if (expandedAssets.has(assetId)) {
        expandedAssets.delete(assetId);
    } else {
        expandedAssets.add(assetId);
    }
    renderHybridPOAMDetailPage(currentPOAMDetail);
}

function closePOAMDetails() {
    document.getElementById('poam-detail-page').classList.add('hidden');
    document.body.style.overflow = 'auto';
    currentPOAMDetail = null;
    expandedAssets.clear();
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
        }
        
        // Refresh if needed
        if (currentPOAMDetail && currentPOAMDetail.id === poamId) {
            currentPOAMDetail = poam;
        }
        
    } catch (error) {
        console.error('Failed to update field:', error);
        showUpdateFeedback('Failed to update field', 'error');
    }
}

// Placeholder functions for milestones and comments
function addMilestone(poamId) {
    console.log('Add milestone for:', poamId);
    showUpdateFeedback('Milestone feature coming soon', 'info');
}

function addComment(poamId) {
    const textarea = document.getElementById(`new-comment-${poamId}`);
    const text = textarea.value.trim();
    
    if (!text) return;
    
    console.log('Add comment for:', poamId, text);
    showUpdateFeedback('Comment feature coming soon', 'info');
    textarea.value = '';
}

function renderMilestonesList(poamId, milestones) {
    return `
        <div class="space-y-2">
            ${milestones.map(milestone => `
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded">
                    <div>
                        <div class="font-medium text-slate-900">${milestone.name}</div>
                        <div class="text-sm text-slate-600">${milestone.targetDate}</div>
                    </div>
                    <span class="px-2 py-1 rounded-full text-xs ${milestone.completed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                        ${milestone.completed ? 'Completed' : 'Pending'}
                    </span>
                </div>
            `).join('')}
        </div>
    `;
}

function renderCommentsList(comments) {
    return `
        <div class="space-y-3">
            ${comments.map(comment => `
                <div class="border-l-4 border-indigo-200 pl-4 py-2">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-medium text-slate-900">${comment.author}</span>
                        <span class="text-xs text-slate-500">${new Date(comment.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="text-sm text-slate-700">${comment.text}</div>
                </div>
            `).join('')}
        </div>
    `;
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
