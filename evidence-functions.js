// Evidence Vault Functions with POAM Integration and Chain of Custody

// Initialize evidence vault when module loads
function loadEvidenceFiles() {
    console.log('Loading evidence vault...');
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('evidence-date').value = today;
    
    // Populate POAM dropdown
    populatePOAMDropdown();
    
    // Load and display existing evidence
    displayEvidenceRepository();
}

// Populate POAM dropdown with available POAMs
function populatePOAMDropdown() {
    const poamSelect = document.getElementById('evidence-poam-select');
    if (!poamSelect) return;
    
    // Clear existing options except the first one
    poamSelect.innerHTML = '<option value="">Choose a POAM to link evidence...</option>';
    
    // Get all POAMs from storage
    const poamData = JSON.parse(localStorage.getItem('poamData') || '{}');
    
    // Add POAMs to dropdown, grouped by status
    const openPOAMs = [];
    const inProgressPOAMs = [];
    const otherPOAMs = [];
    
    Object.entries(poamData).forEach(([id, poam]) => {
        const status = poam.status || 'open';
        const poamOption = {
            id: id,
            text: `${id} - ${poam.finding_description?.substring(0, 60) || 'No description'}...`,
            status: status,
            risk: poam.risk_level || 'unknown',
            due: poam.scheduled_completion_date || 'N/A'
        };
        
        if (status === 'open') {
            openPOAMs.push(poamOption);
        } else if (status === 'in_progress') {
            inProgressPOAMs.push(poamOption);
        } else if (status !== 'completed' && status !== 'closed') {
            otherPOAMs.push(poamOption);
        }
    });
    
    // Add grouped options
    if (openPOAMs.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = '🔴 Open POAMs';
        openPOAMs.forEach(poam => {
            const option = document.createElement('option');
            option.value = poam.id;
            option.textContent = poam.text;
            option.dataset.status = poam.status;
            option.dataset.risk = poam.risk;
            option.dataset.due = poam.due;
            optgroup.appendChild(option);
        });
        poamSelect.appendChild(optgroup);
    }
    
    if (inProgressPOAMs.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = '🟡 In Progress POAMs';
        inProgressPOAMs.forEach(poam => {
            const option = document.createElement('option');
            option.value = poam.id;
            option.textContent = poam.text;
            option.dataset.status = poam.status;
            option.dataset.risk = poam.risk;
            option.dataset.due = poam.due;
            optgroup.appendChild(option);
        });
        poamSelect.appendChild(optgroup);
    }
    
    if (otherPOAMs.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = '⚪ Other POAMs';
        otherPOAMs.forEach(poam => {
            const option = document.createElement('option');
            option.value = poam.id;
            option.textContent = poam.text;
            option.dataset.status = poam.status;
            option.dataset.risk = poam.risk;
            option.dataset.due = poam.due;
            optgroup.appendChild(option);
        });
        poamSelect.appendChild(optgroup);
    }
}

// Update selected POAM info display
function updateSelectedPOAMInfo() {
    const poamSelect = document.getElementById('evidence-poam-select');
    const selectedOption = poamSelect.options[poamSelect.selectedIndex];
    const infoDiv = document.getElementById('selected-poam-info');
    
    if (!selectedOption || !selectedOption.value) {
        infoDiv.style.display = 'none';
        return;
    }
    
    // Get POAM data
    const poamId = selectedOption.value;
    const poamData = JSON.parse(localStorage.getItem('poamData') || '{}');
    const poam = poamData[poamId];
    
    if (!poam) {
        infoDiv.style.display = 'none';
        return;
    }
    
    // Update info display
    document.getElementById('selected-poam-id').textContent = poamId;
    document.getElementById('selected-poam-description').textContent = poam.finding_description || 'No description available';
    document.getElementById('selected-poam-risk').textContent = (poam.risk_level || 'unknown').toUpperCase();
    document.getElementById('selected-poam-due').textContent = poam.scheduled_completion_date || 'Not set';
    
    // Update status badge
    const statusBadge = document.getElementById('selected-poam-status-badge');
    const status = poam.status || 'open';
    const statusColors = {
        'open': 'bg-red-100 text-red-700',
        'in_progress': 'bg-yellow-100 text-yellow-700',
        'completed': 'bg-green-100 text-green-700',
        'overdue': 'bg-orange-100 text-orange-700',
        'risk-accepted': 'bg-purple-100 text-purple-700'
    };
    statusBadge.className = `px-2 py-1 rounded text-xs font-semibold ${statusColors[status] || 'bg-slate-100 text-slate-700'}`;
    statusBadge.textContent = status.replace('_', ' ').toUpperCase();
    
    infoDiv.style.display = 'block';
}

