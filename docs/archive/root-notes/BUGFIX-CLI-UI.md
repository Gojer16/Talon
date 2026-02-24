# CLI UI Fixes

## Issues Fixed

### 1. Duplicate Greeting
**Problem:** "Hello! Good morning! 🦅" appeared twice on startup

**Fix:** Removed duplicate line in `src/channels/cli/index.ts`

### 2. Background Logs Interfering with Input
**Problem:** Tool execution logs and status messages appeared on the same line as "You >" prompt

**Fix:** Added line clearing before log output:
```typescript
// Clear current line before showing logs
process.stdout.write('\r\x1b[K');
console.log(chalk.gray(`🛠️  Using tool: ${params.tool}`));
this.prompt(); // Re-show prompt after log
```

### 3. List Bullets Removed
**Problem:** Markdown list items (`- item`) had dashes stripped, making text feel "in the air"

**Fix:** Preserve dashes with color in `stripMarkdown()`:
```typescript
.replace(/^\s*[-*+]\s+/gm, chalk.dim('  - '))
```

### 4. Separator Lines Not Colored
**Problem:** `---` separators were plain text

**Fix:** Add color to separators:
```typescript
.replace(/---+/g, chalk.dim('---'))
```

### 5. Agent Name Confusion
**Problem:** Template suggested "Claw" but project is called "Talon"

**Fix:** Updated templates to suggest "Talon" as default:
- `workspace/BOOTSTRAP.md` - Added "Talon is a good default" with 🦅 emoji
- `workspace/IDENTITY.md` - Added suggested names list

## Files Modified

1. `src/channels/cli/index.ts` - CLI output formatting
2. `workspace/BOOTSTRAP.md` - Name suggestions
3. `workspace/IDENTITY.md` - Name suggestions

## Result

Clean CLI output with:
- Single greeting on startup
- Background logs don't interfere with input line
- List items show with colored dashes: `  - item`
- Separators are dimmed: `---`
- Clear guidance to use "Talon" as the agent name
