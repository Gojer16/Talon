# MiniMax - Missing Features Roadmap

> **What's Left**: Discord, browser automation, WebChat UI, and advanced features.

## ✅ Already Complete (~70%)
- Gateway with WebSocket
- Multi-channel (Telegram, WhatsApp, CLI, TUI)
- Agent runtime with memory compression
- File, shell, web search tools

---

## 🚧 MISSING FROM MVP

### 1. Discord Channel ❌
- Bot integration with discord.js
- Text/DM/thread support
- Slash commands

### 2. Browser Automation ❌
- Puppeteer/Playwright tools
- Page navigation and interaction
- Content extraction

### 3. WebChat UI ❌
- React-based chat interface
- WebSocket connection
- Real-time streaming

### 4. Advanced Features (Phase 3) ❌
- Voice Wake + Talk Mode
- Canvas rendering (A2UI)
- Mobile apps (macOS, iOS, Android)
- Additional channels (Slack, Signal)

---

## Core Architecture Comparison

### OpenClaw Full Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            OpenClaw Full Stack                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   WhatsApp   │  │   Telegram   │  │   Discord   │  │    Slack     │   │
│  │  (Baileys)   │  │   (grammY)   │  │ (discord.js)│  │   (Bolt)     │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                 │            │
│         └─────────────────┼─────────────────┼─────────────────┘            │
│                           ▼                                                 │
│                 ┌─────────────────────┐                                    │
│                 │      Gateway        │                                    │
│                 │  (Control Plane)    │                                    │
│                 │  ws://127.0.0.1:18789                                   │
│                 └──────────┬───────────┘                                    │
│                            │                                                │
│         ┌─────────────────┼─────────────────┐                              │
│         ▼                 ▼                 ▼                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
│  │    Pi       │  │   CLI       │  │  Web UI    │                        │
│  │   Agent     │  │  (gateway,  │  │ (Control    │                        │
│  │  (RPC)      │  │   agent,    │  │   + Chat)   │                        │
│  │             │  │   send)     │  │             │                        │
│  └─────────────┘  └─────────────┘  └─────────────┘                        │
│                            │                                                │
│         ┌─────────────────┼─────────────────┐                              │
│         ▼                 ▼                 ▼                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
│  │   macOS     │  │     iOS     │  │   Android   │                        │
│  │    App      │  │    Node     │  │    Node     │                        │
│  │ (Menu Bar)  │  │  (Canvas)   │  │  (Canvas)   │                        │
│  └─────────────┘  └─────────────┘  └─────────────┘                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                      Tool System                                 │       │
│  │  Files │ Shell │ Browser │ Canvas │ Nodes │ Cron │ Webhooks  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                      Skills Platform                             │       │
│  │  AGENTS.md │ SOUL.md │ TOOLS.md │ ~/.openclaw/skills/          │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## MiniMax MVP Architecture

### Phase 1: Minimal Viable Product

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MiniMax MVP                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                     │
│  │   Telegram   │  │   Discord    │  │   WebChat   │                     │
│  │  (grammY)    │  │ (discord.js) │  │  (Browser)  │                     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                     │
│         │                 │                 │                              │
│         └─────────────────┼─────────────────┘                              │
│                           ▼                                                 │
│                 ┌─────────────────────┐                                     │
│                 │      Gateway        │                                     │
│                 │  (Control Plane)    │                                     │
│                 │  ws://127.0.0.1:19789                                    │
│                 └──────────┬───────────┘                                     │
│                            │                                                │
│         ┌─────────────────┼─────────────────┐                              │
│         ▼                 ▼                 ▼                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│  │   Claude    │  │   CLI       │  │  Web UI     │                         │
│  │   Agent     │  │  (minimax   │  │ (Control    │                         │
│  │  (RPC)      │  │   send)     │  │   + Chat)   │                         │
│  └─────────────┘  └─────────────┘  └─────────────┘                         │
│                            │                                                │
│  ┌─────────────────────────┼─────────────────────────────────────────┐     │
│  │                    Tool System                                     │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │     │
│  │  │  Files   │  │  Shell   │  │ Browser  │  │ Sessions │          │     │
│  │  │  (fs)    │  │  (exec)  │  │ ( CDP )  │  │  (msg)   │          │     │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │     │
│  └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

### MiniMax MVP

```
MiniMax/
├── src/
│   ├── gateway/              # Core Gateway (Node.js)
│   │   ├── index.ts          # Entry point
│   │   ├── server.ts         # WebSocket server
│   │   ├── sessions.ts       # Session management
│   │   ├── routing.ts        # Channel routing
│   │   └── tools/            # Tool execution
│   ├── agent/                # Agent runtime
│   │   └── rpc-client.ts     # Claude API client
│   ├── channels/             # Channel integrations
│   │   ├── telegram/         # Telegram bot
│   │   ├── discord/          # Discord bot
│   │   └── webchat/          # Web interface
│   ├── tools/                # Built-in tools
│   │   ├── files.ts          # File operations
│   │   ├── shell.ts          # Shell execution
│   │   └── browser.ts        # Browser control
│   └── config/               # Configuration
│       └── schema.ts         # Config validation
├── ui/
│   └── control/              # Web Control UI (React)
├── skills/                   # Bundled skills
│   └── SKILL.md             # Skill template
├── package.json
├── tsconfig.json
└── README.md
```

### OpenClaw Original (Reference)

