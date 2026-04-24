/**
 * Classification Skill
 * 
 * Classifies remediation strategies for each finding.
 * Adds remediation metadata object to each finding.
 * Must run AFTER SLA calculation and BEFORE grouping.
 */

class ClassificationSkill extends BaseSkill {
    constructor() {
        super('classification', 'Classify remediation strategies for findings');
    }

    async run(input) {
        const { findings } = input;
        
        console.log(`\n🏷️  CLASSIFICATION SKILL: Processing ${findings.length} findings`);
        
        // Debug: Check first finding to see what fields are available
        if (findings.length > 0) {
            const sample = findings[0];
            console.log(`   📋 Sample finding fields:`, Object.keys(sample).join(', '));
            console.log(`   📋 Sample solution:`, sample.solution?.substring(0, 100) || 'MISSING');
            console.log(`   📋 Sample title:`, sample.title?.substring(0, 100) || 'MISSING');
        }
        
        const classified = findings.map(f => {
            const solution = f.solution || '';
            const title = f.title || '';
            const description = f.description || '';
            const os = f.operatingSystem || f.asset?.operatingSystem || f.os || '';

            // Generic extraction from raw data columns
            const actionType = this.extractActionType(solution);
            const rawVersion = this.extractTargetVersion(solution);
            const fixedTarget = rawVersion || '';
            const truncatedVersion = rawVersion ? this.truncateVersion(rawVersion) : null;
            // Try to extract component from description (Wiz file-level findings)
            // before falling back to title-based extraction
            const componentFromDesc = this.extractComponentFromDescription(description);
            const component = componentFromDesc || this.genericExtractProduct(title);
            const vendor = this.genericExtractVendor(title, solution);
            const patchDate = this.extractPatchMonth(solution);
            const actionText = solution || title || '';
            const assetClass = this.deriveAssetClass(os);

            // Build targetKey for grouping.
            // Wiz findings have a wizComponent field (from DetailedName) that
            // identifies the software component (e.g., "Windows Server 2016",
            // "Google Chrome", "vim"). ALL CVEs for the same component should
            // group into ONE POAM. The POAM remediation will reference the
            // highest fix version.
            const wizComponent = f.wizComponent || '';
            let targetKey;
            if (wizComponent) {
                // Wiz finding: group by normalized component name.
                // Strip common Linux package suffixes so related sub-packages
                // (ncurses, ncurses-libs, ncurses-base) collapse into one group.
                targetKey = this.normalizeWizComponent(wizComponent);
            } else if (componentFromDesc) {
                // Wiz file-level description pattern
                targetKey = componentFromDesc;
            } else if (truncatedVersion) {
                targetKey = truncatedVersion;
            } else if (patchDate) {
                targetKey = patchDate;
            } else if (this.isPackageLevelRemediation(solution)) {
                targetKey = component || this.normalizeForHash(title);
            } else if (solution && solution.length > 10 && solution.toLowerCase() !== 'no remediation available') {
                targetKey = this.normalizeForHash(solution);
            } else if (component) {
                targetKey = component;
            } else {
                targetKey = this.normalizeForHash(title || solution);
            }

            // Determine targeting strategy
            const targetingStrategy = (rawVersion || patchDate) ? 'version' : 'asset';

            // For Wiz findings, use a consistent actionType so that all CVEs
            // for the same component collapse into one POAM regardless of
            // whether Remediation text says "Update", "Patch", or is empty.
            const effectiveActionType = wizComponent ? 'upgrade' : actionType;

            // Map actionType to legacy remediationType for downstream compat
            let remediationType = effectiveActionType;
            if (effectiveActionType === 'upgrade') remediationType = 'patch_update';
            else if (effectiveActionType === 'patch') remediationType = 'patch_update';
            else if (effectiveActionType === 'configure') remediationType = 'config_change';
            else if (effectiveActionType === 'remove') remediationType = 'removal';
            else if (effectiveActionType === 'workaround') remediationType = 'operational_mitigation';
            else remediationType = 'operational_mitigation';

            return {
                ...f,
                remediation: {
                    remediationType,
                    actionType: effectiveActionType,
                    component,
                    platform: assetClass,
                    targetingStrategy,
                    fixedTarget,
                    fixedTargetKey: component ? `${component}:${fixedTarget}` : fixedTarget,
                    actionText,
                    vendor,
                    patchDate,
                    targetKey,
                    assetClass
                }
            };
        });
        
        console.log(`\n   📊 CLASSIFICATION RESULTS:`);
        console.log(`      ✅ Findings classified: ${classified.length}`);
        console.log(`      📦 Sample remediation:`, classified[0]?.remediation);
        
        return { findings: classified };
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

    extractPatchMonth(solution) {
        if (!solution) return null;
        const monthYear = solution.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
        return monthYear ? monthYear[1].toLowerCase() + '_' + monthYear[2] : null;
    }

    /**
     * Extract software component from Wiz-style description fields.
     * Pattern: File `C:\...\vim.exe` version `8.2.2859` is vulnerable to ...
     * Returns the filename without extension as the component (e.g., "vim").
     * Also handles Linux paths: File `/usr/lib64/libssl.so.1.1` ...
     */
    extractComponentFromDescription(description) {
        if (!description) return '';
        // Match: File `<path>` version `<ver>` — extract the filename
        const fileMatch = description.match(/File\s+`([^`]+)`\s+version/i);
        if (fileMatch) {
            const fullPath = fileMatch[1];
            // Extract filename from path (handles both \ and /)
            const parts = fullPath.split(/[\\\/]/);
            const filename = parts[parts.length - 1] || '';
            // Strip extension and version suffixes for cleaner grouping
            // e.g., "libssl-1_1.dll" → "libssl", "vim.exe" → "vim"
            const cleaned = filename
                .replace(/\.(dll|exe|so|dylib|jar|py|rb|pl|sh)(\.\d+)*$/i, '')
                .replace(/[-_]\d+.*$/, '') // strip version suffixes like -1_1
                .toLowerCase();
            return cleaned || filename.toLowerCase();
        }
        return '';
    }

    /**
     * Detect package-level remediation commands (yum update X, apt-get install X, pip install X).
     * These should group by vulnerability, not by package name.
     */
    isPackageLevelRemediation(solution) {
        if (!solution) return false;
        const s = solution.toLowerCase().trim();
        return /^(yum|dnf|apt-get|apt|pip|pip3|npm|gem|apk)\s+(update|install|upgrade)\s+\S+$/i.test(s);
    }

    /**
     * Normalize Wiz DetailedName (wizComponent) so related sub-packages
     * collapse into one group. Examples:
     *   ncurses-libs  → ncurses
     *   ncurses-base  → ncurses
     *   dbus-libs     → dbus
     *   vim-minimal   → vim
     * Windows names pass through unchanged.
     */
    normalizeWizComponent(name) {
        if (!name) return 'unknown';
        let n = name.toLowerCase().trim();
        // Don't strip suffixes from multi-word product names (Windows Server 2016, MySQL Workbench)
        if (n.includes(' ')) return n;
        // For single-word hyphenated names (RPM sub-packages like vim-minimal,
        // vim-enhanced, ncurses-libs, dbus-glib), take just the base name
        // before the first hyphen if it's 3+ chars. This collapses all
        // sub-packages into one POAM (e.g., vim-minimal + vim-enhanced → vim).
        const hyphenIdx = n.indexOf('-');
        if (hyphenIdx >= 3) {
            return n.substring(0, hyphenIdx);
        }
        return n;
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

    deriveAssetClass(os) {
        if (!os) return 'general';
        const o = os.toLowerCase();
        if (o.includes('server')) return 'server';
        if (o.includes('windows 10') || o.includes('windows 11') || o.includes('workstation') || o.includes('macos') || o.includes('mac os')) return 'endpoint';
        if (o.includes('cisco') || o.includes('juniper') || o.includes('fortinet') || o.includes('palo alto') || o.includes('network')) return 'network';
        if (o.includes('linux') || o.includes('rhel') || o.includes('centos') || o.includes('ubuntu') || o.includes('debian') || o.includes('suse') || o.includes('red hat')) return 'server';
        if (o.includes('windows')) return 'endpoint';
        return 'general';
    }

    genericExtractProduct(title) {
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
        // Wiz/CVE-titled findings: use full CVE ID as component (e.g. "CVE-2022-4304")
        const cveMatch = title.match(/^(CVE-\d{4}-\d+)$/i);
        if (cveMatch) return cveMatch[1].toUpperCase();
        // Fallback: first word of title (but not if it's just "CVE")
        const words = title.split(/[\s\-:]/);
        const firstWord = words[0] ? words[0].toLowerCase() : 'unknown';
        if (firstWord === 'cve') return title.trim();
        return firstWord;
    }

    genericExtractVendor(title, solution) {
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

    async test() {
        const testFindings = [
            {
                title: 'Microsoft Windows KB5068781 Security Update',
                solution: 'Install KB5068781',
                operatingSystem: 'Windows Server 2019',
                sla: { breached: true }
            }
        ];
        
        const result = await this.execute({ findings: testFindings });
        
        const tests = [
            {
                name: 'Adds remediation object',
                pass: result.data.findings[0].remediation !== undefined
            },
            {
                name: 'Extracts KB number',
                pass: result.data.findings[0].remediation.targetKey === 'kb5068781'
            },
            {
                name: 'Identifies patch action',
                pass: result.data.findings[0].remediation.actionType === 'patch'
            },
            {
                name: 'Classifies as server',
                pass: result.data.findings[0].remediation.assetClass === 'server'
            }
        ];
        
        return tests;
    }
}

console.log('✅ ClassificationSkill loaded');
