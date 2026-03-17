# Git Commit Guidelines

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **refactor**: Code restructuring without behavior change
- **perf**: Performance improvement
- **docs**: Documentation only
- **style**: Formatting, missing semicolons, etc.
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, dependency updates

### Scopes (optional but recommended)
- **pipeline**: Import/processing pipeline
- **ui**: User interface components
- **database**: IndexedDB operations
- **skills**: Skills architecture
- **reporting**: Dashboard/reports
- **milestones**: Milestone management
- **auth**: Authentication/authorization (future)
- **api**: API integration (future)

## Grouping Changes

### ✅ Good: Logical Feature Commits
```bash
# Single feature across multiple files
git add poam-database.js index.html script.js
git commit -m "feat(database): add first-run setup modal with SLA and POAM ID config

- Replace prompt-based setup with GUI modal
- Add chunked batch processing to prevent QuotaExceededError
- Strip rawFindings arrays to reduce storage footprint
- Add automatic cache-busting mechanism

Fixes #123"
```

### ❌ Bad: Individual File Commits
```bash
# Don't do this
git commit -m "fix: update poam-database.js"
git commit -m "chore: bump version in index.html"
git commit -m "feat: add cache buster to script.js"
```

## Commit Workflow

### 1. Work on a Feature Branch (recommended for large features)
```bash
git checkout -b feature/first-run-setup
# Make changes across multiple files
git add .
git commit -m "feat(ui): add first-run setup modal with SLA configuration"
git push origin feature/first-run-setup
# Create PR, review, merge to main
```

### 2. Direct to Main (for small fixes)
```bash
# Group related changes
git add file1.js file2.js file3.html
git commit -m "fix(pipeline): resolve QuotaExceededError on large imports

- Strip rawFindings arrays before storage
- Truncate verbose asset fields to 500 chars
- Implement chunked batch processing (50 POAMs/chunk)"
```

## Multi-File Changes Checklist

Before committing, ask:
1. **Do these files implement a single feature?** → Group them
2. **Are these fixes for the same bug?** → Group them
3. **Are these unrelated changes?** → Separate commits
4. **Does the commit message explain WHY?** → Add context

## Examples

### Good Examples

```bash
# Feature spanning multiple files
feat(skills): add SearchSkill for POAM filtering
- Create SearchSkill class with multi-field query
- Register skill in orchestrator
- Wire search input with debounce and explicit execute
- Add search button and Enter key support

# Bug fix across UI and database
fix(ui): sync POAM status updates across detail view and list
- Update both findingStatus and status fields on save
- Force refresh Generated POAMs cache after edit
- Fix inline dropdown persistence in filtered rows

# Performance improvement
perf(search): cache filtered results and prevent stale requests
- Add search result cache to avoid re-filtering
- Implement request ID to ignore stale responses
- Reduce search latency from 2s to 200ms
```

### Bad Examples

```bash
# Too granular
fix: update poam-database.js
chore: version bump
feat: add modal

# Too vague
fix: various fixes
update: multiple files
chore: cleanup
```

## Release Strategy

### Version Tags
```bash
# After merging a significant feature set
git tag -a v1.2.0 -m "Release v1.2.0: First-run setup and quota fixes"
git push origin v1.2.0
```

### Baseline Tags
```bash
# Mark stable working states
git tag -a baseline-working-2026-03-17 -m "Baseline: Working import with 443 POAMs"
git push origin baseline-working-2026-03-17
```

## Current Project State

**Main Branch**: Production-ready code  
**Feature Branches**: Use for large features (optional)  
**Commit Frequency**: Group related changes, commit when feature/fix is complete  
**Auto-push**: Enabled for approved commits

## Tools

### Check what's staged
```bash
git status
git diff --cached
```

### Amend last commit (if not pushed)
```bash
git add forgotten-file.js
git commit --amend --no-edit
```

### Interactive staging
```bash
git add -p  # Stage changes interactively
```

## Summary

**Key Principle**: One commit = One logical change (feature/fix/refactor)

Group all related file changes into a single commit with a clear, descriptive message that explains what changed and why.
