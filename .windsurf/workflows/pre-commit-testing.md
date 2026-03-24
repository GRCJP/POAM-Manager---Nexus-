---
description: Pre-commit testing workflow - validate changes before commit
---

# Pre-Commit Testing Workflow

This workflow ensures all code changes are validated before committing to prevent breaking the application.

## When to Use This Workflow

- Before committing any code changes
- After fixing bugs or adding features
- When modifying critical components (pipeline, database, analysis engine)

## Testing Steps

### 1. Identify Change Scope

Determine what components were modified:
- **Frontend UI**: HTML, CSS, JavaScript modules
- **Data Processing**: Pipeline, analysis engine, skills
- **Database**: IndexedDB operations, schema changes
- **Import/Export**: CSV parsing, data transformation

### 2. Trace Code Flow

For the modified component, trace the execution path:

```
Example for CSV Import:
1. User uploads CSV → vulnerability-tracking.js:processLocalCSV()
2. Parse CSV → modules/data-processing.js
3. Run pipeline → modules/pipeline.js:runImportPipeline()
4. Phase 1: Filter → runPhase1()
5. Phase 2: Group → runPhase2() [Skills or Legacy Engine]
6. Phase 3: Enrich → runPhase3()
7. Phase 4: Build POAMs → runPhase4()
   - VulnerabilityAnalysisEngineV3.buildPOAMsWithSLAGating()
   - VulnerabilityAnalysisEngineV3.calculatePOAMConfidence()
8. Phase 5: Persist → runPhase5()
   - poam-database.js:savePOAMsBatch()
```

### 3. Verify Dependencies

Check that all required objects/properties exist:

**Common Issues:**
- ✅ Class properties initialized in constructor
- ✅ Required parameters passed to functions
- ✅ Object properties exist before accessing
- ✅ Arrays/Sets initialized before use
- ✅ Null/undefined checks for optional data

**Example Checklist:**
```javascript
// BAD - componentDictionary never initialized
class MyClass {
    constructor() {
        this.someProperty = 'value';
    }
    
    myMethod() {
        if (this.componentDictionary['microsoft']) { // ❌ undefined
            // ...
        }
    }
}

// GOOD - componentDictionary initialized
class MyClass {
    constructor() {
        this.someProperty = 'value';
        this.componentDictionary = { // ✅ initialized
            'microsoft': true,
            'apache': true
        };
    }
}
```

### 4. Review Error-Prone Patterns

**Check for:**
- Accessing nested properties without null checks: `obj.prop.subprop` → `obj?.prop?.subprop`
- Array operations on undefined: `arr.forEach()` → `arr?.forEach()` or `(arr || []).forEach()`
- String operations on undefined: `str.toLowerCase()` → `str?.toLowerCase()`
- Spread operator on undefined: `{...obj}` → `{...(obj || {})}`

### 5. Validate Against Test Data

Use existing test data to verify the change:

**Available Test Data:**
- `/test-data-scrubbed.csv` - Sample vulnerability scan data
- Browser DevTools Console - Run test functions
- `test-csv-import.html` - Standalone test page

**Quick Validation:**
```javascript
// In browser console after loading app:
// 1. Check if classes are defined
console.log(typeof VulnerabilityAnalysisEngineV3); // should be 'function'

// 2. Check if properties are initialized
const engine = new VulnerabilityAnalysisEngineV3();
console.log(engine.componentDictionary); // should be object, not undefined

// 3. Test with sample data
const sampleFindings = [{
    title: 'Test Vulnerability',
    severity: 'high',
    solution: 'Apply patch'
}];
const classified = engine.classifyRemediation(sampleFindings);
console.log(classified[0].remediation); // should have remediation object
```

### 6. Verify Fix Completeness

**Before Committing:**
- ✅ Root cause identified and addressed
- ✅ No undefined/null reference errors
- ✅ Code follows existing patterns
- ✅ No breaking changes to existing functionality
- ✅ Console shows no errors for the modified flow

**Red Flags:**
- ❌ "Try this and see if it works" approach
- ❌ Multiple null checks added without understanding why
- ❌ Fallback values that hide the real issue
- ❌ Changes that "might" fix it

### 7. Document the Fix

**Commit Message Format:**
```
fix(component): Brief description of what was fixed

ROOT CAUSE: Explain what was broken and why
FIX: Describe the solution implemented
IMPACT: What functionality is now working

Example:
fix(critical): Initialize componentDictionary to prevent undefined error

ROOT CAUSE: calculatePOAMConfidence() accessed this.componentDictionary
but it was never initialized in the constructor
FIX: Added componentDictionary initialization with common components
IMPACT: CSV import now completes successfully through all phases
```

## Testing Checklist

Before committing, verify:

- [ ] Identified root cause through code analysis
- [ ] Traced execution path for modified component
- [ ] Verified all dependencies exist
- [ ] Checked for common error patterns
- [ ] Validated logic against test data
- [ ] No console errors in the modified flow
- [ ] Commit message documents root cause and fix
- [ ] Changes follow existing code patterns

## Example: CSV Import Testing

```bash
# 1. Trace the flow
grep -n "processLocalCSV" vulnerability-tracking.js
grep -n "runImportPipeline" modules/pipeline.js
grep -n "buildPOAMsWithSLAGating" vulnerability-analysis-engine-v3.js

# 2. Check for undefined properties
grep -n "this\." vulnerability-analysis-engine-v3.js | grep -v "this\.[a-zA-Z]*\s*="

# 3. Verify initialization
grep -A 50 "constructor()" vulnerability-analysis-engine-v3.js

# 4. Test in browser console
# Load app → Open DevTools → Run validation
```

## Common Failure Patterns

### Pattern 1: Undefined Property Access
```javascript
// Error: Cannot read properties of undefined (reading 'propertyName')
// Cause: Object not initialized or property doesn't exist
// Fix: Initialize in constructor or add null check
```

### Pattern 2: Missing Script Tag
```javascript
// Error: ClassName is not defined
// Cause: Script file not loaded in index.html
// Fix: Add <script src="path/to/file.js"></script>
```

### Pattern 3: Async/Await Issues
```javascript
// Error: Promise rejection or undefined result
// Cause: Missing await or promise not handled
// Fix: Add await or .then() handler
```

### Pattern 4: Skills Architecture Issues
```javascript
// Error: group.remediation is undefined
// Cause: Skills not populating required fields
// Fix: Verify skills are enabled and working correctly
```

## Success Criteria

A change is ready to commit when:

1. ✅ Root cause documented and understood
2. ✅ Fix addresses the actual issue, not symptoms
3. ✅ Code validated through logical analysis
4. ✅ No new errors introduced
5. ✅ Existing functionality preserved
6. ✅ Commit message is clear and detailed

## Notes

- **Don't ask user to test** - Validate the fix yourself first
- **Don't make blind changes** - Understand the code flow
- **Don't commit partial fixes** - Ensure completeness
- **Don't skip documentation** - Future you will thank you