// Clear POAM selection
function clearPOAMSelection() {
    document.getElementById('evidence-poam-select').value = '';
    document.getElementById('selected-poam-info').style.display = 'none';
}

// Handle evidence file upload
function handleEvidenceUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Validate required fields
    const poamId = document.getElementById('evidence-poam-select').value;
    const evidenceType = document.getElementById('evidence-type-select').value;
    const owner = document.getElementById('evidence-owner').value.trim();
    const submitter = document.getElementById('evidence-submitter').value.trim();
    const date = document.getElementById('evidence-date').value;
    const description = document.getElementById('evidence-description').value.trim();
    
    if (!poamId) {
        alert('Please select a POAM to link this evidence to.');
        event.target.value = '';
        return;
    }
    
    if (!evidenceType) {
        alert('Please select an evidence category.');
        event.target.value = '';
        return;
    }
    
    if (!owner || !submitter || !date || !description) {
        alert('Please fill in all required fields:\n- Artifact Owner\n- Submitted By\n- Submission Date\n- Evidence Description');
        event.target.value = '';
        return;
    }
    
    // Show file preview
    displaySelectedFiles(files);
    
    // Process and save evidence
    saveEvidenceFiles(files);
}

// Display selected files preview
function displaySelectedFiles(files) {
    const preview = document.getElementById('selected-files-preview');
    const filesList = document.getElementById('selected-files-list');
    
    filesList.innerHTML = '';
    
    Array.from(files).forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200';
        fileItem.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="${getFileIcon(file.name)} text-xl"></i>
                <div>
                    <p class="text-sm font-medium text-slate-800">${file.name}</p>
                    <p class="text-xs text-slate-500">${(file.size / 1024).toFixed(1)} KB</p>
                </div>
            </div>
            <span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">Ready</span>
        `;
        filesList.appendChild(fileItem);
    });
    
    preview.style.display = 'block';
}

// Save evidence files to localStorage
function saveEvidenceFiles(files) {
    const poamId = document.getElementById('evidence-poam-select').value;
    const evidenceType = document.getElementById('evidence-type-select').value;
    const owner = document.getElementById('evidence-owner').value.trim();
    const submitter = document.getElementById('evidence-submitter').value.trim();
    const date = document.getElementById('evidence-date').value;
    const description = document.getElementById('evidence-description').value.trim();
    const email = document.getElementById('evidence-email').value.trim();
    const autoClose = document.getElementById('evidence-auto-close').checked;
    let reference = document.getElementById('evidence-reference').value.trim();
    
    // Generate reference ID if not provided
    if (!reference) {
        const evidenceData = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
        const count = Object.keys(evidenceData).length + 1;
        reference = `EV-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    }
    
    // Get existing evidence vault
    const evidenceVault = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
    
    // Process each file
    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const evidenceId = `${reference}-${index + 1}`;
            
            // Create evidence record
            const evidenceRecord = {
                id: evidenceId,
                linkedPOAM: poamId,
                evidenceType: evidenceType,
                filename: file.name,
                fileSize: file.size,
                fileData: e.target.result, // Base64 encoded file
                owner: owner,
                submitter: submitter,
                submissionDate: date,
                uploadDate: new Date().toISOString(),
                description: description,
                email: email,
                reference: reference,
                autoClose: autoClose
            };
            
            // Save to evidence vault
            evidenceVault[evidenceId] = evidenceRecord;
            localStorage.setItem('evidenceVault', JSON.stringify(evidenceVault));
            
            // If this is the last file, trigger auto-close if enabled
            if (index === files.length - 1) {
                if (autoClose) {
                    closePOAMWithEvidence(poamId, evidenceId);
                }
                
                // Show success message
                showEvidenceUploadSuccess(files.length, poamId, autoClose);
                
                // Reset form
                resetEvidenceForm();
                
                // Refresh evidence display
                displayEvidenceRepository();
            }
        };
        
        reader.readAsDataURL(file);
    });
}

