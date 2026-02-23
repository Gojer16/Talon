# AGENTS.md

Operating instructions for agentic coding agents working in the Talon codebase.

## Project Overview

Talon is a personal AI assistant that runs locally with multi-channel support (CLI, Telegram, WhatsApp), persistent memory, and tool-based capabilities. Built with TypeScript on Node.js 22+.

**Tech Stack:** TypeScript 5.7+, Node.js 22+, Fastify 5.x, Vitest, Zod, Pino, OpenAI SDK

## Build / Lint / Test Commands

### Development
```bash
npm run dev              # Start gateway with hot reload (tsx watch)
npm run build            # Compile TypeScript to dist/
npm run build:all        # Build main + web
npm start                # Production start (builds first)
```

### Testing
```bash
npm test                 # Run all tests with Vitest
npm run test:watch       # Watch mode
npm run test:coverage    # Run with coverage report

# Run a single test file
npx vitest run tests/unit/file-tools.test.ts

# Run a single test by name pattern
npx vitest run -t "should read entire file"

# Run specific test categories
npx vitest run tests/unit/        # Unit tests only
npx vitest run tests/integration/ # Integration tests only
npx vitest run tests/e2e/         # E2E tests only
```

### Type Checking
```bash
npx tsc --noEmit          # Type check without emitting
npx tsc                   # Full build (includes type check)
```

## Code Style Guidelines

### File Organization
- Source code: `src/`
- Tests: `tests/` (mirrors src structure with unit/integration/e2e subdirs)
- Compiled output: `dist/`
- Configuration: `~/.talon/` (user data, never committed)

### Imports

```typescript
// Node.js built-ins first (with node: prefix)
import fs from 'node:fs';
import path from 'node:path';

// External packages second
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

// Internal imports last (use .js extension for ESM)
import type { TalonConfig } from '../config/schema.js';
import { logger } from '../utils/logger.js';
```

**Rules:**
- Always use `node:` prefix for Node.js built-ins
- Use `.js` extension in imports (TypeScript ESM requirement)
- Use `type` keyword for type-only imports
- Group imports: built-ins → external → internal

### Formatting

No Prettier config - follow existing code patterns:

```typescript
// Indentation: 4 spaces (no tabs)
function example() {
    const value = 1;
}

// Section comments with ─── delimiters
// ─── Section Name ──────────────────────────────────────────────────

// Max line length: ~100 characters

// Object/array trailing commas: yes
const config = {
    name: 'talon',
    version: '0.4.0',
};
```

### TypeScript Conventions

```typescript
// Use strict mode (enabled in tsconfig)
// Prefer interfaces for object shapes
interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<string>;
}

// Use type for unions and aliases
type LoopState = 'idle' | 'thinking' | 'executing' | 'error';

// Use const assertions for literal types
const STATES = ['idle', 'thinking', 'executing'] as const;

// Prefer async/await over .then()
async function fetchData(): Promise<string> {
    const result = await someAsyncOp();
    return result;
}

// Use optional chaining and nullish coalescing
const value = config?.tools?.files?.maxFileSize ?? 1048576;
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `file-tools.ts`, `model-router.ts` |
| Classes | PascalCase | `AgentLoop`, `MemoryManager` |
| Functions | camelCase | `registerTools()`, `isPathAllowed()` |
| Constants | camelCase | `maxIterations`, `defaultTimeout` |
| Interfaces | PascalCase | `TalonConfig`, `ToolDefinition` |
| Types | PascalCase | `LoopState`, `AgentChunk` |
| Private fields | camelCase with leading underscore | `_internal` |

### Error Handling

```typescript
// Return error strings from tools (not throw)
async function execute(args: Record<string, unknown>): Promise<string> {
    if (!isPathAllowed(path, config)) {
        return `Error: Access denied to path "${path}".`;
    }
    
    if (!fs.existsSync(path)) {
        return `Error: File not found: "${path}"`;
    }
    
    // Success case
    return content;
}

// Use try/catch in async operations
try {
    const result = await riskyOperation();
    return result;
} catch (error) {
    logger.error({ error }, 'Operation failed');
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
}

// Use Zod for validation
const result = schema.safeParse(input);
if (!result.success) {
    return `Error: Invalid input: ${result.error.message}`;
}
```

### Logging

```typescript
import { logger } from '../utils/logger.js';

// Use structured logging with pino
logger.debug({ path: filePath, lines: lineCount }, 'file_read');
logger.info({ sessionId, model }, 'Session started');
logger.warn({ attempts: 3 }, 'Retrying connection');
logger.error({ error }, 'Failed to process request');
```

### Testing Patterns

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Feature Name', () => {
    let testDir: string;
    
    beforeAll(async () => {
        // Setup
        testDir = path.join(os.tmpdir(), `talon-test-${Date.now()}`);
        fs.mkdirSync(testDir, { recursive: true });
    });
    
    afterAll(() => {
        // Cleanup
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });
    
    it('should do something specific', async () => {
        const result = await someFunction();
        expect(result).toBe('expected');
    });
});
```

## Architecture Notes

### Core Components

- **Agent Loop** (`src/agent/loop.ts`): State machine (idle → thinking → executing → evaluating → responding)
- **Model Router** (`src/agent/router.ts`): Routes to correct LLM provider
- **Gateway** (`src/gateway/`): Fastify server with WebSocket support
- **Tools** (`src/tools/`): File, shell, web, memory, browser, Apple integrations
- **Memory** (`src/memory/`): Short-term, long-term, compression
- **Channels** (`src/channels/`): CLI, Telegram, WhatsApp handlers

### Tool Registration

```typescript
import type { ToolDefinition } from './registry.js';

export function registerFileTools(config: TalonConfig): ToolDefinition[] {
    return [
        {
            name: 'file_read',
            description: 'Read file contents...',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: '...' },
                },
                required: ['path'],
            },
            execute: async (args) => {
                // Implementation
                return result;
            },
        },
    ];
}
```

### Config Access

User configuration lives in `~/.talon/config.json` with Zod schema in `src/config/schema.ts`. Never commit personal data - it goes in `~/.talon/workspace/` (gitignored).

## Important Patterns

### Path Safety
Always validate paths against `allowedPaths` and `deniedPaths` in config before file operations.

### Context Window Guard
Use `evaluateContextWindow()` and `truncateMessagesToFit()` to prevent token overflow.

### Model Fallback
The `FallbackRouter` handles automatic retries with different providers on failure.

### WebSocket Protocol
Messages follow the `WSMessage` interface with `id`, `type`, `timestamp`, `payload` fields. Use Zod schemas from `src/protocol/` for validation.

## Pre-commit Checklist

1. Run `npm run build` - must compile without errors
2. Run `npm test` - all tests must pass
3. Run `npx tsc --noEmit` - no type errors
4. Check imports use `.js` extension and `node:` prefix
5. Ensure no secrets or personal data in code
