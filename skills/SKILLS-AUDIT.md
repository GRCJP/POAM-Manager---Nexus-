# Skills Architecture Audit & Roadmap

**Date**: 2025-03-16  
**Purpose**: Comprehensive review of skills for LLM/Agent integration readiness

---

## Current Skills Inventory

### ✅ 1. BaseSkill (Foundation)
**File**: `base-skill.js`  
**Status**: COMPLETE  
**Purpose**: Abstract base class for all skills

**Capabilities**:
- ✅ Execution wrapper with error handling
- ✅ Input/output validation framework
- ✅ Self-testing capability
- ✅ Performance metrics tracking (duration, success rate, error history)
- ✅ Standardized interface for all skills

**Interface**:
```javascript
async execute(input) → { success, data, metrics, errors }
async run(input) → output  // Implemented by subclasses
async validate(data, type) → { valid, errors }
async test() → { passed, results }
getMetrics() → { executionCount, successRate, avgDuration, errors }
```

**LLM/Agent Ready**: ✅ YES
- Clear contract: input → output
- Self-documenting via test cases
- Observable via metrics

---

### ✅ 2. CSVParserSkill
**File**: `csv-parser-skill.js`  
**Status**: COMPLETE  
**Purpose**: Parse vulnerability scan CSV files

**Capabilities**:
- ✅ Header-agnostic parsing (finds columns by name, not position)
- ✅ Multi-format support (Qualys, Tenable, Wiz)
- ✅ 40+ field variations mapped to standard schema
- ✅ Data quality validation
- ✅ Flexible header detection (searches first 10 rows)

**Input**:
```javascript
{
  csvData: Array<Array<string>>,  // Raw CSV rows
  format: 'qualys' | 'tenable' | 'wiz',
  filename: string
}
```

**Output**:
```javascript
{
  findings: Array<Finding>,  // Normalized findings
  metadata: {
    filename, format, headerRow, totalRows, parsedRows, skippedRows,
    headerMap, processedAt
  },
  quality: {
    parseRate: "95.2%",
    criticalFieldsCoverage: "100%"
  }
}
```

**LLM/Agent Ready**: ✅ YES
- Clear input/output contract
- Self-validating
- Quality metrics for confidence scoring

---

### ✅ 3. SLACalculatorSkill
**File**: `sla-calculator-skill.js`  
**Status**: COMPLETE  
**Purpose**: Calculate SLA breach status for findings

**Capabilities**:
- ✅ Parse detection dates (multiple formats)
- ✅ Calculate finding age in days
- ✅ Severity-based SLA thresholds:
  - Critical: 15 days
  - High: 30 days
  - Medium: 90 days
  - Low: 180 days
- ✅ Breach date calculation
- ✅ Status normalization (ACTIVE, FIXED, CLOSED, etc.)

**Input**:
```javascript
{
  findings: Array<Finding>  // Must have: firstDetected, severity, status
}
```

**Output**:
```javascript
{
  findings: Array<Finding>,  // Enriched with sla object
  summary: {
    total: number,
    breached: number,
    withinSLA: number,
    missingDates: number,
    breachRate: "42.5%"
  }
}
```

**Finding.sla Object**:
```javascript
{
  severity: 'critical' | 'high' | 'medium' | 'low',
  slaDays: number,
  ageDays: number,
  breached: boolean,
  breachDate: "2025-03-01",
  firstDetected: "2025-02-01",
  lastDetected: "2025-03-15",
  status: "ACTIVE"
}
```

**LLM/Agent Ready**: ✅ YES
- Deterministic logic
- Clear business rules
- Observable metrics

**Note**: Does NOT filter findings < 30 days old - that's Phase 1's responsibility

---

### ✅ 4. ClassificationSkill
**File**: `classification-skill.js`  
**Status**: COMPLETE (FIXED 2025-03-16)  
**Purpose**: Classify remediation strategies for findings

