#!/bin/bash
# Update Talon config with OpenRouter fallback

CONFIG_FILE="$HOME/.talon/config.json"
ENV_FILE="$HOME/.talon/.env"

echo "🦅 Talon Config Updater"
echo "======================="

# Check if config exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file not found: $CONFIG_FILE"
    exit 1
fi

echo "Current config:"
echo "---------------"
grep -A2 '"model"' "$CONFIG_FILE"
echo ""

# Ask for OpenRouter API key
echo "Do you have an OpenRouter API key? (Get one at https://openrouter.ai/)"
read -p "Enter your OpenRouter API key (or press Enter to skip): " OPENROUTER_KEY

if [ -n "$OPENROUTER_KEY" ]; then
    # Update .env file
    if [ -f "$ENV_FILE" ]; then
        if grep -q "OPENROUTER_API_KEY" "$ENV_FILE"; then
            sed -i '' "s/OPENROUTER_API_KEY=.*/OPENROUTER_API_KEY=$OPENROUTER_KEY/" "$ENV_FILE"
        else
            echo "OPENROUTER_API_KEY=$OPENROUTER_KEY" >> "$ENV_FILE"
        fi
    else
        echo "OPENROUTER_API_KEY=$OPENROUTER_KEY" > "$ENV_FILE"
    fi
    
    # Update config.json with OpenRouter provider
    echo "Updating config with OpenRouter fallback..."
    
    # Create a temporary config with OpenRouter
    cat > /tmp/talon_config_update.json << 'EOF'
{
  "agent": {
    "model": "deepseek/deepseek-chat",
    "providers": {
      "deepseek": {
        "apiKey": "${DEEPSEEK_API_KEY}",
        "baseUrl": "https://api.deepseek.com",
        "models": [
          "deepseek-chat",
          "deepseek-reasoner"
        ]
      },
      "openrouter": {
        "apiKey": "${OPENROUTER_API_KEY}",
        "baseUrl": "https://openrouter.ai/api/v1",
        "models": [
          "openrouter/auto",
          "meta-llama/llama-3.3-70b-instruct:free",
          "qwen/qwen-2.5-32b-instruct:free",
          "mistralai/mistral-7b-instruct:free"
        ]
      }
    }
  },
  "gateway": {
    "host": "127.0.0.1",
    "port": 19789,
    "auth": {
      "mode": "none"
    }
  },
  "workspace": {
    "root": "/Users/orlandoascanio/.talon/workspace"
  }
}
EOF
    
    # Merge with existing config (keeping other settings)
    jq --slurp '.[0] * .[1]' "$CONFIG_FILE" /tmp/talon_config_update.json > /tmp/talon_config_merged.json 2>/dev/null
    
    if [ $? -eq 0 ]; then
        mv /tmp/talon_config_merged.json "$CONFIG_FILE"
        echo "✅ Config updated with OpenRouter fallback!"
        echo ""
        echo "Talon will now:"
        echo "1. Try DeepSeek first (cheapest)"
        echo "2. Fall back to OpenRouter if DeepSeek fails"
        echo "3. Use free models on OpenRouter (Llama 3.3 70B, Qwen 2.5 32B, etc.)"
    else
        echo "⚠️  Could not merge configs. Installing jq might help: brew install jq"
        echo "Manually update your config.json with the OpenRouter provider section"
    fi
    
    rm /tmp/talon_config_update.json
else
    echo "⚠️  No OpenRouter key provided. Talon will only use DeepSeek."
    echo "If DeepSeek has issues, you'll need to fix the API key or get OpenRouter."
fi

echo ""
echo "To test the new config:"
echo "  cd /Users/orlandoascanio/Desktop/PersonalOpenClawVersion"
echo "  npm start"