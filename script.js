// POAM Nexus JavaScript functionality

// Module navigation
function showModule(moduleName) {
    // Save current module to localStorage for page refresh persistence
    localStorage.setItem('currentModule', moduleName);
    
    // Hide all modules
    const modules = document.querySelectorAll('.module');
    modules.forEach(module => {
        module.classList.add('hidden');
    });
    
    // Show selected module
    document.getElementById(moduleName + '-module').classList.remove('hidden');
    
    // Load module-specific data
    if (moduleName === 'poam') {
        // Load POAM ID configuration when POAM Repository is shown
        loadPOAMIdConfig();
        updateApplicationPOAMCounts();
    } else if (moduleName === 'vulnerability') {
        // Initialize vulnerability tracking
        showVulnerabilityTab('upload');
        updateSLAMetrics();
    } else if (moduleName === 'evidence') {
        // Load evidence vault data
        loadEvidenceFiles();
    } else if (moduleName === 'reporting') {
        // Load reporting data
        loadReportingData();
    } else if (moduleName === 'settings') {
        // Load settings including risk framework
        loadRiskFramework();
        loadPOAMIdConfig();
    }
    
    // Highlight active nav link
    const activeLink = document.querySelector(`[onclick="showModule('${moduleName}')"]`);
    if (activeLink && activeLink.classList.contains('nav-link')) {
        activeLink.classList.remove('text-slate-600');
        activeLink.classList.add('text-indigo-600');
    }
}

// Placeholder functions for other modules
function loadEvidenceFiles() {
    console.log('Loading evidence files...');
}

function loadReportingData() {
    console.log('Loading reporting data...');
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
                        <button onclick="updatePOAMStatus('${poam.poam_id}')" class="text-blue-600 hover:text-blue-800 p-2" title="Update Status">
                            <i class="fas fa-edit"></i>
                        </button>
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

// Application Management Functions
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

// Evidence Vault with POAM Integration and Chain of Custody
let evidenceDatabase = {};
let selectedPOAMForEvidence = null;

function loadEvidenceFiles() {
    // Load evidence from localStorage
    const savedEvidence = localStorage.getItem('evidenceVault');
    if (savedEvidence) {
        evidenceDatabase = JSON.parse(savedEvidence);
    }
    
    // Load POAMs for selection
    loadPOAMsForEvidenceSelection();
    
    // Display evidence list
    displayEvidenceList('all');
    
    // Set today's date as default
    document.getElementById('evidence-date').value = new Date().toISOString().split('T')[0];
}

function loadPOAMsForEvidenceSelection() {
    const allPOAMs = JSON.parse(localStorage.getItem('poamData') || '{}');
    const poamSelect = document.getElementById('evidence-poam-select');
    
    // Clear existing options
    poamSelect.innerHTML = '<option value="">Choose a POAM to link evidence...</option>';
    
    // Add POAMs to dropdown
    Object.values(allPOAMs).forEach(poam => {
        const option = document.createElement('option');
        option.value = poam.poam_id;
        option.textContent = `${poam.poam_id} - ${poam.risk_level.toUpperCase()} - ${poam.finding_description.substring(0, 50)}...`;
        poamSelect.appendChild(option);
    });
}

function updateSelectedPOAMInfo() {
    const poamId = document.getElementById('evidence-poam-select').value;
    
    if (!poamId) {
        document.getElementById('selected-poam-info').style.display = 'none';
        selectedPOAMForEvidence = null;
        return;
    }
    
    const allPOAMs = JSON.parse(localStorage.getItem('poamData') || '{}');
    const poam = allPOAMs[poamId];
    
    if (poam) {
        selectedPOAMForEvidence = poam;
        document.getElementById('selected-poam-id').textContent = poam.poam_id;
        document.getElementById('selected-poam-description').textContent = poam.finding_description.substring(0, 100) + '...';
        document.getElementById('selected-poam-info').style.display = 'block';
    }
}

function clearPOAMSelection() {
    document.getElementById('evidence-poam-select').value = '';
    document.getElementById('selected-poam-info').style.display = 'none';
    selectedPOAMForEvidence = null;
}

function handleEvidenceUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;
    
    // Validate chain of custody fields
    const submitter = document.getElementById('evidence-submitter').value.trim();
    const submissionDate = document.getElementById('evidence-date').value;
    const evidenceReference = document.getElementById('evidence-reference').value.trim();
    const evidenceType = document.getElementById('evidence-type-select').value;
    
    if (!submitter || !submissionDate || !evidenceReference) {
        alert('Please fill in all chain of custody fields before uploading.');
        return;
    }
    
    // Process each file
    Array.from(files).forEach(file => {
        const evidenceId = 'EV_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const evidenceItem = {
            id: evidenceId,
            filename: file.name,
            size: file.size,
            type: file.type,
            evidenceType: evidenceType,
            uploadDate: new Date().toISOString(),
            submitter: submitter,
            submissionDate: submissionDate,
            reference: evidenceReference,
            
            // POAM Integration
            linkedPOAM: selectedPOAMForEvidence ? selectedPOAMForEvidence.poam_id : null,
            linkedPOAMDescription: selectedPOAMForEvidence ? selectedPOAMForEvidence.finding_description : null,
            
            // Chain of Custody
            chainOfCustody: {
                submitted: {
                    by: submitter,
                    date: submissionDate,
                    timestamp: new Date().toISOString()
                },
                processed: {
                    by: submitter,
                    date: new Date().toISOString().split('T')[0],
                    timestamp: new Date().toISOString()
                },
                verified: false,
                verificationDate: null,
                verifiedBy: null
            },
            
            // File handling (in real implementation, would upload to server)
            fileData: null, // Would contain file data
            status: 'uploaded'
        };
        
        // Store evidence
        evidenceDatabase[evidenceId] = evidenceItem;
        
        // If linked to POAM, update POAM evidence links
        if (selectedPOAMForEvidence) {
            updatePOAMEvidenceLinks(selectedPOAMForEvidence.poam_id, evidenceId);
        }
    });
    
    // Save to localStorage
    localStorage.setItem('evidenceVault', JSON.stringify(evidenceDatabase));
    
    // Refresh display
    displayEvidenceList('all');
    
    // Clear form
    document.getElementById('evidence-file-upload').value = '';
    
    alert(`Successfully uploaded ${files.length} evidence file(s)!`);
}

