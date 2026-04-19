// POAM Workbook Production Enhancements
// Comprehensive features: filtering, quick status panels, all-systems view, exports

// ============================================================================
// FILTERING SYSTEM
// ============================================================================

window.poamWorkbookState = window.poamWorkbookState || {};
window.poamWorkbookState.filters = {
  searchText: '',
  status: 'all',
  severity: 'all',
  poc: 'all',
  dateRange: 'all'
};

window.poamWorkbookSyncStatusPills = function(activeBtn) {
  const pills = document.querySelectorAll('.poam-status-pill');
  pills.forEach(p => {
    p.style.border = '1px solid #E2E4E8';
    p.style.background = '#fff';
    p.style.color = '#374151';
  });
  if (activeBtn) {
    activeBtn.style.border = '1px solid #CCEEEE';
    activeBtn.style.background = '#E6F7F7';
    activeBtn.style.color = '#0D7377';
  }
};

window.poamWorkbookApplyFilters = async function() {
  const systemId = window.poamWorkbookState.activeSystemId;
  if (!systemId || window.poamWorkbookState.activeTab !== 'system') return;
  
  await renderWorkbookSystemTable(systemId);
};

window.poamWorkbookFilterByMetric = function(metric) {
  console.log('Filter by metric:', metric);
  
  // Reset filters
  window.poamWorkbookState.filters = {
    searchText: '',
    status: 'all',
    severity: 'all',
    poc: 'all',
    dateRange: 'all'
  };
  
  // Apply metric-specific filter
  switch(metric) {
    case 'overdue':
      window.poamWorkbookState.filters.dateRange = 'overdue';
      break;
    case 'coming-due':
      window.poamWorkbookState.filters.dateRange = 'coming-due';
      break;
    case 'missing-poc':
      window.poamWorkbookState.filters.poc = 'unassigned';
      break;
    case 'completed':
      window.poamWorkbookState.filters.status = 'Completed';
      break;
    case 'all':
    default:
      // Show all
      break;
  }
  
  // If we're on overview, switch to first system
  if (window.poamWorkbookState.activeTab === 'overview') {
    const systems = window.poamWorkbookState.systems || [];
    if (systems.length > 0) {
      poamWorkbookShowSystem(systems[0].id);
    }
  } else {
    poamWorkbookApplyFilters();
  }
};

// Filter items based on current filter state
window.poamWorkbookFilterItems = function(items) {
  const filters = window.poamWorkbookState.filters;
  
  return items.filter(item => {
    // Search text filter
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      const searchableText = [
        item['Item number'],
        item['Vulnerability Name'],
        item['Vulnerability Description'],
        item['POC Name'],
        item['Impacted Security Controls'],
        item['Identifying Detecting Source'],
        item['Comments'],
        item['Mitigations']
      ].join(' ').toLowerCase();

      if (!searchableText.includes(searchLower)) return false;
    }

    // Control family filter
    if (filters.controlFamily && filters.controlFamily !== 'all') {
      const itemControl = String(item['Impacted Security Controls'] || '').trim().toUpperCase();
      const filterCF = filters.controlFamily.toUpperCase();
      if (!itemControl.startsWith(filterCF)) return false;
    }

    // Status filter (group related statuses)
    if (filters.status !== 'all') {
      const itemStatus = String(item['Status'] || '').trim().toLowerCase();
      const filterStatus = filters.status.toLowerCase();
      const statusGroups = {
        'open': ['open', 'ongoing'],
        'in progress': ['in progress'],
        'delayed': ['delayed', 'extended'],
        'completed': ['completed', 'closed'],
        'risk accepted': ['risk accepted']
      };
      const allowed = statusGroups[filterStatus] || [filterStatus];
      if (!allowed.includes(itemStatus)) return false;
    }

    // Closed-within-days filter (only applies to completed items)
    if (filters.closedWithinDays && filters.closedWithinDays > 0) {
      const closedStr = String(item['Actual Completion Date'] || item.updatedAt || '').trim();
      if (!closedStr) return false;
      const closedDate = new Date(closedStr);
      if (isNaN(closedDate.getTime())) return false;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      closedDate.setHours(0, 0, 0, 0);
      const daysAgo = Math.floor((today - closedDate) / 86400000);
      if (daysAgo > filters.closedWithinDays) return false;
    }

    // Severity filter
    if (filters.severity !== 'all') {
      const itemSeverity = String(item['Severity Value'] || '').trim();
      if (itemSeverity !== filters.severity) return false;
    }
    
    // POC filter
    if (filters.poc === 'unassigned') {
      const itemPoc = String(item['POC Name'] || '').trim();
      if (itemPoc && itemPoc !== 'Unassigned') return false;
    } else if (filters.poc !== 'all') {
      const itemPoc = String(item['POC Name'] || '').trim();
      if (itemPoc !== filters.poc) return false;
    }
    
    // Date range filter
    if (filters.dateRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysOut = new Date(today);
      thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
      
      const dueStr = String(item['Updated Scheduled Completion Date'] || item['Scheduled Completion Date'] || '').trim();
      const status = String(item['Status'] || '').trim();
      
      if (dueStr) {
        const dueDate = new Date(dueStr);
        if (!isNaN(dueDate.getTime())) {
          dueDate.setHours(0, 0, 0, 0);
          
          if (filters.dateRange === 'overdue') {
            if (!(dueDate < today && status !== 'Completed' && status !== 'Closed')) {
              return false;
            }
          } else if (filters.dateRange === 'coming-due') {
            if (!(dueDate >= today && dueDate <= thirtyDaysOut && status !== 'Completed' && status !== 'Closed')) {
              return false;
            }
          }
        }
      } else if (filters.dateRange === 'overdue' || filters.dateRange === 'coming-due') {
        return false;
      }
    }
    
    return true;
  });
};