**Capabilities**:
- ✅ Extract action type (upgrade, patch, configure, remove, workaround)
- ✅ Extract target version/KB/patch date
- ✅ Extract component/product name
- ✅ Extract vendor information
- ✅ Derive asset class (server, endpoint, network, general)
- ✅ **FIXED**: targetKey now prioritizes title/component over solution hash

**Input**:
```javascript
{
  findings: Array<Finding>  // Must have: title, solution, operatingSystem
}
```

**Output**:
```javascript
{
  findings: Array<Finding>  // Enriched with remediation object
}
```

**Finding.remediation Object**:
```javascript
{
  remediationType: 'patch_update' | 'config_change' | 'removal' | 'operational_mitigation',
  actionType: 'upgrade' | 'patch' | 'configure' | 'remove' | 'workaround' | 'other',
  component: string,  // e.g., 'Firefox', 'Chrome'
  platform: 'server' | 'endpoint' | 'network' | 'general',
  targetingStrategy: 'version' | 'asset',
  fixedTarget: string,  // e.g., '115.18', 'kb5034441'
  fixedTargetKey: string,  // e.g., 'Firefox:115.18'
  actionText: string,  // Full solution text
  vendor: string,  // e.g., 'Microsoft', 'Mozilla'
  patchDate: string | null,  // e.g., 'january_2025'
  targetKey: string,  // Grouping key (version > patch > component > title hash)
  assetClass: string
}
```

**Recent Fix (2025-03-16)**:
- Changed `targetKey` logic from `truncatedVersion || normalizeForHash(solution)` 
- To: `truncatedVersion || patchDate || component || normalizeForHash(title || solution)`
- **Impact**: Findings like "Pending Reboot Detected" now share same targetKey → single POAM instead of 88 individual POAMs

**LLM/Agent Ready**: ✅ YES
- Pattern-based extraction (regex)
- Deterministic logic
- Could be enhanced with ML for better product/vendor extraction

---

### ✅ 5. GroupingSkill
**File**: `grouping-skill.js`  
**Status**: COMPLETE  
**Purpose**: Group findings by remediation signature

**Capabilities**:
- ✅ Build signature from remediation metadata: `actionType::targetKey::assetClass`
- ✅ Aggregate findings with same remediation strategy
- ✅ Track assets, CVEs, QIDs per group
- ✅ Collect evidence samples (max 5 per group)
- ✅ Calculate group statistics

**Input**:
```javascript
{
  findings: Array<Finding>  // Must have remediation object from ClassificationSkill
}
```

**Output**:
```javascript
{
  groups: Array<Group>,
  summary: {
    totalGroups: number,
    totalFindings: number,
    avgFindingsPerGroup: number,
    largestGroup: number,
    smallestGroup: number
  }
}
```

**Group Object**:
```javascript
{
  signature: string,  // e.g., "patch::kb5034441::server"
  findings: Array<Finding>,
  assets: Array<string>,  // Unique hostnames/IPs
  cves: Array<string>,  // Unique CVE IDs
  qids: Array<string>,  // Unique QIDs
  evidenceSamples: Array<string>,  // Sample evidence (max 5)
  remediation: RemediationObject  // From first finding in group
}
```

**LLM/Agent Ready**: ✅ YES
- Deterministic grouping logic
- Clear aggregation rules
- Observable statistics

---

### ✅ 6. SkillOrchestrator
**File**: `skill-orchestrator.js`  
**Status**: COMPLETE  
**Purpose**: Coordinate skill execution in pipelines

**Capabilities**:
- ✅ Register and manage skills
- ✅ Define pipelines (skill sequences)
- ✅ Execute pipelines with data flow
- ✅ Error handling and recovery
- ✅ Metrics aggregation across skills
- ✅ Performance reporting

**Interface**:
```javascript
registerSkill(name, skillInstance)
definePipeline(name, skillSequence)
executePipeline(name, input) → { success, data, execution }
testAllSkills() → { allPassed, results }
getAllMetrics() → Map<skillName, metrics>
generateReport()
```

