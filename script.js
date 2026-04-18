// TRACE - Tracking Remediation & Compliance Efficiently

// Cache-busting mechanism: Force reload when storage is cleared
(function initCacheBuster() {
    const CACHE_VERSION_KEY = 'poamNexusCacheVersion';
    const CURRENT_VERSION = '20260317-clearfix'; // Update this when code changes
    
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    
    if (!storedVersion) {
        // First run or storage was cleared - set version and continue
        localStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION);
    } else if (storedVersion !== CURRENT_VERSION) {
        // Version mismatch - force hard reload to get latest code
        console.log(`🔄 Cache version mismatch (stored: ${storedVersion}, current: ${CURRENT_VERSION}) - forcing reload...`);
        localStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION);
        window.location.reload(true);
    }
})();

// Module navigation
function showModule(moduleName) {
    // Scan History is now inside Evidence Vault — redirect before any DOM work
    if (moduleName === 'scan-history') {
        showModule('evidence');
        showEvidenceTab('scan-history');
        return;
    }

    // Save current module to localStorage for page refresh persistence
    localStorage.setItem('currentModule', moduleName);
    
    // Hide all modules
    const modules = document.querySelectorAll('.module');
    modules.forEach(module => {
        module.classList.add('hidden');
    });
    
    // Show selected module with error handling
    const targetModule = document.getElementById(moduleName + '-module');
    if (targetModule) {
        targetModule.classList.remove('hidden');
        // If a module ends up with a 0x0 rect (common when layout collapses), force a sane box.
        requestAnimationFrame(() => {
            try {
                const rect = targetModule.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                    targetModule.style.display = 'block';
                    targetModule.style.width = '100%';
                    targetModule.style.minHeight = '600px';
                    targetModule.style.paddingBottom = '24px';
                }
            } catch (e) {
                console.error('❌ Post-showModule layout normalization failed:', e);
            }
        });
    } else {
        console.warn(`Module '${moduleName}' not found in showModule`);
        // Default to dashboard if requested module doesn't exist
        const dashboardModule = document.getElementById('dashboard-module');
        if (dashboardModule) {
            dashboardModule.classList.remove('hidden');
        }
        // Clear the invalid module from localStorage
        localStorage.removeItem('currentModule');
        return;
    }
    
    // Load module-specific data
    if (moduleName === 'dashboard') {
        if (typeof loadDashboardMetrics === 'function') loadDashboardMetrics();
    } else if (moduleName === 'poam') {
        // Load POAM ID configuration when POAM Repository is shown
        loadPOAMIdConfig();
        updateApplicationPOAMCounts();
    } else if (moduleName === 'vulnerability' || moduleName === 'vulnerability-tracking') {
        // Initialize vulnerability tracking and load existing POAMs
        if (typeof showVulnerabilityTab === 'function') showVulnerabilityTab('upload');
        if (typeof displayVulnerabilityPOAMs === 'function') displayVulnerabilityPOAMs();
        if (typeof updateVulnerabilityModuleMetrics === 'function') updateVulnerabilityModuleMetrics();
    } else if (moduleName === 'evidence') {
        // Load evidence vault data, default to evidence tab
        showEvidenceTab('evidence');
        loadEvidenceFiles();
    } else if (moduleName === 'reporting') {
        // Load reporting data
        loadReportingData();
    } else if (moduleName === 'audit') {
        // Load audit log
        if (typeof loadAuditModule === 'function') loadAuditModule();
    } else if (moduleName === 'security-control-monitoring') {
        // Initialize Security Control Monitoring (Workbook) module
        if (typeof initPOAMWorkbookModule === 'function') {
            initPOAMWorkbookModule();
        }
    } else if (moduleName === 'settings') {
        // Load settings including risk framework
        loadRiskFramework();
        loadPOAMIdConfig();
    }
    
    // Highlight active sidebar link
    const allSidebarLinks = document.querySelectorAll('.sidebar-link, .sb-item');
    allSidebarLinks.forEach(link => {
        link.classList.remove('active', 'bg-indigo-600', 'text-white', 'text-slate-400', 'text-slate-100');
    });

    // Add active state to the matching sidebar link
    const activeLink = document.querySelector(`[onclick="showModule('${moduleName}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// Switch tabs within the Evidence Vault module
function showEvidenceTab(tab) {
    const evidencePanel = document.getElementById('evidence-panel-evidence');
    const scanHistoryPanel = document.getElementById('evidence-panel-scan-history');
    const evTab = document.getElementById('ev-tab-evidence');
    const shTab = document.getElementById('ev-tab-scan-history');
    if (tab === 'scan-history') {
        if (evidencePanel) evidencePanel.classList.add('hidden');
        if (scanHistoryPanel) scanHistoryPanel.classList.remove('hidden');
        if (evTab) evTab.classList.remove('active');
        if (shTab) shTab.classList.add('active');
        renderScanHistory();
    } else {
        if (evidencePanel) evidencePanel.classList.remove('hidden');
        if (scanHistoryPanel) scanHistoryPanel.classList.add('hidden');
        if (evTab) evTab.classList.add('active');
        if (shTab) shTab.classList.remove('active');
    }
}

// Placeholder functions for other modules
// loadEvidenceFiles lives in modules/data-processing.js

function loadReportingData() {
    console.log('Loading reporting data...');
    if (typeof loadReportingModule === 'function') loadReportingModule();
    if (typeof loadReportingPageMetrics === 'function') loadReportingPageMetrics();
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL ASSETS REGISTRY (Settings Tab)
// ═══════════════════════════════════════════════════════════════

async function loadCriticalAssetsRegistry() {
    console.log('🛡️ Loading critical assets registry...');
    try {
        if (!poamDB || !poamDB.db) await poamDB.init();
        const assets = await poamDB.getCriticalAssets();
        renderCriticalAssetsTable(assets);
    } catch (err) {
        console.error('❌ Failed to load critical assets:', err);
    }
}

function renderCriticalAssetsTable(assets) {
    const tbody = document.getElementById('ca-registry-table-body');
    if (!tbody) return;

    if (!assets || assets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-400">No critical assets registered</td></tr>';
        return;
    }

    const tagColors = {
        'publicly-exposed': 'bg-red-50 text-red-600 border-red-200',
        'critical-infrastructure': 'bg-purple-50 text-purple-600 border-purple-200',
        'pii-phi': 'bg-blue-50 text-blue-600 border-blue-200',
        'high-value-target': 'bg-amber-50 text-amber-600 border-amber-200'
    };

    tbody.innerHTML = assets.map(a => {
        const tags = (a.tags || []).map(t =>
            `<span class="text-[10px] font-medium px-1.5 py-0.5 rounded border ${tagColors[t] || 'bg-slate-50 text-slate-500 border-slate-200'}">${t}</span>`
        ).join(' ');
        const date = a.addedDate ? new Date(a.addedDate).toLocaleDateString() : '—';
        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="py-2 px-3 font-medium text-slate-700">${escapeHtmlSafe(a.name || a.hostname || '—')}</td>
                <td class="py-2 px-3 font-mono text-xs text-slate-500">${escapeHtmlSafe(a.ip || '—')}</td>
                <td class="py-2 px-3">${tags || '<span class="text-slate-400 text-xs">No tags</span>'}</td>
                <td class="py-2 px-3 text-xs text-slate-500 max-w-xs truncate">${escapeHtmlSafe(a.notes || '—')}</td>
                <td class="py-2 px-3 text-xs text-slate-400">${date}</td>
                <td class="py-2 px-3 text-center">
                    <button onclick="deleteCriticalAssetUI('${a.id}')" class="text-xs text-red-400 hover:text-red-600 font-medium"><i class="fas fa-trash mr-1"></i>Remove</button>
                </td>
            </tr>`;
    }).join('');
}

async function addCriticalAssetFromForm() {
    const name = document.getElementById('ca-name')?.value?.trim();
    const ip = document.getElementById('ca-ip')?.value?.trim();
    const notes = document.getElementById('ca-notes')?.value?.trim();

    if (!name && !ip) {
        alert('Please enter at least a name/hostname or IP address.');
        return;
    }

    const tags = [];
    document.querySelectorAll('.ca-tag-checkbox:checked').forEach(cb => tags.push(cb.value));

    try {
        if (!poamDB || !poamDB.db) await poamDB.init();
        await poamDB.addCriticalAsset({ name, hostname: name, ip, tags, notes });

        // Clear form
        if (document.getElementById('ca-name')) document.getElementById('ca-name').value = '';
        if (document.getElementById('ca-ip')) document.getElementById('ca-ip').value = '';
        if (document.getElementById('ca-notes')) document.getElementById('ca-notes').value = '';
        document.querySelectorAll('.ca-tag-checkbox').forEach(cb => cb.checked = false);

        await loadCriticalAssetsRegistry();
        console.log(`✅ Critical asset added: ${name || ip}`);
    } catch (err) {
        console.error('❌ Failed to add critical asset:', err);
        alert(`Failed to add critical asset: ${err.message}`);
    }
}

async function deleteCriticalAssetUI(id) {
    if (!confirm('Remove this critical asset from the registry?')) return;
    try {
        if (!poamDB || !poamDB.db) await poamDB.init();
        await poamDB.deleteCriticalAsset(id);
        await loadCriticalAssetsRegistry();
        console.log(`🗑️ Critical asset removed: ${id}`);
    } catch (err) {
        console.error('❌ Failed to delete critical asset:', err);
    }
}