// ============================================================================
// QUICK STATUS PANEL PER SYSTEM
// ============================================================================

window.poamWorkbookRenderQuickStatusPanel = function(items) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let open = 0;
  let inProgress = 0;
  let totalCompleted = 0;
  let overdue = 0;

  // Count recently closed by time window
  const closedDaysAgo = { 7: 0, 15: 0, 30: 0, 60: 0, 90: 0 };

  for (const item of items) {
    const status = String(item['Status'] || '').trim() || 'Open';
    const sl = status.toLowerCase();

    if (sl === 'completed' || sl === 'closed') {
      totalCompleted++;
      // Check when it was completed for recent-closed counts
      const closedStr = String(item['Actual Completion Date'] || item.updatedAt || '').trim();
      if (closedStr) {
        const closedDate = new Date(closedStr);
        if (!isNaN(closedDate.getTime())) {
          closedDate.setHours(0, 0, 0, 0);
          const daysAgo = Math.floor((today - closedDate) / 86400000);
          for (const window of [7, 15, 30, 60, 90]) {
            if (daysAgo <= window) closedDaysAgo[window]++;
          }
        }
      }
      continue;
    } else if (sl === 'risk accepted') {
      continue;
    }

    // Check if overdue
    const dueStr = String(item['Updated Scheduled Completion Date'] || item['Scheduled Completion Date'] || '').trim();
    let isOverdue = false;
    if (dueStr) {
      const dueDate = new Date(dueStr);
      if (!isNaN(dueDate.getTime())) {
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < today) isOverdue = true;
      }
    }

    if (sl === 'delayed' || sl === 'extended' || isOverdue) {
      overdue++;
    } else if (sl === 'in progress') {
      inProgress++;
    } else {
      open++;
    }
  }

  // Default closed window
  const defaultWindow = 30;

  return `
    <div class="grid grid-cols-5 gap-2 mb-4">
      <div style="background:#E6F7F7;border:1px solid #CCEEEE" class="rounded-lg p-3 cursor-pointer hover:shadow transition-shadow" onclick="window.poamWorkbookState.filters.status='Open'; window.poamWorkbookState.filters.dateRange='all'; poamWorkbookApplyFilters()">
        <div style="color:#0A5E62" class="text-xs font-semibold uppercase mb-1">Open</div>
        <div style="color:#0D7377" class="text-2xl font-bold">${open}</div>
      </div>
      <div style="background:#FFF7ED;border:1px solid #FDE68A" class="rounded-lg p-3 cursor-pointer hover:shadow transition-shadow" onclick="window.poamWorkbookState.filters.status='In Progress'; window.poamWorkbookState.filters.dateRange='all'; poamWorkbookApplyFilters()">
        <div style="color:#92400E" class="text-xs font-semibold uppercase mb-1">In Progress</div>
        <div style="color:#B45309" class="text-2xl font-bold">${inProgress}</div>
      </div>
      <div style="background:#FFF5F5;border:1px solid #FECACA" class="rounded-lg p-3 cursor-pointer hover:shadow transition-shadow" onclick="window.poamWorkbookState.filters.status='all'; window.poamWorkbookState.filters.dateRange='overdue'; poamWorkbookApplyFilters()">
        <div style="color:#991B1B" class="text-xs font-semibold uppercase mb-1">Overdue</div>
        <div style="color:#DC2626" class="text-2xl font-bold">${overdue}</div>
      </div>
      <div style="background:#F3F4F6;border:1px solid #E2E4E8" class="rounded-lg p-3 cursor-pointer hover:shadow transition-shadow" onclick="window.poamWorkbookState.filters.status='Completed'; window.poamWorkbookState.filters.dateRange='all'; poamWorkbookApplyFilters()">
        <div style="color:#374151" class="text-xs font-semibold uppercase mb-1">All Completed</div>
        <div style="color:#111827" class="text-2xl font-bold">${totalCompleted}</div>
      </div>
      <div style="background:#E6F7F7;border:1px solid #CCEEEE" class="rounded-lg p-3 hover:shadow transition-shadow">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div style="color:#0A5E62" class="text-xs font-semibold uppercase">Closed</div>
          <select id="wb-closed-window" onchange="poamWorkbookUpdateClosedTile(this.value)" style="font-size:10px;border:1px solid #CCEEEE;border-radius:4px;padding:1px 4px;background:#fff;color:#0A5E62;font-weight:700;cursor:pointer;font-family:inherit">
            <option value="7">7d</option>
            <option value="15">15d</option>
            <option value="30" selected>30d</option>
            <option value="60">60d</option>
            <option value="90">90d</option>
          </select>
        </div>
        <div id="wb-closed-count" style="color:#0D7377;cursor:pointer" class="text-2xl font-bold" onclick="window.poamWorkbookState.filters.status='Completed'; window.poamWorkbookState.filters.closedWithinDays=parseInt(document.getElementById('wb-closed-window').value)||30; window.poamWorkbookState.filters.dateRange='all'; poamWorkbookApplyFilters()">${closedDaysAgo[defaultWindow]}</div>
        <script>
          window._closedDaysAgo = ${JSON.stringify(closedDaysAgo)};
        </script>
      </div>
    </div>
  `;
};