function updatePOAMEvidenceLinks(poamId, evidenceId) {
    const allPOAMs = JSON.parse(localStorage.getItem('poamData') || '{}');
    
    if (allPOAMs[poamId]) {
        if (!allPOAMs[poamId].evidenceLinks) {
            allPOAMs[poamId].evidenceLinks = [];
        }
        allPOAMs[poamId].evidenceLinks.push({
            evidenceId: evidenceId,
            linkedDate: new Date().toISOString()
        });
        
        localStorage.setItem('poamData', JSON.stringify(allPOAMs));
    }
}

function displayEvidenceList(filter = 'all') {
    const evidenceList = document.getElementById('evidence-list');
    const evidenceArray = Object.values(evidenceDatabase);
    
    // Apply filter
    let filteredEvidence = evidenceArray;
    if (filter === 'linked') {
        filteredEvidence = evidenceArray.filter(e => e.linkedPOAM);
    } else if (filter === 'unlinked') {
        filteredEvidence = evidenceArray.filter(e => !e.linkedPOAM);
    }
    
    if (filteredEvidence.length === 0) {
        evidenceList.innerHTML = `
            <div class="text-center py-8 text-slate-500">
                <i class="fas fa-folder-open text-4xl mb-4"></i>
                <p>No evidence files found</p>
            </div>
        `;
        return;
    }
    
    // Sort by upload date (newest first)
    filteredEvidence.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    
    // Generate HTML
    let html = '';
    filteredEvidence.forEach(evidence => {
        const fileIcon = getFileIcon(evidence.filename);
        const linkedBadge = evidence.linkedPOAM ? 
            `<span class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">${evidence.linkedPOAM}</span>` :
            `<span class="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-semibold">Unlinked</span>`;
        
        html += `
            <div class="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                <div class="flex items-center gap-4">
                    <i class="${fileIcon} text-2xl"></i>
                    <div>
                        <p class="font-semibold text-slate-800">${evidence.filename}</p>
                        <p class="text-sm text-slate-500">
                            Uploaded ${formatDate(evidence.uploadDate)} • ${formatFileSize(evidence.size)} • 
                            Ref: ${evidence.reference} • By: ${evidence.submitter}
                        </p>
                        ${evidence.linkedPOAM ? `<p class="text-xs text-indigo-600 mt-1">Linked to: ${evidence.linkedPOAMDescription.substring(0, 60)}...</p>` : ''}
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    ${linkedBadge}
                    <span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">${evidence.evidenceType}</span>
                    <button onclick="viewEvidenceDetails('${evidence.id}')" class="text-indigo-600 hover:text-indigo-800">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="downloadEvidence('${evidence.id}')" class="text-green-600 hover:text-green-800">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    evidenceList.innerHTML = html;
}

function filterEvidence(filter) {
    displayEvidenceList(filter);
}

function viewEvidenceDetails(evidenceId) {
    const evidence = evidenceDatabase[evidenceId];
    if (!evidence) return;
    
    // Create details modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-slate-900">Evidence Details</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <div class="space-y-6">
                <!-- Evidence Information -->
                <div class="bg-slate-50 rounded-lg p-4">
                    <h3 class="font-semibold text-slate-800 mb-3">Evidence Information</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><strong>File Name:</strong> ${evidence.filename}</div>
                        <div><strong>Reference:</strong> ${evidence.reference}</div>
                        <div><strong>Type:</strong> ${evidence.evidenceType}</div>
                        <div><strong>Size:</strong> ${formatFileSize(evidence.size)}</div>
                        <div><strong>Upload Date:</strong> ${formatDate(evidence.uploadDate)}</div>
                        <div><strong>Status:</strong> ${evidence.status}</div>
                    </div>
                </div>
                
                <!-- Chain of Custody -->
                <div class="bg-blue-50 rounded-lg p-4">
                    <h3 class="font-semibold text-slate-800 mb-3">Chain of Custody</h3>
                    <div class="space-y-3 text-sm">
                        <div class="flex justify-between">
                            <span><strong>Submitted By:</strong> ${evidence.chainOfCustody.submitted.by}</span>
                            <span>${formatDate(evidence.chainOfCustody.submitted.timestamp)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span><strong>Processed By:</strong> ${evidence.chainOfCustody.processed.by}</span>
                            <span>${formatDate(evidence.chainOfCustody.processed.timestamp)}</span>
                        </div>
                        ${evidence.chainOfCustody.verified ? `
                            <div class="flex justify-between text-green-700">
                                <span><strong>Verified By:</strong> ${evidence.chainOfCustody.verifiedBy}</span>
                                <span>${formatDate(evidence.chainOfCustody.verificationDate)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- POAM Link -->
                ${evidence.linkedPOAM ? `
                    <div class="bg-indigo-50 rounded-lg p-4">
                        <h3 class="font-semibold text-slate-800 mb-3">Linked POAM</h3>
                        <div class="text-sm">
                            <div><strong>POAM ID:</strong> ${evidence.linkedPOAM}</div>
                            <div><strong>Description:</strong> ${evidence.linkedPOAMDescription}</div>
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="mt-6 flex justify-end gap-3">
                <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                    Close
                </button>
                <button onclick="downloadEvidence('${evidence.id}')" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    <i class="fas fa-download mr-2"></i>Download
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function downloadEvidence(evidenceId) {
    const evidence = evidenceDatabase[evidenceId];
    if (!evidence) return;
    
    // In a real implementation, this would download the actual file
    // For now, we'll create a placeholder download
    alert(`Downloading evidence: ${evidence.filename}\nReference: ${evidence.reference}\n\nIn production, this would download the actual file.`);
}

function getFileIcon(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'pdf': 'fas fa-file-pdf text-red-500',
        'doc': 'fas fa-file-word text-blue-500',
        'docx': 'fas fa-file-word text-blue-500',
        'xls': 'fas fa-file-excel text-green-500',
        'xlsx': 'fas fa-file-excel text-green-500',
        'ppt': 'fas fa-file-powerpoint text-orange-500',
        'pptx': 'fas fa-file-powerpoint text-orange-500',
        'txt': 'fas fa-file-alt text-slate-500',
        'png': 'fas fa-file-image text-purple-500',
        'jpg': 'fas fa-file-image text-purple-500',
        'jpeg': 'fas fa-file-image text-purple-500',
        'zip': 'fas fa-file-archive text-yellow-500',
        'rar': 'fas fa-file-archive text-yellow-500'
    };
    
    return iconMap[extension] || 'fas fa-file text-slate-500';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

function savePOAMIdConfigFromSettings() {
    const prefix = document.getElementById('settings-poam-id-prefix').value || 'POAM-';
    const startNum = parseInt(document.getElementById('settings-poam-id-start').value) || 1;
    
    const config = {
        prefix: prefix,
        currentNumber: startNum,
        updatedAt: new Date().toISOString(),
        setupCompleted: true
    };
    
    // Save to localStorage
    localStorage.setItem('poamIdConfig', JSON.stringify(config));
    
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

function getNextPOAMId() {
    const config = JSON.parse(localStorage.getItem('poamIdConfig') || '{}');
    
    // If no config exists, use default
    const prefix = config.prefix || 'POAM-';
    let currentNumber = config.currentNumber || 1;
    
    const nextId = prefix + String(currentNumber).padStart(3, '0');
    
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

// Vulnerability Tracking Functions - Unified POAM Manager
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
        created_by: 'POAM Nexus - SLA Processing',
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
    document.getElementById('os-breakdown').textContent = osBreakdown;
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
    // Hide all modules
    document.querySelectorAll('.module').forEach(module => {
        module.classList.add('hidden');
    });
    
    // Show selected module
    document.getElementById(moduleName + '-module').classList.remove('hidden');
    
    // Load module-specific data
    if (moduleName === 'dashboard') {
        // Load dashboard metrics from all POAM sources
        console.log('🔄 Loading dashboard metrics...');
        await updateSLAMetrics();
        console.log('✅ Dashboard metrics loaded');
    } else if (moduleName === 'poam') {
        // Load POAM ID configuration when POAM Repository is shown
        loadPOAMIdConfig();
        updateApplicationPOAMCounts();
    } else if (moduleName === 'vulnerability') {
        // Initialize vulnerability tracking
        showVulnerabilityTab('upload');
        updateSLAMetrics();
    } else if (moduleName === 'evidence') {
        // Load evidence vault data
        loadEvidenceFiles();
    } else if (moduleName === 'reporting') {
        // Load reporting data
        loadReportingData();
    } else if (moduleName === 'settings') {
        // Load settings including risk framework and SLA
        loadRiskFramework();
        loadSLAConfig();
        loadPOAMIdConfig();
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Restore last active module or default to dashboard
    const savedModule = localStorage.getItem('currentModule') || 'dashboard';
    initializeModule(savedModule);
});
