#!/bin/bash

# Start server if not running
if ! pgrep -f "python.*8080" > /dev/null; then
    echo "Starting dev server..."
    cd /Users/jleepe/CascadeProjects/repo/poam-project/POAM-Manager---Nexus-
    python3 -m http.server 8080 > /dev/null 2>&1 &
    sleep 2
fi

# Open test page in browser
echo "Opening test page in browser..."
open "http://localhost:8080/test-csv-import.html"

echo ""
echo "Test page opened. Check browser console for output."
echo "Look for:"
echo "  - ✅ Skills initialized"
echo "  - ✅ Classified X findings"
echo "  - First finding has remediation? ✅ YES or ❌ NO"
echo "  - ✅ Created X groups"
echo "  - First group has remediation? ✅ YES or ❌ NO"
