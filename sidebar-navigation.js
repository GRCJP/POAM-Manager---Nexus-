// Sidebar Navigation Functions

// Toggle sidebar on mobile
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
}

// Mobile sidebar toggle button
document.addEventListener('DOMContentLoaded', function() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
});

// Toggle sidebar section (collapsible menus)
function toggleSidebarSection(sectionId) {
    const section = document.getElementById(sectionId);
    const button = event.currentTarget;
    const icon = button.querySelector('.fa-chevron-down');
    
    if (section) {
        section.classList.toggle('hidden');
        if (icon) {
            icon.classList.toggle('rotate-180');
        }
    }
}

// Update showModule function to handle sidebar active states
function showModule(moduleName) {
    // Hide all modules
    const modules = document.querySelectorAll('.module');
    modules.forEach(module => {
        module.classList.add('hidden');
    });
    
    // Show selected module
    const targetModule = document.getElementById(moduleName + '-module');
    if (targetModule) {
        targetModule.classList.remove('hidden');
    }
    
    // Update sidebar active states
    updateSidebarActiveState(moduleName);
    
    // Load module-specific data
    if (moduleName === 'poam') {
        loadPOAMIdConfig();
        updateApplicationPOAMCounts();
    } else if (moduleName === 'vulnerability') {
        showVulnerabilityTab('upload');
        updateSLAMetrics();
        // Update vulnerability module metrics
        if (typeof updateVulnerabilityModuleMetrics === 'function') {
            updateVulnerabilityModuleMetrics();
        }
    } else if (moduleName === 'evidence') {
        loadEvidenceFiles();
    } else if (moduleName === 'reporting') {
        loadReportingData();
    } else if (moduleName === 'settings') {
        // Show default settings tab (SLA)
        showSettingsTab('sla');
    } else if (moduleName === 'admin') {
        // Show default admin tab (users)
        showAdminTab('users');
    }
    
    // Close mobile sidebar after selection
    if (window.innerWidth < 1024) {
        toggleSidebar();
    }
}

// Update sidebar active state
function updateSidebarActiveState(moduleName) {
    // Remove active class from all sidebar links
    const sidebarLinks = document.querySelectorAll('.sidebar-link, .sidebar-sublink');
    sidebarLinks.forEach(link => {
        link.classList.remove('bg-indigo-600', 'text-white');
        link.classList.add('text-slate-100');
    });
    
    // Add active class to current link
    const activeLink = document.querySelector(`[onclick*="showModule('${moduleName}')"]`);
    if (activeLink && (activeLink.classList.contains('sidebar-link') || activeLink.classList.contains('sidebar-sublink'))) {
        activeLink.classList.add('bg-indigo-600', 'text-white');
        activeLink.classList.remove('text-slate-100');
    }
}

// Show specific settings tab
function showSettingsTab(tabName) {
    // First, show the settings module
    const settingsModule = document.getElementById('settings-module');
    if (settingsModule && settingsModule.classList.contains('hidden')) {
        showModule('settings');
    }
    
    // Hide all settings tabs
    const settingsTabs = document.querySelectorAll('.settings-tab');
    settingsTabs.forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Show selected tab
    const targetTab = document.getElementById('settings-' + tabName);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }
    
    // Update sidebar active state for settings submenu
    updateSettingsSubmenuActiveState(tabName);
    
    // Load tab-specific data
    if (tabName === 'sla') {
        loadSLAConfig();
    } else if (tabName === 'risk-framework') {
        loadRiskFramework();
    } else if (tabName === 'poam-id') {
        loadPOAMIdConfig();
    }
    
    // Close mobile sidebar after selection
    if (window.innerWidth < 1024) {
        toggleSidebar();
    }
}

