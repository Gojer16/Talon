# Talon — Tools & Capabilities

This document details every tool the agent can invoke, including parameters, return values, security considerations, and implementation notes.

---

## Tool Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Tool Registry                         │
│                                                          │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐ │
│  │  File    │ │  Shell  │ │ Browser  │ │   Memory     │ │
│  │  Tools   │ │  Tools  │ │  Tools   │ │   Tools      │ │
│  │ (5 tools)│ │(1 tool) │ │(5 tools) │ │  (2 tools)   │ │
│  └─────────┘ └─────────┘ └──────────┘ └──────────────┘ │
│                                                          │
│  ┌──────────┐ ┌──────────────┐                          │
│  │   OS     │ │   Persona    │                          │
│  │  Tools   │ │   Tools      │                          │
│  │(3 tools) │ │  (1 tool)    │                          │
│  └──────────┘ └──────────────┘                          │
│                                                          │
│  Total: 17 built-in tools                                │
└──────────────────────────────────────────────────────────┘
```

---

## 1. Filesystem Tools

### `file_read`

Read the contents of a file.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | ✅ | Absolute or `~/`-relative path |
| `startLine` | `number` | ❌ | 1-indexed start line |
| `endLine` | `number` | ❌ | 1-indexed end line (inclusive) |
| `encoding` | `string` | ❌ | File encoding (default: `utf-8`) |

**Returns:** File contents as string. If lines specified, only those lines.

**Security:** Respects `tools.files.allowedPaths` config. Rejects reads outside allowed paths.

---

### `file_write`

Create or overwrite a file.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | ✅ | Target file path |
| `content` | `string` | ✅ | File contents |
| `createDirs` | `boolean` | ❌ | Create parent dirs if missing (default: `true`) |

**Returns:** Confirmation with file path and byte count.

**Security:** Creates parent directories automatically. Asks for confirmation if overwriting an existing file (configurable).

---

### `file_edit`

Edit a file by replacing specific text.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | ✅ | File to edit |
| `oldText` | `string` | ✅ | Exact text to find |
| `newText` | `string` | ✅ | Replacement text |

**Returns:** Confirmation showing the diff applied.

**Notes:** Fails if `oldText` is not found or matches multiple locations (ambiguous).

---

### `file_list`

List files and directories.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | ✅ | Directory to list |
| `recursive` | `boolean` | ❌ | Recurse into subdirectories (default: `false`) |
| `maxDepth` | `number` | ❌ | Max recursion depth (default: `3`) |
| `pattern` | `string` | ❌ | Glob pattern filter (e.g., `*.ts`) |

**Returns:** Array of entries with name, type (file/dir), size, and modification time.

---

### `file_search`

Search for text content across files.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | ✅ | Directory to search |
| `query` | `string` | ✅ | Text or regex pattern |
| `glob` | `string` | ❌ | File filter (e.g., `*.ts`) |
| `caseSensitive` | `boolean` | ❌ | Case-sensitive search (default: `false`) |
| `maxResults` | `number` | ❌ | Cap results (default: `50`) |

**Returns:** Array of matches with file path, line number, and matching line content.

**Implementation:** Uses `ripgrep` if available, falls back to Node.js `readline` scanning.

---

## 2. Shell Tool

### `shell_execute`

Execute a shell command.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `command` | `string` | ✅ | Shell command to run |
| `cwd` | `string` | ❌ | Working directory (default: `~`) |
| `timeout` | `number` | ❌ | Timeout in ms (default: `30000`) |
| `background` | `boolean` | ❌ | Run in background (default: `false`) |

**Returns:**

```typescript
{
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}
```

**Security considerations:**

- **Confirmation required** for destructive commands (configurable pattern list):
  - `rm`, `rmdir`, `mv` (when overwriting), `dd`, `mkfs`
  - Any command with `sudo`
  - `git push`, `git push --force`
- **Blocked commands** (configurable denylist):
  - `rm -rf /`, `:(){ :|:& };:` (fork bomb)
- **Streaming output**: Long-running commands stream stdout/stderr back in real-time
- **Background processes**: Can be started and monitored via process ID

---

## 3. Browser Tools

Browser tools use a **dedicated Chromium instance** managed by Playwright. The browser is separate from the user's personal browser to avoid interference.

### `browser_navigate`

Navigate to a URL.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | ✅ | URL to navigate to |
| `waitFor` | `string` | ❌ | CSS selector to wait for before returning |

**Returns:** Page title and current URL after navigation.

---

### `browser_click`

Click an element on the page.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | ✅ | CSS selector of element to click |

**Returns:** Confirmation of click action.

---

### `browser_type`

Type into a form field.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | ✅ | CSS selector of input element |
| `text` | `string` | ✅ | Text to type |
| `clear` | `boolean` | ❌ | Clear field first (default: `true`) |

**Returns:** Confirmation.

---

### `browser_extract`

Extract text content from the page.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | ❌ | CSS selector (default: full page `body`) |
| `format` | `'text' \| 'html' \| 'markdown'` | ❌ | Output format (default: `text`) |

**Returns:** Extracted content string.

---

### `browser_screenshot`

Take a screenshot of the current page.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `fullPage` | `boolean` | ❌ | Full page vs viewport (default: `false`) |
| `selector` | `string` | ❌ | Screenshot a specific element |

**Returns:** Path to saved screenshot image.

**Notes:** Screenshots saved to `~/.talon/screenshots/`. Image passed to LLM via vision if model supports it.

---

## 4. Memory Tools

### `memory_recall`

Search long-term memory for relevant information.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | ✅ | What to search for |
| `category` | `string` | ❌ | Filter by category |
| `limit` | `number` | ❌ | Max results (default: `5`) |

**Returns:** Array of matching memories with content, category, and timestamp.

**Implementation:** Keyword search for MVP. Semantic/vector search in Phase 3.

---

### `memory_remember`

Store important information in long-term memory.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `content` | `string` | ✅ | Information to store |
| `category` | `string` | ❌ | Category tag (e.g., `preferences`, `facts`, `projects`) |

**Returns:** Confirmation with memory ID.

**Auto-memory:** The agent is instructed (via system prompt) to automatically extract and store important facts from conversations — preferences, project context, recurring patterns.

---

## 5. OS Tools

### `os_notify`

Show a system notification.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | ✅ | Notification title |
| `body` | `string` | ✅ | Notification body |
| `sound` | `boolean` | ❌ | Play notification sound (default: `true`) |

**Implementation:** Uses `osascript` on macOS, `notify-send` on Linux.

---

### `clipboard_read`

Read the current system clipboard contents.

| Parameter | Type | Required | Description |
|---|---|---|---|
| *none* | — | — | — |

**Returns:** Clipboard text content.

**Implementation:** `pbpaste` (macOS), `xclip -o` (Linux).

---

### `clipboard_write`

Write to the system clipboard.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `content` | `string` | ✅ | Text to copy to clipboard |

**Returns:** Confirmation.

**Implementation:** `pbcopy` (macOS), `xclip -selection clipboard` (Linux).

---

## 6. Persona Tool

### `soul_update`

Propose an update to the assistant's Soul (personality/identity).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `section` | `string` | ✅ | Section of SOUL.md to update |
| `content` | `string` | ✅ | New content for the section |
| `reason` | `string` | ✅ | Why this update is proposed |

**Returns:** Diff showing proposed changes.

**Security:** Updates always require user confirmation. The agent cannot unilaterally change its own personality.

---

## Tool Comparison: Talon vs OpenClaw

| Tool Category | OpenClaw | Talon MVP | Talon Future |
|---|---|---|---|
| **Files** | Full fs read/write/edit | ✅ Same | + version-aware edits |
| **Shell** | bash exec + process management | ✅ Same | + persistent terminals |
| **Browser** | Custom CDP wrapper | ✅ Playwright | Same |
| **Canvas** | A2UI renderer | ❌ Not in MVP | Phase 3 |
| **Nodes** | iOS/Android device actions | ❌ Not in MVP | Phase 3+ |
| **Cron** | Scheduled tasks | ❌ Not in MVP | Phase 2 |
| **Webhooks** | Inbound HTTP hooks | ❌ Not in MVP | Phase 2 |
| **Sessions** | Inter-agent messaging | ❌ Not in MVP | Phase 3 |
| **Memory** | Implicit only | ✅ Explicit tools | + vector search |
| **OS** | Via node.invoke | ✅ Direct | + window management |
| **Persona** | SOUL.md (static) | ✅ Self-evolving | Same |
