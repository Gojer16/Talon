# Talon — Security Architecture

Talon runs with full system access by default. This document defines the security controls that keep that power safe.

---

## Threat Model

Since Talon runs locally for a single user, the primary threats are:

| Threat | Severity | Mitigation |
|---|---|---|
| **AI executing destructive commands** | 🔴 High | Confirmation flow for destructive ops |
| **Prompt injection via web content** | 🟡 Medium | Isolated browser, output sanitization |
| **Unauthorized channel access** | 🟡 Medium | User allowlists per channel |
| **API key exposure** | 🟡 Medium | Environment variables, encrypted config |
| **Remote Gateway exposure** | 🔴 High | Loopback-only by default, auth for remote |
| **Malicious skills/plugins** | 🟡 Medium | Permission manifest, install confirmation |

---

## 1. Tool Safety

### Confirmation Requirements

Tools are classified by risk level:

| Risk Level | Behavior | Examples |
|---|---|---|
| **Safe** | Execute immediately | `file_read`, `file_list`, `file_search`, `memory_recall`, `clipboard_read` |
| **Moderate** | Execute with notification | `file_write`, `file_edit`, `shell_execute` (non-destructive), `browser_navigate` |
| **Dangerous** | Require user confirmation | `shell_execute` (destructive commands), `soul_update` |

### Destructive Command Detection

Commands matching these patterns trigger confirmation:

```typescript
const DESTRUCTIVE_PATTERNS = [
  /\brm\b/,                    // File deletion
  /\brmdir\b/,                 // Directory deletion
  /\bmkfs\b/,                  // Filesystem format
  /\bdd\b/,                    // Disk operations
  /\bsudo\b/,                  // Elevated privileges
  /\bgit\s+push/,              // Remote git changes
  /\bgit\s+reset\s+--hard/,    // Destructive git reset
  /\bnpm\s+publish/,           // Package publishing
  /\bcurl\b.*\|\s*sh/,         // Pipe curl to shell
  /\bchmod\s+777/,             // Overly permissive permissions
  /\bkill\b/,                  // Process termination
  /shutdown|reboot/,           // System power
];
```

### Blocked Commands

These commands are **never** executed regardless of confirmation:

```typescript
const BLOCKED_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  ':(){ :|:& };:',            // Fork bomb
  'mkfs',                      // Without explicit path
  'dd if=/dev/zero',          // Disk wipe
];
```

### Path Restrictions

```typescript
interface FileSecurityConfig {
  allowedPaths: string[];       // Paths the agent can access
  // Default: ["~/"] (user home)
  // Restrict to: ["~/projects", "~/Documents"]
  
  deniedPaths: string[];        // Always blocked
  // Default: ["~/.ssh", "~/.gnupg", "~/.talon/config.json"]
  
  maxFileSize: number;          // Max file size for read/write (default: 10MB)
}
```

---

## 2. Channel Access Control

### User Allowlists

Each channel can restrict which users are allowed to interact:

```json
{
  "channels": {
    "telegram": {
      "botToken": "...",
      "allowedUsers": ["12345678"],
      "allowedGroups": ["group_abc"]
    },
    "discord": {
      "botToken": "...",
      "allowedGuilds": ["guild_123"],
      "allowedUsers": ["user_456"],
      "ownerOnly": false
    }
  }
}
```

**Default behavior:** If no allowlist is configured, the channel accepts messages from **all** users. This is fine for personal use but should be restricted for any remote deployment.

### Group Chat Safety

| Setting | Description |
|---|---|
| `activation: "mention"` | Only respond when explicitly @mentioned in groups |
| `toolAccess: "restricted"` | Groups get read-only tools (no shell, no file write) |
| `ownerOnly: true` | Only the configured owner can interact, even in DMs |

---

## 3. Gateway Security

### Network Binding

```json
{
  "gateway": {
    "host": "127.0.0.1",
    "port": 19789
  }
}
```

**Default:** Binds to `127.0.0.1` (loopback only). The Gateway is never visible on the network without explicit configuration.

### Remote Access Authentication

When exposed remotely (via Tailscale or SSH tunnel):

| Auth Mode | Description |
|---|---|
| `none` | No auth (only for loopback) |
| `password` | Shared password for WebChat/Control UI |
| `token` | Bearer token for API/WebSocket access |
| `tailscale` | Tailscale identity headers (Serve mode) |

```json
{
  "gateway": {
    "auth": {
      "mode": "password",
      "password": "${TALON_PASSWORD}",
      "allowTailscale": true
    }
  }
}
```

### WebSocket Security

- Rate limiting: Max 100 messages/minute per connection
- Message size limit: 1MB per message
- Connection limit: Max 10 concurrent connections
- Origin validation: Reject connections from unknown origins (when configured)

---

## 4. Sandbox Isolation (Phase 2)

For group/non-owner sessions, tool execution can be sandboxed:

```json
{
  "security": {
    "sandbox": {
      "mode": "non-main",
      "engine": "docker",
      "allowedTools": ["file_read", "file_list", "file_search", "memory_recall"],
      "deniedTools": ["shell_execute", "file_write", "browser_navigate", "os_notify"]
    }
  }
}
```

### Sandbox Modes

| Mode | Behavior |
|---|---|
| `off` | No sandboxing — full access for all sessions |
| `non-main` | Main session (owner, DM) gets full access; group/other sessions are sandboxed |
| `always` | All sessions are sandboxed |

### Docker Sandbox (Phase 2)

Each sandboxed session runs tools inside an ephemeral Docker container:

```
┌─────────────────────────────────┐
│ Docker Container                 │
│                                  │
│  Mounted: ~/projects (read-only) │
│  Network: none                   │
│  Resources: 512MB RAM, 1 CPU     │
│  Timeout: 60s per command        │
│                                  │
│  Only tools: file_read,          │
│              file_search,        │
│              memory_recall       │
└─────────────────────────────────┘
```

---

## 5. API Key Management

### Storage

API keys are stored in the config file but should reference environment variables:

```json
{
  "agent": {
    "providers": {
      "anthropic": { "apiKey": "${ANTHROPIC_API_KEY}" },
      "openai": { "apiKey": "${OPENAI_API_KEY}" }
    }
  }
}
```

The config loader expands `${VAR}` references to environment variable values at runtime.

### .env Support

Talon loads `~/.talon/.env` at startup:

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=123456:ABC...
DISCORD_BOT_TOKEN=MTA...
TALON_PASSWORD=supersecret
```

### Security Rules

- Never log API keys (even at debug level)
- Never include API keys in error messages
- Never send API keys to the LLM as context
- Mask keys in Control UI config view (show only last 4 chars)

---

## 6. Audit Logging

All security-relevant events are logged:

```typescript
interface AuditEntry {
  timestamp: string;
  event: AuditEvent;
  sessionId?: string;
  channel?: string;
  details: Record<string, unknown>;
}

type AuditEvent =
  | 'auth.success'          // Successful authentication
  | 'auth.failure'          // Failed authentication attempt
  | 'tool.execute'          // Tool was executed
  | 'tool.blocked'          // Tool execution was blocked
  | 'tool.confirmed'        // User confirmed a dangerous operation
  | 'tool.denied'           // User denied a dangerous operation
  | 'config.changed'        // Configuration was modified
  | 'session.created'       // New session started
  | 'soul.updated'          // Soul was modified
  | 'skill.installed';      // New skill was installed
```

Audit log location: `~/.talon/logs/audit.jsonl` (JSON Lines format, one entry per line).
