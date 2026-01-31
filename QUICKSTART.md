# POAM Nexus - Quick Start Guide

## One-Command Startup

Open this folder in your terminal and run:

```bash
./start.sh
```

This script will:
- Auto-detect if git is initialized (and init if needed)
- Add the GitHub remote if missing
- Pull the latest changes
- Start the dev server on http://localhost:8080

## Manual Steps (if you prefer)

### 1. Open the project
```bash
cd /path/to/POAM-Manager---Nexus-
```

### 2. Ensure git is set up
```bash
git init
git remote add origin https://github.com/GRCJP/POAM-Manager---Nexus-.git
git pull origin main
```

### 3. Start dev server
```bash
python3 -m http.server 8080
```

Then open http://localhost:8080

## Edit → Test → Push Workflow

1. **Edit** any file in this folder
2. **Test** changes at http://localhost:8080
3. **Commit and push**:
   ```bash
   git add .
   git commit -m "describe your changes"
   git push origin main
   ```

## Project Structure

- `index.html` - Main application entry point
- `script.js` - Core application logic
- `poam-*.js` - POAM workbook modules
- `vulnerability-*.js` - Vulnerability analysis engines
- `test_*.html` - Test pages for specific features

## Need SSH instead of HTTPS?

If you prefer SSH authentication for GitHub pushes:
```bash
git remote set-url origin git@github.com:GRCJP/POAM-Manager---Nexus-.git
```

Then add your SSH key to GitHub (see GitHub docs for "Adding a new SSH key").
