# Skills-Based Architecture

## Overview

The POAM Manager pipeline has been refactored into a **skills-based architecture** where each skill is a focused, testable module with a single responsibility.

## Benefits

✅ **Modularity**: Each skill is independent and can be tested/updated separately  
✅ **Testability**: Built-in self-testing with test cases for each skill  
✅ **Observability**: Comprehensive metrics and diagnostics per skill  
✅ **Maintainability**: Clear separation of concerns, easier to debug  
✅ **Extensibility**: Easy to add new skills or modify existing ones  
✅ **Performance Tracking**: Execution time, success rate, error tracking per skill  

## Core Skills

### 1. CSVParserSkill
**Responsibility**: Parse CSV files and normalize data

**Capabilities**:
- Header-agnostic parsing (finds columns by name, not position)
- Supports multiple formats (Qualys, Tenable, Wiz)
- Flexible field mapping with 40+ field variations
- Data quality validation

**Input**: `{ csvData, format, filename }`  
**Output**: `{ findings, metadata, quality }`

**Test Cases**:
- Parse simple Qualys CSV
- Handle missing columns
- Detect header variations

---

### 2. SLACalculatorSkill
**Responsibility**: Calculate SLA breach status for findings

**Capabilities**:
- Parse detection dates (multiple formats)
- Calculate finding age in days
- Determine breach status based on severity
- Track breach dates and lifecycle

**Input**: `{ findings }`  
**Output**: `{ findings (enriched with SLA), summary }`

**Test Cases**:
- Calculate SLA for breached high severity finding
- Calculate SLA for within-SLA medium severity finding
- Handle missing dates gracefully

---

### 3. GroupingSkill
**Responsibility**: Group findings by remediation signature

**Capabilities**:
- Extract remediation metadata (action type, target, asset class)
- Generate unique signatures for correlation
- Aggregate findings into logical groups
- Track CVEs, QIDs, assets per group

**Input**: `{ findings }`  
**Output**: `{ groups, summary }`

**Test Cases**:
- Group findings by KB patch
- Separate groups for different patches
- Handle configuration changes vs patches

---

### 4. SkillOrchestrator
**Responsibility**: Coordinate skill execution in pipelines

**Capabilities**:
- Register and manage skills
- Define and execute pipelines (skill sequences)
- Error handling and recovery
- Metrics aggregation across skills
- Performance reporting

**Methods**:
- `registerSkill(name, instance)`
- `definePipeline(name, skillSequence)`
- `executePipeline(name, input)`
- `testAllSkills()`
- `generateReport()`

---

## Pipeline Example

```javascript
// Create orchestrator
const orchestrator = new SkillOrchestrator();

// Register skills
orchestrator.registerSkill('parser', new CSVParserSkill());
orchestrator.registerSkill('sla', new SLACalculatorSkill());
orchestrator.registerSkill('grouping', new GroupingSkill());

// Define pipeline
orchestrator.definePipeline('scan-processing', [
    'parser',
    'sla',
    'grouping'
]);

// Execute pipeline
const result = await orchestrator.executePipeline('scan-processing', {
    csvData: parsedCSV,
    format: 'qualys',
    filename: 'scan.csv'
});

if (result.success) {
    const groups = result.data.groups;
    // Continue with POAM creation...
}
```

## Skill Interface

All skills inherit from `BaseSkill` and implement:

```javascript
class MySkill extends BaseSkill {
    async run(input) {
        // Core skill logic
        return output;
    }

    async validate(data, type) {
        // Validate input/output
        return { valid: true, errors: [] };
    }

    async getTestCases() {
        // Return test cases
        return [
            {
                name: 'Test case name',
                input: { /* test input */ },
                validate: (result) => {
                    // Return true if test passed
                    return result.success && /* assertions */;
                }
            }
        ];
    }
}
```

## Metrics & Diagnostics

Each skill tracks:
- Execution count
- Success/failure count
- Average duration
- Success rate
- Error history

Access metrics:
```javascript
const metrics = skill.getMetrics();
// {
//   executionCount: 10,
//   successCount: 9,
//   failureCount: 1,
//   avgDuration: 45.2,
//   successRate: '90.00%',
//   errors: [...]
// }
```

## Testing

Test individual skill:
```javascript
const result = await skill.test();
// { passed: true, results: [...] }
```

Test all skills:
```javascript
const result = await orchestrator.testAllSkills();
// { allPassed: true, results: [...] }
```

## Future Skills

Planned skills to complete the architecture:

- **POAMBuilderSkill**: Create POAMs from groups
- **EnrichmentSkill**: Add CVE/CVSS/vendor data
- **ValidationSkill**: Validate POAM completeness
- **CorrelationSkill**: Match with existing POAMs
- **PersistenceSkill**: Save to IndexedDB
- **APIIntegrationSkill**: Sync with Qualys/Tenable APIs

## Migration Path

1. ✅ Create base skill infrastructure
2. ✅ Refactor CSV parsing into CSVParserSkill
3. ✅ Refactor SLA calculation into SLACalculatorSkill
4. ✅ Refactor grouping into GroupingSkill
5. ⏳ Refactor POAM building into POAMBuilderSkill
6. ⏳ Refactor enrichment into EnrichmentSkill
7. ⏳ Update pipeline orchestrator to use skills
8. ⏳ Add comprehensive test coverage
9. ⏳ Performance optimization per skill

## Performance Goals

- CSV parsing: < 100ms for 1000 rows
- SLA calculation: < 50ms for 1000 findings
- Grouping: < 200ms for 1000 findings
- Full pipeline: < 1s for typical scan (1000-5000 findings)