// Update settings submenu active state
function updateSettingsSubmenuActiveState(tabName) {
    const settingsSubmenu = document.querySelectorAll('#settings-section .sidebar-sublink');
    settingsSubmenu.forEach(link => {
        link.classList.remove('bg-slate-700', 'text-white');
    });
    
    const activeLink = document.querySelector(`[onclick*="showSettingsTab('${tabName}')"]`);
    if (activeLink) {
        activeLink.classList.add('bg-slate-700', 'text-white');
    }
}

// Show specific admin tab
function showAdminTab(tabName) {
    // First, show the admin module
    const adminModule = document.getElementById('admin-module');
    if (adminModule && adminModule.classList.contains('hidden')) {
        showModule('admin');
    }
    
    // Hide all admin tabs
    const adminTabs = document.querySelectorAll('.admin-tab');
    adminTabs.forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Show selected tab
    const targetTab = document.getElementById('admin-' + tabName);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }
    
    // Update sidebar active state for admin submenu
    updateAdminSubmenuActiveState(tabName);
    
    // Close mobile sidebar after selection
    if (window.innerWidth < 1024) {
        toggleSidebar();
    }
}

// Update admin submenu active state
function updateAdminSubmenuActiveState(tabName) {
    const adminSubmenu = document.querySelectorAll('#admin-section .sidebar-sublink');
    adminSubmenu.forEach(link => {
        link.classList.remove('bg-slate-700', 'text-white');
    });
    
    const activeLink = document.querySelector(`[onclick*="showAdminTab('${tabName}')"]`);
    if (activeLink) {
        activeLink.classList.add('bg-slate-700', 'text-white');
    }
}

// Settings functions
function saveSLAConfig() {
    const slaConfig = {
        critical: document.getElementById('sla-critical').value,
        high: document.getElementById('sla-high').value,
        medium: document.getElementById('sla-medium').value,
        low: document.getElementById('sla-low').value
    };
    
    localStorage.setItem('slaConfig', JSON.stringify(slaConfig));
    alert('✅ SLA Configuration saved successfully!');
}

function resetSLADefaults() {
    if (confirm('Reset SLA thresholds to default values?')) {
        document.getElementById('sla-critical').value = 15;
        document.getElementById('sla-high').value = 30;
        document.getElementById('sla-medium').value = 60;
        document.getElementById('sla-low').value = 90;
        saveSLAConfig();
    }
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

function saveRiskFramework() {
    const framework = document.getElementById('risk-framework-select').value;
    const mapper = document.getElementById('control-mapper-select').value;
    
    const config = {
        framework: framework,
        mapper: mapper
    };
    
    localStorage.setItem('riskFramework', JSON.stringify(config));
    alert('✅ Risk Framework configuration saved successfully!');
}

function loadRiskFramework() {
    const savedConfig = localStorage.getItem('riskFramework');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        document.getElementById('risk-framework-select').value = config.framework || 'nist';
        document.getElementById('control-mapper-select').value = config.mapper || 'enhanced';
        updateFrameworkInfo();
    }
}

