// ═══════════════════════════════════════════════════════════════
// POAM ACTIVITY WIDGET
// Dashboard widget showing POAM activity metrics and trends
// ═══════════════════════════════════════════════════════════════

async function renderPOAMActivityWidget(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Activity widget container not found:', containerId);
        return;
    }

    // Show loading state
    container.innerHTML = `
        <div class="bg-white rounded-lg shadow-md p-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-slate-800">📊 POAM Activity Monitor</h3>
                <div class="animate-pulse text-slate-400">
                    <i class="fas fa-spinner fa-spin"></i> Analyzing...
                </div>
            </div>
        </div>
    `;

    try {
        // Run activity analysis
        const metrics = await window.poamActivityMonitor.analyzeActivity();

        if (metrics.isFirstRun) {
            // First run - show baseline message
            container.innerHTML = `
                <div class="bg-white rounded-lg shadow-md p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold text-slate-800">📊 POAM Activity Monitor</h3>
                        <button onclick="refreshPOAMActivity()" class="text-sm text-teal-700 hover:text-teal-800">
                            <i class="fas fa-sync-alt"></i> Refresh
                        </button>
                    </div>
                    <div class="text-center py-8">
                        <i class="fas fa-check-circle text-green-500 text-4xl mb-3"></i>
                        <p class="text-slate-600 font-medium">Baseline Snapshot Captured</p>
                        <p class="text-sm text-slate-500 mt-2">Activity tracking will begin on next refresh</p>
                        <p class="text-xs text-slate-400 mt-4">Current POAMs: ${metrics.currentSnapshot.totalPOAMs}</p>
                    </div>
                </div>
            `;
            return;
        }

        // Render activity metrics
        const html = buildActivityWidgetHTML(metrics);
        container.innerHTML = html;

    } catch (error) {
        console.error('Failed to render activity widget:', error);
        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-slate-800">📊 POAM Activity Monitor</h3>
                </div>
                <div class="text-center py-8 text-red-600">
                    <i class="fas fa-exclamation-triangle text-3xl mb-2"></i>
                    <p class="font-medium">Failed to load activity data</p>
                    <p class="text-sm text-slate-500 mt-2">${error.message}</p>
                </div>
            </div>
        `;
    }
}

function buildActivityWidgetHTML(metrics) {
    const { timeframe, statusChanges, currentState, percentages, detailedChanges } = metrics;

    // Determine trend indicators
    const getTrendIcon = (value) => {
        if (value > 0) return '<i class="fas fa-arrow-up text-green-600"></i>';
        if (value < 0) return '<i class="fas fa-arrow-down text-red-600"></i>';
        return '<i class="fas fa-minus text-slate-400"></i>';
    };

    const getTrendColor = (value, inverse = false) => {
        if (inverse) {
            // For metrics where decrease is good (e.g., delayed)
            if (value > 0) return 'text-red-600';
            if (value < 0) return 'text-green-600';
        } else {
            // For metrics where increase is good (e.g., closed)
            if (value > 0) return 'text-green-600';
            if (value < 0) return 'text-red-600';
        }
        return 'text-slate-600';
    };

    return `
        <div class="bg-white rounded-lg shadow-md p-6">
            <!-- Header -->
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="text-lg font-semibold text-slate-800">📊 POAM Activity Monitor</h3>
                    <p class="text-xs text-slate-500 mt-1">Since last check: ${timeframe.displayTime} ago</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="showActivityDetails()" class="text-sm text-slate-600 hover:text-slate-800">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                    <button onclick="refreshPOAMActivity()" class="text-sm text-teal-700 hover:text-teal-800">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>

            <!-- Key Metrics Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <!-- Closed -->
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-medium text-green-700 uppercase">Closed</span>
                        ${getTrendIcon(statusChanges.closed)}
                    </div>
                    <div class="text-2xl font-bold ${getTrendColor(statusChanges.closed)}">
                        ${statusChanges.closed > 0 ? '+' : ''}${statusChanges.closed}
                    </div>
                    <div class="text-xs text-green-600 mt-1">
                        ${currentState.completed} total (${percentages.completed}%)
                    </div>
                </div>

                <!-- In Progress -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-medium text-blue-700 uppercase">In Progress</span>
                        ${getTrendIcon(statusChanges.newlyInProgress)}
                    </div>
                    <div class="text-2xl font-bold ${getTrendColor(statusChanges.newlyInProgress)}">
                        ${statusChanges.newlyInProgress > 0 ? '+' : ''}${statusChanges.newlyInProgress}
                    </div>
                    <div class="text-xs text-blue-600 mt-1">
                        ${currentState.inProgress} active (${percentages.activelyWorked}%)
                    </div>
                </div>

                <!-- Delayed -->
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-medium text-red-700 uppercase">Delayed</span>
                        ${getTrendIcon(statusChanges.newlyDelayed)}
                    </div>
                    <div class="text-2xl font-bold ${getTrendColor(statusChanges.newlyDelayed, true)}">
                        ${statusChanges.newlyDelayed > 0 ? '+' : ''}${statusChanges.newlyDelayed}
                    </div>
                    <div class="text-xs text-red-600 mt-1">
                        ${currentState.delayed} overdue (${percentages.delayed}%)
                    </div>
                </div>

                <!-- Needs Review -->
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-medium text-amber-700 uppercase">Needs Review</span>
                        ${getTrendIcon(statusChanges.newlyNeedsReview)}
                    </div>
                    <div class="text-2xl font-bold ${getTrendColor(statusChanges.newlyNeedsReview, true)}">
                        ${statusChanges.newlyNeedsReview > 0 ? '+' : ''}${statusChanges.newlyNeedsReview}
                    </div>
                    <div class="text-xs text-amber-600 mt-1">
                        ${currentState.needsReview} flagged
                    </div>
                </div>
            </div>

            <!-- Activity Summary Bar -->
            <div class="bg-slate-50 rounded-lg p-4 mb-4">
                <div class="flex items-center justify-between text-sm mb-2">
                    <span class="font-medium text-slate-700">Activity Summary</span>
                    <span class="text-xs text-slate-500">${currentState.total} total POAMs</span>
                </div>
                <div class="flex gap-2 text-xs">
                    ${detailedChanges.statusChanged.length > 0 ? `
                        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            ${detailedChanges.statusChanged.length} status change${detailedChanges.statusChanged.length !== 1 ? 's' : ''}
                        </span>
                    ` : ''}
                    ${detailedChanges.newPOAMs.length > 0 ? `
                        <span class="px-2 py-1 bg-green-100 text-green-700 rounded">
                            ${detailedChanges.newPOAMs.length} new POAM${detailedChanges.newPOAMs.length !== 1 ? 's' : ''}
                        </span>
                    ` : ''}
                    ${detailedChanges.riskChanged.length > 0 ? `
                        <span class="px-2 py-1 bg-amber-50 text-amber-800 rounded">
                            ${detailedChanges.riskChanged.length} risk change${detailedChanges.riskChanged.length !== 1 ? 's' : ''}
                        </span>
                    ` : ''}
                    ${detailedChanges.assetCountChanged.length > 0 ? `
                        <span class="px-2 py-1 bg-slate-100 text-slate-700 rounded">
                            ${detailedChanges.assetCountChanged.length} asset update${detailedChanges.assetCountChanged.length !== 1 ? 's' : ''}
                        </span>
                    ` : ''}
                    ${detailedChanges.statusChanged.length === 0 && detailedChanges.newPOAMs.length === 0 && detailedChanges.riskChanged.length === 0 && detailedChanges.assetCountChanged.length === 0 ? `
                        <span class="text-slate-500 italic">No changes detected</span>
                    ` : ''}
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="flex gap-2 text-sm">
                ${statusChanges.closed > 0 ? `
                    <button onclick="showModule('vulnerability-tracking'); filterPOAMsByMetric('closed')" 
                            class="flex-1 px-3 py-2 bg-green-50 text-green-700 rounded hover:bg-green-100 border border-green-200">
                        <i class="fas fa-check-circle"></i> View Closed
                    </button>
                ` : ''}
                ${currentState.delayed > 0 ? `
                    <button onclick="showModule('vulnerability-tracking'); filterPOAMsByMetric('overdue')" 
                            class="flex-1 px-3 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100 border border-red-200">
                        <i class="fas fa-exclamation-triangle"></i> View Delayed
                    </button>
                ` : ''}
                ${currentState.needsReview > 0 ? `
                    <button onclick="showModule('vulnerability-tracking'); filterPOAMsByMetric('needs-review')" 
                            class="flex-1 px-3 py-2 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 border border-amber-200">
                        <i class="fas fa-flag"></i> View Flagged
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// Show detailed activity changes modal
function showActivityDetails() {
    const metrics = window.poamActivityMonitor.activityMetrics;
    if (!metrics) {
        alert('No activity data available. Please refresh the activity monitor.');
        return;
    }

    const { detailedChanges, timeframe } = metrics;

    let html = `
        <div class="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto max-h-[90vh] overflow-y-auto">
            <h2 class="text-xl font-bold text-slate-800 mb-4">📊 Detailed Activity Report</h2>
            <p class="text-sm text-slate-500 mb-6">Changes since ${new Date(timeframe.lastCheckTimestamp).toLocaleString()}</p>
    `;

    // Status changes
    if (detailedChanges.statusChanged.length > 0) {
        html += `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-slate-800 mb-3">🔄 Status Changes (${detailedChanges.statusChanged.length})</h3>
                <div class="bg-slate-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <table class="w-full text-sm">
                        <thead class="text-xs text-slate-500 uppercase">
                            <tr>
                                <th class="text-left py-2">POAM ID</th>
                                <th class="text-center py-2">From</th>
                                <th class="text-center py-2">To</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        detailedChanges.statusChanged.forEach(change => {
            html += `
                <tr class="border-t border-slate-200">
                    <td class="py-2 font-mono text-teal-700">${change.id}</td>
                    <td class="py-2 text-center">
                        <span class="px-2 py-1 rounded bg-slate-200 text-slate-700 text-xs">${change.from}</span>
                    </td>
                    <td class="py-2 text-center">
                        <span class="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-semibold">${change.to}</span>
                    </td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // New POAMs
    if (detailedChanges.newPOAMs.length > 0) {
        html += `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-slate-800 mb-3">🆕 New POAMs (${detailedChanges.newPOAMs.length})</h3>
                <div class="bg-green-50 rounded-lg p-4">
                    <div class="flex flex-wrap gap-2">
        `;
        
        detailedChanges.newPOAMs.forEach(poam => {
            html += `<span class="px-3 py-1 bg-white border border-green-200 rounded text-sm font-mono text-slate-700">${poam.id}</span>`;
        });
        
        html += `
                    </div>
                </div>
            </div>
        `;
    }

    // Risk changes
    if (detailedChanges.riskChanged.length > 0) {
        html += `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-slate-800 mb-3">⚠️ Risk Changes (${detailedChanges.riskChanged.length})</h3>
                <div class="bg-slate-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <table class="w-full text-sm">
                        <thead class="text-xs text-slate-500 uppercase">
                            <tr>
                                <th class="text-left py-2">POAM ID</th>
                                <th class="text-center py-2">From</th>
                                <th class="text-center py-2">To</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        detailedChanges.riskChanged.forEach(change => {
            const getRiskColor = (risk) => {
                const r = risk.toLowerCase();
                if (r === 'critical') return 'bg-red-100 text-red-800';
                if (r === 'high') return 'bg-amber-50 text-orange-800';
                if (r === 'medium') return 'bg-yellow-100 text-yellow-800';
                return 'bg-slate-100 text-slate-800';
            };
            
            html += `
                <tr class="border-t border-slate-200">
                    <td class="py-2 font-mono text-teal-700">${change.id}</td>
                    <td class="py-2 text-center">
                        <span class="px-2 py-1 rounded text-xs ${getRiskColor(change.from)}">${change.from}</span>
                    </td>
                    <td class="py-2 text-center">
                        <span class="px-2 py-1 rounded text-xs font-semibold ${getRiskColor(change.to)}">${change.to}</span>
                    </td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    html += `
            <div class="flex justify-end gap-3 mt-6">
                <button onclick="this.closest('.modal').remove()" class="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-200 rounded-lg hover:bg-slate-300">
                    Close
                </button>
            </div>
        </div>
    `;

    // Create and show modal
    const modal = document.createElement('div');
    modal.className = 'modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = html;
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    document.body.appendChild(modal);
}

// Refresh activity data
async function refreshPOAMActivity() {
    console.log('🔄 Refreshing POAM activity...');
    await renderPOAMActivityWidget('poam-activity-widget');
}

// Reset activity baseline
function resetActivityBaseline() {
    if (confirm('Reset activity baseline? This will clear all activity tracking history.')) {
        window.poamActivityMonitor.resetBaseline();
        alert('Activity baseline reset. A new baseline will be captured on next refresh.');
        refreshPOAMActivity();
    }
}

// Export functions globally
window.renderPOAMActivityWidget = renderPOAMActivityWidget;
window.refreshPOAMActivity = refreshPOAMActivity;
window.showActivityDetails = showActivityDetails;
window.resetActivityBaseline = resetActivityBaseline;
