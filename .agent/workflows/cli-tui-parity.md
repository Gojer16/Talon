---
description: CLI ↔ TUI Parity — keep both interfaces in sync at all times
---

# CLI ↔ TUI Parity Rule

**MANDATORY**: The CLI channel and TUI client share a **single renderer** (`src/channels/cli/renderer.ts`). All display logic lives there. If you need to change how output looks, edit `renderer.ts` — both interfaces update automatically.

## Architecture (Post-Refactor)

```
src/channels/cli/renderer.ts    ← SINGLE SOURCE OF TRUTH for all display
      ↑                    ↑
      │                    │
src/channels/cli/index.ts  src/cli/tui.ts
(event bus adapter)        (WebSocket adapter)
```

Both the CLI and TUI are **thin adapters** that:
1. Receive messages from their transport (event bus / WebSocket)
2. Convert them to `RenderChunk` objects
3. Pass them to `TerminalRenderer.handleChunk()`

The renderer handles everything: buffering, tool results, timeouts, formatting, error display.

## What lives where:

| Change type | Edit this file | Auto-works in both? |
|---|---|---|
| Display formatting | `renderer.ts` | ✅ YES |
| New chunk/message type | `renderer.ts` | ✅ YES |
| Tool call display | `renderer.ts` | ✅ YES |
| Error handling display | `renderer.ts` | ✅ YES |
| Timeout behavior | `renderer.ts` | ✅ YES |
| New slash command | `commands.ts` + `tui.ts` | ⚠️ Need both |
| New event bus event | `cli/index.ts` | ⚠️ CLI only, need TUI too |
| New WebSocket message type | `renderer.ts` (`wsMessageToChunk`) + TUI auto-uses | ✅ Usually YES |

## Key interfaces:

```typescript
// RenderChunk — the universal display input
interface RenderChunk {
    type: 'text' | 'thinking' | 'error' | 'tool_call' | 'tool_result' | 'done';
    content?: string;
    toolCall?: { id: string; name: string; args: Record<string, unknown> };
    toolResult?: { id: string; output: string; success: boolean };
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    providerId?: string;
    model?: string;
}
```

## When making changes:

1. **Display change?** → Edit `renderer.ts` only. Done.
2. **New agent loop chunk type?**
   - Add to `RenderChunk` type in `renderer.ts`
   - Add handler in `TerminalRenderer`
   - Add mapping in `wsMessageToChunk()` (for TUI)
   - Gateway type mapping in `gateway/index.ts` if needed
3. **New slash command?**
   - Add to `commands.ts` (CLI picks it up via command registry)
   - Add to TUI's `handleSlashCommand()` in `tui.ts`
4. **After ALL changes:**
   - Run tests: `npx vitest run`
   - Build: `npm run build` (TUI runs from `dist/`)
   - Restart: `talon service restart`

## Files to check together:

```
src/channels/cli/renderer.ts    ← Display logic (shared)
src/channels/cli/index.ts       ← CLI adapter (event bus → renderer)
src/cli/tui.ts                  ← TUI adapter (WebSocket → renderer)
src/channels/cli/commands.ts    ← Slash commands (CLI)
src/channels/cli/utils.ts       ← Text formatting utilities
src/gateway/index.ts             ← Gateway (broadcasts chunks)
src/agent/loop.ts                ← Agent loop (produces chunks)
```