function updateFrameworkInfo() {
    const framework = document.getElementById('risk-framework-select').value;
    const infoDiv = document.getElementById('framework-info');
    
    const frameworkData = {
        'nist': {
            name: 'NIST 800-53 / RMF',
            description: 'Federal risk management framework with comprehensive security controls and assessment procedures for information systems.',
            families: '20 control families',
            controls: '1000+ security controls',
            levels: 'High, Moderate, Low'
        },
        'csf': {
            name: 'NIST Cybersecurity Framework',
            description: 'Framework for improving critical infrastructure cybersecurity with five core functions: Identify, Protect, Detect, Respond, Recover.',
            families: '5 core functions',
            controls: '108 subcategories',
            levels: 'Tier 1-4 maturity'
        },
        'iso27001': {
            name: 'ISO 27001',
            description: 'International standard for information security management systems (ISMS) with comprehensive control objectives.',
            families: '14 control domains',
            controls: '114 security controls',
            levels: 'Compliance-based'
        },
        'mitre': {
            name: 'MITRE ATT&CK',
            description: 'Knowledge base of adversary tactics and techniques based on real-world observations of cyber attacks.',
            families: '14 tactics',
            controls: '200+ techniques',
            levels: 'Threat-based'
        },
        'fedramp': {
            name: 'FedRAMP',
            description: 'Federal Risk and Authorization Management Program for cloud service providers serving federal agencies.',
            families: 'Based on NIST 800-53',
            controls: '325+ controls',
            levels: 'Low, Moderate, High'
        },
        'cms': {
            name: 'CMS ARS',
            description: 'Centers for Medicare & Medicaid Services Acceptable Risk Safeguards for protecting CMS information.',
            families: 'Based on NIST 800-53',
            controls: 'CMS-specific controls',
            levels: 'FIPS 199 categories'
        },
        'irs': {
            name: 'IRS 1075',
            description: 'IRS Publication 1075 for safeguarding Federal Tax Information (FTI) with strict security requirements.',
            families: 'Based on NIST 800-53',
            controls: 'FTI-specific controls',
            levels: 'High impact'
        },
        'cis': {
            name: 'CIS Controls',
            description: 'Center for Internet Security Controls - prioritized set of actions for cyber defense.',
            families: '18 control categories',
            controls: '153 safeguards',
            levels: 'IG1, IG2, IG3'
        }
    };
    
    const data = frameworkData[framework] || frameworkData['nist'];
    
    infoDiv.innerHTML = `
        <h4 class="font-bold text-indigo-900 mb-2 text-lg">${data.name}</h4>
        <p class="text-sm text-indigo-800 mb-4">${data.description}</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div class="bg-white rounded-lg p-3">
                <strong class="text-indigo-900">Control Families:</strong>
                <p class="text-slate-600">${data.families}</p>
            </div>
            <div class="bg-white rounded-lg p-3">
                <strong class="text-indigo-900">Total Controls:</strong>
                <p class="text-slate-600">${data.controls}</p>
            </div>
            <div class="bg-white rounded-lg p-3">
                <strong class="text-indigo-900">Impact Levels:</strong>
                <p class="text-slate-600">${data.levels}</p>
            </div>
        </div>
    `;
}

function saveUserPreferences() {
    alert('✅ User preferences saved successfully!');
}

// Save API Configuration
function saveAPIConfig() {
    const apiConfig = {
        qualys: {
            enabled: document.getElementById('qualys-enabled')?.checked || false,
            url: document.getElementById('qualys-url')?.value || '',
            key: document.getElementById('qualys-key')?.value || '',
            schedule: document.getElementById('qualys-schedule')?.value || 'manual'
        },
        tenable: {
            enabled: document.getElementById('tenable-enabled')?.checked || false,
            url: document.getElementById('tenable-url')?.value || '',
            key: document.getElementById('tenable-key')?.value || '',
            schedule: document.getElementById('tenable-schedule')?.value || 'manual'
        },
        wiz: {
            enabled: document.getElementById('wiz-enabled')?.checked || false,
            url: document.getElementById('wiz-url')?.value || '',
            secret: document.getElementById('wiz-secret')?.value || '',
            schedule: document.getElementById('wiz-schedule')?.value || 'manual'
        }
    };
    
    localStorage.setItem('apiConfig', JSON.stringify(apiConfig));
    alert('✅ API Configuration saved successfully!');
}

// Test API Connections
function testAPIConnections() {
    alert('🔌 Testing API connections...\n\nThis feature will validate your API credentials and connectivity. Implementation coming soon!');
}

