#!/bin/bash
# Start a local HTTP server, run Playwright tests, then stop the server.
# Usage: ./tests/run-tests.sh [optional playwright args]
# Example: ./tests/run-tests.sh --grep "navigation"
# Example: ./tests/run-tests.sh tests/dashboard.spec.js

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "Starting HTTP server on port 8080..."
python3 -m http.server 8080 &
SERVER_PID=$!

# Give the server a moment to start
sleep 2

# Verify server is running
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "ERROR: HTTP server failed to start"
  exit 1
fi

echo "Server running (PID: $SERVER_PID)"
echo "Running Playwright tests..."

npx playwright test "$@"
EXIT_CODE=$?

echo "Stopping server (PID: $SERVER_PID)..."
kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true

exit $EXIT_CODE
