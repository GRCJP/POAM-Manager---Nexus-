# Git Workflow - POAM Manager Project

## **Mandatory Workflow for All Future Updates**

---

## **Branch Strategy**

### **Main Branch**
- **Purpose**: Production-ready code only
- **Protection**: Never commit directly to main
- **Updates**: Only via merged feature branches

### **Feature Branches**
- **Purpose**: All development work
- **Naming**: `feature/descriptive-name`
- **Lifespan**: Created → Developed → Merged → Deleted

---

## **Branch Naming Convention**

```
feature/add-api-sync          # New features
fix/poam-creation-null-error  # Bug fixes
refactor/consolidate-ui       # Code refactoring
docs/update-architecture      # Documentation
release/v2.1.0                # Release preparation
hotfix/critical-security      # Emergency fixes
```

---

## **Standard Workflow**

### **1. Start New Work**

```bash
# Always start from latest main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name
```

### **2. Develop**

```bash
# Make changes
# ... edit files ...

# Stage changes
git add .

# Commit with descriptive message
git commit -m "Add feature: descriptive message

- Detail 1
- Detail 2
- Detail 3"

# Push to remote
git push origin feature/your-feature-name
```

### **3. Keep Branch Updated**

```bash
# Periodically sync with main
git checkout main
git pull origin main
git checkout feature/your-feature-name
git merge main

# Resolve any conflicts
# ... fix conflicts ...
git add .
git commit -m "Merge main into feature branch"
git push origin feature/your-feature-name
```

### **4. Complete Feature**

```bash
# Ensure all tests pass
# Ensure code is clean
# Ensure documentation is updated

# Final push
git push origin feature/your-feature-name

# Create Pull Request on GitHub
# (or merge locally if solo developer)
```

### **5. Merge to Main**

```bash
# Switch to main
git checkout main
git pull origin main

# Merge feature branch
git merge feature/your-feature-name

# Push to remote
git push origin main
```

### **6. Tag Release (if applicable)**

```bash
# Tag the release
git tag -a v2.1.0 -m "Release v2.1.0: Feature description"

# Push tag
git push origin v2.1.0
```

### **7. Cleanup**

```bash
# Delete local branch
git branch -d feature/your-feature-name

# Delete remote branch
git push origin --delete feature/your-feature-name
```

---

## **Commit Message Format**

### **Structure**
```
<type>: <short summary>

<detailed description>

<breaking changes if any>
```

### **Types**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation
- `style`: Code style (formatting, no logic change)
- `test`: Adding tests
- `chore`: Maintenance tasks

### **Examples**

**Good**:
```
feat: Add skills-based architecture for modular processing

- Created BaseSkill class with execute/validate/test methods
- Implemented CSVParserSkill, SLACalculatorSkill, GroupingSkill
- Added SkillOrchestrator for pipeline coordination
- Integrated with existing pipeline via feature flag

Benefits:
- Modular, testable components
- Performance metrics per skill
- Easy to toggle between old/new pipeline
```

**Bad**:
```
update files
```

---

## **Release Versioning**

### **Semantic Versioning: MAJOR.MINOR.PATCH**

- **MAJOR** (v2.0.0): Breaking changes, major refactors
- **MINOR** (v2.1.0): New features, backward compatible
- **PATCH** (v2.1.1): Bug fixes, no new features

### **Examples**
- v1.0.0 → v2.0.0: Module consolidation (breaking)
- v2.0.0 → v2.1.0: Add API integration (new feature)
- v2.1.0 → v2.1.1: Fix POAM creation bug (patch)

---

## **Current Consolidation Workflow**

### **What We're Doing Now**

