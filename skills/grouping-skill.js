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
            // Findings should already have remediation object from classification step
            const rem = finding.remediation;
            
            if (!rem) {
                console.warn(`⚠️ Finding ${idx} missing remediation object - skipping`);
                return;
            }
            
            // Build signature from remediation object
            const signature = `${rem.actionType || 'other'}::${rem.targetKey || 'unknown'}::${rem.assetClass || 'general'}`;
            
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
        const os = finding.operatingSystem || finding.asset?.operatingSystem || finding.os || '';
        
        // Extract action type
        const actionType = this.extractActionType(solution);
        
        // Extract version/target
        const rawVersion = this.extractTargetVersion(solution);
        const fixedTarget = rawVersion || '';
        const truncatedVersion = rawVersion ? this.truncateVersion(rawVersion) : null;
        const targetKey = truncatedVersion || this.normalizeForHash(solution);
        
        // Extract asset class
        const assetClass = this.extractAssetClass(finding);
        
        // Extract product and vendor
        const component = this.extractProduct(title);
        const vendor = this.extractVendor(title, solution);
        
        // Extract patch date
        const patchDate = this.extractPatchMonth(solution);
        
        // Determine targeting strategy
        const targetingStrategy = (rawVersion || patchDate) ? 'version' : 'asset';
        
        // Map actionType to remediationType
        let remediationType = actionType;
        if (actionType === 'upgrade') remediationType = 'patch_update';
        else if (actionType === 'patch') remediationType = 'patch_update';
        else if (actionType === 'configure') remediationType = 'config_change';
        else if (actionType === 'remove') remediationType = 'removal';
        else if (actionType === 'workaround') remediationType = 'operational_mitigation';
        else remediationType = 'operational_mitigation';
        
        return {
            remediationType,
            actionType,
            component,
            platform: assetClass,
            targetingStrategy,
            fixedTarget,
            fixedTargetKey: component ? `${component}:${fixedTarget}` : fixedTarget,
            actionText: solution || title || '',
            vendor,
            patchDate,
            targetKey,
            assetClass
        };
    }
    
    extractPatchMonth(solution) {
        if (!solution) return null;
        const monthYear = solution.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
        return monthYear ? monthYear[1].toLowerCase() + '_' + monthYear[2] : null;
    }

    extractActionType(solution) {
        if (!solution) return 'other';
        const s = solution.toLowerCase();
        if (s.includes('upgrade') || s.includes('update to')) return 'upgrade';
        if (/kb\d+/i.test(s) || s.includes('hotfix') || s.includes('apply patch')) return 'patch';
        if (s.includes('configure') || s.includes('disable') || s.includes('enable') || s.includes('harden') || s.includes('set ')) return 'configure';
        if (s.includes('remove') || s.includes('uninstall')) return 'remove';
        if (s.includes('workaround') || s.includes('mitigat')) return 'workaround';
        if (s.includes('patch') || s.includes('install')) return 'patch';
        return 'other';
    }

    extractTargetKey(solution, title, finding) {
        // Extract version/KB and use it as targetKey
        const rawVersion = this.extractTargetVersion(solution);
        const truncatedVersion = rawVersion ? this.truncateVersion(rawVersion) : null;
        
        // If we have a version, use it
        if (truncatedVersion) {
            return truncatedVersion;
        }
        
        // Otherwise, normalize the solution text for hashing
        return this.normalizeForHash(solution);
    }
    
    extractTargetVersion(solution) {
        if (!solution) return null;
        // Priority 1: KB number
        const kb = solution.match(/KB(\d+)/i);
        if (kb) return 'kb' + kb[1];
        // Priority 2: Patch month
        const monthYear = solution.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
        if (monthYear) return monthYear[1].toLowerCase() + '_' + monthYear[2];
        // Priority 3: Version from upgrade/update/install context
        const ver = solution.match(/(?:upgrade|update|install)\s+(?:to\s+)?(?:version\s+)?(?:[a-zA-Z\s]+\s+)?(\d+(?:\.\d+)+)/i);
        if (ver) return ver[1];
        // Priority 4: Standalone version with "or later/higher"
        const standaloneVer = solution.match(/(\d+\.\d+(?:\.\d+)*)\s+or\s+(?:later|higher|above|newer)/i);
        if (standaloneVer) return standaloneVer[1];
        return null;
    }
    
    truncateVersion(version) {
        if (!version) return null;
        // KB numbers and patch months — keep as-is
        if (version.startsWith('kb') || version.includes('_')) return version;
        const parts = version.split('.');
        // 2-part versions (e.g. 9.5, 115.18) — keep as-is
        if (parts.length <= 2) return version;
        // 3+ part versions — truncate to major.minor
        return parts.slice(0, 2).join('.');
    }
    
    normalizeForHash(solution) {
        if (!solution) return 'no_solution';
        let n = solution.toLowerCase()
            .replace(/please\s+/g, '').replace(/kindly\s+/g, '')
            .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
            .substring(0, 60);
        let hash = 0;
        for (let i = 0; i < n.length; i++) {
            hash = ((hash << 5) - hash) + n.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).substring(0, 6) + '_' + n.substring(0, 20).replace(/\s+/g, '_');
    }

    extractAssetClass(finding) {
        const os = (finding.operatingSystem || finding.asset?.operatingSystem || finding.os || '').toLowerCase();
        
        if (!os) return 'general';
        if (os.includes('server')) return 'server';
        if (os.includes('windows 10') || os.includes('windows 11') || os.includes('workstation') || os.includes('macos') || os.includes('mac os')) return 'endpoint';
        if (os.includes('cisco') || os.includes('juniper') || os.includes('fortinet') || os.includes('palo alto') || os.includes('network')) return 'network';
        if (os.includes('linux') || os.includes('rhel') || os.includes('centos') || os.includes('ubuntu') || os.includes('debian') || os.includes('suse') || os.includes('red hat')) return 'server';
        if (os.includes('windows')) return 'endpoint';
        
        return 'general';
    }
    
    extractProduct(title) {
        if (!title) return '';
        const lower = title.toLowerCase();
        // Known product patterns
        if (lower.includes('chrome') || lower.includes('chromium')) return 'chrome';
        if (lower.includes('firefox')) return 'firefox';
        if (lower.includes('edge')) return 'edge';
        if (lower.includes('windows')) return 'windows';
        if (lower.includes('apache') && lower.includes('tomcat')) return 'tomcat';
        if (lower.includes('apache')) return 'apache';
        if (lower.includes('nginx')) return 'nginx';
        if (lower.includes('openssh') || lower.includes('ssh')) return 'openssh';
        if (lower.includes('openssl') || lower.includes('ssl')) return 'openssl';
        if (lower.includes('mysql')) return 'mysql';
        if (lower.includes('postgresql')) return 'postgresql';
        if (lower.includes('java')) return 'java';
        if (lower.includes('python')) return 'python';
        if (lower.includes('php')) return 'php';
        if (lower.includes('cisco')) return 'cisco';
        if (lower.includes('oracle')) return 'oracle';
        // Fallback: first word of title
        const words = title.split(/[\s\-:]/);
        return words[0] ? words[0].toLowerCase() : 'unknown';
    }
    
    extractVendor(title, solution) {
        const text = ((title || '') + ' ' + (solution || '')).toLowerCase();
        if (text.includes('microsoft') || text.includes('windows')) return 'Microsoft';
        if (text.includes('mozilla') || text.includes('firefox')) return 'Mozilla';
        if (text.includes('google') || text.includes('chrome') || text.includes('chromium')) return 'Google';
        if (text.includes('oracle') || text.includes('java se')) return 'Oracle';
        if (text.includes('apache')) return 'Apache';
        if (text.includes('cisco')) return 'Cisco';
        if (text.includes('redhat') || text.includes('red hat')) return 'Red Hat';
        if (text.includes('canonical') || text.includes('ubuntu')) return 'Canonical';
        if (text.includes('vmware')) return 'VMware';
        return '';
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