**Pipeline Definition**:
```javascript
orchestrator.definePipeline('scan-processing', [
  'parser',         // CSVParserSkill
  'sla',           // SLACalculatorSkill
  'classification', // ClassificationSkill
  'grouping'       // GroupingSkill
]);
```

**LLM/Agent Ready**: ✅ YES
- Declarative pipeline definition
- Automatic data flow between skills
- Observable execution metrics
- **Perfect for LLM orchestration**: Agent can define custom pipelines by selecting skills

---

## Missing Skills (Needed for Complete Pipeline)

### ⏳ 7. POAMBuilderSkill (CRITICAL)
**Status**: NOT IMPLEMENTED  
**Purpose**: Build POAMs from remediation groups

**Required Capabilities**:
- Create POAM object from group
- Assign POAM ID (sequential or UUID)
- Calculate due date based on SLA breach analysis
- Determine POAM status (open, risk-accepted, etc.)
- Generate title, description, mitigation text
- Assign POC/team (if rules exist)
- Calculate confidence score
- Set priority flags

**Input**:
```javascript
{
  groups: Array<Group>,  // From GroupingSkill
  config: {
    isBaseline: boolean,
    autoPrioritizeTop: number
  }
}
```

**Output**:
```javascript
{
  poams: Array<POAM>,
  summary: {
    created: number,
    skipped: number,
    skipReasons: Object
  }
}
```

**POAM Object Schema**:
```javascript
{
  id: string,
  title: string,
  description: string,
  vulnerability: string,
  findingDescription: string,
  
  // Risk
  risk: 'Critical' | 'High' | 'Medium' | 'Low',
  rawRisk: number,
  
  // Status & Dates
  findingStatus: string,
  status: string,
  dueDate: Date,
  scheduledCompletionDate: Date,
  updatedScheduledCompletionDate: Date,
  
  // Assets
  affectedAssets: Array<string>,
  totalAffectedAssets: number,
  asset: string,  // Primary asset
  
  // Remediation
  remediationSignature: string,
  remediationType: string,
  component: string,
  platform: string,
  targetingStrategy: string,
  fixedTarget: string,
  mitigation: string,
  
  // Tracking
  cves: Array<string>,
  qids: Array<string>,
  findingCount: number,
  evidenceSamples: Array<string>,
  
  // SLA
  slaBreached: boolean,
  breachedAssets: number,
  activeAssets: number,
  
  // Assignment
  poc: string,
  pocTeam: string,
  controlFamily: string,
  
  // Metadata
  confidence: number,
  isPriority: boolean,
  isBaseline: boolean,
  rawFindings: Array<Finding>
}
```

**LLM/Agent Ready**: 🔄 NEEDS IMPLEMENTATION
- Logic exists in `vulnerability-analysis-engine.js` → needs extraction to skill
- Template generation is good candidate for LLM enhancement

---

### ⏳ 8. EnrichmentSkill
**Status**: NOT IMPLEMENTED  
**Purpose**: Enrich groups with external data

**Required Capabilities**:
- CVE lookup (CVSS scores, descriptions, references)
- Vendor advisory lookup
- Exploit availability check
- Asset criticality lookup
- Control family mapping

**Input**:
```javascript
{
  groups: Array<Group>
}
```

**Output**:
```javascript
{
  groups: Array<Group>  // Enriched with external data
}
```

**LLM/Agent Ready**: 🔄 NEEDS IMPLEMENTATION
- API integration required
- Caching strategy needed
- Good candidate for async/parallel execution

---

### ⏳ 9. ValidationSkill
**Status**: NOT IMPLEMENTED  
**Purpose**: Validate POAM completeness and quality

**Required Capabilities**:
- Check required fields are populated
- Validate date logic (due date > first detected)
- Check for duplicate POAMs
- Validate control family assignments
- Quality scoring

**Input**:
```javascript
{
  poams: Array<POAM>
}
```

