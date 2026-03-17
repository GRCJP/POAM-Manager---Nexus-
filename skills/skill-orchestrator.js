/**
 * Skill Orchestrator
 * 
 * Coordinates execution of multiple skills in a pipeline
 * Handles error recovery, metrics aggregation, and skill chaining
 */

class SkillOrchestrator {
    constructor() {
        this.skills = new Map();
        this.pipelines = new Map();
        this.executionHistory = [];
    }

    /**
     * Register a skill
     */
    registerSkill(name, skillInstance) {
        this.skills.set(name, skillInstance);
        console.log(`✅ Registered skill: ${name}`);
    }

    /**
     * Define a pipeline (sequence of skills)
     */
    definePipeline(name, skillSequence) {
        this.pipelines.set(name, skillSequence);
        console.log(`✅ Defined pipeline: ${name} (${skillSequence.length} skills)`);
    }

    /**
     * Execute a pipeline
     */
    async executePipeline(pipelineName, initialInput) {
        console.log(`\n🚀 EXECUTING PIPELINE: ${pipelineName}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        const pipeline = this.pipelines.get(pipelineName);
        if (!pipeline) {
            throw new Error(`Pipeline '${pipelineName}' not found`);
        }

        const execution = {
            pipelineName,
            startTime: new Date(),
            skills: [],
            success: false,
            finalOutput: null,
            errors: []
        };

        let currentData = initialInput;
        let allSucceeded = true;

        for (let i = 0; i < pipeline.length; i++) {
            const skillName = pipeline[i];
            const skill = this.skills.get(skillName);

            if (!skill) {
                const error = `Skill '${skillName}' not found`;
                execution.errors.push(error);
                allSucceeded = false;
                break;
            }

            console.log(`\n[${i + 1}/${pipeline.length}] Executing: ${skillName}`);
            console.log(`─────────────────────────────────────────────────────`);

            const result = await skill.execute(currentData);

            execution.skills.push({
                name: skillName,
                success: result.success,
                duration: result.metrics.duration,
                errors: result.errors
            });

            if (!result.success) {
                console.error(`❌ Pipeline failed at skill: ${skillName}`);
                execution.errors.push(...result.errors);
                allSucceeded = false;
                break;
            }

            // Pass output to next skill
            currentData = result.data;
        }

        execution.endTime = new Date();
        execution.duration = execution.endTime - execution.startTime;
        execution.success = allSucceeded;
        execution.finalOutput = allSucceeded ? currentData : null;

        this.executionHistory.push(execution);

        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`${allSucceeded ? '✅' : '❌'} PIPELINE ${allSucceeded ? 'COMPLETED' : 'FAILED'}: ${pipelineName}`);
        console.log(`   Duration: ${execution.duration}ms`);
        console.log(`   Skills executed: ${execution.skills.length}/${pipeline.length}`);
        if (!allSucceeded) {
            console.log(`   Errors: ${execution.errors.join(', ')}`);
        }
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        return {
            success: allSucceeded,
            data: execution.finalOutput,
            execution
        };
    }

    /**
     * Execute a single skill
     */
    async executeSkill(skillName, input) {
        const skill = this.skills.get(skillName);
        if (!skill) {
            throw new Error(`Skill '${skillName}' not found`);
        }
        return await skill.execute(input);
    }

    /**
     * Test all registered skills
     */
    async testAllSkills() {
        console.log(`\n🧪 TESTING ALL SKILLS`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        const results = [];

        for (const [name, skill] of this.skills) {
            console.log(`\nTesting: ${name}`);
            const testResult = await skill.test();
            results.push({
                skill: name,
                passed: testResult.passed,
                results: testResult.results
            });
        }

        const allPassed = results.every(r => r.passed);

        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`${allPassed ? '✅' : '❌'} ALL SKILLS ${allPassed ? 'PASSED' : 'FAILED'}`);
        results.forEach(r => {
            console.log(`   ${r.passed ? '✅' : '❌'} ${r.skill}`);
        });
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        return {
            allPassed,
            results
        };
    }

    /**
     * Get metrics for all skills
     */
    getAllMetrics() {
        const metrics = {};
        for (const [name, skill] of this.skills) {
            metrics[name] = skill.getMetrics();
        }
        return metrics;
    }

    /**
     * Get pipeline execution history
     */
    getExecutionHistory() {
        return this.executionHistory;
    }

    /**
     * Reset all skill metrics
     */
    resetAllMetrics() {
        for (const [name, skill] of this.skills) {
            skill.resetMetrics();
        }
        this.executionHistory = [];
        console.log('✅ Reset all skill metrics');
    }

    /**
     * Generate performance report
     */
    generateReport() {
        console.log(`\n📊 SKILL PERFORMANCE REPORT`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        const metrics = this.getAllMetrics();

        for (const [name, metric] of Object.entries(metrics)) {
            console.log(`\n${name}:`);
            console.log(`   Executions: ${metric.executionCount}`);
            console.log(`   Success Rate: ${metric.successRate}`);
            console.log(`   Avg Duration: ${metric.avgDuration.toFixed(2)}ms`);
            console.log(`   Total Duration: ${metric.totalDuration.toFixed(2)}ms`);
            if (metric.errors.length > 0) {
                console.log(`   Recent Errors: ${metric.errors.slice(-3).map(e => e.error).join(', ')}`);
            }
        }

        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        if (this.executionHistory.length > 0) {
            console.log(`\nPipeline Executions: ${this.executionHistory.length}`);
            const successfulPipelines = this.executionHistory.filter(e => e.success).length;
            console.log(`Success Rate: ${((successfulPipelines / this.executionHistory.length) * 100).toFixed(2)}%`);
            console.log(`Avg Pipeline Duration: ${(this.executionHistory.reduce((sum, e) => sum + e.duration, 0) / this.executionHistory.length).toFixed(2)}ms`);
        }

        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SkillOrchestrator;
}
