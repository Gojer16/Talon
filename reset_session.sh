#!/bin/bash
cd "$(dirname "$0")"

# Start Talon in background
node dist/cli/index.js start &
TALON_PID=$!

# Wait a bit for it to start
sleep 3

# Send /reset command
echo "/reset" > /dev/null

# Wait for it to process
sleep 2

# Send exit
echo "/exit" > /dev/null

# Kill the process
kill $TALON_PID 2>/dev/null

echo "Session should be reset now. Try running: npm start"