**Output**:
```javascript
{
  poams: Array<POAM>,  // With validation flags
  validation: {
    passed: number,
    warnings: number,
    errors: number,
    issues: Array<ValidationIssue>
  }
}
```

**LLM/Agent Ready**: 🔄 NEEDS IMPLEMENTATION
- Rule-based validation
- Could use LLM for semantic validation (e.g., "does mitigation match vulnerability?")

---

### ⏳ 10. PersistenceSkill
**Status**: NOT IMPLEMENTED  
**Purpose**: Save POAMs to IndexedDB

**Required Capabilities**:
- Batch insert POAMs
- Update existing POAMs (merge logic)
- Auto-resolve closed POAMs
- Save scan metadata
- Transaction management

**Input**:
```javascript
{
  poams: Array<POAM>,
  scanMetadata: Object,
  mode: 'baseline' | 'reimport'
}
```

**Output**:
```javascript
{
  saved: number,
  updated: number,
  autoResolved: number,
  errors: Array<Error>
}
```

**LLM/Agent Ready**: 🔄 NEEDS IMPLEMENTATION
- Currently in `poam-lifecycle.js` → needs extraction to skill
- Merge logic is complex - good candidate for skill isolation

---

### ⏳ 11. CorrelationSkill
**Status**: NOT IMPLEMENTED  
**Purpose**: Match new POAMs with existing POAMs

**Required Capabilities**:
- Match by remediation signature
- Detect duplicates
- Identify updates vs new POAMs
- Preserve user edits (status, POC, notes, milestones)
- Track status history

**Input**:
```javascript
{
  newPOAMs: Array<POAM>,
  existingPOAMs: Array<POAM>
}
```

**Output**:
```javascript
{
  matched: Array<{ new, existing, action: 'update' | 'merge' }>,
  new: Array<POAM>,
  orphaned: Array<POAM>  // Existing POAMs not in new scan
}
```

**LLM/Agent Ready**: 🔄 NEEDS IMPLEMENTATION
- Currently in `poam-lifecycle.js` → needs extraction
- Fuzzy matching could benefit from ML/LLM

---

## Pipeline Architecture

### Current Pipeline (Phase 1-2 with Skills)

```
CSV Upload
    ↓
Phase 1: Eligibility Gate (pipeline.js)
    - Filter inactive statuses
    - Filter findings < 30 days old
    ↓
Phase 2: Skills Pipeline (if USE_SKILLS_ARCHITECTURE = true)
    - CSVParserSkill (if raw CSV)
    - SLACalculatorSkill
    - ClassificationSkill
    - GroupingSkill
    ↓
Phase 3: Group Enrichment (legacy engine)
    - Add CVE/CVSS data
    - Add vendor info
    ↓
Phase 4: POAM Pre-Population (legacy engine)
    - buildPOAMsWithSLAGating()
    - Apply templates
    - Calculate confidence
    ↓
Phase 5: Commit and Persist (legacy engine)
    - Merge with existing POAMs
    - Save to IndexedDB
```

### Target Pipeline (Full Skills)

```
CSV Upload
    ↓
EligibilitySkill (NEW)
    - Filter inactive statuses
    - Filter findings < 30 days old
    ↓
CSVParserSkill
    - Parse and normalize
    ↓
SLACalculatorSkill
    - Calculate breach status
    ↓
ClassificationSkill
    - Extract remediation metadata
    ↓
GroupingSkill
    - Consolidate by signature
    ↓
EnrichmentSkill (NEW)
    - Add external data
    ↓
POAMBuilderSkill (NEW)
    - Create POAM objects
    ↓
ValidationSkill (NEW)
    - Validate completeness
    ↓
CorrelationSkill (NEW)
    - Match with existing POAMs
    ↓
PersistenceSkill (NEW)
    - Save to IndexedDB
```

---

## LLM/Agent Integration Readiness

### ✅ What's Ready Now

