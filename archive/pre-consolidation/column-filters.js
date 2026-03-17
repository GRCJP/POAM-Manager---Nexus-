// Column Filter Functions for POAM Table
// Handles inline column header filtering with dropdowns

// Toggle column filter dropdown
function toggleColumnFilter(columnName) {
    const dropdown = document.getElementById(`${columnName}-filter-dropdown`);
    
    // Close other dropdowns
    if (openFilterDropdown && openFilterDropdown !== dropdown) {
        openFilterDropdown.classList.add('hidden');
    }
    
    // Toggle current dropdown
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        openFilterDropdown = dropdown.classList.contains('hidden') ? null : dropdown;
        
        // Initialize POC options if opening POC filter
        if (columnName === 'poc' && !dropdown.classList.contains('hidden')) {
            initializePOCOptions();
        }
    }
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.relative.group')) {
        const dropdowns = document.querySelectorAll('[id$="-filter-dropdown"]');
        dropdowns.forEach(d => d.classList.add('hidden'));
        openFilterDropdown = null;
    }
});

// Risk Filter (Multi-Select)
function applyRiskFilter() {
    const checkboxes = document.querySelectorAll('#risk-filter-dropdown input[type="checkbox"]:checked');
    activeFilters.risk = Array.from(checkboxes).map(cb => cb.value);
    
    updateFilterIndicator('risk', activeFilters.risk.length);
    updateFilterChips();
    currentPOAMPage = 1;
    displayVulnerabilityPOAMs();
}

// Status Filter
function applyStatusFilter(value) {
    activeFilters.status = value;
    updateFilterIndicator('status', value ? 1 : 0);
    updateFilterChips();
    currentPOAMPage = 1;
    displayVulnerabilityPOAMs();
}

// Asset Range Filter
function applyAssetFilter(value) {
    activeFilters.assetRange = value;
    updateFilterIndicator('asset', value ? 1 : 0);
    updateFilterChips();
    currentPOAMPage = 1;
    displayVulnerabilityPOAMs();
}

// Due Date Filter
function applyDueDateFilter(value) {
    activeFilters.dueDate = value;
    updateFilterIndicator('duedate', value ? 1 : 0);
    updateFilterChips();
    currentPOAMPage = 1;
    displayVulnerabilityPOAMs();
}

// POC Filter with Typeahead
const pocTeams = [
    'Unassigned',
    'Windows Systems Team',
    'Linux Systems Team',
    'Network Engineering Team',
    'Desktop Engineering Team',
    'Application Development Team',
    'Web Infrastructure Team',
    'Network Security Team',
    'End User Computing Team',
    'Security Operations Team',
    'PCI Compliance Team',
    'Critical Systems Team'
];

function initializePOCOptions() {
    filterPOCOptions('');
}

