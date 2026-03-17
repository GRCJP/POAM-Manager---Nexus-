/**
 * Grouping Skill
 * 
 * Responsibilities:
 * - Group findings by remediation signature
 * - Extract remediation metadata (action type, target, asset class)
 * - Aggregate findings into logical remediation groups
 * - Generate unique signatures for correlation
 */

class GroupingSkill extends BaseSkill {
    constructor(config = {}) {
        super('GroupingSkill', config);
    }

    async run(input) {
        const { findings } = input;
        
        console.log(`\n🔧 GROUPING SKILL: Processing ${findings.length} findings`);
        
        const groups = new Map();
        let groupsCreated = 0;
        let findingsGrouped = 0;
        
        findings.forEach((finding, idx) => {
            // Extract remediation metadata
            const remediation = this.extractRemediationMetadata(finding);
            
            // Build signature
            const signature = this.buildSignature(remediation);
            
            // Create or update group
            if (!groups.has(signature)) {
                groups.set(signature, {
                    signature,
                    findings: [],
                    assets: new Set(),
                    cves: new Set(),
                    qids: new Set(),
                    evidenceSamples: [],
                    remediation
                });
                groupsCreated++;
                
                if (groupsCreated <= 5) {
                    console.log(`   📦 Group ${groupsCreated}: ${signature.substring(0, 80)}`);
                }
            }
            
            const group = groups.get(signature);
            group.findings.push(finding);
            findingsGrouped++;
            
            // Track assets
            const assetKey = finding.host || finding.ip || 'Unknown';
            group.assets.add(assetKey);
            
            // Track CVEs
            if (Array.isArray(finding.cve)) {
                finding.cve.forEach(c => { if (c) group.cves.add(c); });
            }
            
            // Track QIDs
            if (Array.isArray(finding.qid)) {
                finding.qid.forEach(q => { if (q) group.qids.add(String(q)); });
            }
            
            // Collect evidence samples
            if (group.evidenceSamples.length < 5 && (finding.results || finding.evidence)) {
                group.evidenceSamples.push(finding.results || finding.evidence);
            }
        });
        
        // Convert Map to Array and convert Sets to Arrays
        const groupsArray = Array.from(groups.values()).map(group => ({
            ...group,
            assets: Array.from(group.assets),
            cves: Array.from(group.cves),
            qids: Array.from(group.qids)
        }));
        
        console.log(`\n   📊 GROUPING RESULTS:`);
        console.log(`      ✅ Groups created: ${groupsCreated}`);
        console.log(`      ✅ Findings grouped: ${findingsGrouped}`);
        console.log(`      📈 Avg findings/group: ${(findingsGrouped / groupsCreated).toFixed(2)}`);
        
        return {
            groups: groupsArray,
            summary: {
                totalGroups: groupsCreated,
                totalFindings: findingsGrouped,
                avgFindingsPerGroup: (findingsGrouped / groupsCreated).toFixed(2),
                largestGroup: Math.max(...groupsArray.map(g => g.findings.length)),
                smallestGroup: Math.min(...groupsArray.map(g => g.findings.length))
            }
        };
    }

    extractRemediationMetadata(finding) {
        const solution = finding.solution || '';
        const title = finding.title || '';
        const category = finding.category || '';
        
        // Extract action type
        const actionType = this.extractActionType(solution);
        
        // Extract target (what needs to be fixed)
        const targetKey = this.extractTargetKey(solution, title, finding);
        
        // Extract asset class
        const assetClass = this.extractAssetClass(finding);
        
        // Extract patch date if applicable
        const patchDate = finding.patchReleased || null;
        
        return {
            actionType,
            targetKey,
            assetClass,
            patchDate,
            remediationType: this.determineRemediationType(actionType, targetKey)
        };
    }

    extractActionType(solution) {
        if (!solution) return 'other';
        const s = solution.toLowerCase();
        
        if (s.includes('install') || s.includes('apply') || s.includes('patch')) return 'patch';
        if (s.includes('upgrade') || s.includes('update')) return 'upgrade';
        if (s.includes('configure') || s.includes('disable') || s.includes('enable')) return 'configure';
        if (s.includes('remove') || s.includes('uninstall')) return 'remove';
        if (s.includes('restrict') || s.includes('block')) return 'restrict';
        
        return 'other';
    }