window.poamWorkbookUpdateClosedTile = function(days) {
  const el = document.getElementById('wb-closed-count');
  if (el && window._closedDaysAgo) {
    el.textContent = window._closedDaysAgo[days] || 0;
  }
};

// ============================================================================
// ALL SYSTEMS VIEW
// ============================================================================

window.poamWorkbookRenderAllSystemsView = async function() {
  const allItems = await window.poamWorkbookDB.getAllItems();
  const systemsMap = new Map();
  
  // Group items by system
  for (const item of allItems) {
    const sysId = item.systemId || 'default';
    if (!systemsMap.has(sysId)) {
      systemsMap.set(sysId, []);
    }
    systemsMap.get(sysId).push(item);
  }
  
  const systems = Array.from(systemsMap.entries()).map(([id, items]) => {
    const analytics = computeWorkbookAnalytics(items, `system:${id}`);
    return { id, items, analytics };
  });
  
  return `
    <div class="space-y-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-slate-900">All Systems Overview</h3>
        <button onclick="poamWorkbookExportAllSystems()" class="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 text-sm font-semibold">
          <i class="fas fa-file-export mr-2"></i>Export All Systems
        </button>
      </div>
      
      ${systems.map(sys => `
        <div class="bg-white rounded-lg border border-slate-200 p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <h4 class="text-md font-bold text-slate-900">${escapeHtml(sys.id)}</h4>
              <span class="text-sm text-slate-600">${sys.items.length} POAMs</span>
            </div>
            <div class="flex gap-2">
              <button onclick="poamWorkbookShowSystem('${escapeAttr(sys.id)}')" class="px-3 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 text-sm font-medium">
                <i class="fas fa-eye mr-1"></i>View
              </button>
              <button onclick="poamWorkbookExportSystem('${escapeAttr(sys.id)}')" class="px-3 py-1 bg-teal-50 text-teal-800 rounded hover:bg-teal-100 text-sm font-medium">
                <i class="fas fa-download mr-1"></i>Export
              </button>
            </div>
          </div>
          
          <div class="grid grid-cols-5 gap-2">
            <div class="text-center p-2 bg-slate-50 rounded">
              <div class="text-xs text-slate-600 mb-1">Total</div>
              <div class="text-lg font-bold text-slate-900">${sys.analytics.total}</div>
            </div>
            <div class="text-center p-2 bg-red-50 rounded">
              <div class="text-xs text-red-600 mb-1">Overdue</div>
              <div class="text-lg font-bold text-red-900">${sys.analytics.overdue}</div>
            </div>
            <div class="text-center p-2 bg-amber-50 rounded">
              <div class="text-xs text-amber-600 mb-1">Coming Due</div>
              <div class="text-lg font-bold text-amber-900">${sys.analytics.comingDue || 0}</div>
            </div>
            <div class="text-center p-2 bg-orange-50 rounded">
              <div class="text-xs text-amber-700 mb-1">No POC</div>
              <div class="text-lg font-bold text-orange-900">${sys.analytics.missingPoc}</div>
            </div>
            <div class="text-center p-2 bg-green-50 rounded">
              <div class="text-xs text-green-600 mb-1">Completed</div>
              <div class="text-lg font-bold text-green-900">${sys.analytics.completed || 0}</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
};

// Export all systems
window.poamWorkbookExportAllSystems = async function() {
  try {
    await poamWorkbookExportXlsx({ systemId: null });
    showUpdateFeedback('Exported all systems successfully', 'success');
  } catch (e) {
    console.error('Export failed:', e);
    showUpdateFeedback(`Export failed: ${e.message}`, 'error');
  }
};

// Export specific system
window.poamWorkbookExportSystem = async function(systemId) {
  try {
    await poamWorkbookExportXlsx({ systemId });
    showUpdateFeedback(`Exported system ${systemId} successfully`, 'success');
  } catch (e) {
    console.error('Export failed:', e);
    showUpdateFeedback(`Export failed: ${e.message}`, 'error');
  }
};

console.log('✅ POAM Workbook Production Enhancements loaded');
