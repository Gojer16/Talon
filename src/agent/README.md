# Feature: Talon Agent System

## 1. Purpose
- Implements the core AI reasoning engine with state machine: PLAN → DECIDE → EXECUTE → EVALUATE → COMPRESS → RESPOND.
- Solves the problem of orchestrating AI model calls, tool execution, and memory management in a reliable loop.
- Exists as the "brain" of Talon that processes user requests through LLMs and tools.
- Does NOT handle: HTTP/WebSocket communication (gateway), tool implementations (tools), session persistence (gateway/sessions), or channel management (channels).

## 2. Scope Boundaries
- Belongs inside: AI model routing, fallback handling, context window management, agent state machine, prompt engineering.
- Must NEVER contain: Network server code, database operations, UI rendering, or tool business logic.
- Dependencies: gateway/ (for sessions/events), memory/ (for context), tools/ (for capabilities), config/ (for settings).
- Ownership boundaries: Agent owns AI reasoning flow. Gateway owns session state. Tools own specific capabilities. Memory owns context management.

## 3. Architecture Overview
```
Session → Agent Loop → Model Router → LLM Provider → Tool Execution → Memory Compression → Response
    ↑         ↑            ↑             ↑               ↑                ↑                 ↓
State     State       Cost-based    API calls      Registry        Summarization      Session
Machine   Machine     Routing      (OpenAI,       Dispatch        (keepRecent)       Update
                                  DeepSeek,
                                  OpenCode)
```

Entry points:
- `AgentLoop.process()` - Main entry for processing user messages
- `ModelRouter.getProviderForTask()` - Model selection for task complexity
- `FallbackRouter.executeWithFallback()` - Retry logic for failed calls

Core modules:
- `AgentLoop`: State machine with PLAN→DECIDE→EXECUTE→EVALUATE→COMPRESS→RESPOND cycle
- `ModelRouter`: Cost-based model selection (simple→cheapest, complex→best)
- `FallbackRouter`: Automatic retry with different providers on failure
- `ContextGuard`: Prevents token overflow with truncation and warnings
- `PromptSystem`: Loads workspace files (SOUL.md, USER.md, IDENTITY.md) and builds system prompts

State management: Loop state machine (`idle`→`thinking`→`executing`→`evaluating`→`compressing`→`responding`), iteration counting, tool call tracking.

Data flow: User message → context building → model selection → LLM call → tool execution → result evaluation → memory compression → response generation.

## 4. Folder Structure Explanation

**loop.ts** (21,592 lines)
- What: Main agent state machine implementation
- Why: Orchestrates the complete AI reasoning cycle with tool execution
- Who calls: Gateway via `MessageRouter`, CLI directly for testing
- What calls: ModelRouter, FallbackRouter, MemoryManager, ToolRegistry
- Side effects: Makes LLM API calls, executes tools, updates session memory
- Critical assumptions: Tools are registered, memory system is initialized, providers are configured

**prompts.ts** (21,851 lines)
- What: System prompt templates and workspace file loading
- Why: Injects personality (SOUL.md), user context (USER.md), identity (IDENTITY.md) into every LLM call
- Who calls: MemoryManager during context building
- What calls: File system operations, daily memory loader, template validation
- Side effects: Reads workspace files, loads daily memories, extracts user name
- Critical assumptions: Workspace files exist, templates are valid markdown, file system is accessible

**router.ts** (9,733 lines)
- What: Model routing logic with cost-based selection
- Why: Selects cheapest capable model for each task type (97% cost savings)
- Who calls: AgentLoop during model selection phase
- What calls: Provider factories, configuration validation
- Side effects: Initializes provider instances, validates API keys
- Critical assumptions: Provider config is valid, API keys are available (except OpenCode)

**fallback.ts** (10,012 lines)
- What: Fallback handling with automatic retry on provider failure
- Why: Ensures reliability when primary providers fail (rate limits, timeouts)
- Who calls: AgentLoop when LLM call fails
- What calls: Error classification, provider priority sorting, retry logic
- Side effects: Attempts multiple providers, tracks latency, logs failures
- Critical assumptions: Multiple providers configured, errors are classifiable

**context-guard.ts** (6,346 lines)
- What: Context window management and token estimation
- Why: Prevents token overflow crashes with truncation and warnings
- Who calls: AgentLoop before LLM calls, MemoryManager during compression
- What calls: Token estimation functions, model context window resolution
- Side effects: Truncates messages, logs warnings, blocks overflow attempts
- Critical assumptions: Token estimation is approximate, model context sizes are known