// Auto-close POAM when evidence is submitted
function closePOAMWithEvidence(poamId, evidenceId) {
    const poamData = JSON.parse(localStorage.getItem('poamData') || '{}');
    
    if (poamData[poamId]) {
        // Update POAM status to completed
        poamData[poamId].status = 'completed';
        poamData[poamId].completion_date = new Date().toISOString().split('T')[0];
        poamData[poamId].closure_evidence = evidenceId;
        poamData[poamId].auto_closed = true;
        
        // Save updated POAM data
        localStorage.setItem('poamData', JSON.stringify(poamData));
        
        // Update POAM table if visible
        updatePOAMTableRow(poamId);
        
        // Update metrics
        if (typeof updateSLAMetrics === 'function') {
            updateSLAMetrics();
        }
        
        console.log(`POAM ${poamId} automatically closed with evidence ${evidenceId}`);
    }
}

// Update POAM table row status
function updatePOAMTableRow(poamId) {
    const tableBody = document.getElementById('poam-table-body');
    if (!tableBody) return;
    
    const rows = tableBody.querySelectorAll('tr');
    rows.forEach(row => {
        const idCell = row.cells[0];
        if (idCell && idCell.textContent.trim() === poamId) {
            // Update status cell (index 7)
            const statusCell = row.cells[7];
            if (statusCell) {
                statusCell.innerHTML = '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">Completed</span>';
            }
        }
    });
}

// Show success message
function showEvidenceUploadSuccess(fileCount, poamId, autoClosed) {
    let message = `✅ Successfully uploaded ${fileCount} evidence file(s) for POAM ${poamId}`;
    
    if (autoClosed) {
        message += `\n\n🎉 POAM ${poamId} has been automatically marked as COMPLETED!`;
    }
    
    alert(message);
}

