# Subagent Model Configuration

## Overview

Subagents use a separate model configuration to optimize costs. By default, they use `gpt-4o-mini`, but you can configure any model from any provider.

## Configuration

Edit `~/.talon/config.json`:

```json
{
  "agent": {
    "model": "deepseek/deepseek-chat",
    "subagentModel": "openrouter/openai/gpt-4o-mini",
    "providers": {
      "openrouter": {
        "apiKey": "${OPENROUTER_API_KEY}",
        "models": ["openai/gpt-4o-mini", "google/gemini-flash-1.5"]
      }
    }
  }
}
```

## Model Format

Use the format: `provider/model-name`

### Examples

**OpenRouter models:**
```json
"subagentModel": "openrouter/openai/gpt-4o-mini"
"subagentModel": "openrouter/google/gemini-flash-1.5"
"subagentModel": "openrouter/anthropic/claude-3-haiku"
"subagentModel": "openrouter/meta-llama/llama-3.1-8b-instruct"
```

**DeepSeek models:**
```json
"subagentModel": "deepseek/deepseek-chat"
```

**OpenAI models:**
```json
"subagentModel": "openai/gpt-4o-mini"
"subagentModel": "openai/gpt-3.5-turbo"
```

## Recommended Cheap Models

For cost optimization, use these models:

| Provider | Model | Cost (per 1M tokens) | Best For |
|----------|-------|---------------------|----------|
| **DeepSeek** | `deepseek/deepseek-chat` | $0.14 | Best value |
| **OpenRouter** | `openrouter/openai/gpt-4o-mini` | $0.15 | Reliable |
| **OpenRouter** | `openrouter/google/gemini-flash-1.5` | $0.075 | Fastest |
| **OpenRouter** | `openrouter/meta-llama/llama-3.1-8b-instruct` | $0.06 | Open source |
| **OpenRouter** | `openrouter/anthropic/claude-3-haiku` | $0.25 | Quality |

## How It Works

1. **Main Agent** uses `agent.model` (e.g., `deepseek/deepseek-chat` or `openrouter/gpt-4o`)
2. **Subagents** use `agent.subagentModel` (defaults to `gpt-4o-mini`)
3. When you delegate a task with `delegate_to_subagent` tool, it uses the subagent model
4. **Cost savings:** If main uses gpt-4o ($5/1M) and subagents use gpt-4o-mini ($0.15/1M) = **97% savings**

## Changing the Model

### Option 1: Edit config file directly

```bash
nano ~/.talon/config.json
```

Add or modify:
```json
"subagentModel": "openrouter/google/gemini-flash-1.5"
```

### Option 2: Use the setup wizard

```bash
npm run setup:secure
```

The wizard will ask for your subagent model preference.

### Option 3: Environment variable (future)

```bash
export TALON_SUBAGENT_MODEL="openrouter/google/gemini-flash-1.5"
```

## Verification

After changing the config, restart Talon and check the logs:

```bash
talon restart
talon status
```

You should see:
```
Subagents initialized { model: 'openrouter/google/gemini-flash-1.5' }
```

## Notes

- The subagent model must be from a **configured provider** (with API key)
- If the model is not available, subagents will fail with "No provider available"
- All 5 subagents (research, writer, planner, critic, summarizer) use the same model
- You can't set different models per subagent type (yet)

## Future Enhancements

Planned features:
- Per-subagent model configuration
- Automatic model selection based on task complexity
- Fallback models for subagents
- Cost tracking per subagent type
