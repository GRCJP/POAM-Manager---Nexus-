// Pipeline Progress UI - Visual progress tracking for 5-phase pipeline
// Shows per-phase progress bars, overall progress, and key metrics

console.log('📦 pipeline-progress-ui.js loading...');

class PipelineProgressUI {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.currentState = null;
    }

    // ═══════════════════════════════════════════════════════════════
    // UI INITIALIZATION
    // ═══════════════════════════════════════════════════════════════
    
    show() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.error(`Container ${this.containerId} not found`);
            return;
        }
        
        this.container.innerHTML = this.renderProgressUI();
        this.container.classList.remove('hidden');
    }

    hide() {
        if (this.container) {
            this.container.classList.add('hidden');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PROGRESS UPDATE
    // ═══════════════════════════════════════════════════════════════
    
    updateProgress(state) {
        this.currentState = state;
        
        if (!this.container) {
            this.show();
        }
        
        // Update overall progress
        this.updateOverallProgress(state.overallProgress);
        
        // Update phase indicators
        this.updatePhaseIndicators(state.phaseIndex);
        
        // Update current phase progress
        this.updateCurrentPhaseProgress(state.phaseIndex, state.phaseProgress);
        
        // Update counts
        this.updateCounts(state.counts);
        
        // Update status text
        this.updateStatusText(state.phaseName, state.phaseProgress);
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDER METHODS
    // ═══════════════════════════════════════════════════════════════
    
    renderProgressUI() {
        return `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="pipeline-progress-overlay">
                <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 p-6">
                    <!-- Header -->
                    <div class="mb-6">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <h2 class="text-2xl font-bold text-gray-900 mb-2">Processing Scan Data</h2>
                                <p class="text-gray-600">Running 5-phase pipeline to generate POAMs</p>
                            </div>
                            <button type="button" onclick="window.exitPipelineProgressUI && window.exitPipelineProgressUI()" class="px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                                Exit
                            </button>
                        </div>
                    </div>

                    <!-- Overall Progress -->
                    <div class="mb-6">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-sm font-medium text-gray-700">Overall Progress</span>
                            <span class="text-sm font-medium text-gray-900" id="overall-progress-percent">0%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-3">
                            <div id="overall-progress-bar" class="bg-indigo-600 h-3 rounded-full transition-all duration-300" style="width: 0%"></div>
                        </div>
                    </div>

                    <!-- Phase Indicators -->
                    <div class="mb-6">
                        <div class="space-y-3">
                            ${this.renderPhaseIndicator(1, 'Point Eligibility Gate', '30-day first_detected filter')}
                            ${this.renderPhaseIndicator(2, 'Grouping', 'Group by remediation strategy')}
                            ${this.renderPhaseIndicator(3, 'Group Enrichment', 'Extract assets, descriptions, mitigation')}
                            ${this.renderPhaseIndicator(4, 'POAM Pre-Population', 'SLA, severity, OS, POC assignment')}
                            ${this.renderPhaseIndicator(5, 'Commit and Persist', 'Write to database')}
                        </div>
                    </div>

                    <!-- Current Phase Progress -->
                    <div class="mb-6 p-4 bg-gray-50 rounded-lg">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-sm font-medium text-gray-700" id="current-phase-name">Initializing...</span>
                            <span class="text-sm font-medium text-gray-900" id="current-phase-percent">0%</span>
                        </div>
                        <div class="w-full bg-gray-300 rounded-full h-2">
                            <div id="current-phase-bar" class="bg-green-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                        </div>
                    </div>

                    <!-- Counts -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div class="bg-blue-50 p-3 rounded-lg">
                            <div class="text-xs text-blue-600 font-medium mb-1">Total Findings</div>
                            <div class="text-2xl font-bold text-blue-900" id="count-total">0</div>
                        </div>
                        <div class="bg-green-50 p-3 rounded-lg">
                            <div class="text-xs text-green-600 font-medium mb-1">Eligible</div>
                            <div class="text-2xl font-bold text-green-900" id="count-eligible">0</div>
                        </div>
                        <div class="bg-purple-50 p-3 rounded-lg">
                            <div class="text-xs text-purple-600 font-medium mb-1">Groups</div>
                            <div class="text-2xl font-bold text-purple-900" id="count-groups">0</div>
                        </div>
                        <div class="bg-indigo-50 p-3 rounded-lg">
                            <div class="text-xs text-indigo-600 font-medium mb-1">POAMs Created</div>
                            <div class="text-2xl font-bold text-indigo-900" id="count-poams">0</div>
                        </div>
                    </div>

                    <!-- Status Text -->
                    <div class="text-center text-sm text-gray-500" id="status-text">
                        Starting pipeline...
                    </div>
                </div>
            </div>
        `;
    }

    renderPhaseIndicator(phaseIndex, phaseName, description) {
        return `
            <div class="flex items-start space-x-3" id="phase-${phaseIndex}-indicator">
                <div class="flex-shrink-0 mt-1">
                    <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center phase-icon" 
                         id="phase-${phaseIndex}-icon">
                        <span class="text-sm font-medium text-gray-400">${phaseIndex}</span>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                        <p class="text-sm font-medium text-gray-900">${phaseName}</p>
                        <span class="text-xs text-gray-500 phase-status" id="phase-${phaseIndex}-status"></span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">${description}</p>
                    <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2 hidden" id="phase-${phaseIndex}-progress-container">
                        <div class="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                             id="phase-${phaseIndex}-progress" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════
    // UPDATE METHODS
    // ═══════════════════════════════════════════════════════════════
    
    updateOverallProgress(progress) {
        const percent = Math.floor(progress * 100);
        const bar = document.getElementById('overall-progress-bar');
        const text = document.getElementById('overall-progress-percent');
        
        if (bar) bar.style.width = percent + '%';
        if (text) text.textContent = percent + '%';
    }

    updatePhaseIndicators(currentPhaseIndex) {
        for (let i = 1; i <= 5; i++) {
            const icon = document.getElementById(`phase-${i}-icon`);
            const status = document.getElementById(`phase-${i}-status`);
            const progressContainer = document.getElementById(`phase-${i}-progress-container`);
            
            if (!icon || !status) continue;
            
            if (i < currentPhaseIndex) {
                // Completed phase
                icon.classList.remove('border-gray-300', 'border-blue-500');
                icon.classList.add('border-green-500', 'bg-green-500');
                icon.innerHTML = '<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>';
                status.textContent = 'Completed';
                status.classList.add('text-green-600');
                if (progressContainer) progressContainer.classList.add('hidden');
            } else if (i === currentPhaseIndex) {
                // Current phase
                icon.classList.remove('border-gray-300', 'border-green-500', 'bg-green-500');
                icon.classList.add('border-blue-500');
                icon.innerHTML = `<span class="text-sm font-medium text-blue-500">${i}</span>`;
                status.textContent = 'In Progress';
                status.classList.add('text-blue-600');
                if (progressContainer) progressContainer.classList.remove('hidden');
            } else {
                // Pending phase
                icon.classList.remove('border-blue-500', 'border-green-500', 'bg-green-500');
                icon.classList.add('border-gray-300');
                icon.innerHTML = `<span class="text-sm font-medium text-gray-400">${i}</span>`;
                status.textContent = 'Pending';
                status.classList.remove('text-blue-600', 'text-green-600');
                if (progressContainer) progressContainer.classList.add('hidden');
            }
        }
    }

    updateCurrentPhaseProgress(phaseIndex, progress) {
        const percent = Math.floor(progress * 100);
        
        // Update current phase bar in main section
        const bar = document.getElementById('current-phase-bar');
        const text = document.getElementById('current-phase-percent');
        
        if (bar) bar.style.width = percent + '%';
        if (text) text.textContent = percent + '%';
        
        // Update phase-specific progress bar
        const phaseBar = document.getElementById(`phase-${phaseIndex}-progress`);
        if (phaseBar) phaseBar.style.width = percent + '%';
    }

    updateCounts(counts) {
        const elements = {
            'count-total': counts.totalRows,
            'count-eligible': counts.eligibleCount,
            'count-groups': counts.groupCount,
            'count-poams': counts.poamsCreated
        };
        
        for (const [id, value] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value || 0;
        }
    }

    updateStatusText(phaseName, progress) {
        const statusEl = document.getElementById('status-text');
        const phaseNameEl = document.getElementById('current-phase-name');
        
        if (statusEl) {
            const percent = Math.floor(progress * 100);
            statusEl.textContent = `Processing ${phaseName}... ${percent}%`;
        }
        
        if (phaseNameEl) {
            phaseNameEl.textContent = phaseName;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // COMPLETION
    // ═══════════════════════════════════════════════════════════════
    
    showComplete(counts) {
        const statusEl = document.getElementById('status-text');
        if (statusEl) {
            statusEl.innerHTML = `
                <div class="text-green-600 font-medium">
                    ✅ Pipeline completed successfully!<br>
                    <span class="text-sm text-gray-600">
                        Created ${counts.poamsCreated} POAMs from ${counts.totalRows} findings
                        (${counts.excludedCount} excluded, ${counts.poamsSkipped} skipped)
                    </span>
                </div>
            `;
        }
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            this.hide();
        }, 3000);
    }

    showError(error) {
        const statusEl = document.getElementById('status-text');
        if (statusEl) {
            statusEl.innerHTML = `
                <div class="text-red-600 font-medium">
                    ❌ Pipeline failed: ${error.message}<br>
                    <span class="text-sm text-gray-600">Phase: ${error.phase}</span>
                    <div class="mt-3">
                        <button type="button" onclick="window.exitPipelineProgressUI && window.exitPipelineProgressUI()" class="px-3 py-2 text-sm font-semibold text-white bg-red-600 rounded hover:bg-red-700">Exit</button>
                    </div>
                </div>
            `;
        }
    }
}

// Export for use in main application
window.PipelineProgressUI = PipelineProgressUI;

console.log('✅ pipeline-progress-ui.js loaded successfully');
