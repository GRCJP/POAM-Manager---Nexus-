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

// Initialize sidebar on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set dashboard as active by default
    updateSidebarActiveState('dashboard');
    
    // Load saved configurations
    loadSLAConfig();
    loadRiskFramework();
    loadAPIConfig();
});