function filterPOCOptions(searchTerm) {
    const container = document.getElementById('poc-options');
    if (!container) return;
    
    const filtered = pocTeams.filter(team => 
        team.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    container.innerHTML = filtered.map(team => `
        <label class="flex items-center gap-2 text-sm font-normal px-2 py-1 hover:bg-slate-100 rounded cursor-pointer">
            <input 
                type="radio" 
                name="poc-filter" 
                value="${team}" 
                ${activeFilters.poc === team ? 'checked' : ''}
                onchange="applyPOCFilter('${team}')">
            <span>${team}</span>
        </label>
    `).join('');
}

function applyPOCFilter(value) {
    activeFilters.poc = value;
    updateFilterIndicator('poc', value ? 1 : 0);
    updateFilterChips();
    currentPOAMPage = 1;
    displayVulnerabilityPOAMs();
}

// Update filter chips display
function updateFilterChips() {
    const container = document.getElementById('filter-chips-container');
    const chipsDiv = document.getElementById('filter-chips');
    
    if (!container || !chipsDiv) return;
    
    const chips = [];
    
    // Risk chips (multi-select)
    if (activeFilters.risk.length > 0) {
        activeFilters.risk.forEach(risk => {
            const colors = {
                'critical': 'bg-red-100 text-red-700',
                'high': 'bg-orange-100 text-orange-700',
                'medium': 'bg-yellow-100 text-yellow-700',
                'low': 'bg-green-100 text-green-700'
            };
            chips.push({
                label: `Risk: ${risk.charAt(0).toUpperCase() + risk.slice(1)}`,
                color: colors[risk] || 'bg-slate-100 text-slate-700',
                onRemove: () => removeRiskFilter(risk)
            });
        });
    }
    
    // Status chip
    if (activeFilters.status) {
        chips.push({
            label: `Status: ${activeFilters.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
            color: 'bg-blue-100 text-blue-700',
            onRemove: () => { applyStatusFilter(''); }
        });
    }
    
    // POC chip
    if (activeFilters.poc) {
        chips.push({
            label: `POC: ${activeFilters.poc}`,
            color: 'bg-purple-100 text-purple-700',
            onRemove: () => { applyPOCFilter(''); }
        });
    }
    
    // Asset range chip
    if (activeFilters.assetRange) {
        chips.push({
            label: `Assets: > ${activeFilters.assetRange}`,
            color: 'bg-indigo-100 text-indigo-700',
            onRemove: () => { applyAssetFilter(''); }
        });
    }
    
    // Due date chip
    if (activeFilters.dueDate) {
        const labels = {
            'overdue': 'Overdue',
            '7days': 'Due in 7 days',
            '30days': 'Due in 30 days'
        };
        chips.push({
            label: `Due: ${labels[activeFilters.dueDate] || activeFilters.dueDate}`,
            color: activeFilters.dueDate === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700',
            onRemove: () => { applyDueDateFilter(''); }
        });
    }
    
    // Show/hide container
    if (chips.length > 0) {
        container.classList.remove('hidden');
        chipsDiv.innerHTML = chips.map((chip, index) => `
            <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${chip.color}">
                ${chip.label}
                <button 
                    onclick="removeFilterChipByIndex(${index})"
                    class="hover:opacity-70">
                    <i class="fas fa-times text-xs"></i>
                </button>
            </span>
        `).join('');
        
        // Store chip removal functions for access by index
        window.filterChipRemovers = chips.map(c => c.onRemove);
    } else {
        container.classList.add('hidden');
        chipsDiv.innerHTML = '';
    }
}

// Remove filter chip by index
function removeFilterChipByIndex(index) {
    if (window.filterChipRemovers && window.filterChipRemovers[index]) {
        window.filterChipRemovers[index]();
    }
}

// Remove individual risk filter
function removeRiskFilter(riskValue) {
    const checkbox = document.querySelector(`#risk-filter-dropdown input[value="${riskValue}"]`);
    if (checkbox) {
        checkbox.checked = false;
    }
    applyRiskFilter();
}

// Update filter indicator (icon highlight and count badge)
function updateFilterIndicator(columnName, count) {
    const icon = document.getElementById(`${columnName}-filter-icon`);
    const badge = document.getElementById(`${columnName}-filter-count`);
    
    if (icon) {
        if (count > 0) {
            icon.classList.add('text-indigo-600');
            icon.classList.remove('text-slate-600');
        } else {
            icon.classList.remove('text-indigo-600');
            icon.classList.add('text-slate-600');
        }
    }
    
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// Enhanced matchesFilters to include new column filters
function matchesColumnFilters(poam) {
    // Search filter (from header)
    if (activeFilters.search) {
        const searchLower = activeFilters.search;
        const matchesSearch = 
            (poam.id && poam.id.toLowerCase().includes(searchLower)) ||
            (poam.title && poam.title.toLowerCase().includes(searchLower)) ||
            (poam.vulnerability && poam.vulnerability.toLowerCase().includes(searchLower)) ||
            (poam.asset && poam.asset.toLowerCase().includes(searchLower)) ||
            (poam.affectedAssets && poam.affectedAssets.some(a => a.toLowerCase().includes(searchLower)));
        
        if (!matchesSearch) return false;
    }
    
    // Risk filter (multi-select)
    if (activeFilters.risk.length > 0) {
        if (!activeFilters.risk.includes(poam.risk)) {
            return false;
        }
    }
    
    // Status filter
    if (activeFilters.status && poam.status !== activeFilters.status) {
        return false;
    }
    
    // POC filter
    if (activeFilters.poc) {
        const poamPOC = poam.poc || poam.pocTeam || 'Unassigned';
        if (poamPOC !== activeFilters.poc) {
            return false;
        }
    }
    
    // Asset range filter
    if (activeFilters.assetRange) {
        const assetCount = poam.assetCount || poam.totalAffectedAssets || 0;
        const threshold = parseInt(activeFilters.assetRange);
        if (assetCount <= threshold) {
            return false;
        }
    }
    
    // Due date filter
    if (activeFilters.dueDate) {
        const dueDate = new Date(poam.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        switch (activeFilters.dueDate) {
            case 'overdue':
                if (dueDate >= today) return false;
                break;
            case '7days':
                const sevenDays = new Date(today);
                sevenDays.setDate(sevenDays.getDate() + 7);
                if (dueDate < today || dueDate > sevenDays) return false;
                break;
            case '30days':
                const thirtyDays = new Date(today);
                thirtyDays.setDate(thirtyDays.getDate() + 30);
                if (dueDate < today || dueDate > thirtyDays) return false;
                break;
        }
    }
    
    return true;
}

// Clear all column filters
function clearAllColumnFilters() {
    // Reset filter state
    activeFilters = {
        search: activeFilters.search, // Keep search
        risk: [],
        status: '',
        poc: '',
        assetRange: '',
        dueDate: ''
    };
    
    // Reset UI elements
    document.querySelectorAll('#risk-filter-dropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="status-filter"]').forEach(r => r.checked = r.value === '');
    document.querySelectorAll('input[name="asset-range"]').forEach(r => r.checked = r.value === '');
    document.querySelectorAll('input[name="duedate-filter"]').forEach(r => r.checked = r.value === '');
    document.querySelectorAll('input[name="poc-filter"]').forEach(r => r.checked = false);
    
    // Update indicators
    updateFilterIndicator('risk', 0);
    updateFilterIndicator('status', 0);
    updateFilterIndicator('asset', 0);
    updateFilterIndicator('duedate', 0);
    updateFilterIndicator('poc', 0);
    
    // Update chips display
    updateFilterChips();
    
    // Refresh display
    currentPOAMPage = 1;
    displayVulnerabilityPOAMs();
}
