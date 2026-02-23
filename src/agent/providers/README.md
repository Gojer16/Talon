# 📁 agent/providers/ - AI Model Providers

## 🎯 What This Folder Does
Implements AI model provider integrations for various LLM services. Supports OpenAI-compatible APIs (DeepSeek, OpenRouter, OpenAI) and specialized providers like OpenCode.

## 📄 Key Files
- `openai-compatible.ts` - **Unified OpenAI-compatible provider** (9455 lines) - Works with DeepSeek, OpenRouter, OpenAI, and any OpenAI-compatible API (covers ~90% of models)
- `opencode.ts` - **OpenCode specialized provider** (3880 lines) - Integration with OpenCode AI service for coding tasks

## ⚠️ Important Constraints
- **OpenAI compatibility**: Most providers must follow OpenAI API schema
- **API key management**: Keys must be loaded from environment/config
- **Rate limiting**: Implement retry logic with exponential backoff
- **Streaming support**: Must support both streaming and non-streaming responses
- **Tool calling**: Must support OpenAI-style tool/function calling

## 🔌 Public Interfaces
- `OpenAICompatibleProvider` - Main provider for OpenAI-compatible services
- `OpenCodeProvider` - Specialized provider for OpenCode service
- `LLMResponse` interface - Standardized response format
- `LLMStreamChunk` interface - Streaming response chunks
- `LLMTool` interface - Tool definition for function calling

## 🔧 Provider Configuration
Each provider requires:
```typescript
{
  apiKey: string,           // API key for the service
  baseURL: string,          // API endpoint URL
  model: string,            // Model name to use
  temperature: number,      // Creativity level (0.0-1.0)
  maxTokens: number         // Maximum response tokens
}
```

## 🚨 Common Issues & Fixes
1. **API key errors**: Check environment variables and config files
2. **Rate limiting (429)**: Implement exponential backoff: wait 1s → 2s → 4s → 8s
3. **Connection timeouts**: Increase timeout settings for slow networks
4. **Model not found**: Verify model name matches provider's available models
5. **Streaming interruptions**: Handle connection drops gracefully

## 🔄 Supported Services
- **DeepSeek**: `https://api.deepseek.com/v1`
- **OpenRouter**: `https://openrouter.ai/api/v1`
- **OpenAI**: `https://api.openai.com/v1`
- **OpenCode**: `https://api.opencode.ai/v1`
- **Any OpenAI-compatible**: Custom base URLs supported

## 📊 Performance Notes
- **OpenAI-compatible**: Fastest, most reliable (90% use case)
- **OpenCode**: Specialized for coding, may be slower for general tasks
- **Fallback chains**: Configure primary → secondary → tertiary providers

## 🔗 Integration
- Used by `AgentLoop` for LLM calls
- Configured via `ModelRouter` in `../router.ts`
- Fallback handling via `FallbackRouter` in `../fallback.ts`