```bash
# 1. Created feature branch
git checkout -b feature/module-consolidation

# 2. Consolidate files
# ... create consolidated modules ...

# 3. Test thoroughly
# ... verify all features work ...

# 4. Commit consolidation
git add .
git commit -m "refactor: Consolidate 41 files into 14 modules

CONSOLIDATION:
- Created poam-ui.js (merged 4 files)
- Created pipeline.js (merged 4 files)
- Created workbook.js (merged 5 files)
- Created integrations.js (merged 4 files)
- Created reporting.js (merged 3 files)
- Created data-processing.js (merged 3 files)

BENEFITS:
- 67% reduction in file count
- Clear module boundaries
- Easier maintenance
- Better organization

BREAKING CHANGES:
- Script tag order in index.html changed
- Old individual files archived"

# 5. Push feature branch
git push origin feature/module-consolidation

# 6. Merge to main
git checkout main
git merge feature/module-consolidation
git push origin main

# 7. Tag as v2.0.0
git tag -a v2.0.0 -m "Release v2.0.0: Module Consolidation

Major refactor consolidating 41 files into 14 logical modules.
Establishes proper git workflow and module architecture."
git push origin v2.0.0

# 8. Cleanup
git branch -d feature/module-consolidation
git push origin --delete feature/module-consolidation
```

---

## **Emergency Hotfix Workflow**

For critical production bugs:

```bash
# Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug-name

# Fix the bug
# ... make changes ...

# Commit and push
git add .
git commit -m "hotfix: Fix critical bug description"
git push origin hotfix/critical-bug-name

# Merge to main immediately
git checkout main
git merge hotfix/critical-bug-name
git push origin main

# Tag patch version
git tag -a v2.0.1 -m "Hotfix v2.0.1: Critical bug fix"
git push origin v2.0.1

# Cleanup
git branch -d hotfix/critical-bug-name
git push origin --delete hotfix/critical-bug-name
```

---

## **Best Practices**

### **DO**
✅ Always work on feature branches  
✅ Write descriptive commit messages  
✅ Keep branches short-lived (< 1 week)  
✅ Merge main into feature branch regularly  
✅ Test before merging to main  
✅ Tag releases with semantic versioning  
✅ Delete branches after merging  

### **DON'T**
❌ Commit directly to main  
❌ Use version suffixes (v2, v3) in filenames  
❌ Leave stale branches  
❌ Write vague commit messages ("update", "fix")  
❌ Merge untested code  
❌ Push broken code to main  

---

## **Workflow Enforcement**

### **GitHub Branch Protection (Recommended)**

Enable on `main` branch:
- [ ] Require pull request reviews
- [ ] Require status checks to pass
- [ ] Require branches to be up to date
- [ ] Restrict who can push to main

### **Pre-commit Hooks (Future)**

```bash
# .git/hooks/pre-commit
#!/bin/bash
# Prevent direct commits to main
branch=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')
if [ "$branch" = "main" ]; then
  echo "❌ Direct commits to main are not allowed!"
  echo "Create a feature branch: git checkout -b feature/your-feature"
  exit 1
fi
```

---

## **Quick Reference**

### **Start New Feature**
```bash
git checkout main && git pull
git checkout -b feature/name
```

### **Save Work**
```bash
git add .
git commit -m "descriptive message"
git push origin feature/name
```

### **Merge to Main**
```bash
git checkout main && git pull
git merge feature/name
git push origin main
```

### **Tag Release**
```bash
git tag -a v2.1.0 -m "Release message"
git push origin v2.1.0
```

### **Cleanup**
```bash
git branch -d feature/name
git push origin --delete feature/name
```

---

## **This Prevents**

✅ File proliferation (version suffixes)  
✅ Breaking production code  
✅ Lost work (uncommitted changes)  
✅ Merge conflicts (regular syncing)  
✅ Unclear history (descriptive commits)  
✅ Unversioned releases (git tags)  

---

## **Conclusion**

**From now on, ALL work happens on feature branches.**

No exceptions. This workflow ensures:
- Clean, stable main branch
- Clear development history
- Easy rollback if needed
- Proper release management
- Professional development practices