    extractTargetKey(solution, title, finding) {
        // Try to extract KB numbers
        const kbMatch = (solution + ' ' + title).match(/KB\d+/i);
        if (kbMatch) return kbMatch[0].toUpperCase();
        
        // Try to extract CVE
        if (finding.cve && finding.cve.length > 0) {
            return finding.cve[0];
        }
        
        // Try to extract software name
        const softwareMatch = title.match(/^([A-Za-z0-9\s\-\.]+?)(?:\s+\d|\s+vulnerability|\s+security|$)/i);
        if (softwareMatch) {
            return softwareMatch[1].trim();
        }
        
        // Try to extract configuration item
        const configMatch = solution.match(/(?:configure|disable|enable)\s+([A-Za-z0-9\s\-\.]+)/i);
        if (configMatch) {
            return configMatch[1].trim();
        }
        
        // Fallback to QID
        if (finding.qid && finding.qid.length > 0) {
            return `QID-${finding.qid[0]}`;
        }
        
        return 'unknown';
    }

    extractAssetClass(finding) {
        const os = (finding.operatingSystem || '').toLowerCase();
        
        if (os.includes('windows')) return 'windows';
        if (os.includes('linux') || os.includes('ubuntu') || os.includes('centos') || os.includes('redhat')) return 'linux';
        if (os.includes('mac') || os.includes('darwin')) return 'macos';
        if (os.includes('network') || os.includes('cisco') || os.includes('juniper')) return 'network';
        if (os.includes('vmware') || os.includes('esxi')) return 'virtualization';
        
        return 'general';
    }

    determineRemediationType(actionType, targetKey) {
        if (actionType === 'patch' && targetKey.startsWith('KB')) {
            return 'windows_patch';
        }
        if (actionType === 'patch') {
            return 'software_patch';
        }
        if (actionType === 'upgrade') {
            return 'software_upgrade';
        }
        if (actionType === 'configure') {
            return 'configuration_change';
        }
        if (actionType === 'remove') {
            return 'software_removal';
        }
        return 'operational_mitigation';
    }

    buildSignature(remediation) {
        // Signature format: actionType::targetKey::assetClass
        return `${remediation.actionType}::${remediation.targetKey}::${remediation.assetClass}`;
    }

    async validate(data, type) {
        if (type === 'input') {
            const errors = [];
            if (!data.findings || !Array.isArray(data.findings)) {
                errors.push('findings must be an array');
            }
            if (data.findings && data.findings.length === 0) {
                errors.push('findings array cannot be empty');
            }
            return { valid: errors.length === 0, errors };
        }

        if (type === 'output') {
            const errors = [];
            if (!data.groups || !Array.isArray(data.groups)) {
                errors.push('groups must be an array');
            }
            if (!data.summary) {
                errors.push('summary is required');
            }
            // Validate all groups have required fields
            const invalidGroups = data.groups.filter(g => 
                !g.signature || !g.findings || !g.remediation
            );
            if (invalidGroups.length > 0) {
                errors.push(`${invalidGroups.length} groups missing required fields`);
            }
            return { valid: errors.length === 0, errors };
        }

        return { valid: true, errors: [] };
    }

    async getTestCases() {
        return [
            {
                name: 'Group findings by KB patch',
                input: {
                    findings: [
                        {
                            title: 'Windows KB5068781 Security Update',
                            solution: 'Install KB5068781',
                            operatingSystem: 'Windows Server 2019',
                            host: 'server01',
                            qid: ['12345'],
                            cve: ['CVE-2024-1234']
                        },
                        {
                            title: 'Windows KB5068781 Security Update',
                            solution: 'Install KB5068781',
                            operatingSystem: 'Windows Server 2019',
                            host: 'server02',
                            qid: ['12345'],
                            cve: ['CVE-2024-1234']
                        }
                    ]
                },
                validate: (result) => {
                    return result.success && 
                           result.data.groups.length === 1 &&
                           result.data.groups[0].findings.length === 2 &&
                           result.data.groups[0].signature.includes('KB5068781');
                }
            },
            {
                name: 'Separate groups for different patches',
                input: {
                    findings: [
                        {
                            title: 'Windows KB5068781 Security Update',
                            solution: 'Install KB5068781',
                            operatingSystem: 'Windows Server 2019',
                            host: 'server01',
                            qid: ['12345']
                        },
                        {
                            title: 'Windows KB5072014 Security Update',
                            solution: 'Install KB5072014',
                            operatingSystem: 'Windows Server 2019',
                            host: 'server01',
                            qid: ['12346']
                        }
                    ]
                },
                validate: (result) => {
                    return result.success && 
                           result.data.groups.length === 2;
                }
            }
        ];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GroupingSkill;
}