1. **Skill Discovery**: Agent can list available skills via `orchestrator.skills`
2. **Skill Execution**: Agent can execute individual skills with `skill.execute(input)`
3. **Pipeline Definition**: Agent can define custom pipelines dynamically
4. **Observability**: Agent can inspect metrics via `skill.getMetrics()`
5. **Self-Testing**: Agent can validate skills via `skill.test()`
6. **Error Handling**: Standardized error responses with context

### 🔄 What Needs Work

1. **Skill Metadata**: Add structured metadata for LLM consumption
   ```javascript
   skill.getMetadata() → {
     name, description, version,
     inputSchema, outputSchema,
     dependencies, capabilities,
     examples, testCases
   }
   ```

2. **Natural Language Interface**: Add NL descriptions
   ```javascript
   skill.describe() → "I parse CSV vulnerability scan files and normalize them to a standard schema. I support Qualys, Tenable, and Wiz formats."
   ```

3. **Skill Recommendations**: Agent needs to know which skills to use for a task
   ```javascript
   orchestrator.recommendPipeline(task) → ['parser', 'sla', 'grouping']
   ```

4. **Partial Execution**: Support resuming pipelines from checkpoints
   ```javascript
   orchestrator.executePipeline(name, input, { startFrom: 'grouping' })
   ```

5. **Skill Composition**: Allow skills to call other skills
   ```javascript
   class CompositeSkill extends BaseSkill {
     async run(input) {
       const step1 = await this.callSkill('parser', input);
       const step2 = await this.callSkill('sla', step1.data);
       return step2.data;
     }
   }
   ```

---

## Recommended Implementation Order

### Phase 1: Complete Core Skills (CRITICAL)
1. ✅ BaseSkill - DONE
2. ✅ CSVParserSkill - DONE
3. ✅ SLACalculatorSkill - DONE
4. ✅ ClassificationSkill - DONE (FIXED)
5. ✅ GroupingSkill - DONE
6. ✅ SkillOrchestrator - DONE

### Phase 2: Build Missing Skills (HIGH PRIORITY)
7. 🔄 **POAMBuilderSkill** - Extract from `vulnerability-analysis-engine.js`
8. 🔄 **PersistenceSkill** - Extract from `poam-lifecycle.js`
9. 🔄 **CorrelationSkill** - Extract from `poam-lifecycle.js`

### Phase 3: Add Enhancement Skills (MEDIUM PRIORITY)
10. 🔄 **EnrichmentSkill** - CVE/CVSS/vendor lookup
11. 🔄 **ValidationSkill** - POAM quality checks
12. 🔄 **EligibilitySkill** - Extract Phase 1 logic

### Phase 4: LLM Integration (FUTURE)
13. 🔄 Add skill metadata schemas
14. 🔄 Add natural language descriptions
15. 🔄 Build skill recommendation engine
16. 🔄 Add partial execution support
17. 🔄 Build skill composition framework

---

## Testing Strategy

### Unit Testing (Per Skill)
- Each skill has `getTestCases()` method
- Run via `skill.test()`
- Validates input → output contract

### Integration Testing (Pipeline)
- Run via `orchestrator.executePipeline()`
- Validates data flow between skills
- End-to-end with sample CSV

### Performance Testing
- Track via `skill.getMetrics()`
- Target: < 1s for 1000-5000 findings
- Monitor: duration, success rate, error rate

---

## Next Steps

1. **Immediate**: Extract POAMBuilderSkill from legacy engine
2. **Short-term**: Extract PersistenceSkill and CorrelationSkill
3. **Medium-term**: Add skill metadata for LLM consumption
4. **Long-term**: Build LLM orchestration layer

---

## Conclusion

**Current State**: 6/12 skills complete (50%)  
**LLM Ready**: Core skills are LLM-ready, missing skills need implementation  
**Blocker**: POAMBuilderSkill is critical path - without it, pipeline is incomplete

**Recommendation**: Extract POAMBuilderSkill from `vulnerability-analysis-engine.js` as next priority. This will complete the core pipeline and enable full end-to-end testing.