**providers/** (directory)
- What: AI provider implementations (OpenAI-compatible, OpenCode)
- Why: Abstracts different LLM APIs behind consistent interface
- Who calls: ModelRouter when making LLM calls
- What calls: External API endpoints (OpenAI, DeepSeek, OpenRouter, OpenCode)
- Side effects: Makes network requests, consumes API credits, streams responses
- Critical assumptions: APIs are available, network is reachable, credentials valid

## 5. Public API

**Exported classes:**
- `AgentLoop` (loop.ts) - Main state machine
- `ModelRouter` (router.ts) - Model selection
- `FallbackRouter` (fallback.ts) - Retry logic
- `OpenAICompatibleProvider` (providers/openai-compatible.ts) - Base provider
- `OpenCodeProvider` (providers/opencode.ts) - Free model provider

**Input types:**
- `Session`: Contains messages, metadata, context
- `TaskComplexity`: 'simple' | 'moderate' | 'complex' | 'summarize'
- `LLMMessage`: Array of {role, content} for LLM calls
- `ToolCall`: {id, name, args} for tool execution

**Output types:**
- `AgentChunk`: Streaming response chunks (thinking/text/tool_call/tool_result/done/error)
- `LLMResponse`: Complete LLM response with usage metrics
- `FallbackResult`: Result with attempt history and provider info
- `ContextWindowStatus`: Token usage analysis with warnings

**Error behavior:**
- LLM errors: Classified (auth/rate-limit/timeout/context/billing) → fallback or fail
- Tool errors: Returned as tool_result with success: false
- State errors: Invalid state transitions → reset to idle
- Validation errors: Invalid input → immediate failure with clear error

**Edge cases:**
- Empty workspace files: Uses default templates
- No providers configured: Warns but continues (will fail on LLM call)
- Tool execution timeout: Returns error, continues loop
- Infinite loops: Max iteration protection (default: 10)
- Context overflow: Truncates oldest messages, warns user

**Idempotency notes:**
- Model selection: Idempotent for same task complexity
- Fallback retry: Not idempotent (tracks attempts)
- Context building: Idempotent for same session state
- Tool execution: Depends on tool implementation

## 6. Internal Logic Details

**Core algorithms:**
- State machine: PLAN→DECIDE→EXECUTE→EVALUATE→COMPRESS→RESPOND with guard conditions
- Model routing: Cost-based selection with complexity mapping (simple→cheapest, complex→best)
- Fallback chain: Primary→Secondary→Tertiary with error classification and priority sorting
- Token estimation: ~4 chars/token approximation with message structure overhead
- Context truncation: Remove oldest messages while preserving tool call/result pairs

**Important decision trees:**
1. Task complexity → Model selection: simple→OpenCode/DeepSeek, moderate→default, complex→GPT-4o/Claude
2. LLM error → Classify → Retryable? → Yes→fallback, No→fail with error message
3. Context overflow → Estimate tokens → Warn threshold? → Block threshold? → Truncate or fail
4. Tool calls needed → LLM suggests tools → Validate → Execute → Collect results → Continue loop

**Guardrails:**
- Max iterations: Prevents infinite loops (configurable, default: 10)
- Token limits: Hard block at 16k remaining, warn at 32k remaining
- Rate limiting: Automatic fallback on 429 errors
- Tool safety: Tool registry validates before execution
- Missing: Cost tracking per provider (planned)

**Validation strategy:**
- Message validation: Role/content required, content non-empty
- Tool call validation: Name exists in registry, args match schema
- Context validation: Messages fit in window after estimation
- Configuration validation: Providers configured, API keys valid (except OpenCode)

**Retry logic:**
- LLM calls: 3 retries with exponential backoff on network/timeout errors
- Fallback chain: Try next provider on rate-limit/billing errors
- No retry: Authentication errors (invalid API key), context overflow
- Missing: Circuit breaker per provider (prevents hitting dead providers)

## 7. Data Contracts

**Schemas used:**
- `LLMMessageSchema`: Zod schema for LLM message format
- `ToolCallSchema`: Zod schema for tool call requests
- `AgentConfigSchema`: Zod schema for agent configuration
- `ProviderConfigSchema`: Zod schema for provider settings

**Validation rules:**
- LLM messages: Must have role ('system', 'user', 'assistant', 'tool'), content must be string
- Tool calls: Must have id (string), name (registered tool), args (object)
- Context windows: Model-specific limits enforced with safety margins
- Provider config: API keys required (except OpenCode), base URLs valid

**Expected shape of objects:**
```typescript
AgentChunk: {
  type: 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content?: string;
  toolCall?: { id: string; name: string; args: Record<string, unknown> };
  toolResult?: { id: string; output: string; success: boolean };
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  providerId?: string;
  model?: string;
  iteration?: number;
}

FallbackResult: {
  response: LLMResponse;
  providerId: string;
  model: string;
  attempts: Array<{providerId: string, success: boolean, error?: string, latencyMs: number}>;
  totalLatencyMs: number;
}
```

**Breaking-change risk areas:**
- LLM message format: Changing role/content structure breaks provider compatibility
- Tool call format: Changes break tool execution pipeline
- Provider interfaces: Changing base provider API breaks all implementations
- State machine: Adding/removing states breaks existing loop logic

## 8. Failure Modes

**Known failure cases:**
- All providers rate limited: No fallback available, request fails
- Context overflow after truncation: Even truncated messages exceed limit
- Tool registry empty: Agent cannot execute any tools
- Network partition: All external APIs unreachable
- Memory system failure: Cannot load workspace files or daily memories

**Silent failure risks:**
- Token estimation inaccurate: Actual tokens exceed estimate, causes overflow
- Fallback chain exhausted: Returns last error instead of comprehensive failure
- Tool execution errors: Swallowed by tool and returned as failed result
- Missing: Monitoring for degraded performance (slow providers)

**Race conditions:**
- Concurrent tool registration: Tools map modification during iteration
- Session state modification: Memory updates while building context
- Provider initialization: Multiple calls to initializeProviders()
- Missing: Locking for shared provider instances

**Memory issues:**
- Large context accumulation: Unbounded message history in session
- Provider instance proliferation: Each router creates new instances
- Stream buffer accumulation: Unconsumed response chunks
- Missing: Memory usage monitoring in agent loop

**Performance bottlenecks:**
- Sequential fallback: Tries providers one by one (no parallel attempt)
- File system reads: Workspace files loaded on every message
- Token estimation: O(n) over all messages for each LLM call
- Tool validation: Linear search through tool registry

## 9. Observability

**Logs produced:**
- State transitions: INFO level with from→to state
- Model selection: DEBUG level with complexity→provider mapping
- Fallback attempts: WARN level with provider errors and retries
- Context warnings: WARN level when tokens low, ERROR when blocking
- Token usage: DEBUG level with estimates vs limits
- Missing: Structured logging with correlation IDs

**Metrics to track:**
- State machine transitions (count by state)
- Model selection distribution (provider by complexity)
- Fallback rate (percentage of requests needing fallback)
- Token usage distribution (prompt/completion/total)
- Tool execution latency (p50, p95, p99)
- Provider success rate (by provider ID)
- Missing: Cost tracking per provider/model

**Debug strategy:**
1. Enable debug logging: `DEBUG=agent:*` environment variable
2. Check agent state: Log shows current state and iteration
3. Inspect context: `evaluateContextWindow()` shows token usage
4. Test providers: Direct provider calls bypassing router
5. Trace tool execution: Tool registry logs all executions

**How to test locally:**
1. Unit tests: `npm test src/agent/` (323 tests)
2. Integration: Create test session, send message, verify loop completes
3. Provider testing: Test each provider with simple prompt
4. Fallback testing: Mock provider failures, verify fallback works
5. Context testing: Create long conversation, verify truncation works

## 10. AI Agent Instructions

**How an AI agent should modify this feature:**
1. Understand the state machine flow before modifying loop logic
2. Test provider compatibility when changing LLM interfaces
3. Verify fallback behavior still works after changes
4. Check token estimation accuracy for new message formats
5. Run all 323 agent tests before committing

**What files must be read before editing:**
- `loop.ts`: Complete state machine logic and tool integration
- `router.ts`: Model selection algorithm and provider initialization
- `fallback.ts`: Error classification and retry logic
- `context-guard.ts`: Token estimation and truncation logic
- `prompts.ts`: Workspace file loading and system prompt construction

**Safe refactoring rules:**
1. Keep state machine transitions backward compatible
2. Maintain provider interface compatibility
3. Preserve fallback chain order (priority-based)
4. Don't break tool call/result pairing in context
5. Keep workspace file loading behavior consistent

**Forbidden modifications:**
- Removing state machine states without migration path
- Changing LLM message format without provider updates
- Breaking tool call serialization format
- Removing token estimation without replacement
- Changing workspace file paths without migration

## 11. Extension Points

**Where new functionality can be safely added:**
- New provider types: Add to `providers/` directory, register in router
- Additional states: Extend `LoopState` type, add transitions in loop
- Custom tool types: Implement tool interface, register in registry
- Enhanced prompts: Add new workspace file types, load in prompts.ts
- Monitoring hooks: Add event emissions in state transitions

**How to extend without breaking contracts:**
1. Add optional fields to existing types (never remove required fields)
2. Use feature flags for new states or providers
3. Provide default implementations for new interfaces
4. Version provider APIs with backward compatibility
5. Use migration for workspace file format changes

## 12. Technical Debt & TODO

**Weak areas:**
- Sequential fallback attempts (should try providers in parallel)
- Approximate token estimation (should use proper tokenizer)
- No cost tracking per request (cannot optimize for cost)
- File system reads on every message (should cache workspace files)
- Missing: Adaptive model selection based on past performance

**Refactor targets:**
- Extract state machine to finite state machine library
- Implement proper tokenization with @anthropic-ai/tokenizer
- Add cost tracking with configurable budgets
- Cache workspace files with file watcher for changes
- Missing: Dependency injection for testability

**Simplification ideas:**
- Reduce state machine states where possible
- Consolidate provider interfaces (OpenAI-compatible covers most)
- Simplify tool call validation (current is complex)
- Merge similar prompt templates
- Missing: Configuration-driven state machine