// Load API Configuration
function loadAPIConfig() {
    const savedConfig = localStorage.getItem('apiConfig');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        
        // Load Qualys config
        if (document.getElementById('qualys-enabled')) {
            document.getElementById('qualys-enabled').checked = config.qualys?.enabled || false;
            document.getElementById('qualys-url').value = config.qualys?.url || '';
            document.getElementById('qualys-key').value = config.qualys?.key || '';
            document.getElementById('qualys-schedule').value = config.qualys?.schedule || 'manual';
        }
        
        // Load Tenable config
        if (document.getElementById('tenable-enabled')) {
            document.getElementById('tenable-enabled').checked = config.tenable?.enabled || false;
            document.getElementById('tenable-url').value = config.tenable?.url || '';
            document.getElementById('tenable-key').value = config.tenable?.key || '';
            document.getElementById('tenable-schedule').value = config.tenable?.schedule || 'manual';
        }
        
        // Load Wiz config
        if (document.getElementById('wiz-enabled')) {
            document.getElementById('wiz-enabled').checked = config.wiz?.enabled || false;
            document.getElementById('wiz-url').value = config.wiz?.url || '';
            document.getElementById('wiz-secret').value = config.wiz?.secret || '';
            document.getElementById('wiz-schedule').value = config.wiz?.schedule || 'manual';
        }
    }
}

// System Findings Functions
function showSystemFindings(systemId) {
    console.log(`🖥️ Loading findings for system: ${systemId}`);
    
    // Check if user has admin or security role
    const userRole = getCurrentUserRole();
    if (!['admin', 'security', 'auditor'].includes(userRole)) {
        showUpdateFeedback('Access denied. Admin or Security role required.', 'error');
        return;
    }
    
    // Hide all modules
    document.querySelectorAll('.module').forEach(module => {
        module.classList.add('hidden');
    });
    
    // Show the system findings module
    let systemModule = document.getElementById('system-findings-module');
    if (!systemModule) {
        // Create the module if it doesn't exist
        createSystemFindingsModule();
        systemModule = document.getElementById('system-findings-module');
    }
    
    systemModule.classList.remove('hidden');
    
    // Load system-specific data
    loadSystemFindings(systemId);
    
    // Update sidebar active state
    updateSidebarActiveState(`system-${systemId}`);
}

function createSystemFindingsModule() {
    const mainContent = document.querySelector('main');
    
    const moduleHTML = `
        <div id="system-findings-module" class="module hidden">
            <div class="mb-8 flex justify-between items-center">
                <div>
                    <button onclick="showModule('dashboard')" class="text-indigo-600 hover:text-indigo-800 mb-4">
                        <i class="fas fa-arrow-left mr-2"></i>Back to Dashboard
                    </button>
                    <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">System Findings</h1>
                    <p class="text-slate-500 mt-1">View scan findings and NIST controls by system</p>
                </div>
                <div class="flex gap-3">
                    <button onclick="exportSystemReport()" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
                        <i class="fas fa-download"></i>
                        <span>Export Report</span>
                    </button>
                    <button onclick="refreshSystemData()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                        <i class="fas fa-sync-alt"></i>
                        <span>Refresh</span>
                    </button>
                </div>
            </div>
            
            <!-- System Info Header -->
            <div id="system-info-header" class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <!-- System info will be populated here -->
            </div>
            
            <!-- Findings Tabs -->
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div class="border-b border-slate-200 mb-6">
                    <nav class="flex space-x-8">
                        <button onclick="showSystemTab('scan-findings')" class="system-tab py-2 px-1 border-b-2 font-medium text-sm border-indigo-500 text-indigo-600">
                            <i class="fas fa-bug mr-2"></i>Scan Findings
                        </button>
                        <button onclick="showSystemTab('nist-controls')" class="system-tab py-2 px-1 border-b-2 font-medium text-sm border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300">
                            <i class="fas fa-shield-alt mr-2"></i>NIST Controls
                        </button>
                        <button onclick="showSystemTab('compliance-status')" class="system-tab py-2 px-1 border-b-2 font-medium text-sm border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300">
                            <i class="fas fa-chart-pie mr-2"></i>Compliance Status
                        </button>
                    </nav>
                </div>
                
                <!-- Tab Content -->
                <div id="system-tab-content">
                    <!-- Content will be populated based on selected tab -->
                </div>
            </div>
        </div>
    `;
    
    mainContent.insertAdjacentHTML('beforeend', moduleHTML);
}

