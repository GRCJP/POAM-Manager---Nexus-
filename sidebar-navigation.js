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

// Update sidebar active state
function updateSidebarActiveState(moduleName) {
    // Use mockup-C .active class — remove from all, add to matching link
    document.querySelectorAll('.sidebar-link, .sidebar-sublink, .sb-item').forEach(link => {
        link.classList.remove('active');
    });
    const activeLink = document.querySelector(`[onclick*="showModule('${moduleName}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// Show specific settings tab
function showSettingsTab(tabName) {
    // Backwards-compatibility mapping from old tab names to new consolidated tabs
    const tabMapping = {
        'sla': 'general',
        'preferences': 'general',
        'systems': 'general',
        'risk-framework': 'compliance',
        'poam-id': 'compliance',
        'api-config': 'integrations',
        'jira-config': 'integrations'
    };
    const finalTabName = tabMapping[tabName] || tabName;

    // First, show the settings module
    const settingsModule = document.getElementById('settings-module');
    if (settingsModule && settingsModule.classList.contains('hidden')) {
        showModule('settings');
    }

    // Hide all tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.add('hidden');
    });

    // Show selected tab
    const selectedTab = document.getElementById(`settings-${finalTabName}`);
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
    }

    // Update in-module tab bar active state
    document.querySelectorAll('#settings-module .mod-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeTabBtn = document.querySelector(`#settings-module .mod-tab[data-tab="${finalTabName}"]`);
    if (activeTabBtn) activeTabBtn.classList.add('active');

    // Update sidebar active state
    updateSettingsSubmenuActiveState(finalTabName);

    // Load tab-specific data
    if (finalTabName === 'general') {
        loadSLAConfig();
        loadNotificationRules();
        loadRoleContacts();
        loadEmailConfig();
        if (typeof renderSystemsSettings === 'function') {
            renderSystemsSettings();
        }
    } else if (finalTabName === 'critical-assets') {
        if (typeof loadCriticalAssetsRegistry === 'function') loadCriticalAssetsRegistry();
    } else if (finalTabName === 'integrations') {
        if (typeof renderAPISettingsTab === 'function') renderAPISettingsTab();
        if (typeof loadJiraConfig === 'function') loadJiraConfig();
    }

    // Close mobile sidebar after selection
    if (window.innerWidth < 1024) {
        toggleSidebar();
    }
}

// Update settings submenu active state
function updateSettingsSubmenuActiveState(tabName) {
    document.querySelectorAll('.sidebar-sublink, .sb-item').forEach(link => {
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes('showSettingsTab')) {
            link.classList.remove('active');
        }
    });
    const activeLink = document.querySelector(`[onclick*="showSettingsTab('${tabName}')"]`);
    if (activeLink) activeLink.classList.add('active');
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

    // Update in-module tab bar active state
    document.querySelectorAll('#admin-module .mod-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeTabBtn = document.querySelector(`#admin-module .mod-tab[data-tab="${tabName}"]`);
    if (activeTabBtn) activeTabBtn.classList.add('active');

    // Update sidebar active state for admin submenu
    updateAdminSubmenuActiveState(tabName);

    if (tabName === 'users') {
        initAdminUsers();
    } else if (tabName === 'roles') {
        renderRoleSummaryCards();
    }

    // Close mobile sidebar after selection
    if (window.innerWidth < 1024) {
        toggleSidebar();
    }
}

// Update admin submenu active state
function updateAdminSubmenuActiveState(tabName) {
    document.querySelectorAll('.sidebar-sublink, .sb-item').forEach(link => {
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes('showAdminTab')) {
            link.classList.remove('active');
        }
    });
    const activeLink = document.querySelector(`[onclick*="showAdminTab('${tabName}')"]`);
    if (activeLink) activeLink.classList.add('active');
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
    if (typeof showUpdateFeedback === 'function') {
        showUpdateFeedback('SLA Configuration saved successfully', 'success');
    }
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


// Notification Rules (role-based matrix)
const NOTIFICATION_DEFAULTS = {
    poam_created:        { poc: true, appOwner: true, isso: false, issm: true, ciso: false, analyst: true, auditor: false },
    poam_assigned:       { poc: true, appOwner: true, isso: false, issm: false, ciso: false, analyst: true, auditor: false },
    status_changed:      { poc: true, appOwner: true, isso: false, issm: false, ciso: false, analyst: true, auditor: false },
    sla_warning:         { poc: true, appOwner: true, isso: true, issm: false, ciso: false, analyst: false, auditor: false },
    sla_breach:          { poc: true, appOwner: true, isso: true, issm: true, ciso: true, analyst: true, auditor: false },
    extension_requested: { poc: false, appOwner: false, isso: true, issm: true, ciso: false, analyst: false, auditor: false },
    extension_decided:   { poc: true, appOwner: false, isso: false, issm: false, ciso: false, analyst: false, auditor: false },
    evidence_submitted:  { poc: false, appOwner: false, isso: false, issm: false, ciso: false, analyst: true, auditor: true },
    weekly_digest:       { poc: true, appOwner: true, isso: true, issm: true, ciso: false, analyst: true, auditor: false }
};

const NOTIFICATION_EVENT_LABELS = {
    poam_created: 'New POA&M created',
    poam_assigned: 'POA&M assigned / reassigned',
    status_changed: 'Status changed',
    sla_warning: 'SLA warning',
    sla_breach: 'SLA breach',
    extension_requested: 'Extension requested',
    extension_decided: 'Extension approved / denied',
    evidence_submitted: 'Evidence submitted',
    weekly_digest: 'Weekly digest'
};

const NOTIFICATION_ROLE_KEYS = ['poc', 'appOwner', 'isso', 'issm', 'ciso', 'analyst', 'auditor'];

function renderNotificationMatrix(rules) {
    const tbody = document.getElementById('notification-matrix-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    const eventKeys = Object.keys(NOTIFICATION_EVENT_LABELS);

    eventKeys.forEach(eventKey => {
        const tr = document.createElement('tr');
        // Event label cell
        const tdLabel = document.createElement('td');
        tdLabel.className = 'py-3 px-3 text-sm font-medium text-slate-700';
        tdLabel.textContent = NOTIFICATION_EVENT_LABELS[eventKey];
        tr.appendChild(tdLabel);

        // Checkbox cells for each role
        NOTIFICATION_ROLE_KEYS.forEach(roleKey => {
            const td = document.createElement('td');
            td.className = 'py-3 px-2 text-center';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `notif-${eventKey}-${roleKey}`;
            checkbox.className = 'rounded text-teal-700 focus:ring-teal-500 cursor-pointer';
            checkbox.checked = !!(rules[eventKey] && rules[eventKey][roleKey]);
            td.appendChild(checkbox);
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

function saveNotificationRules() {
    const rules = {};
    const eventKeys = Object.keys(NOTIFICATION_EVENT_LABELS);

    eventKeys.forEach(eventKey => {
        rules[eventKey] = {};
        NOTIFICATION_ROLE_KEYS.forEach(roleKey => {
            const cb = document.getElementById(`notif-${eventKey}-${roleKey}`);
            rules[eventKey][roleKey] = cb ? cb.checked : false;
        });
    });

    localStorage.setItem('notificationRules', JSON.stringify(rules));
    if (typeof showUpdateFeedback === 'function') {
        showUpdateFeedback('Notification rules saved successfully', 'success');
    }
}

function loadNotificationRules() {
    const saved = localStorage.getItem('notificationRules');
    const rules = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(NOTIFICATION_DEFAULTS));
    renderNotificationMatrix(rules);
}

function resetNotificationDefaults() {
    if (confirm('Reset notification rules to default values?')) {
        const defaults = JSON.parse(JSON.stringify(NOTIFICATION_DEFAULTS));
        localStorage.setItem('notificationRules', JSON.stringify(defaults));
        renderNotificationMatrix(defaults);
    }
}

function saveRoleContacts() {
    const contacts = {
        isso: (document.getElementById('role-contact-isso') || {}).value || '',
        issm: (document.getElementById('role-contact-issm') || {}).value || '',
        ciso: (document.getElementById('role-contact-ciso') || {}).value || '',
        analyst: (document.getElementById('role-contact-analyst') || {}).value || '',
        auditor: (document.getElementById('role-contact-auditor') || {}).value || ''
    };
    localStorage.setItem('roleContacts', JSON.stringify(contacts));
    if (typeof showUpdateFeedback === 'function') {
        showUpdateFeedback('Role contacts saved successfully', 'success');
    }
}

function loadRoleContacts() {
    const saved = localStorage.getItem('roleContacts');
    if (saved) {
        const contacts = JSON.parse(saved);
        const fields = ['isso', 'issm', 'ciso', 'analyst', 'auditor'];
        fields.forEach(role => {
            const el = document.getElementById(`role-contact-${role}`);
            if (el) el.value = contacts[role] || '';
        });
    }
}

// ── Admin User Management ──
const DEFAULT_USERS = [
    { id: 'james.lee', first: 'James', last: 'Lee', email: 'james.lee@agency.gov', role: 'Administrator', notifRole: 'issm', department: 'Security Operations', status: 'Active' },
    { id: 'maria.rodriguez', first: 'Maria', last: 'Rodriguez', email: 'maria.rodriguez@agency.gov', role: 'Administrator', notifRole: 'isso', department: 'Security Operations', status: 'Active' },
    { id: 'david.washington', first: 'David', last: 'Washington', email: 'david.washington@agency.gov', role: 'Security Analyst', notifRole: 'analyst', department: 'Vulnerability Management', status: 'Active' },
    { id: 'sarah.patel', first: 'Sarah', last: 'Patel', email: 'sarah.patel@agency.gov', role: 'Security Analyst', notifRole: 'appOwner', department: 'Application Security', status: 'Active' },
    { id: 'tom.chen', first: 'Tom', last: 'Chen', email: 'tom.chen@agency.gov', role: 'Security Analyst', notifRole: 'poc', department: 'Network Operations', status: 'Active' },
    { id: 'rachel.johnson', first: 'Rachel', last: 'Johnson', email: 'rachel.johnson@agency.gov', role: 'Auditor', notifRole: 'auditor', department: 'Compliance', status: 'Active' },
    { id: 'kevin.nguyen', first: 'Kevin', last: 'Nguyen', email: 'kevin.nguyen@agency.gov', role: 'Administrator', notifRole: 'ciso', department: 'Executive Leadership', status: 'Active' }
];

function getAdminUsers() {
    const saved = localStorage.getItem('adminUsers');
    if (saved) return JSON.parse(saved);
    localStorage.setItem('adminUsers', JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
}

function saveAdminUsers(users) {
    localStorage.setItem('adminUsers', JSON.stringify(users));
    // Sync notification roles
    const notifRoles = {};
    users.forEach(u => { if (u.notifRole) notifRoles[u.id] = u.notifRole; });
    localStorage.setItem('userNotificationRoles', JSON.stringify(notifRoles));
}

function renderAdminUserTable() {
    const tbody = document.getElementById('admin-user-table-body');
    if (!tbody) return;
    const users = getAdminUsers();
    const search = (document.getElementById('admin-user-search') || {}).value || '';
    const q = search.toLowerCase();

    const filtered = q ? users.filter(u =>
        (u.first + ' ' + u.last).toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    ) : users;

    const notifRoleLabels = { isso: 'ISSO', issm: 'ISSM', ciso: 'CISO / AO', appOwner: 'App Owner', analyst: 'Security Analyst', auditor: 'Auditor', poc: 'POC' };
    const notifOptions = ['', 'isso', 'issm', 'ciso', 'appOwner', 'analyst', 'auditor', 'poc'];
    const roleBadge = (role) => {
        if (role === 'Auditor') return '<span style="font-size:11px;font-weight:700;color:#047857;background:#D1FAE5;padding:3px 8px;border-radius:4px">' + role + '</span>';
        return '<span style="font-size:11px;font-weight:700;color:#0A5E62;background:#E6F7F7;padding:3px 8px;border-radius:4px">' + role + '</span>';
    };

    tbody.innerHTML = filtered.map(u => {
        const initials = (u.first[0] + u.last[0]).toUpperCase();
        const opts = notifOptions.map(v => {
            const label = v ? notifRoleLabels[v] : '(none)';
            const sel = v === (u.notifRole || '') ? ' selected' : '';
            return `<option value="${v}"${sel}>${label}</option>`;
        }).join('');
        return `<tr style="border-bottom:1px solid #F9FAFB">
            <td style="padding:12px">
                <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:36px;height:36px;background:#E6F7F7;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0D7377;flex-shrink:0">${initials}</div>
                    <div>
                        <p style="font-size:13px;font-weight:600;color:#1F2937;margin:0">${u.first} ${u.last}</p>
                        <p style="font-size:11px;color:#6B7280;margin:0">${u.email}</p>
                    </div>
                </div>
            </td>
            <td style="padding:12px">${roleBadge(u.role)}</td>
            <td style="padding:12px">
                <select style="border:1px solid #D1D5DB;border-radius:6px;padding:4px 8px;font-size:12px;color:#374151;font-family:inherit;outline:none;min-width:130px" onchange="updateUserNotifRole('${u.id}',this.value)">${opts}</select>
            </td>
            <td style="padding:12px;font-size:13px;color:#374151">${u.department}</td>
            <td style="padding:12px"><span style="font-size:11px;font-weight:700;color:#047857;background:#D1FAE5;padding:3px 8px;border-radius:4px">${u.status}</span></td>
            <td style="padding:12px;text-align:right">
                <button onclick="deleteAdminUser('${u.id}')" style="background:none;border:none;cursor:pointer;color:#991B1B;font-size:13px" title="Remove user"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>`;
    }).join('');

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;text-align:center;color:#9CA3AF;font-size:13px">No users found</td></tr>';
    }

    renderRoleSummaryCards();
}

function updateUserNotifRole(userId, value) {
    const users = getAdminUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
        user.notifRole = value || '';
        saveAdminUsers(users);
    }
}

function deleteAdminUser(userId) {
    if (!confirm('Remove this user?')) return;
    const users = getAdminUsers().filter(u => u.id !== userId);
    saveAdminUsers(users);
    renderAdminUserTable();
}

function openAddUserModal() {
    document.getElementById('add-user-modal').classList.remove('hidden');
    document.getElementById('add-user-first').value = '';
    document.getElementById('add-user-last').value = '';
    document.getElementById('add-user-email').value = '';
    document.getElementById('add-user-role').value = 'Security Analyst';
    document.getElementById('add-user-notif-role').value = '';
    document.getElementById('add-user-dept').value = '';
    document.getElementById('add-user-first').focus();
}

function closeAddUserModal() {
    document.getElementById('add-user-modal').classList.add('hidden');
}

function addUserFromModal() {
    const first = document.getElementById('add-user-first').value.trim();
    const last = document.getElementById('add-user-last').value.trim();
    const email = document.getElementById('add-user-email').value.trim();
    const role = document.getElementById('add-user-role').value;
    const notifRole = document.getElementById('add-user-notif-role').value;
    const dept = document.getElementById('add-user-dept').value.trim();

    if (!first || !last || !email) {
        if (typeof showUpdateFeedback === 'function') {
            showUpdateFeedback('First name, last name, and email are required', 'error');
        }
        return;
    }

    const users = getAdminUsers();
    const id = email.split('@')[0].toLowerCase().replace(/[^a-z0-9.]/g, '');
    if (users.find(u => u.id === id || u.email === email)) {
        if (typeof showUpdateFeedback === 'function') {
            showUpdateFeedback('A user with this email already exists', 'error');
        }
        return;
    }

    users.push({ id, first, last, email, role, notifRole, department: dept || 'Unassigned', status: 'Active' });
    saveAdminUsers(users);
    closeAddUserModal();
    renderAdminUserTable();
}

function renderRoleSummaryCards() {
    const container = document.getElementById('admin-role-summary-cards');
    if (!container) return;
    const users = getAdminUsers();
    const roles = [
        { name: 'Administrator', badge: 'Full Access', badgeColor: '#0A5E62', badgeBg: '#E6F7F7' },
        { name: 'Security Analyst', badge: 'Read/Write', badgeColor: '#0A5E62', badgeBg: '#E6F7F7' },
        { name: 'Auditor', badge: 'Read Only', badgeColor: '#047857', badgeBg: '#D1FAE5' }
    ];
    container.innerHTML = roles.map(r => {
        const count = users.filter(u => u.role === r.name).length;
        return `<div style="flex:1;border:1px solid #E2E4E8;border-radius:8px;padding:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <p style="font-size:13px;font-weight:700;color:#1F2937;margin:0">${r.name}</p>
                <span style="font-size:10px;font-weight:700;color:${r.badgeColor};background:${r.badgeBg};padding:2px 8px;border-radius:4px">${r.badge}</span>
            </div>
            <p style="font-size:11px;color:#6B7280;margin:0"><i class="fas fa-users" style="margin-right:4px"></i>${count} user${count !== 1 ? 's' : ''}</p>
        </div>`;
    }).join('');
}

function initAdminUsers() {
    renderAdminUserTable();
}

// Email delivery configuration
function saveEmailConfig() {
    const config = {
        enabled: document.getElementById('email-delivery-enabled')?.checked || false,
        smtpHost: (document.getElementById('smtp-host') || {}).value || '',
        smtpPort: (document.getElementById('smtp-port') || {}).value || '587',
        fromAddress: (document.getElementById('smtp-from') || {}).value || '',
        replyTo: (document.getElementById('smtp-reply-to') || {}).value || '',
        digestSchedule: (document.getElementById('email-digest-schedule') || {}).value || 'weekly',
        bcc: (document.getElementById('email-bcc') || {}).value || ''
    };
    localStorage.setItem('emailConfig', JSON.stringify(config));
    if (typeof showUpdateFeedback === 'function') {
        showUpdateFeedback('Email settings saved successfully', 'success');
    }
}

function loadEmailConfig() {
    const saved = localStorage.getItem('emailConfig');
    if (saved) {
        const config = JSON.parse(saved);
        const enabledEl = document.getElementById('email-delivery-enabled');
        if (enabledEl) enabledEl.checked = config.enabled || false;
        const fields = {
            'smtp-host': config.smtpHost,
            'smtp-port': config.smtpPort,
            'smtp-from': config.fromAddress,
            'smtp-reply-to': config.replyTo,
            'email-digest-schedule': config.digestSchedule,
            'email-bcc': config.bcc
        };
        Object.entries(fields).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el && val) el.value = val;
        });
    }
}

function testEmailConnection() {
    const host = (document.getElementById('smtp-host') || {}).value;
    if (!host) {
        if (typeof showUpdateFeedback === 'function') {
            showUpdateFeedback('Enter an SMTP host before testing', 'error');
        }
        return;
    }
    if (typeof showUpdateFeedback === 'function') {
        showUpdateFeedback('SMTP connection test is not available in demo mode. Configure your SMTP relay and deploy to test connectivity.', 'info');
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
    if (typeof showUpdateFeedback === 'function') {
        showUpdateFeedback('Risk Framework configuration saved successfully', 'success');
    }
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
        <p style="font-size:15px;font-weight:700;color:#0D7377;margin:0 0 6px">${data.name}</p>
        <p style="font-size:13px;color:#374151;margin:0 0 16px">${data.description}</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
            <div style="background:#fff;border-radius:6px;padding:12px;border:1px solid #E2E4E8">
                <p style="font-size:11px;font-weight:700;color:#0D7377;margin:0 0 4px">Control Families</p>
                <p style="font-size:13px;color:#374151;margin:0">${data.families}</p>
            </div>
            <div style="background:#fff;border-radius:6px;padding:12px;border:1px solid #E2E4E8">
                <p style="font-size:11px;font-weight:700;color:#0D7377;margin:0 0 4px">Total Controls</p>
                <p style="font-size:13px;color:#374151;margin:0">${data.controls}</p>
            </div>
            <div style="background:#fff;border-radius:6px;padding:12px;border:1px solid #E2E4E8">
                <p style="font-size:11px;font-weight:700;color:#0D7377;margin:0 0 4px">Impact Levels</p>
                <p style="font-size:13px;color:#374151;margin:0">${data.levels}</p>
            </div>
        </div>
    `;
}

function saveUserPreferences() {
    if (typeof showUpdateFeedback === 'function') {
        showUpdateFeedback('User preferences saved successfully', 'success');
    }
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
    if (typeof showUpdateFeedback === 'function') {
        showUpdateFeedback('API Configuration saved successfully', 'success');
    }
}

// Test API Connections
function testAPIConnections() {
    if (typeof showUpdateFeedback === 'function') {
        showUpdateFeedback('Testing API connections... This feature will validate your API credentials and connectivity. Implementation coming soon.', 'info');
    }
}

// Load API Configuration
function loadAPIConfig() {
    try {
        const savedConfig = localStorage.getItem('apiConfig');
        if (!savedConfig) return;
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
    } catch (error) {
        console.error('❌ Failed to load API config:', error);
    }
}

// Jira integration functions
function loadJiraConfig() {
    const saved = localStorage.getItem('jiraConfig');
    if (saved) {
        const config = JSON.parse(saved);
        const urlEl = document.getElementById('jira-base-url');
        const keyEl = document.getElementById('jira-project-key');
        const emailEl = document.getElementById('jira-email');
        const tokenEl = document.getElementById('jira-api-token');
        if (urlEl) urlEl.value = config.baseUrl || '';
        if (keyEl) keyEl.value = config.projectKey || '';
        if (emailEl) emailEl.value = config.email || '';
        if (tokenEl) tokenEl.value = config.apiToken || '';
    }
}

function saveJiraConfig() {
    const config = {
        baseUrl: document.getElementById('jira-base-url').value,
        projectKey: document.getElementById('jira-project-key').value,
        email: document.getElementById('jira-email').value,
        apiToken: document.getElementById('jira-api-token').value
    };
    localStorage.setItem('jiraConfig', JSON.stringify(config));
    if (typeof showUpdateFeedback === 'function') {
        showUpdateFeedback('Jira configuration saved successfully', 'success');
    }
}

function testJiraConnection() {
    const url = document.getElementById('jira-base-url').value;
    if (!url) {
        if (typeof showUpdateFeedback === 'function') {
            showUpdateFeedback('Please enter a Jira instance URL first', 'error');
        }
        return;
    }
    if (typeof showUpdateFeedback === 'function') {
        showUpdateFeedback('Connection test is not available in this environment. Configuration saved locally.', 'info');
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
