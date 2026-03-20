// ═══════════════════════════════════════════════════════════════
// POAM ACTIVITY MONITOR
// Tracks POAM changes over time and provides activity metrics
// ═══════════════════════════════════════════════════════════════

class POAMActivityMonitor {
    constructor() {
        this.db = null;
        this.currentSnapshot = null;
        this.previousSnapshot = null;
        this.activityMetrics = null;
    }

    async init() {
        if (!window.poamDB || !window.poamDB.db) {
            if (window.poamDB) {
                await window.poamDB.init();
            } else {
                throw new Error('POAMDatabase not available');
            }
        }
        this.db = window.poamDB;
        
        // Load last snapshot from localStorage
        const lastSnapshot = localStorage.getItem('poamActivitySnapshot');
        if (lastSnapshot) {
            this.previousSnapshot = JSON.parse(lastSnapshot);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SNAPSHOT CREATION
    // ═══════════════════════════════════════════════════════════════

    async captureSnapshot() {
        const poams = await this.db.getAllPOAMs();
        const now = new Date().toISOString();

        // Calculate status breakdown
        const statusCounts = {};
        const riskCounts = {};
        const pocCounts = {};
        const controlFamilyCounts = {};
        
        let totalOpen = 0;
        let totalInProgress = 0;
        let totalCompleted = 0;
        let totalDelayed = 0;
        let totalNeedsReview = 0;
        let totalCriticalHigh = 0;

        const poamDetails = [];

        poams.forEach(poam => {
            const status = (poam.findingStatus || poam.status || 'open').toLowerCase();
            const risk = (poam.risk || poam.riskLevel || 'medium').toLowerCase();
            const poc = poam.poc || poam.pocTeam || 'Unassigned';
            const controlFamily = poam.controlFamily || 'Unknown';

            // Status counts
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            // Risk counts
            riskCounts[risk] = (riskCounts[risk] || 0) + 1;
            
            // POC counts
            pocCounts[poc] = (pocCounts[poc] || 0) + 1;
            
            // Control family counts
            controlFamilyCounts[controlFamily] = (controlFamilyCounts[controlFamily] || 0) + 1;

            // Aggregate metrics
            if (status === 'open') totalOpen++;
            if (status === 'in-progress' || status === 'in progress') totalInProgress++;
            if (status === 'completed' || status === 'closed') totalCompleted++;
            if (poam.needsReview) totalNeedsReview++;
            if (risk === 'critical' || risk === 'high') totalCriticalHigh++;

            // Check if delayed (past due date and not completed)
            if (poam.dueDate && (status !== 'completed' && status !== 'closed')) {
                const dueDate = new Date(poam.dueDate);
                if (dueDate < new Date()) {
                    totalDelayed++;
                }
            }

            // Store minimal POAM details for comparison
            poamDetails.push({
                id: poam.id,
                status: status,
                risk: risk,
                poc: poc,
                dueDate: poam.dueDate,
                lastModifiedDate: poam.lastModifiedDate,
                needsReview: poam.needsReview || false,
                totalAffectedAssets: poam.totalAffectedAssets || 0
            });
        });

        const snapshot = {
            timestamp: now,
            totalPOAMs: poams.length,
            statusCounts,
            riskCounts,
            pocCounts,
            controlFamilyCounts,
            aggregates: {
                open: totalOpen,
                inProgress: totalInProgress,
                completed: totalCompleted,
                delayed: totalDelayed,
                needsReview: totalNeedsReview,
                criticalHigh: totalCriticalHigh
            },
            poamDetails
        };

        this.currentSnapshot = snapshot;
        
        // Save to localStorage
        localStorage.setItem('poamActivitySnapshot', JSON.stringify(snapshot));
        
        return snapshot;
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTIVITY ANALYSIS
    // ═══════════════════════════════════════════════════════════════

    async analyzeActivity() {
        await this.init();
        
        // Capture current state
        await this.captureSnapshot();

        if (!this.previousSnapshot) {
            // First run - no comparison available
            return {
                isFirstRun: true,
                currentSnapshot: this.currentSnapshot,
                message: 'Baseline snapshot captured. Activity tracking will begin on next check.'
            };
        }

        // Calculate time delta
        const timeDelta = new Date(this.currentSnapshot.timestamp) - new Date(this.previousSnapshot.timestamp);
        const hoursSinceLastCheck = Math.round(timeDelta / (1000 * 60 * 60));
        const daysSinceLastCheck = Math.round(timeDelta / (1000 * 60 * 60 * 24));

        // Compare snapshots
        const metrics = {
            timeframe: {
                lastCheckTimestamp: this.previousSnapshot.timestamp,
                currentTimestamp: this.currentSnapshot.timestamp,
                hoursSinceLastCheck,
                daysSinceLastCheck,
                displayTime: this.formatTimeframe(hoursSinceLastCheck)
            },
            
            // Total changes
            totalPOAMsChange: this.currentSnapshot.totalPOAMs - this.previousSnapshot.totalPOAMs,
            
            // Status changes
            statusChanges: {
                closed: (this.currentSnapshot.aggregates.completed - this.previousSnapshot.aggregates.completed),
                newlyInProgress: (this.currentSnapshot.aggregates.inProgress - this.previousSnapshot.aggregates.inProgress),
                newlyDelayed: (this.currentSnapshot.aggregates.delayed - this.previousSnapshot.aggregates.delayed),
                newlyNeedsReview: (this.currentSnapshot.aggregates.needsReview - this.previousSnapshot.aggregates.needsReview)
            },
            
            // Current state
            currentState: {
                total: this.currentSnapshot.totalPOAMs,
                open: this.currentSnapshot.aggregates.open,
                inProgress: this.currentSnapshot.aggregates.inProgress,
                completed: this.currentSnapshot.aggregates.completed,
                delayed: this.currentSnapshot.aggregates.delayed,
                needsReview: this.currentSnapshot.aggregates.needsReview,
                criticalHigh: this.currentSnapshot.aggregates.criticalHigh
            },
            
            // Activity percentages
            percentages: {
                activelyWorked: this.currentSnapshot.totalPOAMs > 0 
                    ? Math.round((this.currentSnapshot.aggregates.inProgress / this.currentSnapshot.totalPOAMs) * 100)
                    : 0,
                completed: this.currentSnapshot.totalPOAMs > 0
                    ? Math.round((this.currentSnapshot.aggregates.completed / this.currentSnapshot.totalPOAMs) * 100)
                    : 0,
                delayed: this.currentSnapshot.totalPOAMs > 0
                    ? Math.round((this.currentSnapshot.aggregates.delayed / this.currentSnapshot.totalPOAMs) * 100)
                    : 0
            },
            
            // Detailed changes
            detailedChanges: this.detectDetailedChanges()
        };

        // Calculate velocity metrics
        if (daysSinceLastCheck > 0) {
            metrics.velocity = {
                closureRate: metrics.statusChanges.closed / daysSinceLastCheck,
                newPOAMRate: metrics.totalPOAMsChange > 0 ? metrics.totalPOAMsChange / daysSinceLastCheck : 0
            };
        }

        this.activityMetrics = metrics;
        return metrics;
    }

    detectDetailedChanges() {
        if (!this.previousSnapshot || !this.currentSnapshot) return {};

        const prevPOAMs = new Map(this.previousSnapshot.poamDetails.map(p => [p.id, p]));
        const currPOAMs = new Map(this.currentSnapshot.poamDetails.map(p => [p.id, p]));

        const changes = {
            newPOAMs: [],
            closedPOAMs: [],
            statusChanged: [],
            riskChanged: [],
            pocChanged: [],
            assetCountChanged: []
        };

        // Detect new POAMs
        currPOAMs.forEach((curr, id) => {
            if (!prevPOAMs.has(id)) {
                changes.newPOAMs.push({
                    id,
                    status: curr.status,
                    risk: curr.risk
                });
            }
        });

        // Detect changes in existing POAMs
        prevPOAMs.forEach((prev, id) => {
            const curr = currPOAMs.get(id);
            
            if (!curr) {
                // POAM was deleted (shouldn't happen, but track it)
                return;
            }

            // Status change
            if (prev.status !== curr.status) {
                changes.statusChanged.push({
                    id,
                    from: prev.status,
                    to: curr.status
                });
                
                // Track closures specifically
                if (curr.status === 'completed' || curr.status === 'closed') {
                    changes.closedPOAMs.push({
                        id,
                        previousStatus: prev.status
                    });
                }
            }

            // Risk change
            if (prev.risk !== curr.risk) {
                changes.riskChanged.push({
                    id,
                    from: prev.risk,
                    to: curr.risk
                });
            }

            // POC change
            if (prev.poc !== curr.poc) {
                changes.pocChanged.push({
                    id,
                    from: prev.poc,
                    to: curr.poc
                });
            }

            // Asset count change
            if (prev.totalAffectedAssets !== curr.totalAffectedAssets) {
                const delta = curr.totalAffectedAssets - prev.totalAffectedAssets;
                const percentChange = prev.totalAffectedAssets > 0
                    ? Math.round((delta / prev.totalAffectedAssets) * 100)
                    : 0;
                    
                changes.assetCountChanged.push({
                    id,
                    from: prev.totalAffectedAssets,
                    to: curr.totalAffectedAssets,
                    delta,
                    percentChange
                });
            }
        });

        return changes;
    }

    formatTimeframe(hours) {
        if (hours < 1) return 'Less than 1 hour';
        if (hours === 1) return '1 hour';
        if (hours < 24) return `${hours} hours`;
        const days = Math.round(hours / 24);
        if (days === 1) return '1 day';
        if (days < 7) return `${days} days`;
        const weeks = Math.round(days / 7);
        if (weeks === 1) return '1 week';
        return `${weeks} weeks`;
    }

    // ═══════════════════════════════════════════════════════════════
    // RESET / CLEAR
    // ═══════════════════════════════════════════════════════════════

    resetBaseline() {
        localStorage.removeItem('poamActivitySnapshot');
        this.previousSnapshot = null;
        this.currentSnapshot = null;
        this.activityMetrics = null;
        console.log('✅ Activity monitor baseline reset');
    }
}

// Export globally
window.POAMActivityMonitor = POAMActivityMonitor;
window.poamActivityMonitor = new POAMActivityMonitor();
