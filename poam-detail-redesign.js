// POAM Detail View - Redesigned for Fast Investigation and Traceability
// Optimized for minimal clicks, inline editing, and 1:1 scan data mapping

let currentPOAMDetail = null;
let assetViewMode = 'tiles'; // 'tiles' or 'list'
let expandedAssets = new Set();

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY POINT - Show POAM Detail
// ═══════════════════════════════════════════════════════════════

async function showPOAMDetails(poamId) {
    console.log(`🔍 Loading POAM details for: ${poamId}`);
    
    // Get POAM from IndexedDB
    const poam = await poamDB.getPOAM(poamId);
    if (!poam) {
        console.error('POAM not found:', poamId);
        return;
    }
    
    currentPOAMDetail = poam;
    
    // Determine default view mode based on asset count
    const assetCount = poam.totalAffectedAssets || poam.assetCount || 0;
    assetViewMode = assetCount <= 20 ? 'tiles' : 'list';
    
    // Render the page
    renderPOAMDetailPage(poam);
    
    // Show the detail page
    document.getElementById('poam-detail-page').classList.remove('hidden');
    document.getElementById('vulnerability-tracking-module').classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════════
// RENDER POAM DETAIL PAGE
// ═══════════════════════════════════════════════════════════════

function renderPOAMDetailPage(poam) {
    const container = document.getElementById('poam-detail-content');
    
    const riskColors = {
        'critical': 'bg-red-100 text-red-700 border-red-300',
        'high': 'bg-orange-100 text-orange-700 border-orange-300',
        'medium': 'bg-yellow-100 text-yellow-700 border-yellow-300',
        'low': 'bg-green-100 text-green-700 border-green-300'
    };
    
    const confidenceColors = {
        'High': 'bg-green-100 text-green-700',
        'Medium': 'bg-yellow-100 text-yellow-700',
        'Low': 'bg-red-100 text-red-700'
    };
    
    container.innerHTML = `
        <!-- Sticky Header (Control Strip) -->
        <div class="sticky top-0 z-40 bg-white border-b-2 border-indigo-600 shadow-md">
            <div class="px-6 py-4">
                <div class="flex items-start justify-between gap-4">
                    <!-- Left: POAM ID and Title -->
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <button onclick="closePOAMDetail()" class="text-slate-600 hover:text-slate-900">
                                <i class="fas fa-arrow-left text-lg"></i>
                            </button>
                            <h1 class="text-2xl font-bold text-slate-900">${poam.id}</h1>
                            <span class="px-3 py-1 rounded-full text-sm font-semibold border-2 ${riskColors[poam.risk] || riskColors['medium']}">
                                ${(poam.risk || 'medium').toUpperCase()}
                            </span>
                            ${poam.confidenceLevel ? `
                                <span class="px-3 py-1 rounded-full text-sm font-semibold ${confidenceColors[poam.confidenceLevel]}">
                                    ${poam.confidenceLevel} Confidence
                                </span>
                            ` : ''}
                            ${poam.needsReview ? `
                                <span class="px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-700">
                                    <i class="fas fa-exclamation-triangle mr-1"></i>Needs Review
                                </span>
                            ` : ''}
                        </div>
                        <h2 class="text-lg text-slate-700 font-medium">${poam.title || poam.vulnerability}</h2>
                    </div>
                    
                    <!-- Right: Key Metrics -->
                    <div class="flex items-center gap-6 text-sm">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-indigo-600">${poam.totalAffectedAssets || poam.assetCount || 0}</div>
                            <div class="text-xs text-slate-600">Total Assets</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-red-600">${poam.breachedAssets || 0}</div>
                            <div class="text-xs text-slate-600">Breached</div>
                        </div>
                        <div class="text-center">
                            <div class="text-lg font-semibold text-slate-700">${poam.dueDate || 'N/A'}</div>
                            <div class="text-xs text-slate-600">Due Date</div>
                        </div>
                    </div>
                </div>
                
                <!-- Inline Editable Fields -->
                <div class="mt-4 flex items-center gap-6 text-sm">
                    <div class="flex items-center gap-2">
                        <span class="text-slate-600 font-medium">Status:</span>
                        <select 
                            onchange="updatePOAMField('${poam.id}', 'status', this.value)"
                            class="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                            <option value="open" ${poam.status === 'open' ? 'selected' : ''}>Open</option>
                            <option value="in-progress" ${poam.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                            <option value="risk-accepted" ${poam.status === 'risk-accepted' ? 'selected' : ''}>Risk Accepted</option>
                            <option value="extended" ${poam.status === 'extended' ? 'selected' : ''}>Extended</option>
                            <option value="completed" ${poam.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="closed" ${poam.status === 'closed' ? 'selected' : ''}>Closed</option>
                        </select>
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <span class="text-slate-600 font-medium">POC:</span>
                        <select 
                            onchange="updatePOAMField('${poam.id}', 'poc', this.value)"
                            class="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                            <option value="Unassigned">Unassigned</option>
                            <option value="Windows Systems Team" ${poam.poc === 'Windows Systems Team' ? 'selected' : ''}>Windows Systems Team</option>
                            <option value="Linux Systems Team" ${poam.poc === 'Linux Systems Team' ? 'selected' : ''}>Linux Systems Team</option>
                            <option value="Network Engineering Team" ${poam.poc === 'Network Engineering Team' ? 'selected' : ''}>Network Engineering Team</option>
                            <option value="Desktop Engineering Team" ${poam.poc === 'Desktop Engineering Team' ? 'selected' : ''}>Desktop Engineering Team</option>
                            <option value="Application Development Team" ${poam.poc === 'Application Development Team' ? 'selected' : ''}>Application Development Team</option>
                            <option value="Network Security Team" ${poam.poc === 'Network Security Team' ? 'selected' : ''}>Network Security Team</option>
                        </select>
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <span class="text-slate-600 font-medium">Due Date:</span>
                        <input 
                            type="date" 
                            value="${poam.dueDate || ''}"
                            onchange="updatePOAMField('${poam.id}', 'dueDate', this.value)"
                            class="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Single Column Content Body -->
        <div class="px-6 py-6 space-y-6">
            
            <!-- Collapsible POAM Metadata -->
            <div class="bg-white rounded-lg border border-slate-200">
                <button 
                    onclick="toggleSection('poam-metadata')"
                    class="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                    <h3 class="text-lg font-semibold text-slate-900">POAM Details</h3>
                    <i id="poam-metadata-icon" class="fas fa-chevron-down text-slate-400"></i>
                </button>
                <div id="poam-metadata" class="hidden px-6 py-4 border-t border-slate-200">
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><strong>Source:</strong> ${poam.source || 'N/A'}</div>
                        <div><strong>Created Date:</strong> ${poam.createdDate ? new Date(poam.createdDate).toLocaleDateString() : 'N/A'}</div>
                        <div><strong>Risk Level:</strong> ${(poam.risk || 'medium').toUpperCase()}</div>
                        <div><strong>Status:</strong> ${poam.status || 'open'}</div>
                        <div><strong>SLA Days:</strong> ${poam.slaDays || 'N/A'}</div>
                        <div><strong>Days Overdue:</strong> ${poam.daysOverdue || 0}</div>
                    </div>
                </div>
            </div>
            
            <!-- Description & Remediation (Structured) -->
            <div class="bg-white rounded-lg border border-slate-200 p-6">
                <h3 class="text-lg font-semibold text-slate-900 mb-4">Description & Remediation</h3>
                
                <div class="space-y-4">
                    <div>
                        <h4 class="text-sm font-semibold text-slate-700 mb-1">Summary</h4>
                        <p class="text-sm text-slate-600">${poam.summary || generateSummary(poam)}</p>
                    </div>
                    
                    <div>
                        <h4 class="text-sm font-semibold text-slate-700 mb-1">SLA Status</h4>
                        <p class="text-sm text-slate-600">
                            Oldest detection: ${poam.firstDetected || 'N/A'} | 
                            ${poam.daysOverdue > 0 ? `<span class="text-red-600 font-semibold">${poam.daysOverdue} days overdue</span>` : 'Within SLA'}
                        </p>
                    </div>
                    
                    <div>
                        <h4 class="text-sm font-semibold text-slate-700 mb-1">Required Remediation</h4>
                        <p class="text-sm text-slate-600">${poam.remediationAction || 'See asset-specific solutions below'}</p>
                    </div>
                    
                    <div>
                        <h4 class="text-sm font-semibold text-slate-700 mb-1">Validation Method</h4>
                        <p class="text-sm text-slate-600">${poam.validationMethod || 'Rescan to verify remediation'}</p>
                    </div>
                </div>
            </div>
            
            <!-- Inline Notes Section -->
            <div class="bg-white rounded-lg border border-slate-200 p-6">
                <h3 class="text-lg font-semibold text-slate-900 mb-4">Notes</h3>
                <textarea 
                    id="poam-notes-${poam.id}"
                    rows="3"
                    placeholder="Add notes or comments..."
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    onblur="savePOAMNotes('${poam.id}')">${(poam.notes || []).map(n => `${n.timestamp}: ${n.text}`).join('\n')}</textarea>
            </div>
            
            <!-- Affected Assets Section -->
            ${renderAffectedAssetsSection(poam)}
            
            <!-- Raw Vulnerabilities Section -->
            ${renderRawVulnerabilitiesSection(poam)}
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// AFFECTED ASSETS SECTION
// ═══════════════════════════════════════════════════════════════

function renderAffectedAssetsSection(poam) {
    const assets = poam.affectedAssets || [];
    const assetCount = assets.length;
    
    return `
        <div class="bg-white rounded-lg border border-slate-200">
            <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 class="text-lg font-semibold text-slate-900">
                    Affected Assets (${assetCount})
                </h3>
                
                <!-- View Toggle -->
                <div class="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                    <button 
                        onclick="switchAssetView('tiles')"
                        class="px-3 py-1 rounded ${assetViewMode === 'tiles' ? 'bg-white shadow' : ''} text-sm">
                        <i class="fas fa-th mr-1"></i>Tiles
                    </button>
                    <button 
                        onclick="switchAssetView('list')"
                        class="px-3 py-1 rounded ${assetViewMode === 'list' ? 'bg-white shadow' : ''} text-sm">
                        <i class="fas fa-list mr-1"></i>List
                    </button>
                </div>
            </div>
            
            <div id="assets-container" class="p-6">
                ${assetViewMode === 'tiles' ? renderAssetTiles(poam) : renderAssetList(poam)}
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// ASSET TILES VIEW
// ═══════════════════════════════════════════════════════════════

function renderAssetTiles(poam) {
    const assets = poam.affectedAssets || [];
    const rawFindings = poam.rawFindings || [];
    
    if (assets.length === 0) {
        return '<p class="text-slate-500 text-center py-8">No affected assets</p>';
    }
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${assets.map((asset, index) => {
                const assetFindings = rawFindings.filter(f => f.asset === asset);
                const status = getAssetStatus(asset, poam);
                const statusColors = {
                    'Breached': 'bg-red-100 text-red-700 border-red-300',
                    'Active': 'bg-yellow-100 text-yellow-700 border-yellow-300',
                    'Within SLA': 'bg-green-100 text-green-700 border-green-300'
                };
                
                return `
                    <div class="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                         onclick="expandAssetInline('${asset}', ${index})">
                        <div class="flex items-start justify-between mb-2">
                            <h4 class="font-semibold text-slate-900 text-sm">${asset}</h4>
                            <span class="px-2 py-1 rounded text-xs font-semibold border ${statusColors[status] || statusColors['Active']}">
                                ${status}
                            </span>
                        </div>
                        <div class="text-xs text-slate-600">
                            ${assetFindings.length} finding(s)
                        </div>
                        <div class="mt-2 text-xs text-indigo-600">
                            <i class="fas fa-chevron-down mr-1"></i>Click to expand
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// ASSET LIST VIEW (PRIMARY FOR SCALE)
// ═══════════════════════════════════════════════════════════════

function renderAssetList(poam) {
    const assets = poam.affectedAssets || [];
    const rawFindings = poam.rawFindings || [];
    
    if (assets.length === 0) {
        return '<p class="text-slate-500 text-center py-8">No affected assets</p>';
    }
    
    return `
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Asset Name</th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">First Detected</th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Last Detected</th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Result</th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Solution</th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody id="asset-list-body">
                    ${assets.map((asset, index) => renderAssetRow(asset, index, poam, rawFindings)).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderAssetRow(asset, index, poam, rawFindings) {
    const assetFindings = rawFindings.filter(f => f.asset === asset);
    const firstFinding = assetFindings[0] || {};
    const status = getAssetStatus(asset, poam);
    const isExpanded = expandedAssets.has(asset);
    
    const statusColors = {
        'Breached': 'bg-red-100 text-red-700',
        'Active': 'bg-yellow-100 text-yellow-700',
        'Within SLA': 'bg-green-100 text-green-700'
    };
    
    return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" 
            onclick="toggleAssetExpansion('${asset}', ${index})"
            id="asset-row-${index}">
            <td class="px-4 py-3 font-medium text-slate-900">
                <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} text-xs text-slate-400 mr-2"></i>
                ${asset}
            </td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 rounded text-xs font-semibold ${statusColors[status] || statusColors['Active']}">
                    ${status}
                </span>
            </td>
            <td class="px-4 py-3 text-slate-600">${firstFinding.firstDetected || 'N/A'}</td>
            <td class="px-4 py-3 text-slate-600">${firstFinding.lastDetected || 'N/A'}</td>
            <td class="px-4 py-3 text-slate-600 max-w-xs truncate" title="${firstFinding.result || 'N/A'}">
                ${firstFinding.result || 'N/A'}
            </td>
            <td class="px-4 py-3 text-slate-600 max-w-xs truncate" title="${firstFinding.solution || 'N/A'}">
                ${firstFinding.solution || 'N/A'}
            </td>
            <td class="px-4 py-3">
                <button class="text-indigo-600 hover:text-indigo-800 text-xs" onclick="event.stopPropagation(); viewRawData('${asset}')">
                    <i class="fas fa-file-alt mr-1"></i>Raw
                </button>
            </td>
        </tr>
        ${isExpanded ? renderAssetExpansion(asset, assetFindings) : ''}
    `;
}

// ═══════════════════════════════════════════════════════════════
// ASSET ROW EXPANSION (INLINE)
// ═══════════════════════════════════════════════════════════════

function renderAssetExpansion(asset, findings) {
    if (findings.length === 0) {
        return `
            <tr class="bg-slate-50" id="asset-expansion-${asset}">
                <td colspan="7" class="px-4 py-4">
                    <p class="text-slate-500 text-sm">No detailed findings available for this asset</p>
                </td>
            </tr>
        `;
    }
    
    return `
        <tr class="bg-slate-50" id="asset-expansion-${asset}">
            <td colspan="7" class="px-4 py-4">
                <div class="space-y-4">
                    ${findings.map((finding, idx) => `
                        <div class="bg-white rounded-lg border border-slate-200 p-4">
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <h5 class="font-semibold text-slate-700 mb-1">Vulnerability Title</h5>
                                    <p class="text-slate-600">${finding.title || 'N/A'}</p>
                                </div>
                                <div>
                                    <h5 class="font-semibold text-slate-700 mb-1">CVE(s)</h5>
                                    <p class="text-slate-600">${finding.cves ? finding.cves.join(', ') : 'N/A'}</p>
                                </div>
                                <div class="col-span-2">
                                    <h5 class="font-semibold text-slate-700 mb-1">Result (Asset-Specific)</h5>
                                    <p class="text-slate-600 font-mono text-xs bg-slate-50 p-2 rounded">${finding.result || 'N/A'}</p>
                                </div>
                                <div class="col-span-2">
                                    <h5 class="font-semibold text-slate-700 mb-1">Solution (Exact from Scan)</h5>
                                    <p class="text-slate-600">${finding.solution || 'N/A'}</p>
                                </div>
                                <div>
                                    <h5 class="font-semibold text-slate-700 mb-1">First Detected</h5>
                                    <p class="text-slate-600">${finding.firstDetected || 'N/A'}</p>
                                </div>
                                <div>
                                    <h5 class="font-semibold text-slate-700 mb-1">Last Detected</h5>
                                    <p class="text-slate-600">${finding.lastDetected || 'N/A'}</p>
                                </div>
                                ${finding.qid ? `
                                    <div>
                                        <h5 class="font-semibold text-slate-700 mb-1">QID</h5>
                                        <p class="text-slate-600">${finding.qid}</p>
                                    </div>
                                ` : ''}
                                ${finding.port ? `
                                    <div>
                                        <h5 class="font-semibold text-slate-700 mb-1">Port</h5>
                                        <p class="text-slate-600">${finding.port}</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </td>
        </tr>
    `;
}

// ═══════════════════════════════════════════════════════════════
// RAW VULNERABILITIES SECTION
// ═══════════════════════════════════════════════════════════════

function renderRawVulnerabilitiesSection(poam) {
    const rawFindings = poam.rawFindings || [];
    
    if (rawFindings.length === 0) {
        return '';
    }
    
    return `
        <div class="bg-white rounded-lg border border-slate-200">
            <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 class="text-lg font-semibold text-slate-900">
                    Raw Vulnerabilities (${rawFindings.length})
                </h3>
                <div class="flex items-center gap-2">
                    <input 
                        type="text" 
                        id="raw-vuln-search"
                        placeholder="Search vulnerabilities..."
                        class="px-3 py-1 border border-slate-300 rounded-lg text-sm"
                        oninput="filterRawVulnerabilities(this.value)">
                    <button onclick="exportRawVulnerabilities('${poam.id}')" class="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                        <i class="fas fa-download mr-1"></i>Export
                    </button>
                </div>
            </div>
            
            <div class="overflow-x-auto max-h-96">
                <table class="w-full text-sm" id="raw-vuln-table">
                    <thead class="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Asset</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Title</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">CVE</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Severity</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rawFindings.map((finding, idx) => {
                            const isBreached = finding.sla && finding.sla.breached;
                            return `
                                <tr class="border-b border-slate-100 hover:bg-slate-50 ${isBreached ? 'bg-red-50' : ''}" data-asset="${finding.asset}">
                                    <td class="px-4 py-3 font-medium text-slate-900">
                                        <button onclick="jumpToAsset('${finding.asset}')" class="text-indigo-600 hover:underline">
                                            ${finding.asset}
                                        </button>
                                    </td>
                                    <td class="px-4 py-3 text-slate-600">${finding.title || 'N/A'}</td>
                                    <td class="px-4 py-3 text-slate-600">${finding.cves ? finding.cves.join(', ') : 'N/A'}</td>
                                    <td class="px-4 py-3">${finding.severity || 'N/A'}</td>
                                    <td class="px-4 py-3">
                                        ${isBreached ? '<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">Breached</span>' : '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">Within SLA</span>'}
                                    </td>
                                    <td class="px-4 py-3">
                                        <button onclick="viewFindingDetails(${idx})" class="text-indigo-600 hover:text-indigo-800 text-xs">
                                            <i class="fas fa-eye mr-1"></i>View
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getAssetStatus(asset, poam) {
    if (poam.breachedAssetsList && poam.breachedAssetsList.includes(asset)) {
        return 'Breached';
    }
    if (poam.activeAssetsList && poam.activeAssetsList.includes(asset)) {
        return 'Active';
    }
    if (poam.withinSlaAssets && poam.withinSlaAssets.includes(asset)) {
        return 'Within SLA';
    }
    return 'Active';
}

function generateSummary(poam) {
    const assetCount = poam.totalAffectedAssets || poam.assetCount || 0;
    const breached = poam.breachedAssets || 0;
    return `${assetCount} asset(s) affected with ${breached} breached SLA requiring immediate attention.`;
}

function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const icon = document.getElementById(`${sectionId}-icon`);
    
    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        section.classList.add('hidden');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}

function switchAssetView(mode) {
    assetViewMode = mode;
    const container = document.getElementById('assets-container');
    container.innerHTML = mode === 'tiles' ? renderAssetTiles(currentPOAMDetail) : renderAssetList(currentPOAMDetail);
}

function toggleAssetExpansion(asset, index) {
    if (expandedAssets.has(asset)) {
        expandedAssets.delete(asset);
    } else {
        expandedAssets.add(asset);
    }
    
    // Re-render asset list to show/hide expansion
    const container = document.getElementById('assets-container');
    container.innerHTML = renderAssetList(currentPOAMDetail);
}

function jumpToAsset(asset) {
    // Switch to list view if not already
    if (assetViewMode !== 'list') {
        switchAssetView('list');
    }
    
    // Expand the asset
    expandedAssets.add(asset);
    
    // Re-render and scroll
    const container = document.getElementById('assets-container');
    container.innerHTML = renderAssetList(currentPOAMDetail);
    
    // Scroll to asset
    setTimeout(() => {
        const assetRow = document.querySelector(`[onclick*="${asset}"]`);
        if (assetRow) {
            assetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            assetRow.classList.add('bg-indigo-50');
            setTimeout(() => assetRow.classList.remove('bg-indigo-50'), 2000);
        }
    }, 100);
}

async function updatePOAMField(poamId, field, value) {
    try {
        const poam = await poamDB.getPOAM(poamId);
        if (!poam) return;
        
        poam[field] = value;
        if (field === 'poc') poam.pocTeam = value;
        
        await poamDB.savePOAM(poam);
        currentPOAMDetail = poam;
        
        showUpdateFeedback(`${field} updated successfully`, 'success');
    } catch (error) {
        console.error('Failed to update POAM:', error);
        showUpdateFeedback('Failed to update', 'error');
    }
}

async function savePOAMNotes(poamId) {
    const textarea = document.getElementById(`poam-notes-${poamId}`);
    const noteText = textarea.value.trim();
    
    if (!noteText) return;
    
    try {
        const poam = await poamDB.getPOAM(poamId);
        if (!poam) return;
        
        if (!poam.notes) poam.notes = [];
        
        poam.notes.push({
            text: noteText,
            timestamp: new Date().toISOString(),
            author: 'Admin User'
        });
        
        await poamDB.savePOAM(poam);
        showUpdateFeedback('Note saved', 'success');
    } catch (error) {
        console.error('Failed to save note:', error);
        showUpdateFeedback('Failed to save note', 'error');
    }
}

function closePOAMDetail() {
    document.getElementById('poam-detail-page').classList.add('hidden');
    document.getElementById('vulnerability-tracking-module').classList.remove('hidden');
    expandedAssets.clear();
}

function filterRawVulnerabilities(searchTerm) {
    const rows = document.querySelectorAll('#raw-vuln-table tbody tr');
    const term = searchTerm.toLowerCase();
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
}

function exportRawVulnerabilities(poamId) {
    // Export functionality
    console.log('Exporting raw vulnerabilities for POAM:', poamId);
    showUpdateFeedback('Export started', 'success');
}

function viewRawData(asset) {
    console.log('Viewing raw data for asset:', asset);
}

function viewFindingDetails(index) {
    console.log('Viewing finding details:', index);
}

function expandAssetInline(asset, index) {
    jumpToAsset(asset);
}
