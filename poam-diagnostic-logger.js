/**
 * TRACE Diagnostic Logger
 * Comprehensive system check to identify all issues
 */

class POAMDiagnosticLogger {
    constructor() {
        this.issues = [];
        this.warnings = [];
        this.checks = [];
        this.startTime = Date.now();
    }

    async runFullDiagnostic() {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔍 POAM NEXUS COMPREHENSIVE DIAGNOSTIC');
        console.log('═══════════════════════════════════════════════════════════\n');

        // 1. Database Check
        await this.checkDatabase();

        // 2. Pipeline Components Check
        await this.checkPipelineComponents();

        // 3. Skills Architecture Check
        await this.checkSkillsArchitecture();

        // 4. CSV Processing Check
        await this.checkCSVProcessing();

        // 5. POAM Creation Check
        await this.checkPOAMCreation();

        // 6. UI Components Check
        await this.checkUIComponents();

        // 7. Missing Fields Analysis
        await this.analyzeDataQuality();

        // Report
        this.generateReport();
    }

    async checkDatabase() {
        console.log('\n📦 CHECKING DATABASE...');
        this.checks.push({ category: 'Database', name: 'Database Initialization' });

        if (!window.poamDB) {
            this.issues.push({
                severity: 'CRITICAL',
                category: 'Database',
                issue: 'poamDB not available in global scope',
                impact: 'Cannot save or retrieve POAMs',
                fix: 'Check poam-database.js is loaded before other modules'
            });
            return;
        }

        try {
            const poams = await window.poamDB.getAllPOAMs();
            console.log(`  ✅ Database accessible, ${poams.length} POAMs found`);
            this.checks.push({ category: 'Database', name: 'POAM Count', value: poams.length });

            // Check for data quality issues
            if (poams.length > 0) {
                const sample = poams[0];
                const requiredFields = ['id', 'title', 'status', 'affectedAssets'];
                const missingFields = requiredFields.filter(f => !sample[f]);
                
                if (missingFields.length > 0) {
                    this.warnings.push({
                        severity: 'WARNING',
                        category: 'Database',
                        issue: `Sample POAM missing fields: ${missingFields.join(', ')}`,
                        impact: 'UI may not display correctly'
                    });
                }
            }
        } catch (err) {
            this.issues.push({
                severity: 'CRITICAL',
                category: 'Database',
                issue: `Database error: ${err.message}`,
                impact: 'Cannot access stored POAMs'
            });
        }

        // Check scan runs
        try {
            const scanRuns = await window.poamDB.getAllScanRuns?.() || [];
            this.checks.push({ category: 'Database', name: 'Scan Runs', value: scanRuns.length });
        } catch (err) {
            this.warnings.push({
                severity: 'WARNING',
                category: 'Database',
                issue: 'Cannot retrieve scan runs',
                impact: 'Dashboard metrics may be incomplete'
            });
        }
    }

    async checkPipelineComponents() {
        console.log('\n🔧 CHECKING PIPELINE COMPONENTS...');
        
        const components = [
            { name: 'PipelineOrchestrator', global: 'PipelineOrchestrator' },
            { name: 'PipelineDatabase', global: 'PipelineDatabase' },
            { name: 'PipelineLogger', global: 'PipelineLogger' },
            { name: 'VulnerabilityAnalysisEngineV3', global: 'VulnerabilityAnalysisEngineV3' }
        ];

        for (const comp of components) {
            if (window[comp.global]) {
                console.log(`  ✅ ${comp.name}`);
                this.checks.push({ category: 'Pipeline', name: comp.name, status: 'OK' });
            } else {
                this.issues.push({
                    severity: 'CRITICAL',
                    category: 'Pipeline',
                    issue: `${comp.name} not loaded`,
                    impact: 'Pipeline cannot function'
                });
            }
        }

        // Check feature flag
        if (typeof window.USE_SKILLS_ARCHITECTURE !== 'undefined') {
            this.checks.push({ 
                category: 'Pipeline', 
                name: 'Skills Architecture', 
                value: window.USE_SKILLS_ARCHITECTURE ? 'ENABLED' : 'DISABLED'
            });
        }
    }

    async checkSkillsArchitecture() {
        console.log('\n🎯 CHECKING SKILLS ARCHITECTURE...');
        
        const skills = [
            'BaseSkill', 'CSVParserSkill', 'SLACalculatorSkill', 
            'ClassificationSkill', 'GroupingSkill', 'SkillOrchestrator'
        ];

        for (const skill of skills) {
            if (window[skill]) {
                console.log(`  ✅ ${skill}`);
                this.checks.push({ category: 'Skills', name: skill, status: 'OK' });
            } else {
                this.warnings.push({
                    severity: 'WARNING',
                    category: 'Skills',
                    issue: `${skill} not loaded`,
                    impact: 'Skills architecture incomplete (falling back to legacy)'
                });
            }
        }
    }

    async checkCSVProcessing() {
        console.log('\n📄 CHECKING CSV PROCESSING...');
        
        // Check CSV parsing functions
        const csvFunctions = ['processLocalCSV', 'parseCSV', 'detectCSVFormat'];
        for (const fn of csvFunctions) {
            if (typeof window[fn] === 'function') {
                this.checks.push({ category: 'CSV', name: fn, status: 'OK' });
            } else {
                this.warnings.push({
                    severity: 'WARNING',
                    category: 'CSV',
                    issue: `Function ${fn} not available`,
                    impact: 'CSV upload may fail'
                });
            }
        }
    }

