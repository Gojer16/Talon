#!/bin/bash
# ─── Channel Integration Test Script ──────────────────────────────
# Tests Telegram and WhatsApp channel connectivity and message flow

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║     Talon Channel Integration Test Suite              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if config exists
CONFIG_FILE="$HOME/.talon/config.json"
ENV_FILE="$HOME/.talon/.env"

echo "📋 Checking configuration..."
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ Config file not found: $CONFIG_FILE${NC}"
    echo "Please run 'npm run setup' first"
    exit 1
else
    echo -e "${GREEN}✅ Config file found${NC}"
fi

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  Env file not found: $ENV_FILE${NC}"
else
    echo -e "${GREEN}✅ Env file found${NC}"
fi

echo ""
echo "📊 Checking channel configuration..."

# Check Telegram config
TELEGRAM_ENABLED=$(cat "$CONFIG_FILE" | grep -A 5 '"telegram"' | grep '"enabled"' | grep -o 'true\|false' || echo "false")
TELEGRAM_TOKEN=$(cat "$ENV_FILE" | grep 'TELEGRAM_BOT_TOKEN' | cut -d'=' -f2 || echo "")

echo ""
echo "✈️  Telegram:"
if [ "$TELEGRAM_ENABLED" = "true" ]; then
    echo -e "${GREEN}  ✅ Enabled in config${NC}"
    if [ -n "$TELEGRAM_TOKEN" ]; then
        echo -e "${GREEN}  ✅ Bot token configured in .env${NC}"
        
        # Test Telegram API
        echo "  🧪 Testing Telegram API..."
        RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/getMe")
        if echo "$RESPONSE" | grep -q '"ok":true'; then
            BOT_NAME=$(echo "$RESPONSE" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
            echo -e "${GREEN}  ✅ Bot API working! Bot: @$BOT_NAME${NC}"
            
            # Get updates
            echo "  📬 Checking for recent updates..."
            UPDATES=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates" -d "offset=-1")
            echo "  Last update: $UPDATES"
        else
            echo -e "${RED}  ❌ Bot API failed${NC}"
            echo "  Response: $RESPONSE"
        fi
    else
        echo -e "${RED}  ❌ Bot token missing in .env${NC}"
        echo "  Add: TELEGRAM_BOT_TOKEN=your_token_here"
    fi
else
    echo -e "${YELLOW}  ⚠️  Disabled in config${NC}"
fi

# Check WhatsApp config
WHATSAPP_ENABLED=$(cat "$CONFIG_FILE" | grep -A 5 '"whatsapp"' | grep '"enabled"' | grep -o 'true\|false' || echo "false")
WHATSAPP_USERS=$(cat "$CONFIG_FILE" | grep -A 10 '"whatsapp"' | grep -A 1 'allowedUsers' | grep -o '\[.*\]' || echo "[]")

echo ""
echo "📱 WhatsApp:"
if [ "$WHATSAPP_ENABLED" = "true" ]; then
    echo -e "${GREEN}  ✅ Enabled in config${NC}"
    echo "  Allowed users: $WHATSAPP_USERS"
    
    # Check if dependencies are installed
    if npm list whatsapp-web.js >/dev/null 2>&1; then
        echo -e "${GREEN}  ✅ whatsapp-web.js installed${NC}"
    else
        echo -e "${RED}  ❌ whatsapp-web.js not installed${NC}"
        echo "  Run: npm install whatsapp-web.js qrcode-terminal"
    fi
else
    echo -e "${YELLOW}  ⚠️  Disabled in config${NC}"
fi

echo ""
echo "🔍 Checking running Talon processes..."
TALON_PIDS=$(pgrep -f "talon|gateway" || echo "")
if [ -n "$TALON_PIDS" ]; then
    echo -e "${GREEN}  ✅ Talon is running (PIDs: $TALON_PIDS)${NC}"
else
    echo -e "${YELLOW}  ⚠️  Talon is not running${NC}"
    echo "  Run: npm start"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "Summary:"
echo "  - Config: $([ -f "$CONFIG_FILE" ] && echo '✅' || echo '❌')"
echo "  - Telegram: $([ "$TELEGRAM_ENABLED" = "true" ] && [ -n "$TELEGRAM_TOKEN" ] && echo '✅ Ready' || echo '⚠️  Not configured')"
echo "  - WhatsApp: $([ "$WHATSAPP_ENABLED" = "true" ] && echo '✅ Enabled' || echo '⚠️  Disabled')"
echo "  - Talon Running: $([ -n "$TALON_PIDS" ] && echo '✅ Yes' || echo '❌ No')"
echo "═══════════════════════════════════════════════════════"
echo ""

# Instructions for manual testing
echo "📖 Manual Testing Instructions:"
echo ""
echo "For Telegram:"
echo "  1. Open Telegram and find your bot"
echo "  2. Send: /start"
echo "  3. Send a test message: 'Hello Talon!'"
echo "  4. Check Talon logs for: 'Telegram message received'"
echo ""
echo "For WhatsApp:"
echo "  1. Wait for QR code in Talon logs"
echo "  2. Scan QR with WhatsApp phone app"
echo "  3. Send a test message to Talon"
echo "  4. Check Talon logs for: 'WhatsApp message received'"
echo ""
echo "Debug Mode:"
echo "  Run Talon with: DEBUG=true npm start"
echo "  This will show detailed channel logs"
echo ""
