/**
 * POAM Builder Skill
 * 
 * Responsibilities:
 * - Build POAM objects from remediation groups
 * - Assign POAM IDs
 * - Calculate due dates based on SLA breach analysis
 * - Determine POAM status
 * - Generate titles, descriptions, mitigation text
 * - Assign POC/team using rules engine
 * - Calculate confidence scores
 * - Set priority flags
 */

class POAMBuilderSkill extends BaseSkill {
    constructor(config = {}) {
        super('POAMBuilderSkill', config);
        
        // Configuration
        this.isBaselineMode = config.isBaselineMode || false;
        this.autoPrioritizeTop = config.autoPrioritizeTop || 0;
        this.scanId = config.scanId || null;
        
        // Tracking
        this.poamsCreated = 0;
        this.poamsSkipped = 0;
        this.skipReasons = {};
    }

    async run(input) {
        const { groups, config = {} } = input;
        
        // Update config if provided
        if (config.isBaselineMode !== undefined) this.isBaselineMode = config.isBaselineMode;
        if (config.autoPrioritizeTop !== undefined) this.autoPrioritizeTop = config.autoPrioritizeTop;
        if (config.scanId !== undefined) this.scanId = config.scanId;
        
        console.log(`\n🏗️  POAM BUILDER SKILL: Processing ${groups.length} groups`);
        console.log(`   Baseline mode: ${this.isBaselineMode}`);
        console.log(`   Auto-prioritize top: ${this.autoPrioritizeTop}`);
        
        const poams = [];
        let poamIdCounter = 1;
        this.poamsCreated = 0;
        this.poamsSkipped = 0;
        this.skipReasons = {};
        
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            
            if ((i + 1) % 10 === 0 || i === groups.length - 1) {
                console.log(`   🏗️  Progress: ${i + 1}/${groups.length} groups processed, ${poams.length} POAMs created`);
            }
            
            const rem = group.remediation;
            const signature = group.signature;
            
            // Analyze group breach status
            const breachAnalysis = this.analyzeGroupBreach(group);
            
            // Create POAM for any group with active findings
            const hasActiveFindings = breachAnalysis.activeAssets.size > 0;
            if (!hasActiveFindings) {
                this.poamsSkipped++;
                this.skipReasons[breachAnalysis.skipReason] = 
                    (this.skipReasons[breachAnalysis.skipReason] || 0) + 1;
                continue;
            }
            
            // Assign POC using rules engine
            const pocAssignment = this.assignPOC(rem, group);
            
            // Calculate due date
            const firstDetectedDate = breachAnalysis.oldestDetectionDate;
            const calculatedDueDate = this.calculateDueDate(
                breachAnalysis.highestRisk,
                firstDetectedDate,
                breachAnalysis.oldestBreachDate
            );
            
            // Calculate days overdue
            const now = new Date();
            const breachDate = new Date(calculatedDueDate);
            const daysOverdue = this.daysBetween(breachDate, now);
            
            // Determine POAM status
            const poamStatus = this.determinePOAMStatus(rem, breachAnalysis, group);
            
            // Generate finding description
            const findingDescription = this.generateFindingDescription(group, rem);
            
            // Select POAM title
            const poamTitle = this.selectPOAMTitle(rem, group, breachAnalysis);
            
            // Calculate asset counts
            const totalAffectedAssets = group.assets.length;
            const activeAssetCount = breachAnalysis.activeAssets.size;
            const breachedAssetCount = breachAnalysis.breachedAssets.size;
            
            // Build POAM object
            const poam = {
                // Identifiers
                id: `POAM-${String(poamIdCounter).padStart(4, '0')}`,
                source: 'Vulnerability Scan Report',
                
                // Display fields
                title: poamTitle,
                description: findingDescription,
                findingDescription: findingDescription,
                vulnerability: poamTitle,
                
                // Remediation metadata
                remediationSignature: signature,
                remediationType: rem.remediationType,
                component: rem.component || '',
                platform: rem.platform || 'general',
                targetingStrategy: rem.targetingStrategy || 'asset',
                fixedTarget: rem.fixedTarget || '',
                fixedTargetKey: rem.fixedTargetKey || '',
                actionText: rem.actionText || '',
                
                // Status and tracking
                status: poamStatus,
                findingStatus: poamStatus,
                risk: breachAnalysis.highestRisk,
                rawRisk: this.riskToNumber(breachAnalysis.highestRisk),
                dueDate: calculatedDueDate,
                scheduledCompletionDate: calculatedDueDate,
                updatedScheduledCompletionDate: calculatedDueDate,
                createdDate: new Date().toISOString().split('T')[0],
                
                // SLA and breach metadata
                slaBreached: breachAnalysis.breachedAssets.size > 0,
                slaDays: breachAnalysis.slaDays,
                oldestDetectionDate: breachAnalysis.oldestDetectionDate,
                breachDate: breachAnalysis.oldestBreachDate,
                daysOverdue: daysOverdue,
                
                // Asset counts
                totalAffectedAssets: totalAffectedAssets,
                activeAssets: activeAssetCount,
                breachedAssets: breachedAssetCount,
                assetCount: totalAffectedAssets,
                assetCountBreached: breachedAssetCount,
                assetCountActive: activeAssetCount,
                assetCountWithinSLA: breachAnalysis.withinSlaAssets.size,
                findingCount: group.findings.length,
                
                // Asset lists
                affectedAssets: group.assets,
                asset: group.assets.join(', '),
                breachedAssetsList: Array.from(breachAnalysis.breachedAssets),
                activeAssetsList: Array.from(breachAnalysis.activeAssets),
                withinSlaAssets: Array.from(breachAnalysis.withinSlaAssets),
                
                // CVE/QID tracking
                cves: group.cves || [],
                qids: group.qids || [],
                advisoryIds: group.advisoryIds || [],
                
                // POC assignment
                poc: pocAssignment.pocTeam,
                pocTeam: pocAssignment.pocTeam,
                assignmentReason: pocAssignment.assignmentReason,
                recommendedOwner: pocAssignment.pocTeam,
                
                // Control family (will be enhanced later)
                controlFamily: this.assignControlFamily(rem, group),
                
                // Resources
                resourcesRequired: 'Personnel Time',
                
                // Evidence
                evidenceSamples: group.evidenceSamples || [],
                
                // Mitigation (generated from template)
                mitigation: this.generateMitigation(rem, group),
                
                // Confidence (will be calculated separately)
                confidenceScore: 0,
                needsReview: false,
                
                // Flags
                isBaseline: this.isBaselineMode,
                isPriority: false,  // Set later based on auto-prioritize
                
                // Raw findings for drill-down
                rawFindings: group.findings,
                
                // Risk acceptance tracking
                ignoredFindingsCount: group.findings.filter(f => f.ignored === true).length,
                hasIgnoredFindings: group.findings.some(f => f.ignored === true)
            };
            
            poams.push(poam);
            this.poamsCreated++;
            poamIdCounter++;
        }
        
