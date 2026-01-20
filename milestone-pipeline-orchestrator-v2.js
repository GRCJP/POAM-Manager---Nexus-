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

        // Initialize new connection if needed
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 9); // Increment version for new schema
            
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
                const poamDraft = await this.createPOAMDraft(enrichedGroup, analysisEngine);
                
                if (poamDraft) {
                    poamDrafts.push(poamDraft);
                } else {
                    skippedCount++;
                }
                
            } catch (error) {
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
        const group = enrichedGroup.originalGroup;
        
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
        const mockRemediation = {
            remediationType: group.patchable ? 'patch' : 'config_change'
        };
        
        const enhancedPOAM = analysisEngine.applyPOAMTemplate(
            poamDraft,
            'PATCHING_UPDATES',
            group.findings[0], // Use first finding as representative
            mockRemediation,
            group
        );
        
        return enhancedPOAM;
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
