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
            const groupsArray = groupResult.data.groups;
            
            if (!Array.isArray(groupsArray)) {
                this.logger.error('GroupingSkill returned invalid groups:', groupsArray);
                throw new Error('GroupingSkill must return groups as an array');
            }
            
            groupsArray.forEach(group => {
                if (group && group.signature) {
                    // Convert assets/cves/qids back to Sets for compatibility with Phase 3
                    const groupWithSets = {
                        ...group,
                        assets: new Set(group.assets || []),
                        cves: new Set(group.cves || []),
                        qids: new Set(group.qids || []),
                        advisoryIds: new Set() // Initialize empty advisoryIds Set
                    };
                    groups.set(group.signature, groupWithSets);
                }
            });
            
            this.logger.info(`Converted ${groups.size} groups from skills to Map format`);
            
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