        // Auto-prioritize top POAMs if baseline mode
        if (this.isBaselineMode && this.autoPrioritizeTop > 0 && poams.length > 0) {
            this.autoPrioritizePOAMs(poams, this.autoPrioritizeTop);
        }
        
        // Calculate confidence scores for all POAMs
        this.calculateConfidenceScores(poams);
        
        console.log(`\n   📊 POAM BUILDER RESULTS:`);
        console.log(`      ✅ POAMs created: ${this.poamsCreated}`);
        console.log(`      ⏭️  Groups skipped: ${this.poamsSkipped}`);
        if (Object.keys(this.skipReasons).length > 0) {
            console.log(`      📋 Skip reasons:`, this.skipReasons);
        }
        
        return {
            poams,
            summary: {
                created: this.poamsCreated,
                skipped: this.poamsSkipped,
                skipReasons: this.skipReasons,
                prioritized: this.isBaselineMode ? this.autoPrioritizeTop : 0
            }
        };
    }

    analyzeGroupBreach(group) {
        const breachedAssets = new Set();
        const activeAssets = new Set();
        const withinSlaAssets = new Set();
        
        let oldestDetectionDate = null;
        let oldestBreachDate = null;
        let oldestAge = 0;
        let highestRisk = 'Low';
        let slaDays = 90;
        
        const riskPriority = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
        
        group.findings.forEach(finding => {
            const asset = finding.host || finding.ip || finding.asset?.hostname || finding.asset?.assetId || 'unknown';
            const sla = finding.sla;
            
            if (!sla) return;
            
            // Track active assets
            const status = (sla.status || '').toUpperCase();
            if (status === 'ACTIVE' || status === 'NEW' || status === 'OPEN') {
                activeAssets.add(asset);
                
                // Track breached vs within SLA
                if (sla.breached) {
                    breachedAssets.add(asset);
                    
                    // Track oldest detection
                    const detectionDate = new Date(sla.firstDetected);
                    if (!oldestDetectionDate || detectionDate < oldestDetectionDate) {
                        oldestDetectionDate = detectionDate;
                        oldestBreachDate = sla.breachDate;
                        oldestAge = sla.ageDays;
                        slaDays = sla.slaDays;
                    }
                } else {
                    withinSlaAssets.add(asset);
                }
            }
            
            // Track highest risk
            const severity = this.normalizeSeverity(sla.severity || finding.severity);
            if (riskPriority[severity] > riskPriority[highestRisk]) {
                highestRisk = severity;
            }
        });
        
        // Determine skip reason if no active findings
        let skipReason = null;
        if (activeAssets.size === 0) {
            if (group.findings.every(f => f.sla?.status === 'FIXED' || f.sla?.status === 'CLOSED')) {
                skipReason = 'All findings fixed/closed';
            } else {
                skipReason = 'No active findings';
            }
        }
        
        return {
            breachedAssets,
            activeAssets,
            withinSlaAssets,
            oldestDetectionDate: oldestDetectionDate ? oldestDetectionDate.toISOString().split('T')[0] : null,
            oldestBreachDate,
            oldestAge,
            highestRisk,
            slaDays,
            skipReason,
            groupBreached: breachedAssets.size > 0
        };
    }

    calculateDueDate(risk, firstDetectedDate, breachDate) {
        // In baseline mode, use fresh due dates from current date
        if (this.isBaselineMode) {
            return this.calculateFreshDueDate(risk);
        }
        
        // Use breach date if available
        if (breachDate) {
            return breachDate;
        }
        
        // Fallback: calculate from first detected
        if (firstDetectedDate) {
            const slaDays = this.getSLADays(risk);
            const detected = new Date(firstDetectedDate);
            detected.setDate(detected.getDate() + slaDays);
            return detected.toISOString().split('T')[0];
        }
        
        // Last resort: use current date + SLA
        return this.calculateFreshDueDate(risk);
    }

    calculateFreshDueDate(risk) {
        const now = new Date();
        const slaDays = this.getSLADays(risk);
        now.setDate(now.getDate() + slaDays);
        return now.toISOString().split('T')[0];
    }

    getSLADays(risk) {
        const slaMap = {
            'Critical': 15,
            'High': 30,
            'Medium': 90,
            'Low': 180
        };
        return slaMap[risk] || 90;
    }

    determinePOAMStatus(rem, breachAnalysis, group) {
        // Check for risk acceptance
        if (rem.remediationType === 'risk_acceptance') {
            return 'risk-accepted';
        }
        
        // Check if any findings are risk accepted
        const hasRiskAccepted = group.findings.some(f => {
            const status = (f.status || '').toLowerCase();
            return status === 'risk accepted' || status === 'risk-accepted' || status === 'ignored';
        });
        
        if (hasRiskAccepted) {
            return 'risk-accepted';
        }
        
        // Default to open
        return 'open';
    }

    generateFindingDescription(group, rem) {
        // Use first finding's description or title
        const firstFinding = group.findings[0];
        return firstFinding?.description || 
               firstFinding?.findingDescription || 
               firstFinding?.title || 
               rem.actionText || 
               'Vulnerability detected';
    }

    selectPOAMTitle(rem, group, breachAnalysis) {
        const firstFinding = group.findings[0];
        
        // Priority 1: Use component + version if available
        if (rem.component && rem.fixedTarget) {
            return `${rem.component} ${rem.fixedTarget} - Multiple Vulnerabilities`;
        }
        
        // Priority 2: Use component name
        if (rem.component) {
            return `${rem.component} - Multiple Vulnerabilities`;
        }
        
        // Priority 3: Use first finding title
        if (firstFinding?.title) {
            return firstFinding.title;
        }
        
        // Priority 4: Use vulnerability name
        if (firstFinding?.vulnerability) {
            return firstFinding.vulnerability;
        }
        
        // Fallback: Generic title
        return `${breachAnalysis.highestRisk} Severity Vulnerability`;
    }

    assignPOC(rem, group) {
        // Simple POC assignment logic
        // Can be enhanced with rules engine later
        
        const platform = rem.platform || 'general';
        
        const pocMap = {
            'server': 'Server Team',
            'endpoint': 'Endpoint Team',
            'network': 'Network Team',
            'general': 'Security Team'
        };
        
        const pocTeam = pocMap[platform] || 'Security Team';
        
        return {
            pocTeam,
            assignmentReason: `Assigned to ${pocTeam} based on platform: ${platform}`,
            ruleMatched: 'platform-based',
            precedence: 1
        };
    }

    assignControlFamily(rem, group) {
        // Simple control family assignment
        // Can be enhanced with mapping logic later
        
        const actionType = rem.actionType || 'other';
        
        const familyMap = {
            'patch': 'SI-2',      // System and Information Integrity - Flaw Remediation
            'upgrade': 'SI-2',
            'configure': 'CM-6',  // Configuration Management - Configuration Settings
            'remove': 'CM-7',     // Configuration Management - Least Functionality
            'workaround': 'SI-2',
            'other': 'SI-2'
        };
        
        return familyMap[actionType] || 'SI-2';
    }

    generateMitigation(rem, group) {
        const actionType = rem.actionType || 'other';
        const component = rem.component || 'affected component';
        const fixedTarget = rem.fixedTarget || 'latest version';
        
        const templates = {
            'upgrade': `Upgrade ${component} to version ${fixedTarget} or later using the standard deployment process.`,
            'patch': `Apply the required patches to ${component} using the standard patch management process.`,
            'configure': `Reconfigure ${component} according to security hardening guidelines.`,
            'remove': `Remove or disable ${component} if not required for business operations.`,
            'workaround': `Implement the recommended workaround until a permanent fix is available.`,
            'other': `Remediate the vulnerability according to vendor guidance.`
        };
        
        return templates[actionType] || templates['other'];
    }

    autoPrioritizePOAMs(poams, topN) {
        // Sort by total affected assets (descending)
        const sorted = [...poams].sort((a, b) => {
            return (b.totalAffectedAssets || 0) - (a.totalAffectedAssets || 0);
        });
        
        // Mark top N as priority
        for (let i = 0; i < Math.min(topN, sorted.length); i++) {
            sorted[i].isPriority = true;
        }
        
        console.log(`   🎯 Auto-prioritized top ${Math.min(topN, sorted.length)} POAMs by asset count`);
    }

    calculateConfidenceScores(poams) {
        // Simple confidence scoring based on data completeness
        poams.forEach(poam => {
            let score = 0;
            
            // Has CVEs (+20)
            if (poam.cves && poam.cves.length > 0) score += 20;
            
            // Has component (+20)
            if (poam.component) score += 20;
            
            // Has fixed target (+20)
            if (poam.fixedTarget) score += 20;
            
            // Has multiple findings (+20)
            if (poam.findingCount > 1) score += 20;
            
            // Has evidence (+20)
            if (poam.evidenceSamples && poam.evidenceSamples.length > 0) score += 20;
            
            poam.confidenceScore = score;
            poam.needsReview = score < 60;
        });
    }

    normalizeSeverity(severity) {
        if (!severity) return 'Medium';
        
        const sev = severity.toString().toLowerCase().trim();
        
        // Numeric severity (1-5)
        if (/^[1-5]$/.test(sev)) {
            const num = parseInt(sev);
            if (num <= 2) return 'Low';
            if (num === 3) return 'Medium';
            if (num === 4) return 'High';
            if (num === 5) return 'Critical';
        }
        
        // Text severity
        if (sev.includes('crit')) return 'Critical';
        if (sev.includes('high')) return 'High';
        if (sev.includes('med') || sev.includes('mod')) return 'Medium';
        if (sev.includes('low')) return 'Low';
        
        return 'Medium';
    }

    riskToNumber(risk) {
        const map = { 'Critical': 5, 'High': 4, 'Medium': 3, 'Low': 2 };
        return map[risk] || 3;
    }

    daysBetween(date1, date2) {
        const msPerDay = 1000 * 60 * 60 * 24;
        const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
        const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
        return Math.floor((utc2 - utc1) / msPerDay);
    }

    async validate(data, type) {
        if (type === 'input') {
            const errors = [];
            if (!data.groups || !Array.isArray(data.groups)) {
                errors.push('groups must be an array');
            }
            // Validate groups have required fields
            if (data.groups && data.groups.length > 0) {
                const firstGroup = data.groups[0];
                if (!firstGroup.findings || !Array.isArray(firstGroup.findings)) {
                    errors.push('groups must contain findings array');
                }
                if (!firstGroup.remediation) {
                    errors.push('groups must contain remediation object');
                }
            }
            return { valid: errors.length === 0, errors };
        }

        if (type === 'output') {
            const errors = [];
            if (!data.poams || !Array.isArray(data.poams)) {
                errors.push('poams must be an array');
            }
            if (!data.summary) {
                errors.push('summary is required');
            }
            // Validate POAMs have required fields
            const missingFields = data.poams.filter(p => !p.id || !p.title || !p.risk);
            if (missingFields.length > 0) {
                errors.push(`${missingFields.length} POAMs missing required fields (id, title, risk)`);
            }
            return { valid: errors.length === 0, errors };
        }

        return { valid: true, errors: [] };
    }

    async getTestCases() {
        const now = new Date();
        const oldDate = new Date(now);
        oldDate.setDate(oldDate.getDate() - 60); // 60 days ago
        
        return [
            {
                name: 'Build POAM from single group with breached findings',
                input: {
                    groups: [{
                        signature: 'patch::kb5034441::server',
                        findings: [{
                            title: 'Test Vulnerability',
                            severity: 'High',
                            status: 'Active',
                            host: 'server01',
                            sla: {
                                severity: 'High',
                                slaDays: 30,
                                ageDays: 60,
                                breached: true,
                                breachDate: oldDate.toISOString().split('T')[0],
                                firstDetected: oldDate.toISOString().split('T')[0],
                                status: 'ACTIVE'
                            }
                        }],
                        assets: ['server01'],
                        cves: ['CVE-2024-1234'],
                        qids: ['12345'],
                        evidenceSamples: ['Sample evidence'],
                        remediation: {
                            remediationType: 'patch_update',
                            actionType: 'patch',
                            component: 'Windows',
                            platform: 'server',
                            targetingStrategy: 'version',
                            fixedTarget: 'KB5034441',
                            actionText: 'Apply KB5034441'
                        }
                    }],
                    config: { isBaselineMode: false }
                },
                validate: (result) => {
                    return result.success && 
                           result.data.poams.length === 1 &&
                           result.data.poams[0].id === 'POAM-0001' &&
                           result.data.poams[0].slaBreached === true &&
                           result.data.summary.created === 1;
                }
            }
        ];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = POAMBuilderSkill;
}