// Reset evidence form
function resetEvidenceForm() {
    document.getElementById('evidence-poam-select').value = '';
    document.getElementById('evidence-type-select').value = '';
    document.getElementById('evidence-owner').value = '';
    document.getElementById('evidence-submitter').value = '';
    document.getElementById('evidence-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('evidence-reference').value = '';
    document.getElementById('evidence-email').value = '';
    document.getElementById('evidence-description').value = '';
    document.getElementById('evidence-auto-close').checked = true;
    document.getElementById('evidence-file-upload').value = '';
    document.getElementById('selected-files-preview').style.display = 'none';
    document.getElementById('selected-poam-info').style.display = 'none';
}

// Display evidence repository
function displayEvidenceRepository() {
    const evidenceList = document.getElementById('evidence-list');
    if (!evidenceList) return;
    
    const evidenceVault = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
    const evidenceArray = Object.values(evidenceVault);
    
    if (evidenceArray.length === 0) {
        evidenceList.innerHTML = `
            <div class="text-center py-12 text-slate-400">
                <i class="fas fa-folder-open text-5xl mb-4"></i>
                <p class="text-lg font-medium">No evidence uploaded yet</p>
                <p class="text-sm mt-1">Upload evidence files to link them to POAMs</p>
            </div>
        `;
        return;
    }
    
    // Sort by upload date (newest first)
    evidenceArray.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    
    evidenceList.innerHTML = evidenceArray.map(evidence => {
        const fileIcon = getFileIcon(evidence.filename);
        const uploadDate = new Date(evidence.uploadDate).toLocaleString();
        const submissionDate = new Date(evidence.submissionDate).toLocaleDateString();
        
        return `
            <div class="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors evidence-item" data-poam="${evidence.linkedPOAM}" data-type="${evidence.evidenceType}">
                <div class="flex items-start justify-between">
                    <div class="flex items-start gap-4 flex-1">
                        <i class="${fileIcon} text-3xl"></i>
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-2">
                                <h4 class="font-semibold text-slate-800">${evidence.filename}</h4>
                                <span class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">
                                    <i class="fas fa-link mr-1"></i>${evidence.linkedPOAM}
                                </span>
                                <span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                                    ${evidence.evidenceType}
                                </span>
                            </div>
                            <p class="text-sm text-slate-600 mb-3">${evidence.description}</p>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500">
                                <div>
                                    <i class="fas fa-user text-slate-400 mr-1"></i>
                                    <strong>Owner:</strong> ${evidence.owner}
                                </div>
                                <div>
                                    <i class="fas fa-upload text-slate-400 mr-1"></i>
                                    <strong>Submitted By:</strong> ${evidence.submitter}
                                </div>
                                <div>
                                    <i class="fas fa-calendar text-slate-400 mr-1"></i>
                                    <strong>Submitted:</strong> ${submissionDate}
                                </div>
                                <div>
                                    <i class="fas fa-tag text-slate-400 mr-1"></i>
                                    <strong>Ref:</strong> ${evidence.reference}
                                </div>
                            </div>
                            ${evidence.email ? `<div class="text-xs text-slate-500 mt-2"><i class="fas fa-envelope text-slate-400 mr-1"></i>${evidence.email}</div>` : ''}
                        </div>
                    </div>
                    <div class="flex flex-col gap-2 ml-4">
                        <button onclick="viewEvidenceDetails('${evidence.id}')" class="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors">
                            <i class="fas fa-eye mr-1"></i>View
                        </button>
                        <button onclick="downloadEvidence('${evidence.id}')" class="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors">
                            <i class="fas fa-download mr-1"></i>Download
                        </button>
                        <button onclick="deleteEvidence('${evidence.id}')" class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                            <i class="fas fa-trash mr-1"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Filter evidence
function filterEvidence(filterType) {
    const evidenceItems = document.querySelectorAll('.evidence-item');
    
    evidenceItems.forEach(item => {
        const hasLinkedPOAM = item.dataset.poam && item.dataset.poam !== '';
        
        if (filterType === 'all') {
            item.style.display = 'block';
        } else if (filterType === 'linked' && hasLinkedPOAM) {
            item.style.display = 'block';
        } else if (filterType === 'unlinked' && !hasLinkedPOAM) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Search evidence
function searchEvidence() {
    const searchTerm = document.getElementById('evidence-search').value.toLowerCase();
    const evidenceItems = document.querySelectorAll('.evidence-item');
    
    evidenceItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

// Sort evidence
function sortEvidence() {
    const sortBy = document.getElementById('evidence-sort').value;
    const evidenceList = document.getElementById('evidence-list');
    const evidenceVault = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
    let evidenceArray = Object.values(evidenceVault);
    
    switch(sortBy) {
        case 'date-desc':
            evidenceArray.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
            break;
        case 'date-asc':
            evidenceArray.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));
            break;
        case 'poam':
            evidenceArray.sort((a, b) => a.linkedPOAM.localeCompare(b.linkedPOAM));
            break;
        case 'type':
            evidenceArray.sort((a, b) => a.evidenceType.localeCompare(b.evidenceType));
            break;
    }
    
    // Re-render the list
    displayEvidenceRepository();
}

// View evidence details
function viewEvidenceDetails(evidenceId) {
    const evidenceVault = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
    const evidence = evidenceVault[evidenceId];
    
    if (!evidence) {
        alert('Evidence not found');
        return;
    }
    
    // Get linked POAM data
    const poamData = JSON.parse(localStorage.getItem('poamData') || '{}');
    const linkedPOAM = poamData[evidence.linkedPOAM];
    
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
                <!-- File Information -->
                <div class="bg-slate-50 rounded-lg p-4">
                    <h3 class="font-semibold text-slate-800 mb-3">File Information</h3>
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><strong>Filename:</strong> ${evidence.filename}</div>
                        <div><strong>Size:</strong> ${(evidence.fileSize / 1024).toFixed(1)} KB</div>
                        <div><strong>Category:</strong> ${evidence.evidenceType}</div>
                        <div><strong>Reference:</strong> ${evidence.reference}</div>
                    </div>
                </div>
                
                <!-- Linked POAM -->
                <div class="bg-indigo-50 rounded-lg p-4">
                    <h3 class="font-semibold text-slate-800 mb-3">Linked POAM</h3>
                    <div class="text-sm">
                        <div class="mb-2"><strong>POAM ID:</strong> <span class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">${evidence.linkedPOAM}</span></div>
                        ${linkedPOAM ? `
                            <div class="mb-2"><strong>Description:</strong> ${linkedPOAM.finding_description || 'N/A'}</div>
                            <div class="mb-2"><strong>Status:</strong> ${linkedPOAM.status || 'N/A'}</div>
                            <div><strong>Risk Level:</strong> ${linkedPOAM.risk_level || 'N/A'}</div>
                        ` : '<p class="text-slate-500">POAM details not available</p>'}
                    </div>
                </div>
                
                <!-- Chain of Custody -->
                <div class="bg-green-50 rounded-lg p-4">
                    <h3 class="font-semibold text-slate-800 mb-3">Chain of Custody</h3>
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><strong>Artifact Owner:</strong> ${evidence.owner}</div>
                        <div><strong>Submitted By:</strong> ${evidence.submitter}</div>
                        <div><strong>Submission Date:</strong> ${new Date(evidence.submissionDate).toLocaleDateString()}</div>
                        <div><strong>Upload Date:</strong> ${new Date(evidence.uploadDate).toLocaleString()}</div>
                        ${evidence.email ? `<div class="col-span-2"><strong>Contact:</strong> ${evidence.email}</div>` : ''}
                    </div>
                </div>
                
                <!-- Description -->
                <div class="bg-slate-50 rounded-lg p-4">
                    <h3 class="font-semibold text-slate-800 mb-3">Evidence Description</h3>
                    <p class="text-sm text-slate-600">${evidence.description}</p>
                </div>
                
                ${evidence.autoClose ? `
                <div class="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p class="text-sm text-green-800"><i class="fas fa-check-circle text-green-600 mr-2"></i>This evidence triggered automatic POAM closure</p>
                </div>
                ` : ''}
            </div>
            
            <div class="mt-6 flex justify-end gap-3">
                <button onclick="downloadEvidence('${evidenceId}')" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <i class="fas fa-download mr-2"></i>Download
                </button>
                <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Download evidence
function downloadEvidence(evidenceId) {
    const evidenceVault = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
    const evidence = evidenceVault[evidenceId];
    
    if (!evidence) {
        alert('Evidence not found');
        return;
    }
    
    // Create download link
    const link = document.createElement('a');
    link.href = evidence.fileData;
    link.download = evidence.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Delete evidence
function deleteEvidence(evidenceId) {
    if (!confirm('Are you sure you want to delete this evidence? This action cannot be undone.')) {
        return;
    }
    
    const evidenceVault = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
    delete evidenceVault[evidenceId];
    localStorage.setItem('evidenceVault', JSON.stringify(evidenceVault));
    
    displayEvidenceRepository();
    alert('Evidence deleted successfully');
}

// Get file icon based on filename
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    const iconMap = {
        'pdf': 'fas fa-file-pdf text-red-500',
        'doc': 'fas fa-file-word text-blue-500',
        'docx': 'fas fa-file-word text-blue-500',
        'xls': 'fas fa-file-excel text-green-500',
        'xlsx': 'fas fa-file-excel text-green-500',
        'ppt': 'fas fa-file-powerpoint text-orange-500',
        'pptx': 'fas fa-file-powerpoint text-orange-500',
        'jpg': 'fas fa-file-image text-purple-500',
        'jpeg': 'fas fa-file-image text-purple-500',
        'png': 'fas fa-file-image text-purple-500',
        'gif': 'fas fa-file-image text-purple-500',
        'txt': 'fas fa-file-alt text-slate-500',
        'csv': 'fas fa-file-csv text-green-600',
        'zip': 'fas fa-file-archive text-yellow-600',
        'rar': 'fas fa-file-archive text-yellow-600'
    };
    
    return iconMap[ext] || 'fas fa-file text-slate-500';
}