```
openclaw/
├── apps/                      # Desktop/mobile apps
│   ├── macos/                 # macOS menu bar app
│   ├── ios/                   # iOS node
│   └── android/               # Android node
├── packages/                   # Core packages
│   ├── gateway/               # Gateway core
│   ├── agent/                 # Agent runtime
│   └── protocol/              # Communication protocol
├── extensions/                 # Channel plugins
│   ├── whatsapp/              # Baileys
│   ├── telegram/               # grammY
│   ├── discord/               # discord.js
│   ├── slack/                 # Bolt
│   ├── signal/                # signal-cli
│   └── ...                    # More channels
├── src/
│   ├── gateway/               # Gateway implementation
│   ├── tools/                 # Tool system
│   └── storage/               # Session persistence
├── skills/                    # Bundled skills
├── vendor/
│   └── a2ui/                  # Canvas renderer
├── ui/
│   ├── control/               # Control UI
│   └── chat/                  # WebChat
├── docs/                      # Documentation
├── scripts/                   # Build scripts
└── tests/                     # Test suites
```

---

## Component Comparison

| Component | OpenClaw | MiniMax MVP |
|-----------|----------|-------------|
| **Gateway** | Full-featured with cron, webhooks, presence | Core WebSocket + routing |
| **Channels** | 12+ (WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Teams, Matrix, Zalo, etc.) | 3 (Telegram, Discord, WebChat) |
| **Agent Runtime** | Pi (custom) | Claude API (Anthropic) |
| **Tools** | Full fs, shell, browser, canvas, nodes, cron | Files, Shell, Browser |
| **macOS App** | Full menu bar app with Voice Wake, Talk Mode, Canvas | None (Phase 2) |
| **Mobile Nodes** | iOS + Android with Canvas | None (Phase 2) |
| **Skills System** | Full registry + ClawHub | Basic skills folder |
| **Canvas** | A2UI renderer | None (Phase 2) |
| **Voice** | Voice Wake + Talk Mode | None (Phase 2) |
| **Security** | Sandbox (Docker), TCC permissions | Basic sandbox |
| **Storage** | SQLite + file-based | File-based JSON |

---

## Implementation Phases

### Phase 1: Core Gateway (MVP)

**Goal**: Basic chat with AI + file/shell tools

**Components**:
1. **Gateway** - WebSocket server with session management
2. **Telegram Bot** - Simple message echo + AI responses
3. **Claude Agent** - RPC client to Anthropic API
4. **Basic Tools** - File read/write, shell execution
5. **WebChat** - Simple browser-based chat UI

**Files to create**:
```
src/gateway/index.ts
src/gateway/sessions.ts
src/agent/rpc-client.ts
src/channels/telegram/index.ts
src/tools/files.ts
src/tools/shell.ts
src/config/schema.ts
```

### Phase 2: Multi-Channel + Browser

**Add**:
- Discord bot
- Browser control (Puppeteer/Playwright)
- Session persistence (JSON files)
- Basic security (path allowlisting)

### Phase 3: Ecosystem

**Add**:
- Skills system
- Webhooks
- Additional channels (Slack, WhatsApp)
- macOS app (optional)

---

## API Design

### Gateway WebSocket Protocol

```typescript
// Connect
ws://127.0.0.1:19789

// Messages (JSON)
{ "type": "message", "channel": "telegram", "from": "user123", "text": "hello" }
{ "type": "response", "session": "abc", "text": "Hi! How can I help?" }
{ "type": "tool_call", "tool": "files.read", "args": { "path": "/tmp/test.txt" } }
{ "type": "tool_result", "tool": "files.read", "result": "file content" }
```

### Tool Schema

```typescript
interface Tool {
  name: string;
  description: string;
  params: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean';
      required: boolean;
    }
  };
  execute: (args: any) => Promise<any>;
}
```

---

## Configuration

### MiniMax Config (`~/.minimax/config.json`)

```json
{
  "gateway": {
    "host": "127.0.0.1",
    "port": 19789
  },
  "agent": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKey": "${ANTHROPIC_API_KEY}"
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "${TELEGRAM_BOT_TOKEN}"
    },
    "discord": {
      "enabled": false,
      "botToken": "${DISCORD_BOT_TOKEN}"
    }
  },
  "tools": {
    "files": {
      "enabled": true,
      "allowedPaths": ["~/"]
    },
    "shell": {
      "enabled": true,
      "allowedCommands": ["ls", "cat", "git", "npm", "pnpm"]
    }
  },
  "security": {
    "sandbox": false
  }
}
```

---

## Key Differences from OpenClaw

| Aspect | OpenClaw | MiniMax |
|--------|----------|---------|
| **Language** | TypeScript/Node.js | TypeScript/Node.js |
| **Agent** | Custom Pi agent | Claude API |
| **Channels** | 12+ built-in | Telegram + Discord + WebChat |
| **Browser** | Custom CDP wrapper | Puppeteer |
| **Storage** | SQLite | JSON files |
| **Mobile** | iOS + Android apps | None |
| **Voice** | Voice Wake + TTS | None |
| **Canvas** | A2UI renderer | None |
| **Docker** | Full sandbox | Basic process isolation |
| **Remote** | Tailscale Serve/Funnel | Manual SSH tunnel |

---

## Tech Stack Recommendation

### MVP Technologies

| Layer | Technology | Reason |
|-------|------------|--------|
| Runtime | Node.js 22+ | Same as OpenClaw |
| Language | TypeScript | Type safety |
| Web Framework | Fastify | Performance |
| WS Server | ws or fastify-websocket | Gateway comms |
| Telegram | grammY | TypeScript-first |
| Discord | discord.js | Most popular |
| Browser | Puppeteer | Simpler than CDP |
| Agent | @anthropic-ai/sdk | Official SDK |
| UI | React + Vite | Fast dev |
| Config | Zod | Validation |

### Future Considerations

- **Database**: SQLite (better performance)
- **Browser**: Playwright (more reliable)
- **Voice**: Whisper + TTS APIs
- **Container**: Docker for sandbox
