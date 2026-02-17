#!/bin/bash
# Fix corrupted Talon sessions

SESSION_DIR="$HOME/.talon/sessions"
BACKUP_DIR="$SESSION_DIR/backups"

echo "🦅 Talon Session Fixer"
echo "======================"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check for CLI session
if [ -f "$SESSION_DIR/cli-local.json" ]; then
    echo "Found CLI session: cli-local.json"
    
    # Check if session might be corrupted
    if grep -q '"tool_calls"' "$SESSION_DIR/cli-local.json"; then
        echo "⚠️  Session contains tool calls - might be corrupted"
        
        # Backup the corrupted session
        BACKUP_FILE="$BACKUP_DIR/cli-local-$(date +%Y%m%d-%H%M%S).json"
        cp "$SESSION_DIR/cli-local.json" "$BACKUP_FILE"
        echo "📦 Backed up to: $BACKUP_FILE"
        
        # Delete the corrupted session
        rm "$SESSION_DIR/cli-local.json"
        echo "🗑️  Deleted corrupted session"
        echo "✅ Session has been reset. Talon will start fresh."
    else
        echo "✅ Session looks clean"
    fi
else
    echo "No CLI session found"
fi

# Check for other sessions
SESSION_COUNT=$(ls "$SESSION_DIR"/*.json 2>/dev/null | grep -v backup | wc -l)
echo ""
echo "Total sessions: $SESSION_COUNT"

echo ""
echo "To start Talon with a fresh session:"
echo "  cd /Users/orlandoascanio/Desktop/PersonalOpenClawVersion"
echo "  npm start"