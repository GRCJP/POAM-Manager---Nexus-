// Pipeline Orchestrator - Strict 5-Phase Sequential Pipeline
// Handles scan import and POAM generation with progress tracking and idempotency

console.log('📦 pipeline-orchestrator.js loading...');

// ═══════════════════════════════════════════════════════════════
// PIPELINE DATABASE - Extended IndexedDB for Pipeline State
// ═══════════════════════════════════════════════════════════════

class PipelineDatabase {
    constructor() {
        this.dbName = 'POAMDatabase';
        this.db = null;
        this.logger = new PipelineLogger('PipelineDB', LogLevel.INFO);
    }

    async init() {
        // Use the existing poamDB connection
        if (window.poamDB && window.poamDB.db) {
            this.db = window.poamDB.db;
            this.logger.info('Using existing POAMDatabase connection');
            return;
        }

        // Try to initialize poamDB first so we share the same version
        if (window.poamDB && typeof window.poamDB.init === 'function') {
            try {
                await window.poamDB.init();
                if (window.poamDB.db) {
                    this.db = window.poamDB.db;
                    this.logger.info('Initialized and reusing POAMDatabase connection');
                    return;
                }
            } catch (e) {
                this.logger.warn('Failed to init poamDB, falling back to direct open:', e.message);
            }
        }

        // Fallback: open directly (version must match POAMDatabase.version)
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 10);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Ensure scanRuns store exists
                if (!db.objectStoreNames.contains('scanRuns')) {
                    const scanRunStore = db.createObjectStore('scanRuns', { keyPath: 'runId' });
                    scanRunStore.createIndex('status', 'status', { unique: false });
                    scanRunStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                // Ensure phase artifacts stores exist
                if (!db.objectStoreNames.contains('phaseArtifacts')) {
                    const artifactStore = db.createObjectStore('phaseArtifacts', { keyPath: 'id' });
                    artifactStore.createIndex('runId', 'runId', { unique: false });
                    artifactStore.createIndex('phaseIndex', 'phaseIndex', { unique: false });
                }
            };
        });
    }

    async saveScanRun(scanRun) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['scanRuns'], 'readwrite');
            const store = transaction.objectStore('scanRuns');
            const request = store.put(scanRun);
            
            request.onsuccess = () => resolve(scanRun);
            request.onerror = () => reject(request.error);
        });
    }

    async getScanRun(runId) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['scanRuns'], 'readonly');
            const store = transaction.objectStore('scanRuns');
            const request = store.get(runId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async savePhaseArtifact(artifact) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['phaseArtifacts'], 'readwrite');
            const store = transaction.objectStore('phaseArtifacts');
            const request = store.put(artifact);
            
            request.onsuccess = () => resolve(artifact);
            request.onerror = () => reject(request.error);
        });
    }

    async getPhaseArtifact(runId, phaseIndex) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['phaseArtifacts'], 'readonly');
            const store = transaction.objectStore('phaseArtifacts');
            const index = store.index('runId');
            const request = index.getAll(runId);
            
            request.onsuccess = () => {
                const artifacts = request.result;
                const artifact = artifacts.find(a => a.phaseIndex === phaseIndex);
                resolve(artifact);
            };
            request.onerror = () => reject(request.error);
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// PIPELINE ORCHESTRATOR - Main Pipeline Controller
// ═══════════════════════════════════════════════════════════════

class PipelineOrchestrator {
    constructor() {
        this.db = new PipelineDatabase();
        this.logger = new PipelineLogger('Pipeline', LogLevel.INFO);
        
        // Phase definitions
        this.phases = [
            { index: 1, name: 'Point Eligibility Gate', status: 'phase_1_gate' },
            { index: 2, name: 'Grouping', status: 'phase_2_group' },
            { index: 3, name: 'Group Enrichment', status: 'phase_3_enrich' },
            { index: 4, name: 'POAM Pre-Population', status: 'phase_4_prepopulate' },
            { index: 5, name: 'Commit and Persist', status: 'phase_5_commit' }
        ];
        
        // Current run state
        this.currentRun = null;
        this.progressCallback = null;
    }

    // ═══════════════════════════════════════════════════════════════
    // MAIN PIPELINE ENTRY POINT
    // ═══════════════════════════════════════════════════════════════
    
