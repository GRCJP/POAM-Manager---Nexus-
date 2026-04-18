// ═══════════════════════════════════════════════════════════════
// TRACE — Mock POA&M Workbook Seeder
// Generates realistic mock POA&Ms per system tied to NIST 800-53
// controls so the workbook has something meaningful on first load.
//
// Trigger: global function `seedMockPOAMs()` from console or a
// button. Idempotent — if systems/items already exist, it short-
// circuits unless forced via `seedMockPOAMs({ force: true })`.
// ═══════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const MOCK_SYSTEMS = [
        {
            id: 'sys-enclave-alpha',
            name: 'Enclave Alpha',
            description: 'Primary production enclave — customer-facing web tier',
            fismaLevel: 'High',
            owner: 'J. Martinez',
            environment: 'production'
        },
        {
            id: 'sys-finance-core',
            name: 'Financial Core',
            description: 'GL, AP/AR, and treasury processing',
            fismaLevel: 'High',
            owner: 'A. Patel',
            environment: 'production'
        },
        {
            id: 'sys-hr-platform',
            name: 'HR Platform',
            description: 'Personnel, payroll, benefits',
            fismaLevel: 'Moderate',
            owner: 'K. Wong',
            environment: 'production'
        },
        {
            id: 'sys-identity-services',
            name: 'Identity Services',
            description: 'AD, SSO, PKI, and federation',
            fismaLevel: 'High',
            owner: 'S. Okafor',
            environment: 'production'
        },
        {
            id: 'sys-data-warehouse',
            name: 'Data Warehouse',
            description: 'Analytics and reporting data lake',
            fismaLevel: 'Moderate',
            owner: 'R. Chen',
            environment: 'production'
        },
        {
            id: 'sys-dev-sandbox',
            name: 'Dev Sandbox',
            description: 'Non-production development environment',
            fismaLevel: 'Low',
            owner: 'T. Brown',
            environment: 'development'
        }
    ];

    // NIST 800-53 control families and sample realistic findings per family
    const CONTROL_TEMPLATES = [
        {
            control: 'AC-2',
            family: 'AC',
            title: 'Inactive Privileged Accounts Not Disabled Within Policy Window',
            description: 'Review of privileged account inventory identified accounts with no login activity exceeding the 90-day dormancy threshold. These accounts must be disabled per organization access control policy.',
            severity: 'High',
            mitigation: 'Implement automated account lifecycle workflow to disable inactive privileged accounts after 90 days. Require manager reaffirmation for reactivation.',
            source: 'Assessment'
        },
        {
            control: 'AC-6',
            family: 'AC',
            title: 'Excessive Administrative Privileges on Shared Workstations',
            description: 'Local administrator rights granted to standard user accounts on 14 shared workstations without documented business justification, violating least privilege principle.',
            severity: 'Medium',
            mitigation: 'Remove local admin rights, implement PAM solution for privilege elevation with approval workflow and session recording.',
            source: 'Internal Audit'
        },
        {
            control: 'AU-6',
            family: 'AU',
            title: 'Audit Log Review Not Performed on Required Cadence',
            description: 'SOC team has not conducted weekly review of privileged access audit logs for the past 6 weeks. AU-6 requires documented review cadence.',
            severity: 'Medium',
            mitigation: 'Deploy SIEM correlation rules for automated alerting and formalize weekly log review SOP with audit trail.',
            source: 'Assessment'
        },
        {
            control: 'CM-3',
            family: 'CM',
            title: 'Configuration Changes Deployed Outside Change Control',
            description: 'Three emergency firewall rule changes were applied in the last quarter without corresponding change request tickets, breaking CM-3 controlled configuration change requirements.',
            severity: 'High',
            mitigation: 'Enforce pre-change ticket validation gate in deployment pipeline. Implement compensating detective controls for emergency changes.',
            source: 'Internal Audit'
        },
        {
            control: 'CM-6',
            family: 'CM',
            title: 'Baseline Configuration Drift on Production Servers',
            description: 'Configuration compliance scan identified 23 servers with drift from approved STIG baseline. Drift includes weakened password policies and disabled host firewalls.',
            severity: 'High',
            mitigation: 'Remediate drift via configuration management. Schedule weekly compliance scans and auto-remediation.',
            source: 'Automated Scan'
        },
        {
            control: 'IA-2',
            family: 'IA',
            title: 'Multi-Factor Authentication Not Enforced for Remote Access',
            description: 'VPN authentication path allows password-only login when certificate-based auth fails. IA-2 requires MFA for all remote privileged and non-privileged access.',
            severity: 'Critical',
            mitigation: 'Remove password-only fallback. Require FIDO2/smart card auth for all VPN sessions.',
            source: 'Penetration Test'
        },
        {
            control: 'IA-5',
            family: 'IA',
            title: 'Password Complexity Requirements Not Met on Legacy Systems',
            description: 'Two legacy application servers enforce only 8-character passwords without complexity. Policy requires 14-character complex passwords.',
            severity: 'Medium',
            mitigation: 'Upgrade legacy auth modules or migrate to centralized IdP. Apply compensating controls until migration complete.',
            source: 'Assessment'
        },
        {
            control: 'IR-4',
            family: 'IR',
            title: 'Incident Response Plan Not Tested Annually',
            description: 'IR-4 requires annual testing of incident response procedures. Last documented tabletop exercise was 16 months ago.',
            severity: 'Medium',
            mitigation: 'Schedule and conduct tabletop exercise this quarter. Establish recurring annual test cadence in compliance calendar.',
            source: 'Assessment'
        },
        {
            control: 'RA-5',
            family: 'RA',
            title: 'Vulnerability Scanning Not Performed on All In-Scope Assets',
            description: 'Scan coverage analysis shows 8% of in-scope assets have not been scanned in the last 30 days due to credentialed scan failures.',
            severity: 'Medium',
            mitigation: 'Fix credential rotation pipeline for scanner service accounts. Add alerting for scan coverage drops below 95%.',
            source: 'Automated Scan'
        },
        {
            control: 'SC-7',
            family: 'SC',
            title: 'Boundary Protection Ruleset Contains Overly Permissive Rules',
            description: 'Firewall policy review identified 12 rules allowing any-to-any traffic on non-standard ports. SC-7 requires deny-by-default boundary enforcement.',
            severity: 'High',
            mitigation: 'Replace permissive rules with least-privilege equivalents. Implement weekly rule audit and owner attestation.',
            source: 'Internal Audit'
        },
        {
            control: 'SC-8',
            family: 'SC',
            title: 'Unencrypted Internal Service-to-Service Communications',
            description: 'Three microservices communicate over HTTP within the cluster. SC-8 requires transmission confidentiality for all sensitive data, including internal traffic.',
            severity: 'High',
            mitigation: 'Enforce mTLS via service mesh. Rotate service certificates automatically.',
            source: 'Assessment'
        },
        {
            control: 'SI-2',
            family: 'SI',
            title: 'Critical Patches Exceed SLA Remediation Window',
            description: 'Eleven critical-severity patches identified in last scan cycle remain unremediated beyond 15-day SLA. Assets include internet-facing load balancers.',
            severity: 'Critical',
            mitigation: 'Emergency patching window scheduled. Implement exception workflow for patches blocked by application compatibility.',
            source: 'Automated Scan'
        },
        {
            control: 'SI-4',
            family: 'SI',
            title: 'Intrusion Detection Signatures Out of Date',
            description: 'IDS signature database last updated 22 days ago. Expected daily updates. Coverage gaps exist for recent CVEs.',
            severity: 'Medium',
            mitigation: 'Fix signature update pipeline. Add monitoring alert when update lag exceeds 48 hours.',
            source: 'Automated Scan'
        },
        {
            control: 'CP-9',
            family: 'CP',
            title: 'Backup Restoration Testing Incomplete',
            description: 'CP-9 requires periodic backup restore validation. Last successful full-system restore test was 11 months ago.',
            severity: 'Low',
            mitigation: 'Schedule quarterly restore tests. Automate test restoration into isolated environment.',
            source: 'Assessment'
        }
    ];

    const STATUS_DISTRIBUTION = [
        { status: 'Open', weight: 5 },
        { status: 'In Progress', weight: 3 },
        { status: 'Delayed', weight: 1 },
        { status: 'Risk Accepted', weight: 1 },
        { status: 'Completed', weight: 2 }
    ];

    function pickStatus() {
        const total = STATUS_DISTRIBUTION.reduce((a, b) => a + b.weight, 0);
        let r = Math.random() * total;
        for (const s of STATUS_DISTRIBUTION) {
            if ((r -= s.weight) <= 0) return s.status;
        }
        return 'Open';
    }

    function daysFromNow(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    }

    function pad(n, len) { return String(n).padStart(len, '0'); }

    function buildItem(systemId, systemName, index, template) {
        const itemNum = index + 1;
        const itemId = `POAM-${systemId.toUpperCase().replace('SYS-', '').substring(0, 6)}-${pad(itemNum, 4)}`;
        const status = pickStatus();
        const detectionOffset = -(30 + Math.floor(Math.random() * 180));
        const slaBase = { Critical: 15, High: 30, Medium: 90, Low: 180 }[template.severity] || 90;
        const scheduledOffset = detectionOffset + slaBase;

        const item = {
            id: `${systemId}-${itemId}`,
            systemId,
            systemName,
            'Item number': itemId,
            'Vulnerability Name': template.title,
            'Vulnerability Description': template.description,
            'Detection Date': daysFromNow(detectionOffset),
            'Impacted Security Controls': template.control,
            'Control Family': template.family,
            'Office/Org': systemName,
            'POC Name': 'TBD',
            'Identifying Detecting Source': template.source,
            'Mitigations': template.mitigation,
            'Severity Value': template.severity,
            'Resources Required': 'Internal staff',
            'Scheduled Completion Date': daysFromNow(scheduledOffset),
            'Milestone with Completion Dates': [
                `Analysis complete — ${daysFromNow(detectionOffset + 7)}`,
                `Remediation design — ${daysFromNow(detectionOffset + 14)}`,
                `Deployment — ${daysFromNow(scheduledOffset)}`
            ].join('\n'),
            'Milestone Changes': '',
            'Affected Components/URLs': systemName,
            'Status': status,
            'Comments': '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            source: 'mock-seeder'
        };

        if (status === 'Risk Accepted') {
            item['Risk Acceptance Date'] = daysFromNow(detectionOffset + 10);
            item['Risk Acceptance Rationale'] = 'Compensating controls in place; residual risk accepted by AO.';
        }
        if (status === 'Completed') {
            item['Actual Completion Date'] = daysFromNow(Math.min(-1, scheduledOffset - 5));
        }
        return item;
    }

    async function seedMockPOAMs(options = {}) {
        const force = options.force === true;
        if (!window.poamWorkbookDB) {
            console.error('[mock-seeder] poamWorkbookDB not initialized');
            return { error: 'DB unavailable' };
        }

        try {
            await window.poamWorkbookDB.init();
        } catch (e) {
            console.error('[mock-seeder] DB init failed:', e);
            return { error: e.message };
        }

        // Idempotency: if any items already exist and not forced, skip.
        try {
            const existingSystems = await window.poamWorkbookDB.getSystems();
            if (existingSystems && existingSystems.length > 0 && !force) {
                console.log(`[mock-seeder] ${existingSystems.length} systems already exist. Skipping. Use {force:true} to re-seed.`);
                return { skipped: true, systems: existingSystems.length };
            }
        } catch (e) {
            console.warn('[mock-seeder] getSystems failed, continuing:', e.message);
        }

        // Save systems
        let systemsAdded = 0;
        for (const sys of MOCK_SYSTEMS) {
            try {
                await window.poamWorkbookDB.saveSystem(sys);
                systemsAdded++;
            } catch (e) {
                console.warn(`[mock-seeder] saveSystem(${sys.id}) failed:`, e.message);
            }
        }

        // Save items per system
        let itemsAdded = 0;
        for (const sys of MOCK_SYSTEMS) {
            // Each system gets 8-12 randomly selected templates to keep variety
            const shuffled = [...CONTROL_TEMPLATES].sort(() => Math.random() - 0.5);
            const count = 8 + Math.floor(Math.random() * 5);
            const picks = shuffled.slice(0, count);
            for (let i = 0; i < picks.length; i++) {
                const item = buildItem(sys.id, sys.name, i, picks[i]);
                try {
                    await window.poamWorkbookDB.saveItem(item);
                    itemsAdded++;
                } catch (e) {
                    console.warn(`[mock-seeder] saveItem failed:`, e.message);
                }
            }
        }

        console.log(`[mock-seeder] ✅ Seeded ${systemsAdded} systems, ${itemsAdded} POA&Ms`);

        // Refresh the Workbook UI if it's visible
        try {
            if (typeof window.poamWorkbookRefreshSystems === 'function') {
                await window.poamWorkbookRefreshSystems();
            }
            if (typeof window.renderWorkbookSystemsTable === 'function') {
                window.renderWorkbookSystemsTable();
            }
        } catch (e) { /* non-fatal */ }

        return { systems: systemsAdded, items: itemsAdded };
    }

    window.seedMockPOAMs = seedMockPOAMs;
    console.log('[mock-seeder] Ready. Run seedMockPOAMs() in console to populate workbook.');
})();
