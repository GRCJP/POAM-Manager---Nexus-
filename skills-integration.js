/**
 * Skills Integration Layer
 * 
 * Bridges the new skills architecture with the existing pipeline.
 * Provides backward compatibility while enabling skills-based processing.
 */

console.log('🔌 skills-integration.js loading...');

// Feature flag - set to true to use skills architecture
// ENABLED: ClassificationSkill grouping logic fixed (targetKey now uses title/component)
window.USE_SKILLS_ARCHITECTURE = true;

class SkillsIntegration {
    constructor() {
        this.orchestrator = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        console.log('🎯 Initializing Skills Architecture...');

        // Create orchestrator
        this.orchestrator = new SkillOrchestrator();

        // Register skills
        this.orchestrator.registerSkill('parser', new CSVParserSkill());
        this.orchestrator.registerSkill('sla', new SLACalculatorSkill());
        this.orchestrator.registerSkill('classification', new ClassificationSkill());
        this.orchestrator.registerSkill('grouping', new GroupingSkill());

        // Define pipeline (matches original engine flow)
        this.orchestrator.definePipeline('scan-processing', [
            'parser',      // Parse CSV
            'sla',         // Calculate SLA status
            'classification', // Classify remediation strategies
            'grouping'     // Group by remediation signature
        ]);

        this.initialized = true;
        console.log('✅ Skills Architecture initialized');
    }

    /**
     * Process CSV data using skills pipeline
     * Compatible with existing pipeline interface
     */
    async processCSV(csvData, filename = 'scan.csv') {
        if (!this.initialized) await this.init();

        console.log(`\n🚀 Processing scan with Skills Architecture: ${filename}`);

        try {
            // Execute skills pipeline
            const result = await this.orchestrator.executePipeline('scan-processing', {
                csvData,
                format: 'qualys',
                filename
            });

            if (!result.success) {
                throw new Error(`Skills pipeline failed: ${result.execution.errors.join(', ')}`);
            }

            // Transform skills output to match existing pipeline format
            const { groups, summary } = result.data;

            console.log(`\n✅ Skills pipeline completed:`);
            console.log(`   Groups: ${summary.totalGroups}`);
            console.log(`   Findings: ${summary.totalFindings}`);
            console.log(`   Avg findings/group: ${summary.avgFindingsPerGroup}`);

            return {
                groups,
                findings: groups.flatMap(g => g.findings),
                metadata: {
                    filename,
                    processedAt: new Date().toISOString(),
                    skillsVersion: '1.0.0',
                    summary
                }
            };

        } catch (error) {
            console.error('❌ Skills pipeline error:', error);
            throw error;
        }
    }

    /**
     * Get performance metrics from skills
     */
    getMetrics() {
        if (!this.initialized) return null;
        return this.orchestrator.getAllMetrics();
    }

    /**
     * Generate performance report
     */
    generateReport() {
        if (!this.initialized) return;
        this.orchestrator.generateReport();
    }

    /**
     * Test all skills
     */
    async testSkills() {
        if (!this.initialized) await this.init();
        return await this.orchestrator.testAllSkills();
    }
}

// Global instance
window.skillsIntegration = new SkillsIntegration();

console.log('✅ skills-integration.js loaded');
