# Project Cleanup Analysis

## Current State
- **Total Files**: 60+ files in root directory
- **Analysis Engines**: 3 versions (v1, v2, v3)
- **Test Files**: 13 CSV test files + 6 HTML test files
- **Active Version**: vulnerability-analysis-engine.js (loaded in index.html)

---

## Files to REMOVE (Safe Deletions)

### 1. **Legacy Analysis Engines** (2 files, ~150KB)
**REMOVE:**
- `vulnerability-analysis-engine-v2.js` (29KB) - Superseded by v3
- `vulnerability-analysis-engine-v3.js` (126KB) - NOT used in index.html

**KEEP:**
- `vulnerability-analysis-engine.js` (121KB) - **ACTIVE** in production

**Reason**: Only the base version is loaded. v2 and v3 are legacy iterations that are no longer referenced.

**Risk**: ⚠️ MEDIUM - Verify v3 isn't used anywhere before deleting

---

### 2. **Test CSV Files** (13 files, ~10KB)
**MOVE TO `/tests/` folder:**
- test_advanced_scan.csv
- test_central_siem.csv
- test_config.csv
- test_custom_id.csv
- test_dual_view.csv
- test_first_poam.csv
- test_framework_demo.csv
- test_hr_system.csv
- test_nessus_format.csv
- test_qualys_format.csv
- test_scan.csv
- test_sla_violations.csv
- test_upload_simple.csv

**Reason**: Cluttering root directory. Should be in organized test folder.

**Risk**: ✅ LOW - Just moving, not deleting

---

### 3. **Test HTML Files** (6 files, ~60KB)
**MOVE TO `/tests/` folder:**
- test_milestone_editing.html
- test_milestone_generation.html
- test_milestone_pipeline.html
- test_poam_milestones.html
- test_poc_control_fixes.html
- test_milestone_node.js

**Reason**: Development/testing artifacts, not production code.

**Risk**: ✅ LOW - Just moving, not deleting

---

### 4. **Miscellaneous Test Files**
**MOVE TO `/tests/` folder:**
- test_evidence_sample.txt
- test_upload.js

**Risk**: ✅ LOW

---

### 5. **System Files**
**REMOVE:**
- .DS_Store (Mac system file)

**Risk**: ✅ NONE - Auto-generated

---

### 6. **Duplicate/Preview Files**
**EVALUATE:**
- `ui-redesign-preview.html` (48KB) - Is this still needed or was it a prototype?

**Risk**: ⚠️ MEDIUM - Check if this is referenced anywhere

---

### 7. **Deployment Files in Root**
**MOVE TO `.github/workflows/`:**
- ci.yml
- deploy.yml

**Reason**: Should be in .github/workflows/ directory

**Risk**: ✅ LOW - Standard GitHub Actions location

---

## Files to KEEP (Active Production)

### Core Application Files
- index.html (242KB) - Main app
- script.js (87KB) - Main controller
- vulnerability-tracking.js (132KB) - POAM list/display
- vulnerability-analysis-engine.js (121KB) - **ACTIVE** analysis engine
- csv-format-processors.js (22KB) - CSV parsing
- pipeline-orchestrator.js (37KB) - Pipeline coordination
- poam-database.js (43KB) - IndexedDB layer

### Feature Modules
- dashboard-metrics.js (38KB)
- executive-reports.js (27KB)
- evidence-functions.js (27KB)
- poam-detail-redesign.js (51KB)
- poam-lifecycle.js (26KB)
- milestone-pipeline-orchestrator-v2.js (40KB)
- vulnerability-tracking-milestones.js (14KB)

### Workbook/Export
- poam-workbook-*.js (4 files)
- oscal-export.js

### Integrations
- jira-integration.js
- email-delivery.js
- notification-queue.js
- feedback-collector.js

### UI Components
- sidebar-navigation.js
- column-filters.js
- bulk-operations.js
- pipeline-progress-ui.js
- pipeline-logger.js

### Intelligence
- vulnerability-intelligence.js

### Configuration
- sla-config.json
- config/ folder

### Documentation
- README.md
- QUICKSTART.md
- PIPELINE_REFACTOR_SUMMARY.md
- clear-db-instructions.md
- docs/ folder

### Skills Architecture (NEW)
- skills/ folder (7 files)

### Utilities
- start.sh

---

## Recommended Actions

### Phase 1: Safe Cleanup (Immediate)
```bash
# Create tests directory
mkdir -p tests

# Move test files
mv test_*.csv tests/
mv test_*.html tests/
mv test_*.js tests/
mv test_*.txt tests/

# Remove system files
rm .DS_Store

# Move CI/CD files
mv ci.yml .github/workflows/
mv deploy.yml .github/workflows/
```

### Phase 2: Verify & Remove (After Testing)
```bash
# First, verify v3 isn't used anywhere
grep -r "vulnerability-analysis-engine-v3" . --exclude-dir=.git

# If not used, remove legacy engines
rm vulnerability-analysis-engine-v2.js
rm vulnerability-analysis-engine-v3.js
```

### Phase 3: Evaluate Preview File
```bash
# Check if ui-redesign-preview.html is referenced
grep -r "ui-redesign-preview" . --exclude-dir=.git

# If not used, remove or archive
mv ui-redesign-preview.html tests/prototypes/
```

---

## Space Savings

**Immediate (Phase 1):**
- Organized: ~70KB of test files moved to /tests/
- Removed: 6KB (.DS_Store)
- **Total**: Cleaner root directory

**After Verification (Phase 2):**
- Removed: ~155KB (v2 + v3 engines)

**Total Cleanup**: ~161KB + much cleaner project structure

---

## Risk Assessment

✅ **LOW RISK** (Phase 1): Moving test files, removing .DS_Store  
⚠️ **MEDIUM RISK** (Phase 2): Removing v2/v3 engines - need verification  
⚠️ **MEDIUM RISK** (Phase 3): Removing ui-redesign-preview.html  

---

## Next Steps

1. Execute Phase 1 (safe cleanup)
2. Test app thoroughly
3. Verify v3 engine isn't used
4. Execute Phase 2 if safe
5. Commit with detailed message