function escapeHtmlSafe(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// View Management Functions
let currentView = 'governance'; // 'governance' or 'application'

function toggleViewMode() {
    if (!currentApplication) {
        alert('Please select an application first.');
        return;
    }
    
    const toggleBtn = document.getElementById('view-mode-toggle');
    const governanceView = document.getElementById('governance-view');
    const applicationView = document.getElementById('application-view');
    
    if (currentView === 'governance') {
        // Switch to application view
        currentView = 'application';
        governanceView.style.display = 'none';
        applicationView.style.display = 'block';
        toggleBtn.innerHTML = '<i class="fas fa-exchange-alt mr-1"></i>Switch to Governance View';
        
        // Load application-specific data
        loadApplicationDashboard();
        loadApplicationPOAMList();
    } else {
        // Switch to governance view
        currentView = 'governance';
        applicationView.style.display = 'none';
        governanceView.style.display = 'block';
        toggleBtn.innerHTML = '<i class="fas fa-exchange-alt mr-1"></i>Switch to App View';
    }
}

function loadApplicationDashboard() {
    if (!currentApplication) return;
    
    // Get POAMs for this application
    const allPOAMs = JSON.parse(localStorage.getItem('poamData') || '{}');
    const appPOAMs = Object.values(allPOAMs).filter(poam => poam.application === currentApplication);
    
    // Calculate metrics
    const totalPOAMs = appPOAMs.length;
    const criticalPOAMs = appPOAMs.filter(poam => poam.risk_level === 'critical').length;
    const openPOAMs = appPOAMs.filter(poam => poam.status === 'open').length;
    const completedPOAMs = appPOAMs.filter(poam => poam.status === 'completed').length;
    
    // Update dashboard
    document.getElementById('app-total-poams').textContent = totalPOAMs;
    document.getElementById('app-critical-poams').textContent = criticalPOAMs;
    document.getElementById('app-open-poams').textContent = openPOAMs;
    document.getElementById('app-completed-poams').textContent = completedPOAMs;
}

function loadApplicationPOAMList() {
    if (!currentApplication) return;
    
    // Get POAMs for this application
    const allPOAMs = JSON.parse(localStorage.getItem('poamData') || '{}');
    const appPOAMs = Object.values(allPOAMs).filter(poam => poam.application === currentApplication);
    
    const poamList = document.getElementById('app-poam-list');
    
    if (appPOAMs.length === 0) {
        poamList.innerHTML = `
            <div class="p-8 text-center text-slate-500">
                <i class="fas fa-shield-alt text-4xl mb-3"></i>
                <p class="font-medium">No security findings found</p>
                <p class="text-sm mt-1">Your application is in good standing!</p>
            </div>
        `;
        return;
    }
    
    // Sort by risk level and status
    const sortedPOAMs = appPOAMs.sort((a, b) => {
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const statusOrder = { open: 0, in_progress: 1, completed: 2 };
        
        if (riskOrder[a.risk_level] !== riskOrder[b.risk_level]) {
            return riskOrder[a.risk_level] - riskOrder[b.risk_level];
        }
        return statusOrder[a.status] - statusOrder[b.status];
    });
    
    poamList.innerHTML = sortedPOAMs.map(poam => {
        const riskBadge = {
            'critical': '<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">Critical</span>',
            'high': '<span class="px-2 py-1 bg-rose-100 text-rose-700 rounded text-xs font-semibold">High</span>',
            'medium': '<span class="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">Medium</span>',
            'low': '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">Low</span>'
        }[poam.risk_level] || '<span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-semibold">Unknown</span>';
        
        const statusBadge = {
            'open': '<span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-semibold">Open</span>',
            'in_progress': '<span class="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">In Progress</span>',
            'completed': '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">Completed</span>',
            'overdue': '<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">Overdue</span>'
        }[poam.status] || '<span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-semibold">Unknown</span>';
        
        return `
            <div class="p-4 hover:bg-slate-50 transition-colors">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <span class="font-mono text-sm text-slate-600">${poam.poam_id}</span>
                            ${riskBadge}
                            ${statusBadge}
                        </div>
                        <p class="text-slate-800 mb-2">${poam.finding_description}</p>
                        <div class="flex items-center gap-4 text-sm text-slate-600">
                            <span><i class="fas fa-calendar mr-1"></i>Due: ${poam.scheduled_completion_date}</span>
                            <span><i class="fas fa-user mr-1"></i>${poam.point_of_contact}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 ml-4">
                        <button onclick="viewPOAMDetails('${poam.poam_id}')" class="text-slate-600 hover:text-slate-800 p-2" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <!-- Status update removed - use vulnerability tracker for status changes -->
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Quick action functions
function requestSecurityScan() {
    alert(`Security scan request for ${applicationData[currentApplication].name} has been submitted to the security team. You will receive a notification when the scan is scheduled.`);
}

function uploadEvidence() {
    alert('Evidence upload feature will open the file picker to upload remediation evidence for your POAM items.');
}

function contactSecurityTeam() {
    alert(`Security team contact for ${applicationData[currentApplication].name}:\n\nEmail: security@company.com\nPhone: x1234\nSlack: #security-help\n\nHours: Monday-Friday 9AM-5PM`);
}

// updatePOAMStatus function moved to vulnerability-tracking.js (IndexedDB-based)

// ═══════════════════════════════════════════════════════════════
// POAM DEBUGGING UTILITIES
// ═══════════════════════════════════════════════════════════════

async function debugPOAMById(poamId) {
    try {
        if (typeof poamDB === 'undefined') {
            console.error('poamDB is not available');
            return;
        }
        if (!poamDB.db) {
            await poamDB.init();
        }

        const poam = await poamDB.getPOAM(poamId);
        if (!poam) {
            console.warn(`POAM ${poamId} not found in IndexedDB`);
            return;
        }

        console.log('🔎 POAM DEBUG:', {
            id: poam.id,
            groupKey: poam.groupKey,
            riskLevel: poam.riskLevel,
            findingStatus: poam.findingStatus,
            rawFindingsCount: poam.rawFindings?.length || 0,
            affectedAssetsCount: poam.affectedAssets?.length || 0,
            totalAffectedAssets: poam.totalAffectedAssets,
            description: poam.description
        });

        if (poam.rawFindings && poam.rawFindings.length > 0) {
            const first = poam.rawFindings[0].raw || poam.rawFindings[0];
            console.log('🔎 First raw finding keys:', Object.keys(first));
            console.log('🔎 First raw finding sample asset fields:', {
                asset_id: first['Asset Id'] || first.asset_id,
                asset_name: first['Asset Name'] || first.asset_name,
                ipv4: first['Asset IPV4'] || first.asset_ipv4
            });
            console.log('🔎 First raw finding text:', {
                title: (first.Title || poam.rawFindings[0].title || '').substring(0, 120),
                solution: (first.Solution || poam.rawFindings[0].solution || '').substring(0, 120),
                results: (first.Results || poam.rawFindings[0].results || '').substring(0, 120)
            });
        }

        if (poam.affectedAssets && poam.affectedAssets.length > 0) {
            console.log('🔎 Affected assets sample:', poam.affectedAssets.slice(0, 5));
        }
    } catch (error) {
        console.error('Failed to debug POAM:', error);
    }
}

// ═══════════════════════════════════════════════════════════════
// SCAN HISTORY MANAGEMENT
// ═══════════════════════════════════════════════════════════════

async function renderScanHistory() {
    const historyList = document.getElementById('scan-history-list');
    if (!historyList) return;

    try {
        const scanRuns = await poamDB.getAllScanRuns();
        
        if (!scanRuns || scanRuns.length === 0) {
            historyList.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-12 text-center text-slate-500">
                        <i class="fas fa-history text-4xl mb-3 opacity-20"></i>
                        <p>No scan history found. Data will appear here once scans are uploaded.</p>
                    </td>
                </tr>
            `;
            return;
        }

        historyList.innerHTML = scanRuns.map(run => {
            const date = new Date(run.importedAt).toLocaleString();
            return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4">
                        <div class="font-mono text-xs font-bold text-indigo-600">${run.scanId}</div>
                        <div class="text-xs text-slate-500 mt-1">${date}</div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="font-medium text-slate-900">${run.source || 'Manual Upload'}</div>
                        <div class="text-xs text-slate-500 mt-1">${run.fileName || 'N/A'}</div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">
                            ${run.totalFindings || run.rawFindings?.length || 0} findings
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <i class="fas fa-check-circle"></i> Persistent
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        <button onclick="revertToScan('${run.scanId}')" 
                                class="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
                            <i class="fas fa-undo"></i> Revert
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error rendering scan history:', error);
        historyList.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Error loading history</td></tr>`;
    }
}

async function revertToScan(scanId) {
    if (!confirm(`Are you sure you want to revert to scan ${scanId}? Current POAM data will be replaced with the state from this scan snapshot.`)) {
        return;
    }

    try {
        const scanRun = await poamDB.getScanRun(scanId);
        if (!scanRun || !scanRun.rawFindings) {
            alert('Could not find raw findings for this scan snapshot.');
            return;
        }

        showUpdateFeedback('Reverting system state to snapshot...', 'info');
        
        // Re-process the raw findings
        const analysisEngine = new VulnerabilityAnalysisEngineV3();
        const poams = await analysisEngine.analyzeAndGroup(scanRun.rawFindings, scanId);
        
        // Clear and reload
        await poamDB.clearAllPOAMs();
        await poamDB.addPOAMsBatch(poams);
        
        showUpdateFeedback('System state reverted successfully!', 'success');
        
        // Refresh UI
        if (typeof displayVulnerabilityPOAMs === 'function') await displayVulnerabilityPOAMs();
        if (typeof updateStoredPOAMCount === 'function') updateStoredPOAMCount();
        
    } catch (error) {
        console.error('Revert error:', error);
        showUpdateFeedback('Failed to revert scan state.', 'error');
    }
}

// Initialize application management
let currentApplication = null;

const applicationData = {
    'hr-system': {
        name: 'HR System',
        description: 'Employee management and payroll',
        icon: 'fa-users',
        color: 'blue'
    },
    'financial-system': {
        name: 'Financial System', 
        description: 'Accounting and financial reporting',
        icon: 'fa-dollar-sign',
        color: 'green'
    },
    'crm-system': {
        name: 'CRM System',
        description: 'Customer relationship management',
        icon: 'fa-address-book',
        color: 'purple'
    },
    'infrastructure': {
        name: 'Infrastructure',
        description: 'Network and servers',
        icon: 'fa-network-wired',
        color: 'orange'
    },
    'web-applications': {
        name: 'Web Applications',
        description: 'Public and internal websites',
        icon: 'fa-globe',
        color: 'indigo'
    },
    'databases': {
        name: 'Databases',
        description: 'Data storage and management',
        icon: 'fa-database',
        color: 'red'
    },
    'api-services': {
        name: 'API Services',
        description: 'REST APIs and microservices',
        icon: 'fa-plug',
        color: 'teal'
    }
};

function selectApplication(appId) {
    if (appId === 'add-application') {
        // Handle adding new application
        const appName = prompt('Enter the name of the new application:');
        if (appName) {
            const appKey = appName.toLowerCase().replace(/\s+/g, '-');
            applicationData[appKey] = {
                name: appName,
                description: 'Custom application',
                icon: 'fa-cube',
                color: 'slate'
            };
            // Save to localStorage
            localStorage.setItem('customApplications', JSON.stringify(applicationData));
            alert(`Application "${appName}" added successfully! Please refresh to see it.`);
        }
        return;
    }
    
    currentApplication = appId;
    const app = applicationData[appId];
    
    if (!app) {
        console.error('Application not found:', appId);
        return;
    }
    
    // Reset to governance view when switching applications
    currentView = 'governance';
    document.getElementById('governance-view').style.display = 'block';
    document.getElementById('application-view').style.display = 'none';
    document.getElementById('view-mode-toggle').innerHTML = '<i class="fas fa-exchange-alt mr-1"></i>Switch to App View';
    
    // Update UI to show selection
    document.getElementById('selected-app-name').textContent = app.name;
    document.getElementById('selected-app-description').textContent = app.description;
    document.getElementById('current-selection').style.display = 'block';
    
    // Show POAM table
    document.getElementById('poam-table-container').style.display = 'block';
    
    // Update application cards to show selected state
    document.querySelectorAll('.application-card').forEach(card => {
        card.classList.remove('border-indigo-500', 'bg-indigo-50');
        card.classList.add('border-slate-200');
    });
    
    const selectedCard = document.querySelector(`[onclick="selectApplication('${appId}')"]`);
    if (selectedCard) {
        selectedCard.classList.remove('border-slate-200');
        selectedCard.classList.add('border-indigo-500', 'bg-indigo-50');
    }
    
    // Load POAMs for this application
    loadApplicationPOAMs(appId);
}

function resetApplicationSelection() {
    currentApplication = null;
    document.getElementById('current-selection').style.display = 'none';
    document.getElementById('poam-table-container').style.display = 'none';
    
    // Reset card styling
    document.querySelectorAll('.application-card').forEach(card => {
        card.classList.remove('border-indigo-500', 'bg-indigo-50');
        card.classList.add('border-slate-200');
    });
}

function loadApplicationPOAMs(appId) {
    // Get POAMs for this application from localStorage
    const allPOAMs = JSON.parse(localStorage.getItem('poamData') || '{}');
    const appPOAMs = Object.values(allPOAMs).filter(poam => poam.application === appId);
    
    // Clear current table
    const tableBody = document.getElementById('poam-table-body');
    tableBody.innerHTML = '';
    
    if (appPOAMs.length === 0) {
        // Show empty state
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-8 text-slate-500">
                    <i class="fas fa-inbox text-4xl mb-3"></i>
                    <p>No POAMs found for ${applicationData[appId].name}</p>
                    <p class="text-sm">Click "New POAM" to create the first one</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Add POAMs to table
    addPOAMsToRepository(appPOAMs);
}

function updateApplicationPOAMCounts() {
    // Update POAM counts for each application
    const allPOAMs = JSON.parse(localStorage.getItem('poamData') || '{}');
    
    Object.keys(applicationData).forEach(appId => {
        const appPOAMs = Object.values(allPOAMs).filter(poam => poam.application === appId);
        const countElement = document.querySelector(`[data-app="${appId}"]`);
        if (countElement) {
            countElement.textContent = appPOAMs.length;
        }
    });
}

// Initialize application management
document.addEventListener('DOMContentLoaded', function() {
    // Load custom applications from localStorage
    const customApps = localStorage.getItem('customApplications');
    if (customApps) {
        Object.assign(applicationData, JSON.parse(customApps));
    }
    
    // Update POAM counts
    updateApplicationPOAMCounts();
});

// Vulnerability Application Selection Functions
let vulnerabilityCurrentApplication = null;

function selectVulnerabilityApplication(appId) {
    if (appId === 'add-application') {
        // Handle adding new application
        const appName = prompt('Enter the name of the new application:');
        if (appName) {
            const appKey = appName.toLowerCase().replace(/\s+/g, '-');
            applicationData[appKey] = {
                name: appName,
                description: 'Custom application',
                icon: 'fa-cube',
                color: 'slate'
            };
            // Save to localStorage
            localStorage.setItem('customApplications', JSON.stringify(applicationData));
            alert(`Application "${appName}" added successfully! Please refresh to see it.`);
        }
        return;
    }
    
    vulnerabilityCurrentApplication = appId;
    const app = applicationData[appId];
    
    if (!app) {
        console.error('Application not found:', appId);
        return;
    }
    
    // Update UI to show selection
    document.getElementById('vulnerability-selected-app-name').textContent = app.name;
    document.getElementById('vulnerability-selected-app-description').textContent = app.description;
    document.getElementById('vulnerability-current-selection').style.display = 'block';
    
    // Update application cards to show selected state
    document.querySelectorAll('.vulnerability-app-card').forEach(card => {
        card.classList.remove('border-purple-500', 'bg-purple-50');
        card.classList.add('border-slate-200');
    });
    
    const selectedCard = document.querySelector(`[onclick="selectVulnerabilityApplication('${appId}')"]`);
    if (selectedCard) {
        selectedCard.classList.remove('border-slate-200');
        selectedCard.classList.add('border-purple-500', 'bg-purple-50');
    }
    
    // Update the global currentApplication for upload processing
    currentApplication = appId;
}

function resetVulnerabilityApplicationSelection() {
    vulnerabilityCurrentApplication = null;
    currentApplication = null;
    
    // Hide selection display
    document.getElementById('vulnerability-current-selection').style.display = 'none';
    
    // Reset card styles
    document.querySelectorAll('.vulnerability-app-card').forEach(card => {
        card.classList.remove('border-purple-500', 'bg-purple-50');
        card.classList.add('border-slate-200');
    });
}

function addVulnerabilityApplication() {
    const appName = prompt('Enter the name of the new application:');
    if (appName) {
        const appKey = appName.toLowerCase().replace(/\s+/g, '-');
        applicationData[appKey] = {
            name: appName,
            description: 'Custom application',
            icon: 'fa-cube',
            color: 'slate'
        };
        // Save to localStorage
        localStorage.setItem('customApplications', JSON.stringify(applicationData));
        alert(`Application "${appName}" added successfully! Please refresh to see it.`);
    }
}

function updateVulnerabilityApplicationPOAMCounts() {
    // Update POAM counts for vulnerability application cards
    const allPOAMs = JSON.parse(localStorage.getItem('poamData') || '{}');
    
    Object.keys(applicationData).forEach(appId => {
        const appPOAMs = Object.values(allPOAMs).filter(poam => poam.application === appId);
        const countElement = document.querySelector(`.vulnerability-poam-count[data-app="${appId}"]`);
        if (countElement) {
            countElement.textContent = appPOAMs.length;
        }
    });
}

// Evidence Vault — all functions live in modules/data-processing.js
// These stubs exist only as fallbacks if data-processing.js hasn't loaded yet.

// (Stale evidence functions removed — all live in modules/data-processing.js now)

function _removedEvidencePlaceholder() {
    // This block intentionally left empty. Evidence functions:
    // loadEvidenceFiles, populatePOAMDropdown, displayEvidenceRepository,
    // handleEvidenceUpload, filterEvidence, viewEvidenceDetails,
    // downloadEvidence, deleteEvidence, closePOAMWithEvidence,
    // linkEvidenceToPOAM, seedTestEvidence
    // ALL live in modules/data-processing.js
    void 0;
}

// Risk Management Framework System
const riskFrameworks = {
    nist: {
        name: 'NIST 800-53 / RMF',
        description: 'Federal risk management framework with comprehensive security controls and assessment procedures.',
        families: '18 families (AC, AU, CM, etc.)',
        controls: '1000+ security controls',
        assessment: 'High, Moderate, Low impact levels',
        compliance: 'Federal agencies, contractors',
        controlMapping: {
            'ssl_tls': { family: 'SC', controls: 'SC-8, SC-12, SC-13' },
            'patch_management': { family: 'SI', controls: 'SI-2, SI-5' },
            'authentication': { family: 'IA', controls: 'IA-2, IA-5' },
            'access_control': { family: 'AC', controls: 'AC-2, AC-3' },
            'encryption': { family: 'SC', controls: 'SC-8, SC-12' },
            'sql_injection': { family: 'SI', controls: 'SI-10' },
            'xss': { family: 'SI', controls: 'SI-10' },
            'configuration': { family: 'CM', controls: 'CM-6, CM-7' },
            'logging': { family: 'AU', controls: 'AU-2, AU-3' },
            'general': { family: 'RA', controls: 'RA-5' }
        }
    },
    csf: {
        name: 'NIST Cybersecurity Framework (CSF)',
        description: 'Voluntary framework for improving critical infrastructure cybersecurity.',
        families: '5 functions (Identify, Protect, Detect, Respond, Recover)',
        controls: '108 subcategories',
        assessment: 'Implementation tiers (Partial, Risk-Informed, Repeatable, Adaptive)',
        compliance: 'Critical infrastructure, private sector',
        controlMapping: {
            'ssl_tls': { family: 'PR', controls: 'PR.AC-1, PR.AC-5' },
            'patch_management': { family: 'PR', controls: 'PR.IP-1, PR.MA-2' },
            'authentication': { family: 'PR', controls: 'PR.AC-1, PR.AC-6, PR.AC-7' },
            'access_control': { family: 'PR', controls: 'PR.AC-1, PR.AC-3' },
            'encryption': { family: 'PR', controls: 'PR.AC-4, PR.DS-2' },
            'sql_injection': { family: 'DE', controls: 'DE.CM-1, DE.CM-8' },
            'xss': { family: 'DE', controls: 'DE.CM-1, DE.CM-8' },
            'configuration': { family: 'PR', controls: 'PR.IP-1, PR.PT-4' },
            'logging': { family: 'DE', controls: 'DE.AE-3, DE.CM-7' },
            'general': { family: 'ID', controls: 'ID.RA-1, ID.RA-3' }
        }
    },
    mitre: {
        name: 'MITRE ATT&CK',
        description: 'Adversary tactics, techniques, and procedures for cybersecurity threat intelligence.',
        families: '14 tactics (Initial Access, Execution, Persistence, etc.)',
        controls: '200+ techniques and sub-techniques',
        assessment: 'Coverage analysis and detection capability',
        compliance: 'Threat intelligence, security operations',
        controlMapping: {
            'ssl_tls': { family: 'TA', controls: 'TA0001, T1071' },
            'patch_management': { family: 'TE', controls: 'TA0002, T1068' },
            'authentication': { family: 'TA', controls: 'TA0001, T1078' },
            'access_control': { family: 'TA', controls: 'TA0004, T1098' },
            'encryption': { family: 'TA', controls: 'TA0005, T1022' },
            'sql_injection': { family: 'TA', controls: 'TA0001, T1190' },
            'xss': { family: 'TA', controls: 'TA0001, T1190' },
            'configuration': { family: 'TE', controls: 'TA0002, T1565' },
            'logging': { family: 'TA', controls: 'TA0005, T1562' },
            'general': { family: 'TA', controls: 'TA0001, T1082' }
        }
    },
    fedramp: {
        name: 'FedRAMP',
        description: 'Federal Risk and Authorization Management Program for cloud services.',
        families: '17 families (based on NIST 800-53)',
        controls: '325 controls (Low/Moderate/High baselines)',
        assessment: 'Continuous monitoring, annual assessment',
        compliance: 'Cloud service providers, federal agencies',
        controlMapping: {
            'ssl_tls': { family: 'SC', controls: 'SC-8, SC-12, SC-13' },
            'patch_management': { family: 'SI', controls: 'SI-2, SI-5' },
            'authentication': { family: 'IA', controls: 'IA-2, IA-5, IA-8' },
            'access_control': { family: 'AC', controls: 'AC-2, AC-3, AC-6' },
            'encryption': { family: 'SC', controls: 'SC-8, SC-12' },
            'sql_injection': { family: 'SI', controls: 'SI-10' },
            'xss': { family: 'SI', controls: 'SI-10' },
            'configuration': { family: 'CM', controls: 'CM-6, CM-7' },
            'logging': { family: 'AU', controls: 'AU-2, AU-3, AU-12' },
            'general': { family: 'RA', controls: 'RA-5' }
        }
    },
    cms: {
        name: 'CMS (Centers for Medicare & Medicaid Services)',
        description: 'Healthcare-specific security requirements for Medicare/Medicaid systems.',
        families: '8 security domains (Access Control, Audit, etc.)',
        controls: '164 security requirements',
        assessment: 'Risk analysis, annual evaluation',
        compliance: 'Healthcare entities, Medicare/Medicaid providers',
        controlMapping: {
            'ssl_tls': { family: 'AC', controls: 'AC.3.001, AC.3.002' },
            'patch_management': { family: 'SM', controls: 'SM.1.001, SM.1.002' },
            'authentication': { family: 'IA', controls: 'IA.2.001, IA.2.002' },
            'access_control': { family: 'AC', controls: 'AC.1.001, AC.1.002' },
            'encryption': { family: 'AC', controls: 'AC.3.001, AC.3.002' },
            'sql_injection': { family: 'SI', controls: 'SI.2.001, SI.2.002' },
            'xss': { family: 'SI', controls: 'SI.2.001, SI.2.002' },
            'configuration': { family: 'SM', controls: 'SM.2.001, SM.2.002' },
            'logging': { family: 'AU', controls: 'AU.1.001, AU.1.002' },
            'general': { family: 'RA', controls: 'RA.1.001, RA.1.002' }
        }
    },
    irs: {
        name: 'IRS (Internal Revenue Service)',
        description: 'Tax system security requirements for IRS and related entities.',
        families: '12 control areas (Security Management, Access Control, etc.)',
        controls: '200+ security controls',
        assessment: 'Annual security assessment, continuous monitoring',
        compliance: 'Tax agencies, financial institutions',
        controlMapping: {
            'ssl_tls': { family: 'SC', controls: 'SC-001, SC-002' },
            'patch_management': { family: 'SM', controls: 'SM-001, SM-002' },
            'authentication': { family: 'AC', controls: 'AC-101, AC-102' },
            'access_control': { family: 'AC', controls: 'AC-001, AC-002' },
            'encryption': { family: 'SC', controls: 'SC-001, SC-003' },
            'sql_injection': { family: 'SI', controls: 'SI-001, SI-002' },
            'xss': { family: 'SI', controls: 'SI-001, SI-002' },
            'configuration': { family: 'CM', controls: 'CM-001, CM-002' },
            'logging': { family: 'AU', controls: 'AU-001, AU-002' },
            'general': { family: 'RA', controls: 'RA-001, RA-002' }
        }
    },
    ai: {
        name: 'AI Risk Management Framework',
        description: 'Comprehensive framework for managing AI/ML system risks and compliance.',
        families: '4 risk categories (Security, Privacy, Bias, Transparency)',
        controls: '150+ AI-specific controls',
        assessment: 'AI model risk assessment, continuous monitoring',
        compliance: 'AI developers, healthcare AI, financial AI',
        controlMapping: {
            'ssl_tls': { family: 'SEC', controls: 'SEC-001, SEC-002' },
            'patch_management': { family: 'SEC', controls: 'SEC-101, SEC-102' },
            'authentication': { family: 'SEC', controls: 'SEC-201, SEC-202' },
            'access_control': { family: 'SEC', controls: 'SEC-301, SEC-302' },
            'encryption': { family: 'PRV', controls: 'PRV-001, PRV-002' },
            'sql_injection': { family: 'SEC', controls: 'SEC-401, SEC-402' },
            'xss': { family: 'SEC', controls: 'SEC-401, SEC-402' },
            'configuration': { family: 'SEC', controls: 'SEC-501, SEC-502' },
            'logging': { family: 'TRN', controls: 'TRN-001, TRN-002' },
            'general': { family: 'BIA', controls: 'BIA-001, BIA-002' }
        }
    }
};

let currentRiskFramework = 'nist'; // Default framework

function updateFrameworkInfo() {
    const selectedFramework = document.getElementById('risk-framework-select').value;
    const framework = riskFrameworks[selectedFramework];
    const infoDiv = document.getElementById('framework-info');
    
    infoDiv.innerHTML = `
        <h4 class="font-semibold text-slate-800 mb-2">Framework: ${framework.name}</h4>
        <p class="text-sm text-slate-600 mb-3">${framework.description}</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><strong>Control Families:</strong> ${framework.families}</div>
            <div><strong>Controls:</strong> ${framework.controls}</div>
            <div><strong>Assessment:</strong> ${framework.assessment}</div>
            <div><strong>Compliance:</strong> ${framework.compliance}</div>
        </div>
    `;
}

function saveRiskFramework() {
    const selectedFramework = document.getElementById('risk-framework-select').value;
    currentRiskFramework = selectedFramework;
    
    // Save to localStorage
    localStorage.setItem('riskFramework', selectedFramework);
    
    // Update the NIST Control Mapper to use the new framework
    updateControlMapper(selectedFramework);
    
    // Update framework display throughout the interface
    updateFrameworkDisplay(selectedFramework);
    
    alert(`Risk framework updated to: ${riskFrameworks[selectedFramework].name}`);
}

function updateFrameworkDisplay(framework) {
    // Update POAM table header
    const headerElement = document.getElementById('framework-controls-header');
    if (headerElement) {
        const frameworkName = riskFrameworks[framework].name;
        headerElement.textContent = frameworkName + ' Controls';
    }
    
    // Update POAM modal controls section
    const modalHeader = document.querySelector('#poam-modal h3');
    if (modalHeader && modalHeader.textContent.includes('Controls')) {
        modalHeader.textContent = riskFrameworks[framework].name + ' Controls';
    }
}

function updateControlMapper(framework) {
    // Update the global NIST Control Mapper to use the selected framework
    if (window.nistControlMapper) {
        window.nistControlMapper.framework = framework;
        window.nistControlMapper.controlMappings = riskFrameworks[framework].controlMapping;
    }
}

function loadRiskFramework() {
    const saved = localStorage.getItem('riskFramework');
    if (saved) {
        currentRiskFramework = saved;
        document.getElementById('risk-framework-select').value = saved;
        updateFrameworkInfo();
        updateControlMapper(saved);
        updateFrameworkDisplay(saved);
    } else {
        // Initialize with default framework display
        updateFrameworkDisplay('nist');
    }
}

function previewFrameworkMapping() {
    const selectedFramework = document.getElementById('risk-framework-select').value;
    const framework = riskFrameworks[selectedFramework];
    
    // Create a preview modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-slate-900">Framework Control Mapping Preview</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-slate-800 mb-3">${framework.name}</h3>
                <p class="text-slate-600 mb-4">${framework.description}</p>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full border border-slate-200 rounded-lg">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="text-left p-3 font-semibold text-slate-700 border-b">Vulnerability Category</th>
                            <th class="text-left p-3 font-semibold text-slate-700 border-b">Control Family</th>
                            <th class="text-left p-3 font-semibold text-slate-700 border-b">Controls</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(framework.controlMapping).map(([category, mapping]) => `
                            <tr class="border-b hover:bg-slate-50">
                                <td class="p-3 font-medium">${category.replace('_', ' ').toUpperCase()}</td>
                                <td class="p-3">${mapping.family}</td>
                                <td class="p-3 font-mono text-sm">${mapping.controls}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="mt-6 flex justify-end">
                <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    Close Preview
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Update the NIST Control Mapper class to support multiple frameworks
class EnhancedControlMapper {
    constructor(framework = 'nist') {
        this.framework = framework;
        this.controlMappings = riskFrameworks[framework].controlMapping;
    }
    
    getControls(category, severity) {
        const mapping = this.controlMappings[category] || this.controlMappings['general'];
        
        // Add additional controls for high-severity findings
        let controls = mapping.controls;
        if (severity === 'critical' || severity === 'high') {
            if (this.framework === 'nist' || this.framework === 'fedramp') {
                controls += ', IR-4'; // Incident response for critical issues
            } else if (this.framework === 'csf') {
                controls += ', RS.RP-1'; // Response planning
            }
        }
        
        return {
            family: mapping.family,
            controls: controls,
            framework: this.framework
        };
    }
}

// POAM ID Configuration Functions - Popup Based
function checkFirstPOAMSetup() {
    const config = localStorage.getItem('poamIdConfig');
    const poamData = localStorage.getItem('poamData');
    
    // If no config exists and no POAMs exist, show popup for first-time setup
    if (!config && (!poamData || Object.keys(JSON.parse(poamData || '{}')).length === 0)) {
        return true; // Need to show setup popup
    }
    return false; // Setup already done
}

function showPOAMIdConfigPopup() {
    document.getElementById('poam-id-config-modal').classList.remove('hidden');
    // Load any existing config into popup
    loadPOAMIdConfigIntoPopup();
}

function closePOAMIdConfigModal() {
    document.getElementById('poam-id-config-modal').classList.add('hidden');
}

function loadPOAMIdConfigIntoPopup() {
    const saved = localStorage.getItem('poamIdConfig');
    if (saved) {
        const config = JSON.parse(saved);
        document.getElementById('popup-poam-id-prefix').value = config.prefix || 'POAM-';
        document.getElementById('popup-poam-id-start').value = config.currentNumber || 1;
    } else {
        // Default values
        document.getElementById('popup-poam-id-prefix').value = 'POAM-';
        document.getElementById('popup-poam-id-start').value = '1';
    }
    updatePopupIDPreview();
}

function updatePopupIDPreview() {
    const prefix = document.getElementById('popup-poam-id-prefix').value || 'POAM-';
    const startNum = document.getElementById('popup-poam-id-start').value || '1';
    const paddedNum = String(startNum).padStart(3, '0');
    document.getElementById('popup-id-preview').textContent = prefix + paddedNum;
}

function savePOAMIdConfigFromPopup() {
    const prefix = document.getElementById('popup-poam-id-prefix').value || 'POAM-';
    const startNum = parseInt(document.getElementById('popup-poam-id-start').value) || 1;
    
    const config = {
        prefix: prefix,
        currentNumber: startNum,
        createdAt: new Date().toISOString(),
        setupCompleted: true
    };
    
    // Save to localStorage
    localStorage.setItem('poamIdConfig', JSON.stringify(config));
    
    // Close popup and continue with POAM creation
    closePOAMIdConfigModal();
    
    // Show success message
    alert('POAM ID configuration saved successfully!');
    
    // Now open the POAM creation modal
    openNewPOAMModal();
}

function updateSettingsIDPreview() {
    const prefix = document.getElementById('settings-poam-id-prefix').value || 'POAM-';
    const startNum = document.getElementById('settings-poam-id-start').value || '1';
    const paddedNum = String(startNum).padStart(3, '0');
    document.getElementById('settings-id-preview').textContent = prefix + paddedNum;
}

function loadPOAMIdConfigIntoSettings() {
    const saved = localStorage.getItem('poamIdConfig');
    if (saved) {
        const config = JSON.parse(saved);
        document.getElementById('settings-poam-id-prefix').value = config.prefix || 'POAM-';
        document.getElementById('settings-poam-id-start').value = config.currentNumber || 1;
        updateSettingsIDPreview();
    }
}

async function savePOAMIdConfigFromSettings() {
    const prefix = document.getElementById('settings-poam-id-prefix').value || 'POAM-';
    const startNum = parseInt(document.getElementById('settings-poam-id-start').value) || 1;
    
    const config = {
        prefix: prefix,
        currentNumber: startNum,
        updatedAt: new Date().toISOString(),
        setupCompleted: true
    };
    
    localStorage.setItem('poamIdConfig', JSON.stringify(config));
    
    const shouldRenumber = confirm('Apply new POAM ID format to all existing POAMs now?');
    if (shouldRenumber) {
        try {
            const result = await renumberAllPOAMIds(prefix, startNum);
            const updatedConfig = {
                ...config,
                currentNumber: result.nextNumber,
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem('poamIdConfig', JSON.stringify(updatedConfig));
            
            if (typeof displayVulnerabilityPOAMs === 'function') {
                await displayVulnerabilityPOAMs();
            }
            if (typeof updateVulnerabilityModuleMetrics === 'function') {
                await updateVulnerabilityModuleMetrics();
            }
            
            alert(`POAM ID configuration updated. Renumbered ${result.updated} POAMs.`);
            return;
        } catch (error) {
            console.error('Error renumbering POAM IDs:', error);
            alert('POAM ID config saved, but renumbering failed: ' + error.message);
            return;
        }
    }
    
    alert('POAM ID configuration updated successfully!');
}

function resetPOAMIdCounter() {
    if (confirm('Are you sure you want to reset the POAM ID counter? This will start numbering from 1 again.')) {
        const config = JSON.parse(localStorage.getItem('poamIdConfig') || '{}');
        config.currentNumber = 1;
        config.updatedAt = new Date().toISOString();
        localStorage.setItem('poamIdConfig', JSON.stringify(config));
        
        // Update the settings display
        document.getElementById('settings-poam-id-start').value = 1;
        updateSettingsIDPreview();
        
        alert('POAM ID counter has been reset to 1.');
    }
}

function loadPOAMIdConfig() {
    // This function is now mainly for loading into settings
    loadPOAMIdConfigIntoSettings();
}

function formatPOAMId(prefix, number) {
    return prefix + String(number).padStart(3, '0');
}

function getNextPOAMId() {
    const config = JSON.parse(localStorage.getItem('poamIdConfig') || '{}');
    
    // If no config exists, use default
    const prefix = config.prefix || 'POAM-';
    let currentNumber = config.currentNumber || 1;
    
    const nextId = formatPOAMId(prefix, currentNumber);
    
    // Update the current number for next time
    currentNumber++;
    const updatedConfig = {
        ...config,
        currentNumber: currentNumber,
        updatedAt: new Date().toISOString()
    };
    localStorage.setItem('poamIdConfig', JSON.stringify(updatedConfig));
    
    return nextId;
}

async function ensurePOAMIdConfigForBaselineImport() {
    // Check if this is truly a first-run baseline import
    const isFirstRun = await isFirstRunBaselineImport();
    if (!isFirstRun) return true;
    
    // Show comprehensive first-run setup for SLA + POAM ID
    return await showFirstRunSetup();
}

async function isFirstRunBaselineImport() {
    // Check if POAM ID config already exists and is complete
    let poamIdConfig = null;
    try {
        poamIdConfig = JSON.parse(localStorage.getItem('poamIdConfig') || 'null');
    } catch (e) {
        poamIdConfig = null;
    }
    const hasPoamIdSetup = !!(poamIdConfig && poamIdConfig.setupCompleted && poamIdConfig.prefix && poamIdConfig.currentNumber);
    
    // Check if SLA config already exists
    let slaConfig = null;
    try {
        slaConfig = JSON.parse(localStorage.getItem('slaConfig') || 'null');
    } catch (e) {
        slaConfig = null;
    }
    const hasSlaSetup = !!(slaConfig && (slaConfig.critical || slaConfig.high || slaConfig.medium || slaConfig.low));
    
    // Check if database has any POAMs
    let hasPOAMs = false;
    try {
        if (typeof poamDB !== 'undefined' && typeof poamDB.countPOAMs === 'function') {
            const count = await poamDB.countPOAMs();
            hasPOAMs = count > 0;
        }
    } catch (e) {
        console.warn('Could not check existing POAM count:', e);
    }
    
    // First run if: no POAMs AND (no POAM ID setup OR no SLA setup)
    return !hasPOAMs && (!hasPoamIdSetup || !hasSlaSetup);
}

async function showFirstRunSetup() {
    return new Promise((resolve) => {
        window.firstRunSetupResolve = resolve;
        const modal = document.getElementById('first-run-setup-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    });
}

function cancelFirstRunSetup() {
    // Apply defaults
    const defaultPoamIdConfig = {
        prefix: 'POAM-',
        currentNumber: 1,
        setupCompleted: true,
        createdAt: new Date().toISOString()
    };
    localStorage.setItem('poamIdConfig', JSON.stringify(defaultPoamIdConfig));
    
    const defaultSlaConfig = {
        critical: 15,
        high: 30,
        medium: 90,
        low: 180
    };
    localStorage.setItem('slaConfig', JSON.stringify(defaultSlaConfig));
    
    closeFirstRunSetupModal();
    if (window.firstRunSetupResolve) {
        window.firstRunSetupResolve(true);
    }
}

function firstRunSetupNext() {
    // Move from step 1 to step 2
    document.getElementById('setup-step-1').classList.add('hidden');
    document.getElementById('setup-step-2').classList.remove('hidden');
    
    // Update indicators
    document.getElementById('setup-step-1-indicator').classList.remove('bg-indigo-600', 'text-white');
    document.getElementById('setup-step-1-indicator').classList.add('bg-green-500', 'text-white');
    document.getElementById('setup-step-1-line').classList.remove('bg-slate-200');
    document.getElementById('setup-step-1-line').classList.add('bg-green-500');
    document.getElementById('setup-step-2-indicator').classList.remove('bg-slate-200', 'text-slate-600');
    document.getElementById('setup-step-2-indicator').classList.add('bg-indigo-600', 'text-white');
    
    // Update buttons
    document.getElementById('setup-back-btn').classList.remove('hidden');
    document.getElementById('setup-next-btn').classList.add('hidden');
    document.getElementById('setup-finish-btn').classList.remove('hidden');
    
    updateSetupPreview();
}

function firstRunSetupBack() {
    // Move from step 2 to step 1
    document.getElementById('setup-step-2').classList.add('hidden');
    document.getElementById('setup-step-1').classList.remove('hidden');
    
    // Update indicators
    document.getElementById('setup-step-1-indicator').classList.remove('bg-green-500');
    document.getElementById('setup-step-1-indicator').classList.add('bg-indigo-600');
    document.getElementById('setup-step-1-line').classList.remove('bg-green-500');
    document.getElementById('setup-step-1-line').classList.add('bg-slate-200');
    document.getElementById('setup-step-2-indicator').classList.remove('bg-indigo-600', 'text-white');
    document.getElementById('setup-step-2-indicator').classList.add('bg-slate-200', 'text-slate-600');
    
    // Update buttons
    document.getElementById('setup-back-btn').classList.add('hidden');
    document.getElementById('setup-next-btn').classList.remove('hidden');
    document.getElementById('setup-finish-btn').classList.add('hidden');
}

function updateSetupPreview() {
    const prefix = document.getElementById('setup-poam-prefix').value || 'POAM-';
    const startNum = parseInt(document.getElementById('setup-poam-start').value) || 1;
    
    document.getElementById('setup-preview-1').textContent = prefix + String(startNum).padStart(3, '0');
    document.getElementById('setup-preview-2').textContent = prefix + String(startNum + 1).padStart(3, '0');
    document.getElementById('setup-preview-3').textContent = prefix + String(startNum + 2).padStart(3, '0');
}

function finishFirstRunSetup() {
    // Collect SLA values
    const critical = Math.max(1, parseInt(document.getElementById('setup-sla-critical').value) || 15);
    const high = Math.max(1, parseInt(document.getElementById('setup-sla-high').value) || 30);
    const medium = Math.max(1, parseInt(document.getElementById('setup-sla-medium').value) || 90);
    const low = Math.max(1, parseInt(document.getElementById('setup-sla-low').value) || 180);
    
    const slaConfig = { critical, high, medium, low };
    localStorage.setItem('slaConfig', JSON.stringify(slaConfig));
    
    // Collect POAM ID values
    const prefix = document.getElementById('setup-poam-prefix').value.trim() || 'POAM-';
    const startNum = Math.max(1, parseInt(document.getElementById('setup-poam-start').value) || 1);
    
    const poamIdConfig = {
        prefix,
        currentNumber: startNum,
        setupCompleted: true,
        createdAt: new Date().toISOString()
    };
    localStorage.setItem('poamIdConfig', JSON.stringify(poamIdConfig));
    
    closeFirstRunSetupModal();
    if (window.firstRunSetupResolve) {
        window.firstRunSetupResolve(true);
    }
}

function closeFirstRunSetupModal() {
    const modal = document.getElementById('first-run-setup-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
    // Reset to step 1 for next time
    document.getElementById('setup-step-2').classList.add('hidden');
    document.getElementById('setup-step-1').classList.remove('hidden');
    document.getElementById('setup-back-btn').classList.add('hidden');
    document.getElementById('setup-next-btn').classList.remove('hidden');
    document.getElementById('setup-finish-btn').classList.add('hidden');
}

async function renumberAllPOAMIds(prefix, startNum) {
    if (typeof poamDB === 'undefined' || typeof poamDB.getAllPOAMs !== 'function') {
        return { updated: 0, nextNumber: startNum };
    }
    
    const existing = await poamDB.getAllPOAMs();
    if (!existing || existing.length === 0) {
        return { updated: 0, nextNumber: startNum };
    }
    
    const sorted = [...existing].sort((a, b) => {
        const aDate = new Date(a.createdDate || a.lastModifiedDate || 0).getTime();
        const bDate = new Date(b.createdDate || b.lastModifiedDate || 0).getTime();
        return aDate - bDate;
    });
    
    let n = startNum;
    const renumbered = sorted.map(poam => {
        const newId = formatPOAMId(prefix, n++);
        return {
            ...poam,
            id: newId,
            findingIdentifier: newId
        };
    });
    
    await poamDB.clearAllPOAMs();
    await poamDB.addPOAMsBatch(renumbered);
    
    return { updated: renumbered.length, nextNumber: n };
}

// Update openNewPOAMModal to check for first-time setup
function openNewPOAMModal() {
    // Check if this is the first POAM creation
    if (checkFirstPOAMSetup()) {
        showPOAMIdConfigPopup();
        return;
    }
    
    // Normal POAM modal opening
    document.getElementById('poam-modal').classList.remove('hidden');
}

// Vulnerability Tracking Functions - TRACE
function showVulnerabilityTab(tabName) {
    // Hide all vulnerability content
    const contents = document.querySelectorAll('.vulnerability-content');
    contents.forEach(content => {
        content.classList.add('hidden');
    });
    
    // Show selected content
    document.getElementById(tabName + '-content').classList.remove('hidden');
    
    // Update tab styling
    const tabs = ['upload-tab', 'jobs-tab', 'reports-tab'];
    tabs.forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) {
            if (tabId === tabName + '-tab') {
                tab.className = 'flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium transition-colors';
            } else {
                tab.className = 'flex-1 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors';
            }
        }
    });
    
    // Load data for specific tabs
    if (tabName === 'jobs') {
        loadUnifiedJobs();
    } else if (tabName === 'reports') {
        loadUnifiedAnalytics();
    }
}

// Update vulnerability processing progress
function updateVulnerabilityProgress(percent, message) {
    const progressBar = document.getElementById('vulnerability-progress-bar');
    const progressText = document.getElementById('vulnerability-progress-text');
    
    if (progressBar) {
        progressBar.style.width = percent + '%';
    }
    
    if (progressText) {
        progressText.textContent = message;
    }
    
    console.log(`Progress: ${percent}% - ${message}`);
}

// Note: handleVulnerabilityUpload and processLocalCSV are now in vulnerability-tracking.js

function processScanDataForSLA(headers, dataLines, filename) {
    const scannerInfo = detectScannerType(headers, filename);
    const analyzer = new VulnerabilityAnalyzer(scannerInfo);
    
    const scanResults = {
        totalFindings: 0,
        slaViolations: [],
        compliantFindings: []
    };
    
    // SLA Configuration (days)
    const slaConfig = {
        critical: 15,  // 15 days for critical
        high: 30,      // 30 days for high
        medium: 60,    // 60 days for medium
        low: 90        // 90 days for low
    };
    
    dataLines.forEach((line, index) => {
        if (!line.trim()) return;
        
        const values = line.split(',').map(v => v.trim());
        const rowData = {};
        
        headers.forEach((header, i) => {
            rowData[header] = values[i] || '';
        });
        
        // Normalize scan data
        const normalizedVuln = analyzer.normalizeVulnerability(rowData);
        
        if (!normalizedVuln.isValid) {
            console.warn(`Skipping invalid vulnerability at line ${index + 1}:`, normalizedVuln.reason);
            return;
        }
        
        scanResults.totalFindings++;
        
        // Check if vulnerability exceeds SLA
        const slaDays = slaConfig[normalizedVuln.severity] || 90;
        const discoveryDate = rowData.discovery_date || rowData.first_seen || new Date().toISOString();
        const daysSinceDiscovery = Math.floor((new Date() - new Date(discoveryDate)) / (1000 * 60 * 60 * 24));
        
        if (daysSinceDiscovery > slaDays) {
            // SLA violation detected
            scanResults.slaViolations.push({
                ...normalizedVuln,
                slaDays: slaDays,
                daysOverdue: daysSinceDiscovery - slaDays,
                discoveryDate: discoveryDate,
                raw: rowData
            });
        } else {
            // Within SLA
            scanResults.compliantFindings.push({
                ...normalizedVuln,
                slaDays: slaDays,
                daysSinceDiscovery: daysSinceDiscovery,
                discoveryDate: discoveryDate
            });
        }
    });
    
    return scanResults;
}

function createPOAMsFromSLAViolations(slaViolations) {
    const poams = [];
    
    slaViolations.forEach(violation => {
        const poam = createSLAPOAM(violation);
        if (poam) {
            poams.push(poam);
        }
    });
    
    return poams;
}

function createSLAPOAM(violation) {
    // Get framework-specific controls
    const controls = getFrameworkControls(violation.category, violation.severity);
    
    // Calculate escalated due date (expedited due to SLA violation)
    const escalatedDueDate = calculateEscalatedDueDate(violation.severity, violation.daysOverdue);
    
    return {
        poam_id: getNextPOAMId(),
        application: 'sla_violation',
        application_name: 'SLA Violation Processing',
        source_type: 'sla_violation',
        scanner_type: 'multiple',
        finding_description: buildSLAFindingDescription(violation),
        risk_level: violation.severity,
        status: 'open',
        control_family: controls.family,
        nist_controls: controls.controls,
        risk_framework: currentRiskFramework,
        point_of_contact: assignSLAPOC(violation.category),
        contact_email: getSLAContactEmail(violation.category),
        scheduled_completion_date: escalatedDueDate,
        resources_required: buildSLAResourceRequirements(violation),
        milestone_number: '1',
        milestone_completion_date: escalatedDueDate,
        milestone_status: 'pending',
        milestone_description: buildSLAMilestoneDescription(violation),
        
        // SLA-specific fields
        vulnerability_category: violation.category,
        cve_id: violation.cveId,
        cvss_score: violation.cvssScore,
        affected_asset: violation.affectedAsset,
        technical_recommendation: violation.recommendation,
        
        // SLA violation metadata
        sla_violation: true,
        sla_days: violation.slaDays,
        days_overdue: violation.daysOverdue,
        discovery_date: violation.discoveryDate,
        escalation_required: violation.daysOverdue > 30,
        
        // Metadata
        created_date: new Date().toISOString(),
        created_by: 'TRACE - SLA Processing',
        source_file: 'SLA Violation Detection'
    };
}

function getFrameworkControls(category, severity) {
    const framework = riskFrameworks[currentRiskFramework];
    const mapping = framework.controlMapping[category] || framework.controlMapping['general'];
    
    let controls = mapping.controls;
    if (severity === 'critical' || severity === 'high') {
        if (currentRiskFramework === 'nist' || currentRiskFramework === 'fedramp') {
            controls += ', IR-4'; // Incident response
        }
    }
    
    return {
        family: mapping.family,
        controls: controls
    };
}

function calculateEscalatedDueDate(severity, daysOverdue) {
    const now = new Date();
    let baseDays = 30; // Default
    
    switch (severity) {
        case 'critical':
            baseDays = 7; // Expedited for critical violations
            break;
        case 'high':
            baseDays = 14; // Expedited for high violations
            break;
        case 'medium':
            baseDays = 30; // Standard for medium
            break;
        case 'low':
            baseDays = 45; // Reduced for low violations
            break;
    }
    
    // Further reduce if severely overdue
    if (daysOverdue > 60) {
        baseDays = Math.max(baseDays / 2, 7);
    }
    
    const dueDate = new Date(now.getTime() + (baseDays * 24 * 60 * 60 * 1000));
    return dueDate.toISOString().split('T')[0];
}

function assignSLAPOC(category) {
    const pocMap = {
        'ssl_tls': 'Security Infrastructure Team',
        'patch_management': 'System Administration Team',
        'authentication': 'Identity Management Team',
        'access_control': 'Security Operations Team',
        'encryption': 'Cryptography Team',
        'sql_injection': 'Application Security Team',
        'xss': 'Application Security Team',
        'configuration': 'System Administration Team',
        'logging': 'Security Operations Team',
        'general': 'Security Team'
    };
    
    return pocMap[category] || 'Security Team';
}

function getSLAContactEmail(category) {
    const emailMap = {
        'ssl_tls': 'infra-security@company.com',
        'patch_management': 'sysadmin@company.com',
        'authentication': 'identity@company.com',
        'access_control': 'soc@company.com',
        'encryption': 'crypto@company.com',
        'sql_injection': 'appsec@company.com',
        'xss': 'appsec@company.com',
        'configuration': 'sysadmin@company.com',
        'logging': 'soc@company.com',
        'general': 'security@company.com'
    };
    
    return emailMap[category] || 'security@company.com';
}

function buildSLAFindingDescription(violation) {
    let description = `SLA VIOLATION: ${violation.title}`;
    
    if (violation.cveId) {
        description += ` (${violation.cveId})`;
    }
    
    if (violation.cvssScore) {
        description += ` [CVSS: ${violation.cvssScore}]`;
    }
    
    description += `\n\n${violation.description}`;
    
    description += `\n\n**SLA VIOLATION DETAILS:**`;
    description += `\n- SLA Period: ${violation.slaDays} days`;
    description += `\n- Days Overdue: ${violation.daysOverdue} days`;
    description += `\n- Discovery Date: ${new Date(violation.discoveryDate).toLocaleDateString()}`;
    
    if (violation.affectedAsset && violation.affectedAsset !== 'Unknown Asset') {
        description += `\n\nAffected Asset: ${violation.affectedAsset}`;
    }
    
    return description;
}

function buildSLAResourceRequirements(violation) {
    let resources = 'Expedited remediation activities required due to SLA violation. ';
    
    if (violation.category === 'patch_management') {
        resources += 'Emergency patching and reboot coordination required.';
    } else if (violation.category === 'ssl_tls') {
        resources += 'Emergency certificate renewal and SSL/TLS configuration required.';
    } else if (violation.category === 'authentication') {
        resources += 'Immediate authentication system updates required.';
    } else if (violation.category === 'sql_injection' || violation.category === 'xss') {
        resources += 'Emergency application code review and deployment required.';
    } else {
        resources += 'Expedited security remediation and verification required.';
    }
    
    return resources;
}

function buildSLAMilestoneDescription(violation) {
    let description = `Expedited remediation of ${violation.category.replace('_', ' ')} vulnerability - SLA VIOLATION`;
    
    if (violation.cveId) {
        description += ` (${violation.cveId})`;
    }
    
    description += ` - ${violation.daysOverdue} days overdue`;
    
    if (violation.daysOverdue > 30) {
        description += ' - CRITICAL ESCALATION REQUIRED';
    }
    
    return description;
}

async function updateSLAMetrics() {
    console.log('📊 updateSLAMetrics called');
    
    // Get manual POAMs from localStorage
    const manualPOAMs = JSON.parse(localStorage.getItem('poamData') || '{}');
    const manualArray = Object.values(manualPOAMs);
    console.log(`📝 Manual POAMs from localStorage: ${manualArray.length}`);
    
    // Get vulnerability POAMs from IndexedDB
    let vulnerabilityArray = [];
    if (typeof poamDB !== 'undefined' && poamDB) {
        try {
            vulnerabilityArray = await poamDB.getAllPOAMs();
            console.log(`🐛 Vulnerability POAMs from IndexedDB: ${vulnerabilityArray.length}`);
        } catch (error) {
            console.error('❌ Failed to load vulnerability POAMs:', error);
        }
    } else {
        console.warn('⚠️ poamDB not available');
    }
    
    // Combine both sources
    const poamArray = [...manualArray, ...vulnerabilityArray];
    console.log(`📊 Total POAMs combined: ${poamArray.length}`);
    
    // Normalize field names for vulnerability POAMs
    const normalizedArray = poamArray.map(p => ({
        ...p,
        risk_level: p.risk_level || p.risk,
        scheduled_completion_date: p.scheduled_completion_date || p.dueDate,
        affected_asset: p.affected_asset || p.asset || (p.affectedAssets ? p.affectedAssets.join(', ') : ''),
        asset_name: p.asset_name || p.asset
    }));
    
    // Calculate POAM metrics by severity
    const totalPOAMs = normalizedArray.length;
    const criticalPOAMs = normalizedArray.filter(p => p.risk_level === 'critical').length;
    const riskAcceptedPOAMs = normalizedArray.filter(p => p.status === 'risk-accepted').length;
    
    console.log(`📈 Metrics calculated - Total: ${totalPOAMs}, Critical: ${criticalPOAMs}, Risk Accepted: ${riskAcceptedPOAMs}`);
    
    // Calculate overdue POAMs
    const overduePOAMs = normalizedArray.filter(p => {
        if (p.status === 'completed' || p.status === 'closed' || p.status === 'risk-accepted') return false;
        return new Date(p.scheduled_completion_date) < new Date();
    }).length;
    
    // Calculate upcoming due dates
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    const sixtyDaysFromNow = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000));
    const ninetyDaysFromNow = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
    
    const dueIn30Days = normalizedArray.filter(p => {
        if (p.status === 'completed' || p.status === 'closed' || p.status === 'risk-accepted') return false;
        const dueDate = new Date(p.scheduled_completion_date);
        return dueDate >= now && dueDate <= thirtyDaysFromNow;
    }).length;
    
    const dueIn60Days = normalizedArray.filter(p => {
        if (p.status === 'completed' || p.status === 'closed' || p.status === 'risk-accepted') return false;
        const dueDate = new Date(p.scheduled_completion_date);
        return dueDate > thirtyDaysFromNow && dueDate <= sixtyDaysFromNow;
    }).length;
    
    // Calculate closed POAMs (completed or closed status)
    const closedPOAMs = normalizedArray.filter(p => {
        return p.status === 'completed' || p.status === 'closed';
    }).length;
    
    // Calculate OS breakdown
    const osCounts = {};
    normalizedArray.forEach(poam => {
        // Extract OS from affected_asset or other fields
        const asset = poam.affected_asset || poam.asset_name || '';
        let os = 'Unknown';
        
        if (asset.toLowerCase().includes('windows')) os = 'Windows';
        else if (asset.toLowerCase().includes('linux')) os = 'Linux';
        else if (asset.toLowerCase().includes('unix')) os = 'Unix';
        else if (asset.toLowerCase().includes('mac') || asset.toLowerCase().includes('osx')) os = 'macOS';
        else if (asset.toLowerCase().includes('ubuntu')) os = 'Ubuntu';
        else if (asset.toLowerCase().includes('centos') || asset.toLowerCase().includes('rhel') || asset.toLowerCase().includes('red hat')) os = 'RHEL/CentOS';
        else if (asset.toLowerCase().includes('debian')) os = 'Debian';
        else if (asset.toLowerCase().includes('cisco')) os = 'Cisco IOS';
        else if (asset.toLowerCase().includes('juniper')) os = 'Juniper';
        
        osCounts[os] = (osCounts[os] || 0) + 1;
    });
    
    // Sort OS counts and get top 3
    const sortedOS = Object.entries(osCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
    
    const osBreakdown = sortedOS.length > 0 
        ? sortedOS.map(([os, count]) => `${os}: ${count}`).join(', ')
        : 'No POAM data available';
    
    // Update UI
    document.getElementById('total-poams-count').textContent = totalPOAMs;
    document.getElementById('critical-poams-count').textContent = criticalPOAMs;
    document.getElementById('risk-accepted-count').textContent = riskAcceptedPOAMs;
    document.getElementById('overdue-poams-count').textContent = overduePOAMs;
    document.getElementById('due-30-days-count').textContent = dueIn30Days;
    document.getElementById('due-60-days-count').textContent = dueIn60Days;
    document.getElementById('poams-closed-count').textContent = closedPOAMs;
    document.getElementById('os-breakdown-container').textContent = osBreakdown;
}

function loadSLAConfig() {
    const savedConfig = localStorage.getItem('slaConfig');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        document.getElementById('sla-critical').value = config.critical || 15;
        document.getElementById('sla-high').value = config.high || 30;
        document.getElementById('sla-medium').value = config.medium || 60;
        document.getElementById('sla-low').value = config.low || 90;
    }
}

function saveSLAConfig() {
    const slaConfig = {
        critical: parseInt(document.getElementById('sla-critical').value),
        high: parseInt(document.getElementById('sla-high').value),
        medium: parseInt(document.getElementById('sla-medium').value),
        low: parseInt(document.getElementById('sla-low').value)
    };
    
    localStorage.setItem('slaConfig', JSON.stringify(slaConfig));
    alert('SLA configuration saved successfully!');
}

function resetSLADefaults() {
    document.getElementById('sla-critical').value = 15;
    document.getElementById('sla-high').value = 30;
    document.getElementById('sla-medium').value = 60;
    document.getElementById('sla-low').value = 90;
    
    // Save defaults
    const defaultConfig = { critical: 15, high: 30, medium: 60, low: 90 };
    localStorage.setItem('slaConfig', JSON.stringify(defaultConfig));
    
    alert('SLA configuration reset to defaults!');
}

function configureSLA() {
    // Navigate to Settings and show SLA section
    showModule('settings');
    // Scroll to SLA configuration section
    setTimeout(() => {
        const slaSection = document.querySelector('.fa-clock').closest('.bg-white');
        if (slaSection) {
            slaSection.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
}

// Update settings initialization to load SLA config
function loadSettings() {
    loadSLAConfig();
    loadRiskFramework();
    loadPOAMIdConfig();
}

// Module initialization
async function initializeModule(moduleName) {
    try {
        document.querySelectorAll('.module').forEach(module => {
            module.classList.add('hidden');
        });

        const targetModule = document.getElementById(moduleName + '-module');
        if (targetModule) {
            targetModule.classList.remove('hidden');
        } else {
            console.warn(`Module '${moduleName}' not found, defaulting to dashboard`);
            const dashboardModule = document.getElementById('dashboard-module');
            if (dashboardModule) {
                dashboardModule.classList.remove('hidden');
            }
            localStorage.removeItem('currentModule');
        }

        if (moduleName === 'dashboard') {
            console.log('🔄 Loading dashboard metrics...');
            if (typeof loadDashboardMetrics === 'function') loadDashboardMetrics();
        } else if (moduleName === 'poam') {
            loadPOAMIdConfig();
            updateApplicationPOAMCounts();
        } else if (moduleName === 'vulnerability' || moduleName === 'vulnerability-tracking') {
            if (typeof showVulnerabilityTab === 'function') showVulnerabilityTab('upload');
            if (typeof displayVulnerabilityPOAMs === 'function') displayVulnerabilityPOAMs();
            if (typeof updateVulnerabilityModuleMetrics === 'function') updateVulnerabilityModuleMetrics();
            if (typeof activeFilters !== 'undefined' && activeFilters.custom === 'needs-review') {
                activeFilters.custom = '';
                console.log('🧹 Cleared disabled needs-review filter');
            }
        } else if (moduleName === 'evidence') {
            loadEvidenceFiles();
        } else if (moduleName === 'reporting') {
            loadReportingData();
        } else if (moduleName === 'settings') {
            loadRiskFramework();
            loadSLAConfig();
            loadPOAMIdConfig();
        }
    } catch (e) {
        console.error('❌ initializeModule failed; falling back to dashboard:', e);
        localStorage.removeItem('currentModule');
        const dashboardModule = document.getElementById('dashboard-module');
        if (dashboardModule) {
            dashboardModule.classList.remove('hidden');
        }
    }
}

async function loadModulePartials() {
    const modules = [
        'dashboard',
        'poam',
        'evidence',
        'vulnerability-tracking',
        'security-control-monitoring',
        'reporting',
        'audit',
        'settings',
        'admin'
    ];
    await Promise.all(modules.map(async name => {
        try {
            const res = await fetch(`partials/${name}.html`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            const el = document.getElementById(`${name}-module`);
            if (el) el.outerHTML = html;
        } catch (e) {
            console.error(`Failed to load partial: ${name}`, e);
        }
    }));
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Application initializing...');

    // Replace old inline module HTML with new mockup-C partials
    await loadModulePartials();

    // Always start with dashboard for consistent user experience
    // Hide all modules first
    document.querySelectorAll('.module').forEach(module => {
        module.classList.add('hidden');
    });
    
    // Show dashboard
    const dashboardModule = document.getElementById('dashboard-module');
    if (dashboardModule) {
        dashboardModule.classList.remove('hidden');
        console.log('✅ Dashboard displayed');
    } else {
        console.error('❌ Dashboard module not found!');
    }
    
    // Set dashboard as current module
    localStorage.setItem('currentModule', 'dashboard');

    // Auto-seed mock POA&M Workbook data on first run so the app has
    // something meaningful to display before a real scan is imported.
    try {
        if (typeof window.seedMockPOAMs === 'function') {
            const alreadySeeded = localStorage.getItem('mockPOAMsSeeded') === '1';
            if (!alreadySeeded) {
                const result = await window.seedMockPOAMs();
                if (result && !result.error) {
                    localStorage.setItem('mockPOAMsSeeded', '1');
                    console.log('✅ Mock POA&M data seeded on first run');
                }
            }
        }
    } catch (e) {
        console.warn('Mock seed on first run failed:', e.message);
    }

    // Auto-seed test evidence after workbook POAMs are ready
    try {
        // One-time reset to re-seed with workbook-only evidence (v4)
        if (localStorage.getItem('testEvidenceV4') !== '1') {
            localStorage.removeItem('testEvidenceSeeded');
            localStorage.removeItem('evidenceVault');
            localStorage.removeItem('testEvidenceV2');
            localStorage.removeItem('testEvidenceV3');
            localStorage.setItem('testEvidenceV4', '1');
        }
        if (typeof window.seedTestEvidence === 'function' && localStorage.getItem('testEvidenceSeeded') !== '1') {
            // Wait for workbook DB to be ready, then seed
            const waitAndSeed = async (attempts) => {
                if (attempts <= 0) { console.warn('Evidence seed: gave up waiting for workbook POAMs'); return; }
                try {
                    if (!window.poamWorkbookDB) { setTimeout(() => waitAndSeed(attempts - 1), 1000); return; }
                    await window.poamWorkbookDB.init();
                    const systems = await window.poamWorkbookDB.getSystems();
                    if (!systems || systems.length === 0) {
                        console.log('Evidence seed: no workbook systems yet, retrying...');
                        setTimeout(() => waitAndSeed(attempts - 1), 1500);
                        return;
                    }
                    const result = await window.seedTestEvidence({ force: true });
                    if (result && !result.error) {
                        localStorage.setItem('testEvidenceSeeded', '1');
                        console.log(`✅ Test evidence seeded: ${result.created} records, ${result.closed} closed`);
                        // Refresh evidence display if user is already on that tab
                        if (typeof displayEvidenceRepository === 'function') displayEvidenceRepository();
                        if (typeof populatePOAMDropdown === 'function') populatePOAMDropdown();
                    }
                } catch (e) {
                    console.warn('Evidence seed attempt failed:', e.message);
                    setTimeout(() => waitAndSeed(attempts - 1), 1500);
                }
            };
            waitAndSeed(10);
        }
    } catch (e) {
        console.warn('Evidence seed check failed:', e.message);
    }

    // Load dashboard metrics
    try {
        if (typeof loadDashboardMetrics === 'function') {
            loadDashboardMetrics();
        }
    } catch (e) {
        console.error('❌ Error loading dashboard metrics:', e);
    }
});