    async runImportPipeline(rawVulnerabilities, scanMetadata, progressCallback) {
        this.progressCallback = progressCallback;
        
        // Initialize database
        await this.db.init();
        
        // Create new run
        const runId = `RUN-${Date.now()}`;
        const scanId = scanMetadata.scanId || `SCAN-${new Date().toISOString().replace(/[:.]/g, '-')}`;
        
        this.currentRun = {
            id: runId,  // Primary key for scanRuns store
            runId,      // Keep for backward compatibility
            scanId,
            createdAt: new Date().toISOString(),
            status: 'phase_1_gate',
            overallProgress: 0,
            phaseProgress: 0,
            phaseName: 'Point Eligibility Gate',
            phaseIndex: 1,
            counts: {
                totalRows: rawVulnerabilities.length,
                eligibleCount: 0,
                excludedCount: 0,
                groupCount: 0,
                poamsCreated: 0,
                poamsSkipped: 0,
                summariesCreated: 0
            },
            error: null,
            scanMetadata
        };
        
        await this.db.saveScanRun(this.currentRun);
        
        this.logger.info(`\n🚀 ═══════════════════════════════════════════════════════`);
        this.logger.info(`   PIPELINE STARTED`);
        this.logger.info(`   Run ID: ${runId}`);
        this.logger.info(`   Scan ID: ${scanId}`);
        this.logger.info(`   Total Findings: ${rawVulnerabilities.length}`);
        this.logger.info(`═══════════════════════════════════════════════════════\n`);
        
        try {
            // Phase 1: Point Eligibility Gate
            const eligibleFindings = await this.runPhase1(rawVulnerabilities);
            
            // Phase 2: Grouping
            const groups = await this.runPhase2(eligibleFindings);
            
            // Phase 3: Group Enrichment
            const enrichedGroups = await this.runPhase3(groups);
            
            // Phase 4: POAM Pre-Population
            const poamDrafts = await this.runPhase4(enrichedGroups);
            
            // Phase 5: Commit and Persist
            const result = await this.runPhase5(poamDrafts);
            
            // Mark complete
            this.currentRun.status = 'complete';
            this.currentRun.overallProgress = 1;
            await this.db.saveScanRun(this.currentRun);
            
            this.logger.info(`\n✅ ═══════════════════════════════════════════════════════`);
            this.logger.info(`   PIPELINE COMPLETED SUCCESSFULLY`);
            this.logger.info(`   POAMs Created: ${this.currentRun.counts.poamsCreated}`);
            this.logger.info(`   POAMs Skipped: ${this.currentRun.counts.poamsSkipped}`);
            this.logger.info(`   Summaries Created: ${this.currentRun.counts.summariesCreated}`);
            this.logger.info(`═══════════════════════════════════════════════════════\n`);
            
            return result;
            
        } catch (error) {
            this.logger.error('Pipeline failed:', error);
            
            this.currentRun.status = 'failed';
            this.currentRun.error = {
                phase: this.currentRun.phaseName,
                message: error.message,
                stack: error.stack
            };
            await this.db.saveScanRun(this.currentRun);
            
            throw error;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: POINT ELIGIBILITY GATE (30-Day First Detected Filter)
    // ═══════════════════════════════════════════════════════════════
    
    async runPhase1(rawVulnerabilities) {
        const phase = this.phases[0];
        this.logger.phaseStart(phase.name);
        
        this.currentRun.status = phase.status;
        this.currentRun.phaseName = phase.name;
        this.currentRun.phaseIndex = phase.index;
        this.currentRun.phaseProgress = 0;
        await this.db.saveScanRun(this.currentRun);
        this.updateProgress();
        
        const eligibleFindings = [];
        const excludedFindings = [];
        const INACTIVE_STATUSES = ['fixed', 'closed', 'resolved', 'ignored', 'disabled'];

        console.log(`🔍 PHASE 1: Processing ${rawVulnerabilities.length} raw findings`);
        if (rawVulnerabilities.length > 0) {
            const sample = rawVulnerabilities[0];
            console.log('🔍 PHASE 1: Sample finding fields:', Object.keys(sample).join(', '));
            console.log('🔍 PHASE 1: Sample finding status:', sample.status, '| severity:', sample.severity, '| title:', sample.title?.substring(0, 60));
        }
        
        for (let i = 0; i < rawVulnerabilities.length; i++) {
            const finding = rawVulnerabilities[i];
            
            // Gate: exclude only Fixed/Closed/Resolved findings
            // Active findings of ANY age are eligible — age and SLA are tracked as metadata
            const status = (finding.status || '').toLowerCase();
            if (INACTIVE_STATUSES.includes(status)) {
                excludedFindings.push({
                    finding,
                    reason: `Inactive status: ${finding.status}`
                });
            } else {
                eligibleFindings.push(finding);
            }
            
            // Update progress every 100 findings
            if (i % 100 === 0 || i === rawVulnerabilities.length - 1) {
                const progress = Math.floor((i + 1) / rawVulnerabilities.length * 100);
                this.currentRun.phaseProgress = progress / 100;
                await this.db.saveScanRun(this.currentRun);
                this.updateProgress();
            }
        }

        console.log(`🔍 PHASE 1: ${eligibleFindings.length} eligible, ${excludedFindings.length} excluded (inactive status)`);
        if (excludedFindings.length > 0) {
            const reasons = {};
            excludedFindings.forEach(e => { reasons[e.reason] = (reasons[e.reason] || 0) + 1; });
            console.log('🔍 PHASE 1: Exclusion reasons:', reasons);
        }
        
        // Update counts
        this.currentRun.counts.eligibleCount = eligibleFindings.length;
        this.currentRun.counts.excludedCount = excludedFindings.length;
        
        // Save phase artifacts
        await this.db.savePhaseArtifact({
            id: `${this.currentRun.runId}-phase1`,
            runId: this.currentRun.runId,
            phaseIndex: 1,
            eligibleFindings,
            excludedFindings: excludedFindings.slice(0, 100), // Sample only
            stats: {
                totalProcessed: rawVulnerabilities.length,
                eligible: eligibleFindings.length,
                excluded: excludedFindings.length,
                exclusionRate: (excludedFindings.length / rawVulnerabilities.length * 100).toFixed(2) + '%'
            }
        });
        
        this.currentRun.phaseProgress = 1;
        await this.db.saveScanRun(this.currentRun);
        this.updateProgress();
        
        this.logger.phaseEnd(phase.name, {
            eligible: eligibleFindings.length,
            excluded: excludedFindings.length,
            exclusionRate: (excludedFindings.length / rawVulnerabilities.length * 100).toFixed(2) + '%'
        });
        
        return eligibleFindings;
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: GROUPING (Preserve Existing Logic)
    // ═══════════════════════════════════════════════════════════════
    
    async runPhase2(eligibleFindings) {
        const phase = this.phases[1];
        this.logger.phaseStart(phase.name);
        
        this.currentRun.status = phase.status;
        this.currentRun.phaseName = phase.name;
        this.currentRun.phaseIndex = phase.index;
        this.currentRun.phaseProgress = 0;
        this.currentRun.overallProgress = 0.2;
        await this.db.saveScanRun(this.currentRun);
        this.updateProgress();
        
        let groups;
        
        // Check if skills architecture is enabled
        if (window.USE_SKILLS_ARCHITECTURE && window.skillsIntegration) {
            this.logger.info('🎯 Using Skills Architecture for processing...');
            
            // Initialize skills if needed
            await window.skillsIntegration.init();
            
            // Use SLA skill
            this.logger.info('Calculating SLA status with SLACalculatorSkill...');
            const slaSkill = window.skillsIntegration.orchestrator.skills.get('sla');
            const slaResult = await slaSkill.execute({ findings: eligibleFindings });
            
            if (!slaResult.success) {
                throw new Error('SLA calculation failed: ' + slaResult.errors.join(', '));
            }
            
            const withSLA = slaResult.data.findings;
            this.currentRun.phaseProgress = 0.5;
            await this.db.saveScanRun(this.currentRun);
            this.updateProgress();
            
            // Use Grouping skill
            this.logger.info('Grouping with GroupingSkill...');
            const groupingSkill = window.skillsIntegration.orchestrator.skills.get('grouping');
            const groupResult = await groupingSkill.execute({ findings: withSLA });
            
            if (!groupResult.success) {
                throw new Error('Grouping failed: ' + groupResult.errors.join(', '));
            }
            
            // Convert groups array to Map for compatibility
            groups = new Map();
            groupResult.data.groups.forEach(group => {
                groups.set(group.signature, group);
            });
            
            this.currentRun.phaseProgress = 0.8;
            await this.db.saveScanRun(this.currentRun);
            this.updateProgress();
            
        } else {
            // Use existing analysis engine for grouping
            this.logger.info('Using legacy analysis engine...');
            const engine = new VulnerabilityAnalysisEngineV3();
            
            // Normalize findings
            this.logger.info('Normalizing findings...');
            const normalized = engine.normalizeFindings(eligibleFindings);
            this.currentRun.phaseProgress = 0.2;
            await this.db.saveScanRun(this.currentRun);
            this.updateProgress();
            
            // Calculate SLA status
            this.logger.info('Calculating SLA status...');
            const withSLA = engine.calculateSLAStatus(normalized);
            this.currentRun.phaseProgress = 0.4;
            await this.db.saveScanRun(this.currentRun);
            this.updateProgress();
            
            // Classify remediation
            this.logger.info('Classifying remediation strategies...');
            const classified = engine.classifyRemediation(withSLA);
            this.currentRun.phaseProgress = 0.6;
            await this.db.saveScanRun(this.currentRun);
            this.updateProgress();
            
            // Group by remediation signature
            this.logger.info('Grouping by remediation signatures...');
            groups = engine.groupByRemediationSignature(classified);
            this.currentRun.phaseProgress = 0.8;
            await this.db.saveScanRun(this.currentRun);
            this.updateProgress();
        }
        
        // Update counts
        this.currentRun.counts.groupCount = groups.size;
        
        // Convert Map to Array for storage
        const groupsArray = Array.from(groups.entries()).map(([signature, group]) => ({
            signature,
            group
        }));
        
        // Save phase artifacts
        await this.db.savePhaseArtifact({
            id: `${this.currentRun.runId}-phase2`,
            runId: this.currentRun.runId,
            phaseIndex: 2,
            groups: groupsArray,
            stats: {
                groupCount: groups.size,
                avgFindingsPerGroup: (eligibleFindings.length / groups.size).toFixed(2),
                totalFindings: eligibleFindings.length
            }
        });
        
        this.currentRun.phaseProgress = 1;
        this.currentRun.overallProgress = 0.4;
        await this.db.saveScanRun(this.currentRun);
        this.updateProgress();
        
        this.logger.phaseEnd(phase.name, {
            groupCount: groups.size,
            avgFindingsPerGroup: (eligibleFindings.length / groups.size).toFixed(2)
        });
        
        return groups;
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 3: GROUP ENRICHMENT
    // ═══════════════════════════════════════════════════════════════
    
    async runPhase3(groups) {
        const phase = this.phases[2];
        this.logger.phaseStart(phase.name);
        
        this.currentRun.status = phase.status;
        this.currentRun.phaseName = phase.name;
        this.currentRun.phaseIndex = phase.index;
        this.currentRun.phaseProgress = 0;
        this.currentRun.overallProgress = 0.4;
        await this.db.saveScanRun(this.currentRun);
        this.updateProgress();
        
        const enrichedGroups = new Map();
        const groupsArray = Array.from(groups.entries());
        
        for (let i = 0; i < groupsArray.length; i++) {
            const [signature, group] = groupsArray[i];
            
            // Enrich group with additional metadata
            const enriched = {
                ...group,
                enrichment: {
                    // Deduplicated affected assets
                    affectedAssets: Array.from(group.assets),
                    assetCount: group.assets.size,
                    
                    // Clean description (prefer CVE-Description over generic text)
                    description: this.selectBestDescription(group.findings),
                    
                    // Mitigation strategy inputs
                    mitigationInputs: {
                        solutionText: this.extractSolutionText(group.findings),
                        vendorAdvisories: Array.from(group.advisoryIds),
                        remediationType: group.remediation?.remediationType
                    },
                    
                    // Operating system detection
                    operatingSystems: this.detectOperatingSystems(group.findings),
                    primaryOS: this.selectPrimaryOS(group.findings)
                }
            };
            
            enrichedGroups.set(signature, enriched);
            
            // Update progress every 10 groups or at end
            if (i % 10 === 0 || i === groupsArray.length - 1) {
                const progress = Math.floor((i + 1) / groupsArray.length * 100);
                this.currentRun.phaseProgress = progress / 100;
                this.currentRun.overallProgress = 0.4 + (progress / 100 * 0.2);
                await this.db.saveScanRun(this.currentRun);
                this.updateProgress();
            }
        }
        
        // Save phase artifacts (sample only to avoid size limits)
        const enrichedSample = Array.from(enrichedGroups.entries()).slice(0, 10).map(([sig, grp]) => ({
            signature: sig,
            enrichment: grp.enrichment
        }));
        
        await this.db.savePhaseArtifact({
            id: `${this.currentRun.runId}-phase3`,
            runId: this.currentRun.runId,
            phaseIndex: 3,
            enrichedSample,
            stats: {
                enrichedGroups: enrichedGroups.size
            }
        });
        
        this.currentRun.phaseProgress = 1;
        this.currentRun.overallProgress = 0.6;
        await this.db.saveScanRun(this.currentRun);
        this.updateProgress();
        
        this.logger.phaseEnd(phase.name, {
            enrichedGroups: enrichedGroups.size
        });
        
        return enrichedGroups;
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 4: POAM PRE-POPULATION
    // ═══════════════════════════════════════════════════════════════
    
    async runPhase4(enrichedGroups) {
        const phase = this.phases[3];
        this.logger.phaseStart(phase.name);
        
        this.currentRun.status = phase.status;
        this.currentRun.phaseName = phase.name;
        this.currentRun.phaseIndex = phase.index;
        this.currentRun.phaseProgress = 0;
        this.currentRun.overallProgress = 0.6;
        await this.db.saveScanRun(this.currentRun);
        this.updateProgress();
        
        // Use existing engine for POAM building with SLA gating
        const engine = new VulnerabilityAnalysisEngineV3();
        engine.scanId = this.currentRun.scanId;
        
        // Check if this is a baseline import
        // Ensure poamDB is initialized
        if (!window.poamDB || !window.poamDB.db) {
            if (window.poamDB) {
                await window.poamDB.init();
            } else {
                this.logger.warn('poamDB not available, assuming baseline import');
            }
        }
        
        const existingPOAMs = window.poamDB ? await window.poamDB.getAllPOAMs() : [];
        const isBaselineImport = existingPOAMs.length === 0;
        engine.setBaselineMode(isBaselineImport);
        
        this.logger.info(`Baseline mode: ${isBaselineImport ? 'ENABLED' : 'DISABLED'}`);
        
        // Build POAMs with SLA gating
        const poamDrafts = await engine.buildPOAMsWithSLAGating(enrichedGroups);
        
        // Apply POAM templates and calculate confidence
        for (let i = 0; i < poamDrafts.length; i++) {
            const poam = poamDrafts[i];
            
            // Progress update every 10 POAMs
            if (i % 10 === 0 || i === poamDrafts.length - 1) {
                const progress = Math.floor((i + 1) / poamDrafts.length * 100);
                this.currentRun.phaseProgress = progress / 100;
                this.currentRun.overallProgress = 0.6 + (progress / 100 * 0.2);
                await this.db.saveScanRun(this.currentRun);
                this.updateProgress();
            }
        }
        
        // Calculate confidence scores
        engine.groupedPOAMs = poamDrafts;
        engine.calculatePOAMConfidence();
        
        // Auto-prioritize top POAMs by asset count during baseline import
        this.logger.info(`Auto-prioritization check: isBaselineImport=${isBaselineImport}, poamCount=${poamDrafts.length}`);
        
        if (isBaselineImport && poamDrafts.length > 0) {
            const maxPrioritized = 8;
            
            // Sort POAMs by total affected assets (descending)
            const sortedByAssets = [...poamDrafts].sort((a, b) => {
                const aCount = a.totalAffectedAssets || 0;
                const bCount = b.totalAffectedAssets || 0;
                return bCount - aCount;
            });
            
            // Set top N POAMs to "In Progress" status
            const topPoams = sortedByAssets.slice(0, maxPrioritized);
            topPoams.forEach((poam, idx) => {
                poam.status = 'in-progress';
                poam.findingStatus = 'in-progress';
                this.logger.info(`  #${idx + 1}: ${poam.title?.substring(0, 60)} (${poam.totalAffectedAssets} assets)`);
            });
            
            this.logger.info(`✅ Auto-prioritized ${topPoams.length} POAMs with highest asset counts to 'In Progress' status`);
        } else if (!isBaselineImport) {
            this.logger.info(`Skipping auto-prioritization: Not a baseline import (existing POAMs found)`);
        }
        
        // Update counts
        this.currentRun.counts.poamsCreated = engine.poamsCreated;
        this.currentRun.counts.poamsSkipped = engine.poamsSkipped;
        
        // Save phase artifacts (sample only)
        await this.db.savePhaseArtifact({
            id: `${this.currentRun.runId}-phase4`,
            runId: this.currentRun.runId,
            phaseIndex: 4,
            poamDraftsSample: poamDrafts.slice(0, 5).map(p => ({
                id: p.id,
                title: p.title,
                risk: p.risk,
                dueDate: p.dueDate,
                poc: p.poc
            })),
            stats: {
                created: engine.poamsCreated,
                skipped: engine.poamsSkipped,
                skipReasons: engine.skipReasons
            }
        });
        
        this.currentRun.phaseProgress = 1;
        this.currentRun.overallProgress = 0.8;
        await this.db.saveScanRun(this.currentRun);
        this.updateProgress();
        
        this.logger.phaseEnd(phase.name, {
            created: engine.poamsCreated,
            skipped: engine.poamsSkipped
        });
        
        return poamDrafts;
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 5: COMMIT AND PERSIST
    // ═══════════════════════════════════════════════════════════════
    
    async runPhase5(poamDrafts) {
        const phase = this.phases[4];
        this.logger.phaseStart(phase.name);
        console.log('🔍 PHASE 5 START: runPhase5 called with', poamDrafts.length, 'POAM drafts');
        
        this.currentRun.status = phase.status;
        this.currentRun.phaseName = phase.name;
        this.currentRun.phaseIndex = phase.index;
        this.currentRun.phaseProgress = 0;
        this.currentRun.overallProgress = 0.8;
        await this.db.saveScanRun(this.currentRun);
        this.updateProgress();
        
        // Ensure poamDB is initialized
        console.log('🔍 PHASE 5: Checking poamDB...');
        if (!window.poamDB || !window.poamDB.db) {
            console.log('🔍 PHASE 5: poamDB not ready, initializing...');
            if (window.poamDB) {
                await window.poamDB.init();
            } else {
                throw new Error('POAMDatabase not available - cannot persist POAMs');
            }
        }
        console.log('🔍 PHASE 5: poamDB ready');
        
        // Atomically persist POAMs to main store
        this.logger.info(`Persisting ${poamDrafts.length} POAMs to database...`);
        console.log('🔍 PHASE 5: Starting persistence...');

        // Ensure milestones exist (auto-prefill) before persistence.
        console.log('🔍 PHASE 5: Backfilling milestones...');
        this.backfillMissingMilestonesOnDrafts(poamDrafts);
        
        // Use merge logic if existing POAMs are present (re-import)
        let saved;
        console.log('🔍 PHASE 5: Fetching existing POAMs...');
        const existingPOAMs = await window.poamDB.getAllPOAMs();
        console.log('🔍 PHASE 5: Found', existingPOAMs.length, 'existing POAMs');
        
        if (existingPOAMs.length > 0 && typeof window.mergePOAMsFromScan === 'function') {
            this.logger.info(`Re-import detected: ${existingPOAMs.length} existing POAMs. Merging...`);
            console.log('🔍 PHASE 5: Calling mergePOAMsFromScan...');
            const mergeResult = await window.mergePOAMsFromScan(poamDrafts);
            console.log('🔍 PHASE 5: Merge complete:', mergeResult.stats);
            
            console.log('🔍 PHASE 5: Calling addPOAMsBatch with', mergeResult.mergedPOAMs.length, 'POAMs...');
            saved = await window.poamDB.addPOAMsBatch(mergeResult.mergedPOAMs);
            console.log('🔍 PHASE 5: addPOAMsBatch complete:', saved);
            
            this.logger.info(`Merge complete: ${mergeResult.stats.created} new, ${mergeResult.stats.updated} updated, ${mergeResult.stats.autoResolved} auto-resolved`);
            this.currentRun.counts.poamsMerged = mergeResult.stats.updated;
            this.currentRun.counts.poamsAutoResolved = mergeResult.stats.autoResolved;
        } else {
            console.log('🔍 PHASE 5: No merge needed, calling addPOAMsBatch directly with', poamDrafts.length, 'POAMs...');
            saved = await window.poamDB.addPOAMsBatch(poamDrafts);
            console.log('🔍 PHASE 5: addPOAMsBatch complete:', saved);
        }
        this.logger.info(`Saved ${saved.saved || saved} POAMs`);
        console.log('🔍 PHASE 5: Persistence complete');
        
        // Dispatch event for notification system (feature flag controlled, non-blocking)
        // Use setTimeout to ensure this doesn't block pipeline completion
        setTimeout(() => {
            try {
                window.dispatchEvent(new CustomEvent('poam-batch-saved', { 
                    detail: { poams: poamDrafts, isBaseline: existingPOAMs.length === 0 } 
                }));
            } catch (error) {
                console.warn('⚠️ Event dispatch failed (non-critical):', error);
            }
        }, 0);
        
        this.currentRun.phaseProgress = 0.5;
        this.currentRun.overallProgress = 0.85;
        await this.db.saveScanRun(this.currentRun);
        this.updateProgress();
        
        // Persist scan run metadata
        this.logger.info('Persisting scan run metadata...');
        const scanRunRecord = {
            id: this.currentRun.scanId,
            scanId: this.currentRun.scanId,
            importedAt: this.currentRun.createdAt,
            timestamp: this.currentRun.createdAt,
            source: this.currentRun.scanMetadata.source || 'Local Upload',
            fileName: this.currentRun.scanMetadata.fileName,
            scanType: this.currentRun.scanMetadata.scanType || 'Local Upload',
            rawFindings: [], // Don't duplicate raw data
            totalFindings: this.currentRun.counts.totalRows,
            poamsGenerated: this.currentRun.counts.poamsCreated
        };
        
        await window.poamDB.saveScanRun(scanRunRecord);
        
        this.currentRun.phaseProgress = 1;
        this.currentRun.overallProgress = 1;
        await this.db.saveScanRun(this.currentRun);
        this.updateProgress();
        
        this.logger.phaseEnd(phase.name, {
            poamsSaved: saved.saved || saved,
            scanRunSaved: true
        });
        
        return {
            poams: poamDrafts,
            scanId: this.currentRun.scanId,
            runId: this.currentRun.runId,
            counts: this.currentRun.counts
        };
    }

    backfillMissingMilestonesOnDrafts(poamDrafts) {
        if (!Array.isArray(poamDrafts) || poamDrafts.length === 0) return;

        if (typeof generateMilestonesForControlFamily !== 'function') {
            this.logger.warn('Milestone generation function not available; skipping milestone backfill');
            return;
        }

        let backfilled = 0;
        let skipped = 0;

        for (const poam of poamDrafts) {
            if (!poam) continue;

            const hasMilestones = Array.isArray(poam.milestones) && poam.milestones.length > 0;
            if (hasMilestones) {
                skipped++;
                continue;
            }

            const controlFamily = poam.controlFamily;
            if (controlFamily !== 'SI' && controlFamily !== 'CM') {
                skipped++;
                continue;
            }

            const startDate = poam.createdDate || poam.initialScheduledCompletionDate;
            const dueDate = poam.dueDate || poam.updatedScheduledCompletionDate || poam.initialScheduledCompletionDate;
            if (!startDate || !dueDate) {
                skipped++;
                continue;
            }

            const generated = generateMilestonesForControlFamily(controlFamily, startDate, dueDate);
            if (Array.isArray(generated) && generated.length > 0) {
                poam.milestones = generated;
                backfilled++;
            } else {
                skipped++;
            }
        }

        if (backfilled > 0) {
            this.logger.info(`Auto-prefilled milestones for ${backfilled} POAM(s) (skipped ${skipped})`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPER METHODS
    // ═══════════════════════════════════════════════════════════════
    
    parseDate(dateStr) {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    selectBestDescription(findings) {
        // Prefer CVE-Description over generic descriptions
        for (const finding of findings) {
            if (finding.cveDescription && finding.cveDescription.length > 50) {
                return finding.cveDescription;
            }
        }
        
        // Fallback to first description
        return findings[0]?.description || findings[0]?.title || 'No description available';
    }

    extractSolutionText(findings) {
        // Extract solution text from first finding with solution
        for (const finding of findings) {
            if (finding.solution && finding.solution.length > 20) {
                return finding.solution;
            }
        }
        return '';
    }

    detectOperatingSystems(findings) {
        const osSet = new Set();
        
        for (const finding of findings) {
            if (finding.operatingSystem) {
                osSet.add(finding.operatingSystem);
            }
        }
        
        return Array.from(osSet);
    }

    selectPrimaryOS(findings) {
        const osCounts = {};
        
        for (const finding of findings) {
            const os = finding.operatingSystem;
            if (os) {
                osCounts[os] = (osCounts[os] || 0) + 1;
            }
        }
        
        // Return most common OS
        let maxCount = 0;
        let primaryOS = 'Unknown';
        
        for (const [os, count] of Object.entries(osCounts)) {
            if (count > maxCount) {
                maxCount = count;
                primaryOS = os;
            }
        }
        
        return primaryOS;
    }

    updateProgress() {
        if (this.progressCallback) {
            this.progressCallback({
                runId: this.currentRun.runId,
                status: this.currentRun.status,
                phaseName: this.currentRun.phaseName,
                phaseIndex: this.currentRun.phaseIndex,
                phaseProgress: this.currentRun.phaseProgress,
                overallProgress: this.currentRun.overallProgress,
                counts: this.currentRun.counts
            });
        }
    }
}

// Export for use in main application
window.PipelineOrchestrator = PipelineOrchestrator;
window.PipelineDatabase = PipelineDatabase;

console.log('✅ pipeline-orchestrator.js loaded successfully');
// Authoritative Milestone-Driven Pipeline Orchestrator V2
// Strict, blocking milestone enforcement with no concurrent processing
// Each phase must 100% complete before the next begins

console.log('🚀 milestone-pipeline-orchestrator-v2.js loading...');

// ═══════════════════════════════════════════════════════════════
// MILESTONE DEFINITIONS - AUTHORITATIVE AND ENFORCED
// ═══════════════════════════════════════════════════════════════

const AUTHORITATIVE_MILESTONES = [
    {
        id: 1,
        name: 'Point Eligibility Gate',
        purpose: 'Determine whether a finding is eligible to become a POAM point',
        rules: {
            firstDetectedThreshold: 30, // days
            excludeIf: 'first_detected ≤ 30 days old',
            includeIf: 'first_detected > 30 days old'
        },
        outputs: ['eligibleFindings', 'excludedCount', 'sampleExcluded'],
        progressMetric: 'processedFindings / totalFindings',
        blocking: true
    },
    {
        id: 2,
        name: 'Like-Minded Vulnerability Grouping',
        purpose: 'Group eligible findings by remediation similarity',
        rules: {
            inputSource: 'eligibleFindings from Milestone 1',
            preserveLogic: 'Use existing solution-based/signature-based grouping'
        },
        outputs: ['remediationGroups', 'groupCount', 'signatureDistribution'],
        progressMetric: 'processedEligibleFindings / eligibleFindingsTotal',
        blocking: true
    },
    {
        id: 3,
        name: 'Group Enrichment',
        purpose: 'Enrich each group with actionable context',
        rules: {
            extractAssets: 'deduped affected assets',
            extractDescriptions: 'clean finding descriptions',
            extractMitigation: 'mitigation strategy inputs',
            determineOS: 'existing heuristics'
        },
        outputs: ['enrichedGroups'],
        progressMetric: 'enrichedGroups / totalGroups',
        blocking: true
    },
    {
        id: 4,
        name: 'POAM Pre-Population',
        purpose: 'Convert enriched groups into POAM drafts',
        rules: {
            mapSeverityToSLA: 'critical 15d, high 30d, medium 90d, low 180d',
            determineRiskStatus: 'existing logic',
            assignPOC: 'existing OS/control mappings',
            populateFields: 'exact current behavior'
        },
        outputs: ['poamDrafts', 'createdCount', 'skippedCount'],
        progressMetric: 'poamsProcessed / totalGroups',
        blocking: true
    },
    {
        id: 5,
        name: 'Commit & Persist',
        purpose: 'Atomically finalize the run',
        rules: {
            writeToLiveStore: 'poams store',
            writeSummaries: 'poamScanSummaries',
            markComplete: 'scan run complete',
            uiLock: 'UI cannot read partial data'
        },
        outputs: ['committedRecords', 'finalRunMetadata'],
        progressMetric: 'recordsWritten / totalRecordsToWrite',
        blocking: true
    }
];

// ═══════════════════════════════════════════════════════════════
// MILESTONE PIPELINE DATABASE - SCAN RUNS STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

class MilestonePipelineDatabase {
    constructor() {
        this.dbName = 'POAMDatabase';
        this.db = null;
        this.logger = new PipelineLogger('MilestonePipelineDB', LogLevel.INFO);
    }

    async init() {
        // Use existing poamDB connection
        if (window.poamDB && window.poamDB.db) {
            this.db = window.poamDB.db;
            this.logger.info('Using existing POAMDatabase connection');
            return;
        }

        // Try to initialize poamDB first so we share the same version
        if (window.poamDB && typeof window.poamDB.init === 'function') {
            try {
                await window.poamDB.init();
                if (window.poamDB.db) {
                    this.db = window.poamDB.db;
                    this.logger.info('Initialized and reusing POAMDatabase connection');
                    return;
                }
            } catch (e) {
                this.logger.warn('Failed to init poamDB, falling back to direct open:', e.message);
            }
        }

        // Fallback: open directly (version must match POAMDatabase.version)
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 10);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create scanRuns store with milestone tracking
                if (!db.objectStoreNames.contains('scanRuns')) {
                    const scanRunStore = db.createObjectStore('scanRuns', { keyPath: 'runId' });
                    scanRunStore.createIndex('status', 'status', { unique: false });
                    scanRunStore.createIndex('currentMilestone', 'currentMilestone', { unique: false });
                    scanRunStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                // Create milestoneArtifacts store for phase outputs
                if (!db.objectStoreNames.contains('milestoneArtifacts')) {
                    const artifactStore = db.createObjectStore('milestoneArtifacts', { keyPath: 'id', autoIncrement: true });
                    artifactStore.createIndex('runId', 'runId', { unique: false });
                    artifactStore.createIndex('milestoneId', 'milestoneId', { unique: false });
                }
                
                // Ensure existing stores exist
                if (!db.objectStoreNames.contains('poams')) {
                    const poamStore = db.createObjectStore('poams', { keyPath: 'id' });
                    poamStore.createIndex('status', 'status', { unique: false });
                    poamStore.createIndex('risk', 'risk', { unique: false });
                    poamStore.createIndex('poc', 'poc', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('poamScanSummaries')) {
                    const summaryStore = db.createObjectStore('poamScanSummaries', { keyPath: 'scanId' });
                }
            };
        });
    }

    async saveScanRun(run) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction(['scanRuns'], 'readwrite');
        const store = transaction.objectStore('scanRuns');
        
        return new Promise((resolve, reject) => {
            const request = store.put(run);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getScanRun(runId) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction(['scanRuns'], 'readonly');
        const store = transaction.objectStore('scanRuns');
        
        return new Promise((resolve, reject) => {
            const request = store.get(runId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveMilestoneArtifact(runId, milestoneId, artifact) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction(['milestoneArtifacts'], 'readwrite');
        const store = transaction.objectStore('milestoneArtifacts');
        
        const record = {
            runId,
            milestoneId,
            artifact,
            createdAt: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.add(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getMilestoneArtifact(runId, milestoneId) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction(['milestoneArtifacts'], 'readonly');
        const store = transaction.objectStore('milestoneArtifacts');
        const index = store.index('runId');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(runId);
            request.onsuccess = () => {
                const artifacts = request.result;
                const artifact = artifacts.find(a => a.milestoneId === milestoneId);
                resolve(artifact ? artifact.artifact : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async atomicCommit(poams, summaries, scanRun) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction(['poams', 'poamScanSummaries', 'scanRuns'], 'readwrite');
        
        // Commit POAMs
        const poamStore = transaction.objectStore('poams');
        for (const poam of poams) {
            poamStore.put(poam);
        }
        
        // Commit summaries
        const summaryStore = transaction.objectStore('poamScanSummaries');
        for (const summary of summaries) {
            summaryStore.put(summary);
        }
        
        // Update scan run status
        const scanRunStore = transaction.objectStore('scanRuns');
        scanRunStore.put(scanRun);
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// AUTHORITATIVE MILESTONE PIPELINE ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

class AuthoritativeMilestonePipeline {
    constructor() {
        this.db = new MilestonePipelineDatabase();
        this.logger = new PipelineLogger('MilestonePipeline', LogLevel.INFO);
        this.currentRun = null;
        this.progressCallback = null;
        this.milestones = AUTHORITATIVE_MILESTONES;
    }

    // ═══════════════════════════════════════════════════════════════
    // MAIN ENTRY POINT - SINGLE ORCHESTRATOR FUNCTION
    // ═══════════════════════════════════════════════════════════════

    async runImportPipeline(rawVulnerabilities, scanMetadata, progressCallback) {
        this.progressCallback = progressCallback;
        
        // Initialize database
        await this.db.init();
        
        // Create authoritative run state
        const runId = `RUN-${Date.now()}`;
        const scanId = scanMetadata.scanId || `SCAN-${new Date().toISOString().replace(/[:.]/g, '-')}`;
        
        this.currentRun = {
            runId,
            scanId,
            createdAt: new Date().toISOString(),
            status: 'running',
            currentMilestone: 1,
            milestoneStatus: {},
            milestoneProgress: {},
            overallProgress: 0,
            counts: {
                totalFindings: rawVulnerabilities.length,
                eligibleFindings: 0,
                excludedFindings: 0,
                groupsFormed: 0,
                groupsEnriched: 0,
                poamsCreated: 0,
                poamsSkipped: 0,
                recordsCommitted: 0
            },
            error: null,
            scanMetadata
        };
        
        // Initialize milestone tracking
        this.milestones.forEach(milestone => {
            this.currentRun.milestoneStatus[milestone.id] = 'pending';
            this.currentRun.milestoneProgress[milestone.id] = 0;
        });
        
        await this.db.saveScanRun(this.currentRun);
        
        this.logger.info(`\n🚀 ═══════════════════════════════════════════════════════`);
        this.logger.info(`   AUTHORITATIVE MILESTONE PIPELINE STARTED`);
        this.logger.info(`   Run ID: ${runId}`);
        this.logger.info(`   Scan ID: ${scanId}`);
        this.logger.info(`   Total Findings: ${rawVulnerabilities.length}`);
        this.logger.info(`═══════════════════════════════════════════════════════\n`);
        
        try {
            // ENFORCED SEQUENTIAL MILESTONE EXECUTION
            // Each milestone must reach 100% before next begins
            
            // MILESTONE 1: Point Eligibility Gate
            const milestone1Result = await this.executeMilestone(1, rawVulnerabilities);
            
            // MILESTONE 2: Like-Minded Vulnerability Grouping  
            const milestone2Result = await this.executeMilestone(2, milestone1Result.eligibleFindings);
            
            // MILESTONE 3: Group Enrichment
            const milestone3Result = await this.executeMilestone(3, milestone2Result.groups);
            
            // MILESTONE 4: POAM Pre-Population
            const milestone4Result = await this.executeMilestone(4, milestone3Result.enrichedGroups);
            
            // MILESTONE 5: Commit & Persist
            const finalResult = await this.executeMilestone(5, milestone4Result.poamDrafts);
            
            // Mark pipeline complete
            this.currentRun.status = 'complete';
            this.currentRun.overallProgress = 1;
            this.currentRun.completedAt = new Date().toISOString();
            
            await this.db.saveScanRun(this.currentRun);
            
            this.logger.info(`\n✅ ═══════════════════════════════════════════════════════`);
            this.logger.info(`   AUTHORITATIVE PIPELINE COMPLETED SUCCESSFULLY`);
            this.logger.info(`   POAMs Created: ${this.currentRun.counts.poamsCreated}`);
            this.logger.info(`   POAMs Skipped: ${this.currentRun.counts.poamsSkipped}`);
            this.logger.info(`   Records Committed: ${this.currentRun.counts.recordsCommitted}`);
            this.logger.info(`═══════════════════════════════════════════════════════\n`);
            
            return finalResult;
            
        } catch (error) {
            this.logger.error('Authoritative pipeline failed:', error);
            
            this.currentRun.status = 'failed';
            this.currentRun.error = {
                milestone: this.currentRun.currentMilestone,
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            };
            
            await this.db.saveScanRun(this.currentRun);
            throw error;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // MILESTONE EXECUTION ENGINE - BLOCKING AND AUTHORITATIVE
    // ═══════════════════════════════════════════════════════════════

    async executeMilestone(milestoneId, inputData) {
        const milestone = this.milestones.find(m => m.id === milestoneId);
        if (!milestone) {
            throw new Error(`Invalid milestone ID: ${milestoneId}`);
        }
        
        // ENFORCE: Cannot proceed if previous milestone not 100% complete
        if (milestoneId > 1) {
            const prevMilestoneProgress = this.currentRun.milestoneProgress[milestoneId - 1];
            if (prevMilestoneProgress !== 1) {
                throw new Error(`Cannot execute Milestone ${milestoneId}: Milestone ${milestoneId - 1} not 100% complete (current: ${Math.round(prevMilestoneProgress * 100)}%)`);
            }
        }
        
        this.logger.info(`\n🎯 MILESTONE ${milestoneId}: ${milestone.name}`);
        this.logger.info(`   Purpose: ${milestone.purpose}`);
        
        // Update run state
        this.currentRun.currentMilestone = milestoneId;
        this.currentRun.milestoneStatus[milestoneId] = 'running';
        await this.db.saveScanRun(this.currentRun);
        
        try {
            // Execute milestone-specific logic
            let result;
            switch (milestoneId) {
                case 1:
                    result = await this.executeMilestone1(inputData);
                    break;
                case 2:
                    result = await this.executeMilestone2(inputData);
                    break;
                case 3:
                    result = await this.executeMilestone3(inputData);
                    break;
                case 4:
                    result = await this.executeMilestone4(inputData);
                    break;
                case 5:
                    result = await this.executeMilestone5(inputData);
                    break;
                default:
                    throw new Error(`Unknown milestone: ${milestoneId}`);
            }
            
            // Mark milestone 100% complete
            this.currentRun.milestoneStatus[milestoneId] = 'completed';
            this.currentRun.milestoneProgress[milestoneId] = 1;
            
            // Save milestone artifact
            await this.db.saveMilestoneArtifact(this.currentRun.runId, milestoneId, result);
            
            // Update overall progress
            this.currentRun.overallProgress = milestoneId / this.milestones.length;
            await this.db.saveScanRun(this.currentRun);
            
            this.logger.info(`✅ Milestone ${milestoneId} completed 100%`);
            
            return result;
            
        } catch (error) {
            this.currentRun.milestoneStatus[milestoneId] = 'failed';
            this.currentRun.error = {
                milestone: milestoneId,
                message: error.message,
                stack: error.stack
            };
            await this.db.saveScanRun(this.currentRun);
            throw error;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // MILESTONE 1: POINT ELIGIBILITY GATE
    // ═══════════════════════════════════════════════════════════════

    async executeMilestone1(rawVulnerabilities) {
        this.logger.info(`   Processing ${rawVulnerabilities.length} findings for eligibility`);
        
        const eligibleFindings = [];
        const excludedFindings = [];
        const sampleExcluded = [];
        
        for (let i = 0; i < rawVulnerabilities.length; i++) {
            const finding = rawVulnerabilities[i];
            
            // Apply eligibility rules
            const isEligible = this.checkEligibility(finding);
            
            if (isEligible) {
                eligibleFindings.push(finding);
            } else {
                excludedFindings.push(finding);
                // Keep sample of excluded findings for auditability
                if (sampleExcluded.length < 10) {
                    sampleExcluded.push({
                        title: finding.title,
                        reason: 'first_detected ≤ 30 days old',
                        firstDetected: finding.firstDetected
                    });
                }
            }
            
            // Update progress
            const progress = (i + 1) / rawVulnerabilities.length;
            this.currentRun.milestoneProgress[1] = progress;
            this.updateProgress(progress, `Processed ${i + 1}/${rawVulnerabilities.length} findings`);
            
            // Save progress every 10%
            if (i % Math.floor(rawVulnerabilities.length * 0.1) === 0) {
                await this.db.saveScanRun(this.currentRun);
            }
        }
        
        // Update counts
        this.currentRun.counts.eligibleFindings = eligibleFindings.length;
        this.currentRun.counts.excludedFindings = excludedFindings.length;
        
        const result = {
            eligibleFindings,
            excludedCount: excludedFindings.length,
            sampleExcluded
        };
        
        this.logger.info(`   Eligible: ${eligibleFindings.length}, Excluded: ${excludedFindings.length}`);
        
        return result;
    }

    checkEligibility(finding) {
        // Rule: Use first_detected date
        const firstDetected = finding.firstDetected || finding.first_detected || finding.detected;
        
        if (!firstDetected) {
            // Invalid dates must be counted and handled consistently (warn, do not crash)
            this.logger.warn(`   Finding missing first_detected date: ${finding.title}`);
            return false; // Exclude findings with invalid dates
        }
        
        const detectionDate = new Date(firstDetected);
        const now = new Date();
        const daysSinceDetection = Math.floor((now - detectionDate) / (1000 * 60 * 60 * 24));
        
        // Rule: If first_detected ≤ 30 days old → EXCLUDE
        // Rule: If first_detected > 30 days old → ELIGIBLE
        return daysSinceDetection > 30;
    }

    // ═══════════════════════════════════════════════════════════════
    // MILESTONE 2: LIKE-MINDED VULNERABILITY GROUPING
    // ═══════════════════════════════════════════════════════════════

    async executeMilestone2(eligibleFindings) {
        this.logger.info(`   Grouping ${eligibleFindings.length} eligible findings`);
        
        // Use existing vulnerability analysis engine for grouping
        const analysisEngine = new VulnerabilityAnalysisEngineV3();
        
        // Convert eligible findings to format expected by analysis engine
        const normalizedFindings = eligibleFindings.map(f => ({
            ...f,
            // Ensure required fields for grouping
            title: f.title || f.vulnerability || 'Unknown',
            solution: f.solution || '',
            description: f.description || f.cveDescription || ''
        }));
        
        // Perform grouping using existing logic
        const groupingResult = await analysisEngine.analyzeAndGroup(normalizedFindings, this.currentRun.scanId);
        
        const groups = groupingResult.groups || [];
        
        // Update progress
        this.currentRun.milestoneProgress[2] = 1;
        this.currentRun.counts.groupsFormed = groups.length;
        this.updateProgress(1, `Formed ${groups.length} vulnerability groups`);
        
        // Calculate signature distribution stats
        const signatureDistribution = {};
        groups.forEach(group => {
            const signature = group.signature || 'unknown';
            signatureDistribution[signature] = (signatureDistribution[signature] || 0) + 1;
        });
        
        const result = {
            groups,
            groupCount: groups.length,
            signatureDistribution
        };
        
        this.logger.info(`   Groups formed: ${groups.length}`);
        
        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    // MILESTONE 3: GROUP ENRICHMENT
    // ═══════════════════════════════════════════════════════════════

    async executeMilestone3(groups) {
        this.logger.info(`   Enriching ${groups.length} groups with actionable context`);
        
        const enrichedGroups = {};
        
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            
            // Enrichment tasks for each group
            const enrichedGroup = {
                groupId: group.groupId || `GROUP-${i + 1}`,
                originalGroup: group,
                
                // Extract affected assets (deduped)
                affectedAssets: this.extractAffectedAssets(group.findings),
                
                // Select clean finding descriptions
                cleanDescription: this.selectCleanDescription(group.findings),
                
                // Extract mitigation strategy inputs
                mitigationInputs: this.extractMitigationInputs(group.findings),
                
                // Determine operating systems using existing heuristics
                operatingSystems: this.determineOperatingSystems(group.findings)
            };
            
            enrichedGroups[enrichedGroup.groupId] = enrichedGroup;
            
            // Update progress
            const progress = (i + 1) / groups.length;
            this.currentRun.milestoneProgress[3] = progress;
            this.updateProgress(progress, `Enriched ${i + 1}/${groups.length} groups`);
        }
        
        this.currentRun.counts.groupsEnriched = Object.keys(enrichedGroups).length;
        
        const result = {
            enrichedGroups: Object.values(enrichedGroups)
        };
        
        this.logger.info(`   Groups enriched: ${Object.keys(enrichedGroups).length}`);
        
        return result;
    }

    extractAffectedAssets(findings) {
        const assetSet = new Set();
        
        findings.forEach(finding => {
            const assetName = finding.host || finding.asset?.hostname || finding.asset?.assetId || finding.ip;
            if (assetName && assetName !== 'unknown') {
                assetSet.add(assetName);
            }
        });
        
        return Array.from(assetSet);
    }

    selectCleanDescription(findings) {
        // Prefer CVE-Description over generic text
        for (const finding of findings) {
            if (finding.cveDescription && finding.cveDescription.trim() !== '') {
                return finding.cveDescription.trim();
            }
        }
        
        // Fallback to any description
        for (const finding of findings) {
            if (finding.description && finding.description.trim() !== '') {
                return finding.description.trim();
            }
        }
        
        return 'No description available';
    }

    extractMitigationInputs(findings) {
        const solutions = findings
            .map(f => f.solution || '')
            .filter(s => s.trim() !== '')
            .slice(0, 5); // Limit to first 5 solutions
        
        return solutions;
    }

    determineOperatingSystems(findings) {
        const osSet = new Set();
        
        findings.forEach(finding => {
            const os = finding.operatingSystem || finding.asset?.operatingSystem || '';
            if (os && os.trim() !== '' && os !== 'unknown') {
                osSet.add(os.trim());
            }
        });
        
        return Array.from(osSet);
    }

    // ═══════════════════════════════════════════════════════════════
    // MILESTONE 4: POAM PRE-POPULATION
    // ═══════════════════════════════════════════════════════════════

    async executeMilestone4(enrichedGroups) {
        this.logger.info(`   Converting ${enrichedGroups.length} enriched groups to POAM drafts`);
        
        const analysisEngine = new VulnerabilityAnalysisEngineV3();
        const poamDrafts = [];
        let skippedCount = 0;
        
        for (let i = 0; i < enrichedGroups.length; i++) {
            const enrichedGroup = enrichedGroups[i];
            
            try {
                // Create POAM draft using existing logic
                console.log(`🔍 [Milestone4] Processing group ${i + 1}/${enrichedGroups.length}: ${enrichedGroup.groupId}`);
                const poamDraft = await this.createPOAMDraft(enrichedGroup, analysisEngine);
                
                if (poamDraft) {
                    poamDrafts.push(poamDraft);
                } else {
                    skippedCount++;
                }
                
            } catch (error) {
                console.error(`❌ [Milestone4] Error processing group ${enrichedGroup.groupId}:`, error);
                console.error('❌ Full error:', error.message);
                console.error('❌ Stack trace:', error.stack);
                this.logger.warn(`   Failed to create POAM draft for group ${enrichedGroup.groupId}: ${error.message}`);
                skippedCount++;
            }
            
            // Update progress
            const progress = (i + 1) / enrichedGroups.length;
            this.currentRun.milestoneProgress[4] = progress;
            this.updateProgress(progress, `Created ${poamDrafts.length} POAM drafts`);
        }
        
        this.currentRun.counts.poamsCreated = poamDrafts.length;
        this.currentRun.counts.poamsSkipped = skippedCount;
        
        const result = {
            poamDrafts,
            createdCount: poamDrafts.length,
            skippedCount
        };
        
        this.logger.info(`   POAMs created: ${poamDrafts.length}, skipped: ${skippedCount}`);
        
        return result;
    }

    async createPOAMDraft(enrichedGroup, analysisEngine) {
        try {
            const group = enrichedGroup.originalGroup;
            
            console.log('🔍 createPOAMDraft started:', {
                groupId: enrichedGroup.groupId,
                hasGroup: !!group,
                hasFindings: !!(group && group.findings),
                findingsCount: group?.findings?.length
            });
            
            // Create base POAM
            const poamDraft = {
                id: `POAM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: group.title || 'Unknown Vulnerability',
                description: enrichedGroup.cleanDescription,
                createdDate: new Date().toISOString().split('T')[0],
                status: 'Open',
                findingSource: 'Vulnerability Scan',
                scanId: this.currentRun.scanId,
                runId: this.currentRun.runId
            };
            
            console.log('✅ Base POAM created:', poamDraft.id);
            
            // Map severity to SLA
            const severity = group.severity || 'medium';
            const slaDays = this.mapSeverityToSLA(severity);
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + slaDays);
            
            poamDraft.dueDate = dueDate.toISOString().split('T')[0];
            poamDraft.initialScheduledCompletionDate = poamDraft.dueDate;
            poamDraft.risk = this.mapSeverityToRisk(severity);
            poamDraft.riskLevel = poamDraft.risk;
            
            // Apply template with milestone generation
            console.log('🔍 Preparing mockRemediation...');
            const mockRemediation = {
                remediationType: group.patchable ? 'patch' : 'config_change'
            };
            
            console.log('🔍 Calling applyPOAMTemplate...');
            const enhancedPOAM = analysisEngine.applyPOAMTemplate(
                poamDraft,
                'PATCHING_UPDATES',
                group.findings[0],
                mockRemediation,
                group
            );
            
            console.log('✅ POAM draft created successfully');
            return enhancedPOAM;
        } catch (error) {
            console.error('❌ Error in createPOAMDraft:', error);
            console.error('❌ Stack trace:', error.stack);
            throw error;
        }
    }

    mapSeverityToSLA(severity) {
        const slaMap = {
            'critical': 15,
            'high': 30,
            'medium': 90,
            'low': 180
        };
        return slaMap[severity] || 90;
    }

    mapSeverityToRisk(severity) {
        const riskMap = {
            'critical': 'critical',
            'high': 'high',
            'medium': 'medium',
            'low': 'low'
        };
        return riskMap[severity] || 'medium';
    }

    // ═══════════════════════════════════════════════════════════════
    // MILESTONE 5: COMMIT & PERSIST
    // ═══════════════════════════════════════════════════════════════

    async executeMilestone5(poamDrafts) {
        this.logger.info(`   Committing ${poamDrafts.length} POAMs to database`);
        
        // Create scan summary
        const scanSummary = {
            scanId: this.currentRun.scanId,
            runId: this.currentRun.runId,
            createdAt: new Date().toISOString(),
            totalFindings: this.currentRun.counts.totalFindings,
            eligibleFindings: this.currentRun.counts.eligibleFindings,
            excludedFindings: this.currentRun.counts.excludedFindings,
            groupsFormed: this.currentRun.counts.groupsFormed,
            poamsCreated: this.currentRun.counts.poamsCreated,
            poamsSkipped: this.currentRun.counts.poamsSkipped,
            scanMetadata: this.currentRun.scanMetadata
        };
        
        // Atomic commit - all or nothing
        await this.db.atomicCommit(poamDrafts, [scanSummary], this.currentRun);
        
        this.currentRun.counts.recordsCommitted = poamDrafts.length + 1; // +1 for summary
        this.currentRun.milestoneProgress[5] = 1;
        this.updateProgress(1, `Committed ${poamDrafts.length} POAMs and scan summary`);
        
        const result = {
            committedRecords: this.currentRun.counts.recordsCommitted,
            finalRunMetadata: {
                runId: this.currentRun.runId,
                scanId: this.currentRun.scanId,
                status: 'complete',
                completedAt: new Date().toISOString(),
                counts: this.currentRun.counts
            }
        };
        
        this.logger.info(`   Records committed: ${this.currentRun.counts.recordsCommitted}`);
        
        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    // PROGRESS TRACKING
    // ═══════════════════════════════════════════════════════════════

    updateProgress(milestoneProgress, message) {
        // Calculate overall progress based on current milestone
        const currentMilestone = this.currentRun.currentMilestone;
        const totalMilestones = this.milestones.length;
        const overallProgress = ((currentMilestone - 1) + milestoneProgress) / totalMilestones;
        
        this.currentRun.overallProgress = overallProgress;
        
        if (this.progressCallback) {
            this.progressCallback({
                overallProgress,
                currentMilestone,
                totalMilestones,
                milestoneProgress,
                milestoneName: this.milestones[currentMilestone - 1].name,
                message
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PIPELINE RESUMPTION AND IDEMPOTENCY
    // ═══════════════════════════════════════════════════════════════

    async resumePipeline(runId) {
        this.logger.info(`Resuming pipeline for run: ${runId}`);
        
        const run = await this.db.getScanRun(runId);
        if (!run) {
            throw new Error(`Run not found: ${runId}`);
        }
        
        if (run.status === 'complete') {
            this.logger.info('Run already complete');
            return run;
        }
        
        if (run.status === 'failed') {
            throw new Error(`Cannot resume failed run: ${runId}`);
        }
        
        this.currentRun = run;
        
        // Find the last completed milestone
        let lastCompletedMilestone = 0;
        for (let i = 1; i <= this.milestones.length; i++) {
            if (run.milestoneStatus[i] === 'completed') {
                lastCompletedMilestone = i;
            } else if (run.milestoneStatus[i] === 'running') {
                break;
            }
        }
        
        this.logger.info(`Resuming from milestone ${lastCompletedMilestone + 1}`);
        
        // Resume from next milestone
        // Implementation would depend on stored artifacts and state
        throw new Error('Pipeline resumption not yet implemented');
    }
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL EXPORTS
// ═══════════════════════════════════════════════════════════════

window.AuthoritativeMilestonePipeline = AuthoritativeMilestonePipeline;
window.AUTHORITATIVE_MILESTONES = AUTHORITATIVE_MILESTONES;

console.log('✅ milestone-pipeline-orchestrator-v2.js loaded successfully');
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
        
        // Mark all phases as complete
        for (let i = 1; i <= 5; i++) {
            const icon = document.getElementById(`phase-${i}-icon`);
            const status = document.getElementById(`phase-${i}-status`);
            if (icon) {
                icon.classList.remove('border-gray-300', 'border-blue-500');
                icon.classList.add('border-green-500', 'bg-green-500');
                icon.innerHTML = '<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>';
            }
            if (status) {
                status.textContent = 'Complete';
                status.className = 'text-xs text-green-600 phase-status';
            }
        }

        // Set overall progress to 100%
        this.updateOverallProgress(1);

        // Get scan analysis if available
        const analysis = window.lastScanAnalysis || {};
        const isReImport = (counts.poamsMerged > 0 || counts.poamsAutoResolved > 0 || analysis.autoClosedPOAMs > 0);
        
        let detailsHtml = '';
        if (isReImport) {
            detailsHtml = `
                <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-left text-xs text-blue-700 space-y-1">
                    <div class="font-semibold text-blue-800 mb-1">📊 Re-import Analysis</div>
                    <div>✅ <strong>${counts.poamsCreated || 0}</strong> new POAMs created</div>
                    <div>🔄 <strong>${counts.poamsMerged || analysis.updatedPOAMs || 0}</strong> existing POAMs updated</div>
                    <div>✓ <strong>${counts.poamsAutoResolved || analysis.autoClosedPOAMs || 0}</strong> POAMs auto-closed (no longer in scan)</div>
                    ${analysis.autoClosedIds && analysis.autoClosedIds.length > 0 ? `<div class="mt-1 text-blue-600"><strong>Closed:</strong> ${analysis.autoClosedIds.slice(0, 5).join(', ')}${analysis.autoClosedIds.length > 5 ? ` +${analysis.autoClosedIds.length - 5} more` : ''}</div>` : ''}
                </div>`;
        } else {
            detailsHtml = `<div class="mt-2 text-sm text-gray-600">Created <strong>${counts.poamsCreated || 0}</strong> POAMs from <strong>${counts.totalRows || 0}</strong> findings (${counts.excludedCount || 0} excluded)</div>`;
        }

        if (statusEl) {
            statusEl.innerHTML = `
                <div class="text-green-600 font-medium">
                    ✅ Pipeline completed successfully!
                    ${detailsHtml}
                    <div class="mt-3 text-xs text-gray-400">Auto-closing in <span id="close-countdown">4</span>s...</div>
                    <div class="mt-2 flex gap-2 justify-center">
                        <button type="button" onclick="showModule('dashboard'); document.getElementById('pipeline-progress-container')?.classList.add('hidden')" 
                            class="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                            <i class="fas fa-chart-line mr-1"></i> Go to Dashboard
                        </button>
                        <button type="button" onclick="document.getElementById('pipeline-progress-container')?.classList.add('hidden')" 
                            class="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors">
                            Stay Here
                        </button>
                    </div>
                </div>
            `;
        }

        // Auto-close after 4 seconds
        let countdown = 4;
        const countdownInterval = setInterval(() => {
            countdown--;
            const el = document.getElementById('close-countdown');
            if (el) el.textContent = countdown;
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                const container = document.getElementById('pipeline-progress-container');
                if (container) container.classList.add('hidden');
            }
        }, 1000);
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
// Pipeline Logger - Configurable logging system with log levels
// Eliminates console spam from hot loops

const LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

class PipelineLogger {
    constructor(name, level = LogLevel.INFO) {
        this.name = name;
        this.level = level;
    }

    setLevel(level) {
        this.level = level;
    }

    error(message, ...args) {
        if (this.level >= LogLevel.ERROR) {
            console.error(`❌ [${this.name}]`, message, ...args);
        }
    }

    warn(message, ...args) {
        if (this.level >= LogLevel.WARN) {
            console.warn(`⚠️ [${this.name}]`, message, ...args);
        }
    }

    info(message, ...args) {
        if (this.level >= LogLevel.INFO) {
            console.log(`ℹ️ [${this.name}]`, message, ...args);
        }
    }

    debug(message, ...args) {
        if (this.level >= LogLevel.DEBUG) {
            console.log(`🔍 [${this.name}]`, message, ...args);
        }
    }

    trace(message, ...args) {
        if (this.level >= LogLevel.TRACE) {
            console.log(`📍 [${this.name}]`, message, ...args);
        }
    }

    phaseStart(phaseName) {
        if (this.level >= LogLevel.INFO) {
            console.log(`\n🚀 ═══ ${phaseName} STARTED ═══`);
        }
    }

    phaseEnd(phaseName, stats = {}) {
        if (this.level >= LogLevel.INFO) {
            console.log(`✅ ═══ ${phaseName} COMPLETED ═══`);
            if (Object.keys(stats).length > 0) {
                console.log('   Stats:', stats);
            }
        }
    }

    phaseProgress(phaseName, progress, detail = '') {
        if (this.level >= LogLevel.DEBUG) {
            console.log(`⏳ [${phaseName}] ${progress}% ${detail}`);
        }
    }
}

// Export for use in other modules
window.LogLevel = LogLevel;
window.PipelineLogger = PipelineLogger;

console.log('✅ pipeline-logger.js loaded successfully');
