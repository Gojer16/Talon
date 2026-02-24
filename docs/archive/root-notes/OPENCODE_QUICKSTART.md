# 🎉 OpenCode Integration Complete!

## ✅ What's New

Talon now supports **4 FREE AI models** from OpenCode - no API key required!

### Available Models

1. **minimax-m2.5-free** - Fast and reliable (recommended)
2. **big-pickle** - Good for general tasks
3. **glm-5-free** - Returns reasoning content
4. **kimi-k2.5-free** - Advanced reasoning

## 🚀 Quick Start

### Option 1: Use Default Config

```bash
# Copy example config (already has OpenCode as default)
cp config.example.json ~/.talon/config.json

# Start Talon
npm start
```

### Option 2: Setup Wizard

```bash
npm run setup
# Select "OpenCode (FREE)" when prompted
```

### Option 3: CLI Command

```bash
# Add OpenCode provider
talon provider
# Select: OpenCode (FREE)
# No API key needed!

# Switch to OpenCode model
talon switch
# Select: OpenCode (FREE)
# Choose your preferred model
```

## 💬 Usage Examples

### Basic Chat

```bash
$ npm start

🦅 Talon v0.3.0
Connected to gateway at http://127.0.0.1:19789
Model: opencode/minimax-m2.5-free (FREE!)

You > Hello! What's 2+2?
🦅 Talon > 2+2 equals 4.
💰 0 → 50 = 50 tokens (OpenCode - FREE)
```

### Switch Models

```bash
You > /model
⚡ Current Model: opencode/minimax-m2.5-free
📍 Provider: OpenCode (FREE)
💰 Cost: $0.00

# Switch to different model
$ talon switch
? Choose provider: OpenCode (FREE)
? Choose model: big-pickle
✓ Switched to opencode/big-pickle
```

### Check Available Models

```bash
You > /config
⚙️  Talon Configuration
  Model:       opencode/minimax-m2.5-free
  Subagent:    opencode/big-pickle
  Providers:   OpenCode (FREE) ✅
  Cost:        $0.00/month
```

## 🎯 Model Selection Guide

| Model | Best For | Speed | Quality |
|-------|----------|-------|---------|
| **minimax-m2.5-free** | General use, fast responses | ⚡⚡⚡ | ⭐⭐⭐ |
| **big-pickle** | Varied tasks, balanced | ⚡⚡ | ⭐⭐⭐ |
| **glm-5-free** | Complex reasoning | ⚡⚡ | ⭐⭐⭐⭐ |
| **kimi-k2.5-free** | Analysis, deep thinking | ⚡ | ⭐⭐⭐⭐⭐ |

## 🔧 Configuration

Your `~/.talon/config.json` should look like this:

```json
{
  "agent": {
    "model": "opencode/minimax-m2.5-free",
    "subagentModel": "opencode/big-pickle",
    "providers": {
      "opencode": {
        "apiKey": "sk-opencode-free-no-key-required",
        "models": [
          "minimax-m2.5-free",
          "big-pickle",
          "glm-5-free",
          "kimi-k2.5-free"
        ]
      }
    }
  }
}
```

## 💰 Cost Comparison

| Provider | Monthly Cost (300M tokens) | OpenCode |
|----------|---------------------------|----------|
| OpenAI GPT-4o | $3,750 | **$0** |
| DeepSeek | $126 | **$0** |
| OpenRouter | $225+ | **$0** |
| **OpenCode** | **$0** | **FREE!** |

## 🛠️ Troubleshooting

### Rate Limited?

Switch to another OpenCode model:

```bash
talon switch
# Select different OpenCode model
```

Or fallback to DeepSeek/OpenRouter (if configured).

### Model Not Working?

Check your config:

```bash
cat ~/.talon/config.json | grep -A5 opencode
```

Should show:
```json
"opencode": {
  "apiKey": "sk-opencode-free-no-key-required",
  "models": ["minimax-m2.5-free", "big-pickle", "glm-5-free", "kimi-k2.5-free"]
}
```

### Empty Responses?

Some models return reasoning in a separate field. This is handled automatically, but you might see "(empty)" in logs while the model is thinking.

## 📚 Documentation

- [Full OpenCode Guide](docs/OPENCODE_INTEGRATION.md)
- [Implementation Details](OPENCODE_IMPLEMENTATION.md)
- [Main README](README.md)

## 🧪 Testing

Verify all models work:

```bash
node test-opencode-integration.js
```

Expected output:
```
🎉 All OpenCode models integrated successfully!
  ✅ minimax-m2.5-free
  ✅ big-pickle
  ✅ glm-5-free
  ✅ kimi-k2.5-free
```

## 🎊 Enjoy Free AI!

You now have access to 4 powerful AI models completely free. No credit card, no API key, no limits!

Happy chatting! 🦅