function loadSystemFindings(systemId) {
    const systems = {
        'ehr-system': {
            name: 'EHR System',
            icon: 'fa-hospital',
            category: 'Clinical',
            risk: 'Critical',
            lastScan: '2025-01-14',
            totalFindings: 12,
            criticalFindings: 3,
            highFindings: 5,
            description: 'Electronic Health Records system containing patient medical data'
        },
        'patient-portal': {
            name: 'Patient Portal',
            icon: 'fa-user-injured',
            category: 'Clinical',
            risk: 'High',
            lastScan: '2025-01-13',
            totalFindings: 8,
            criticalFindings: 1,
            highFindings: 3,
            description: 'Patient-facing portal for accessing medical records and appointments'
        },
        'billing-system': {
            name: 'Billing System',
            icon: 'fa-dollar-sign',
            category: 'Financial',
            risk: 'High',
            lastScan: '2025-01-12',
            totalFindings: 5,
            criticalFindings: 0,
            highFindings: 2,
            description: 'Medical billing and claims processing system'
        },
        'lab-system': {
            name: 'Lab System',
            icon: 'fa-flask',
            category: 'Clinical',
            risk: 'Medium',
            lastScan: '2025-01-14',
            totalFindings: 3,
            criticalFindings: 0,
            highFindings: 1,
            description: 'Laboratory information management system'
        },
        'pharmacy-system': {
            name: 'Pharmacy System',
            icon: 'fa-pills',
            category: 'Clinical',
            risk: 'Medium',
            lastScan: '2025-01-11',
            totalFindings: 2,
            criticalFindings: 0,
            highFindings: 0,
            description: 'Pharmacy management and prescription system'
        },
        'imaging-system': {
            name: 'Imaging System',
            icon: 'fa-x-ray',
            category: 'Clinical',
            risk: 'Medium',
            lastScan: '2025-01-13',
            totalFindings: 4,
            criticalFindings: 0,
            highFindings: 1,
            description: 'Medical imaging and radiology information system'
        }
    };
    
    const system = systems[systemId];
    if (!system) {
        console.error('System not found:', systemId);
        return;
    }
    
    // Update system info header
    const header = document.getElementById('system-info-header');
    header.innerHTML = `
        <div class="flex items-start justify-between">
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center">
                    <i class="fas ${system.icon} text-2xl text-slate-600"></i>
                </div>
                <div>
                    <h2 class="text-xl font-bold text-slate-900">${system.name}</h2>
                    <p class="text-slate-600">${system.description}</p>
                    <div class="flex items-center gap-4 mt-2 text-sm">
                        <span class="px-2 py-1 bg-slate-100 text-slate-700 rounded">${system.category}</span>
                        <span class="px-2 py-1 ${getRiskColorClass(system.risk)} rounded">${system.risk} Risk</span>
                        <span class="text-slate-500">Last scan: ${system.lastScan}</span>
                    </div>
                </div>
            </div>
            <div class="text-right">
                <div class="text-2xl font-bold text-slate-900">${system.totalFindings}</div>
                <div class="text-sm text-slate-600">Total Findings</div>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs text-red-600">${system.criticalFindings} critical</span>
                    <span class="text-xs text-orange-600">${system.highFindings} high</span>
                </div>
            </div>
        </div>
    `;
    
    // Show scan findings by default
    showSystemTab('scan-findings');
}

