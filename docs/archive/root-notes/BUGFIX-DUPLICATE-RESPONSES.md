# Duplicate Response Bug Fix (CRITICAL)

## Problem

Agent responses were being duplicated 2-6 times:

```
🦅 Talon > Haha! I love it...
Haha! I love it...
Haha! I love it...
Haha! I love it...
Haha! I love it...
Haha! I love it...
```

## Root Cause

The `boot()` function in `src/gateway/index.ts` was being called multiple times (likely due to module hot-reloading or multiple imports during development). Each call:

1. Created a NEW `eventBus.on('message.inbound')` listener
2. Each listener runs the agent loop independently
3. Each agent loop produces a response
4. Result: N duplicate responses (where N = number of times boot() was called)

Additionally:
- The CLI channel's `start()` method had the same issue - registering event listeners multiple times
- No concurrency protection to prevent multiple agent loops from running simultaneously

## Fixes Applied

### Fix 1: Prevent Duplicate boot() Calls (`src/gateway/index.ts`)

```typescript
let isBooted = false;

async function boot(): Promise<void> {
    if (isBooted) {
        logger.warn('Gateway already booted, ignoring duplicate boot() call');
        return;
    }
    isBooted = true;
    // ... rest of boot logic
}
```

### Fix 2: Prevent Duplicate CLI start() Calls (`src/channels/cli/index.ts`)

```typescript
export class CliChannel extends BaseChannel {
    private isStarted = false;

    public async start(): Promise<void> {
        if (this.isStarted) {
            logger.warn('CLI channel already started');
            return;
        }
        this.isStarted = true;
        // ... rest of start logic
    }
}
```

### Fix 3: Only Send Response on 'done' Chunk (`src/gateway/index.ts`)

```typescript
// Final response → only send when done
if (chunk.type === 'done') {
    const lastMsg = session.messages.filter(m => m.role === 'assistant').pop();
    if (lastMsg?.content) {
        router.handleOutbound(sessionId, lastMsg.content);
    }
}
```

This ensures we only send the response ONCE when the agent loop completes, not for every text chunk.

### Fix 4: Added Debug Logging

Added logging to track:
- When `handleInbound()` is called
- When `handleOutbound()` is called  
- When event listeners fire

This helps diagnose if the issue returns.

## Why This Happened

During development, Node.js module caching can sometimes fail (especially with TypeScript compilation + hot reloading), causing modules to be imported multiple times. Each import runs the module's top-level code, which in this case called `boot()`.

The guards ensure that even if the module is imported multiple times, the initialization only happens once.

## Files Modified

1. `src/gateway/index.ts` - Added `isBooted` guard
2. `src/channels/cli/index.ts` - Added `isStarted` guard
3. `src/gateway/router.ts` - Added debug logging

## Testing

```bash
npm run build
npm start
```

Expected: Each agent response appears exactly once.

If duplicates still occur, check logs for:
- "Gateway already booted" warnings
- "CLI channel already started" warnings
- Multiple "handleInbound called" or "handleOutbound called" logs for the same message

