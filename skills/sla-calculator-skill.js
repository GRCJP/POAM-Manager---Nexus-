/**
 * SLA Calculator Skill
 * 
 * Responsibilities:
 * - Calculate SLA breach status for findings
 * - Parse and normalize detection dates
 * - Determine breach dates based on severity
 * - Track finding age and lifecycle
 */

class SLACalculatorSkill extends BaseSkill {
    constructor(config = {}) {
        super('SLACalculatorSkill', config);
        
        // Default SLA configuration (days)
        this.slaConfig = config.slaConfig || {
            critical: 15,
            high: 30,
            medium: 90,
            low: 180
        };
    }

    async run(input) {
        const { findings } = input;
        
        console.log(`\n📅 SLA CALCULATOR SKILL: Processing ${findings.length} findings`);
        
        const now = new Date();
        let nullFirstDetected = 0;
        let nullLastDetected = 0;
        let breachedCount = 0;
        let withinSLACount = 0;
        
        const enrichedFindings = findings.map((finding, idx) => {
            const firstDetected = this.parseDate(finding.firstDetected);
            const lastDetected = this.parseDate(finding.lastDetected);
            const severity = this.normalizeSeverity(finding.severity);
            
            if (!firstDetected) nullFirstDetected++;
            if (!lastDetected) nullLastDetected++;
            
            // Calculate age in days
            const ageDays = firstDetected ? this.daysBetween(firstDetected, now) : 0;
            
            // Get SLA days for this severity
            const slaDays = this.slaConfig[severity] || this.slaConfig.medium;
            
            // Normalize status - if no status field, default to 'ACTIVE' for eligible findings
            // (Phase 1 already filtered out inactive statuses)
            const rawStatus = finding.status || finding.Status || '';
            const statusUpper = rawStatus ? rawStatus.toUpperCase() : 'ACTIVE';
            const INACTIVE_STATUSES = ['FIXED', 'CLOSED', 'RESOLVED', 'IGNORED', 'DISABLED', 'NOT_APPLICABLE'];
            const isActiveStatus = !INACTIVE_STATUSES.includes(statusUpper);
            
            // Determine if breached
            const breached = isActiveStatus && (
                firstDetected === null ? true : ageDays > slaDays
            );
            
            if (breached) breachedCount++;
            else if (isActiveStatus) withinSLACount++;
            
            // Calculate breach date
            const breachDate = firstDetected ? 
                this.addDays(firstDetected, slaDays) : null;
            
            // Log first 3 for diagnostics
            if (idx < 3) {
                console.log(`   Finding ${idx + 1}:`);
                console.log(`      Raw firstDetected: ${finding.firstDetected}`);
                console.log(`      Parsed: ${firstDetected}`);
                console.log(`      Age: ${ageDays} days, SLA: ${slaDays} days`);
                console.log(`      Breached: ${breached}`);
            }
            
            return {
                ...finding,
                sla: {
                    severity,
                    slaDays,
                    ageDays,
                    breached,
                    breachDate: breachDate ? breachDate.toISOString().split('T')[0] : null,
                    firstDetected: firstDetected ? firstDetected.toISOString().split('T')[0] : null,
                    lastDetected: lastDetected ? lastDetected.toISOString().split('T')[0] : null,
                    status: statusUpper
                }
            };
        });
        
        console.log(`\n   📊 SLA CALCULATION RESULTS:`);
        console.log(`      ✅ Findings with dates: ${findings.length - nullFirstDetected}`);
        console.log(`      ⚠️  Missing firstDetected: ${nullFirstDetected}`);
        console.log(`      ⚠️  Missing lastDetected: ${nullLastDetected}`);
        console.log(`      🔴 Breached: ${breachedCount}`);
        console.log(`      🟢 Within SLA: ${withinSLACount}`);
        
        return {
            findings: enrichedFindings,
            summary: {
                total: findings.length,
                breached: breachedCount,
                withinSLA: withinSLACount,
                missingDates: nullFirstDetected,
                breachRate: ((breachedCount / findings.length) * 100).toFixed(2) + '%'
            }
        };
    }

    parseDate(dateString) {
        if (!dateString) return null;
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
    }

    normalizeSeverity(severity) {
        if (!severity) return 'medium';
        
        const sev = severity.toString().toLowerCase().trim();
        
        // Numeric severity (1-5)
        if (/^[1-5]$/.test(sev)) {
            const num = parseInt(sev);
            if (num <= 2) return 'low';
            if (num === 3) return 'medium';
            if (num === 4) return 'high';
            if (num === 5) return 'critical';
        }
        
        // Text severity
        if (sev.includes('crit')) return 'critical';
        if (sev.includes('high')) return 'high';
        if (sev.includes('med') || sev.includes('mod')) return 'medium';
        if (sev.includes('low')) return 'low';
        
        return 'medium';
    }

    daysBetween(date1, date2) {
        const msPerDay = 1000 * 60 * 60 * 24;
        const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
        const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
        return Math.floor((utc2 - utc1) / msPerDay);
    }

    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    async validate(data, type) {
        if (type === 'input') {
            const errors = [];
            if (!data.findings || !Array.isArray(data.findings)) {
                errors.push('findings must be an array');
            }
            return { valid: errors.length === 0, errors };
        }

        if (type === 'output') {
            const errors = [];
            if (!data.findings || !Array.isArray(data.findings)) {
                errors.push('findings must be an array');
            }
            if (!data.summary) {
                errors.push('summary is required');
            }
            // Validate all findings have SLA data
            const missingSLA = data.findings.filter(f => !f.sla);
            if (missingSLA.length > 0) {
                errors.push(`${missingSLA.length} findings missing SLA data`);
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
                name: 'Calculate SLA for breached high severity finding',
                input: {
                    findings: [{
                        title: 'Test Vuln',
                        severity: 'high',
                        status: 'Active',
                        firstDetected: oldDate.toISOString()
                    }]
                },
                validate: (result) => {
                    return result.success && 
                           result.data.findings[0].sla.breached === true &&
                           result.data.summary.breached === 1;
                }
            },
            {
                name: 'Calculate SLA for within-SLA medium severity finding',
                input: {
                    findings: [{
                        title: 'Test Vuln',
                        severity: 'medium',
                        status: 'Active',
                        firstDetected: oldDate.toISOString()
                    }]
                },
                validate: (result) => {
                    return result.success && 
                           result.data.findings[0].sla.breached === false &&
                           result.data.summary.withinSLA === 1;
                }
            }
        ];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SLACalculatorSkill;
}