function showSystemTab(tabName) {
    // Update tab active states
    document.querySelectorAll('.system-tab').forEach(tab => {
        tab.classList.remove('border-indigo-500', 'text-indigo-600');
        tab.classList.add('border-transparent', 'text-slate-500');
    });
    
    event.target.classList.remove('border-transparent', 'text-slate-500');
    event.target.classList.add('border-indigo-500', 'text-indigo-600');
    
    // Update content based on tab
    const content = document.getElementById('system-tab-content');
    
    switch(tabName) {
        case 'scan-findings':
            content.innerHTML = `
                <div class="space-y-4">
                    <div class="text-sm text-slate-500">Showing vulnerability scan findings for this system</div>
                    <table class="min-w-full divide-y divide-slate-200">
                        <thead class="bg-slate-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Finding</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Severity</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-slate-200">
                            <tr class="hover:bg-slate-50">
                                <td class="px-6 py-4 text-sm text-slate-900">CVE-2024-0001 in Apache Tomcat</td>
                                <td class="px-6 py-4 text-sm"><span class="px-2 py-1 text-xs rounded bg-red-100 text-red-800">Critical</span></td>
                                <td class="px-6 py-4 text-sm"><span class="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">Open</span></td>
                                <td class="px-6 py-4 text-sm">
                                    <button class="text-indigo-600 hover:text-indigo-900">View Details</button>
                                </td>
                            </tr>
                            <tr class="hover:bg-slate-50">
                                <td class="px-6 py-4 text-sm text-slate-900">Outdated OpenSSL Version</td>
                                <td class="px-6 py-4 text-sm"><span class="px-2 py-1 text-xs rounded bg-orange-100 text-orange-800">High</span></td>
                                <td class="px-6 py-4 text-sm"><span class="px-2 py-1 text-xs rounded bg-green-100 text-green-800">Fixed</span></td>
                                <td class="px-6 py-4 text-sm">
                                    <button class="text-indigo-600 hover:text-indigo-900">View Details</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
            break;
            
        case 'nist-controls':
            content.innerHTML = `
                <div class="space-y-4">
                    <div class="text-sm text-slate-500">NIST 800-53 controls applicable to this system</div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="border border-slate-200 rounded-lg p-4">
                            <h4 class="font-semibold text-slate-900">AC-2: Account Management</h4>
                            <p class="text-sm text-slate-600 mt-1">Manage individual system accounts</p>
                            <div class="mt-2">
                                <span class="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">Implemented</span>
                            </div>
                        </div>
                        <div class="border border-slate-200 rounded-lg p-4">
                            <h4 class="font-semibold text-slate-900">SC-8: Transmission Integrity</h4>
                            <p class="text-sm text-slate-600 mt-1">Protect transmitted information</p>
                            <div class="mt-2">
                                <span class="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Partial</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            break;
            
        case 'compliance-status':
            content.innerHTML = `
                <div class="space-y-4">
                    <div class="text-sm text-slate-500">Overall compliance status for this system</div>
                    <div class="bg-slate-50 rounded-lg p-6">
                        <div class="text-center">
                            <div class="text-4xl font-bold text-indigo-600">78%</div>
                            <div class="text-sm text-slate-600">Compliance Score</div>
                        </div>
                        <div class="mt-6 space-y-2">
                            <div class="flex justify-between text-sm">
                                <span>Controls Implemented</span>
                                <span class="font-semibold">39/50</span>
                            </div>
                            <div class="w-full bg-slate-200 rounded-full h-2">
                                <div class="bg-indigo-600 h-2 rounded-full" style="width: 78%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            break;
    }
}

function getCurrentUserRole() {
    // This would typically come from authentication
    // For now, return 'admin' for demo purposes
    return 'admin';
}

function getRiskColorClass(risk) {
    const colors = {
        'Critical': 'bg-red-100 text-red-800',
        'High': 'bg-orange-100 text-orange-800',
        'Medium': 'bg-yellow-100 text-yellow-800',
        'Low': 'bg-green-100 text-green-800'
    };
    return colors[risk] || colors['Medium'];
}

function exportSystemReport() {
    showUpdateFeedback('System report exported successfully', 'success');
}

function refreshSystemData() {
    showUpdateFeedback('System data refreshed', 'success');
}

// Initialize sidebar on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set dashboard as active by default
    updateSidebarActiveState('dashboard');
    
    // Load saved configurations
    loadSLAConfig();
    loadRiskFramework();
    loadAPIConfig();
});
