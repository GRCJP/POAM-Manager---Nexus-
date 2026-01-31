#!/bin/bash

# POAM Nexus Quick Start
# Auto-detects project state and spins up the dev server from last known config

set -e

echo "🚀 POAM Nexus Quick Start"
echo "=========================="

# Detect if we're in the right directory
if [ ! -f "index.html" ] || [ ! -f "script.js" ]; then
    echo "❌ Error: Not in the POAM Nexus project root."
    echo "   Please run this script from the directory containing index.html and script.js"
    exit 1
fi

# Check if git repo is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    echo "🔗 Adding remote origin..."
    git remote add origin https://github.com/GRCJP/POAM-Manager---Nexus-.git
    echo "📥 Pulling latest changes..."
    git pull origin main
else
    echo "✅ Git repository already initialized"
fi

# Check if dev server is already running
if lsof -i :8080 > /dev/null 2>&1; then
    echo "⚠️  Dev server already running on port 8080"
    echo "🌐 Open http://localhost:8080 in your browser"
else
    echo "🌐 Starting dev server on http://localhost:8080"
    echo "   Press Ctrl+C to stop the server"
    python3 -m http.server 8080
fi