    async checkPOAMCreation() {
        console.log('\n📋 CHECKING POAM CREATION PIPELINE...');
        
        // Check key functions
        const poamFunctions = [
            'buildPOAMsWithSLAGating',
            'analyzeGroupBreach',
            'calculateSLAStatus',
            'classifyRemediation',
            'groupByRemediationSignature'
        ];

        for (const fn of poamFunctions) {
            if (typeof window[fn] === 'function' || 
                (window.VulnerabilityAnalysisEngineV3?.prototype?.[fn])) {
                this.checks.push({ category: 'POAM Creation', name: fn, status: 'OK' });
            } else {
                this.issues.push({
                    severity: 'CRITICAL',
                    category: 'POAM Creation',
                    issue: `Function ${fn} not available`,
                    impact: 'Cannot create POAMs from findings'
                });
            }
        }
    }

    async checkUIComponents() {
        console.log('\n🖥️ CHECKING UI COMPONENTS...');
        
        // Check key DOM elements
        const elements = [
            'vulnerability-poam-list',
            'dashboard-module',
            'security-posture-overview'
        ];

        for (const id of elements) {
            const el = document.getElementById(id);
            if (el) {
                this.checks.push({ category: 'UI', name: `Element #${id}`, status: 'OK' });
            } else {
                this.warnings.push({
                    severity: 'WARNING',
                    category: 'UI',
                    issue: `Element #${id} not found`,
                    impact: 'UI may not render correctly'
                });
            }
        }

        // Check key functions
        const uiFunctions = [
            'displayVulnerabilityPOAMs',
            'loadDashboardMetrics',
            'updateVulnerabilityModuleMetrics',
            'showModule'
        ];

        for (const fn of uiFunctions) {
            if (typeof window[fn] === 'function') {
                this.checks.push({ category: 'UI', name: fn, status: 'OK' });
            } else {
                this.warnings.push({
                    severity: 'WARNING',
                    category: 'UI',
                    issue: `Function ${fn} not available`,
                    impact: 'UI functionality may be limited'
                });
            }
        }
    }

    async analyzeDataQuality() {
        console.log('\n📊 ANALYZING DATA QUALITY PATTERNS...');
        
        // Check for common data issues
        this.checks.push({ 
            category: 'Data Quality', 
            name: 'SLA Config', 
            value: window.SLA_DAYS || 'Not defined'
        });

        // Check for recent errors in console (if accessible)
        console.log('  📌 Common issues to check:');
        console.log('     - firstDetected dates null/missing');
        console.log('     - Groups created but all skipped');
        console.log('     - SLA gating too aggressive');
        console.log('     - Missing remediation metadata');
    }

    generateReport() {
        const duration = Date.now() - this.startTime;
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📋 DIAGNOSTIC REPORT');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`\nDuration: ${duration}ms`);
        console.log(`Checks performed: ${this.checks.length}`);
        console.log(`Issues found: ${this.issues.length}`);
        console.log(`Warnings: ${this.warnings.length}\n`);

        // Critical Issues
        if (this.issues.length > 0) {
            console.log('🔴 CRITICAL ISSUES (Must Fix):');
            console.log('─'.repeat(60));
            this.issues.forEach((issue, i) => {
                console.log(`\n${i + 1}. [${issue.category}] ${issue.issue}`);
                console.log(`   Impact: ${issue.impact}`);
                if (issue.fix) console.log(`   Fix: ${issue.fix}`);
            });
        }

        // Warnings
        if (this.warnings.length > 0) {
            console.log('\n\n🟡 WARNINGS (Should Address):');
            console.log('─'.repeat(60));
            this.warnings.forEach((warn, i) => {
                console.log(`\n${i + 1}. [${warn.category}] ${warn.issue}`);
                console.log(`   Impact: ${warn.impact}`);
            });
        }

        // Summary by Category
        console.log('\n\n📊 COMPONENT STATUS SUMMARY:');
        console.log('─'.repeat(60));
        const categories = [...new Set(this.checks.map(c => c.category))];
        categories.forEach(cat => {
            const checks = this.checks.filter(c => c.category === cat);
            const ok = checks.filter(c => c.status === 'OK').length;
            const total = checks.length;
            console.log(`  ${cat}: ${ok}/${total} OK`);
        });

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✅ DIAGNOSTIC COMPLETE');
        console.log('═══════════════════════════════════════════════════════════\n');

        // Save report for later access
        window.lastDiagnosticReport = {
            timestamp: new Date().toISOString(),
            duration,
            checks: this.checks,
            issues: this.issues,
            warnings: this.warnings,
            summary: {
                totalChecks: this.checks.length,
                criticalIssues: this.issues.length,
                warnings: this.warnings.length
            }
        };

        return window.lastDiagnosticReport;
    }
}

// Create global instance
window.poamDiagnostics = new POAMDiagnosticLogger();

console.log('✅ Diagnostic Logger loaded. Run with: await window.poamDiagnostics.runFullDiagnostic()');
