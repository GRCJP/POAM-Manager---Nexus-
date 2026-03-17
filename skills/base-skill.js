/**
 * Base Skill Class
 * 
 * All skills inherit from this base class and implement:
 * - execute(): Core skill logic
 * - validate(): Input/output validation
 * - test(): Self-testing capability
 * - getMetrics(): Performance and quality metrics
 */

class BaseSkill {
    constructor(name, config = {}) {
        this.name = name;
        this.config = config;
        this.metrics = {
            executionCount: 0,
            successCount: 0,
            failureCount: 0,
            totalDuration: 0,
            lastExecutionTime: null,
            errors: []
        };
    }

    /**
     * Execute the skill with input data
     * @param {*} input - Input data for the skill
     * @returns {Promise<{success: boolean, data: *, metrics: object, errors: array}>}
     */
    async execute(input) {
        const startTime = performance.now();
        this.metrics.executionCount++;
        this.metrics.lastExecutionTime = new Date().toISOString();

        try {
            // Validate input
            const validationResult = await this.validate(input, 'input');
            if (!validationResult.valid) {
                throw new Error(`Input validation failed: ${validationResult.errors.join(', ')}`);
            }

            // Execute core skill logic
            const result = await this.run(input);

            // Validate output
            const outputValidation = await this.validate(result, 'output');
            if (!outputValidation.valid) {
                console.warn(`⚠️ ${this.name} output validation warnings:`, outputValidation.errors);
            }

            const duration = performance.now() - startTime;
            this.metrics.totalDuration += duration;
            this.metrics.successCount++;

            return {
                success: true,
                data: result,
                metrics: {
                    duration,
                    timestamp: new Date().toISOString()
                },
                errors: []
            };

        } catch (error) {
            const duration = performance.now() - startTime;
            this.metrics.totalDuration += duration;
            this.metrics.failureCount++;
            this.metrics.errors.push({
                timestamp: new Date().toISOString(),
                error: error.message,
                stack: error.stack
            });

            console.error(`❌ ${this.name} execution failed:`, error);

            return {
                success: false,
                data: null,
                metrics: {
                    duration,
                    timestamp: new Date().toISOString()
                },
                errors: [error.message]
            };
        }
    }

    /**
     * Core skill logic - must be implemented by subclasses
     * @param {*} input - Validated input data
     * @returns {Promise<*>} - Skill output
     */
    async run(input) {
        throw new Error(`${this.name}.run() must be implemented by subclass`);
    }

    /**
     * Validate input or output data
     * @param {*} data - Data to validate
     * @param {string} type - 'input' or 'output'
     * @returns {Promise<{valid: boolean, errors: array}>}
     */
    async validate(data, type) {
        // Default: no validation
        return { valid: true, errors: [] };
    }

    /**
     * Self-test the skill with sample data
     * @returns {Promise<{passed: boolean, results: array}>}
     */
    async test() {
        console.log(`🧪 Testing ${this.name}...`);
        const testCases = await this.getTestCases();
        const results = [];

        for (const testCase of testCases) {
            const result = await this.execute(testCase.input);
            const passed = testCase.validate(result);
            results.push({
                name: testCase.name,
                passed,
                result
            });
        }

        const allPassed = results.every(r => r.passed);
        console.log(`${allPassed ? '✅' : '❌'} ${this.name} tests ${allPassed ? 'passed' : 'failed'}`);

        return {
            passed: allPassed,
            results
        };
    }

    /**
     * Get test cases for self-testing
     * @returns {Promise<array>} - Array of {name, input, validate} objects
     */
    async getTestCases() {
        return [];
    }

    /**
     * Get skill metrics
     * @returns {object} - Performance and quality metrics
     */
    getMetrics() {
        const avgDuration = this.metrics.executionCount > 0 
            ? this.metrics.totalDuration / this.metrics.executionCount 
            : 0;

        const successRate = this.metrics.executionCount > 0
            ? (this.metrics.successCount / this.metrics.executionCount) * 100
            : 0;

        return {
            ...this.metrics,
            avgDuration,
            successRate: successRate.toFixed(2) + '%'
        };
    }

    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            executionCount: 0,
            successCount: 0,
            failureCount: 0,
            totalDuration: 0,
            lastExecutionTime: null,
            errors: []
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseSkill;
}
