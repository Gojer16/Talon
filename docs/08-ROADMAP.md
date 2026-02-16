# Talon — Implementation Roadmap

Phased delivery plan from MVP to full ecosystem.

---

## Phase Overview

```
  Phase 1            Phase 2              Phase 3            Phase 4
  Core MVP           Enhanced             Ecosystem          Polish
  ──────────         ──────────           ──────────         ──────────
  Gateway            Sub-agents           Skills system      macOS native app
  Agent Loop         Browser control      WhatsApp/Slack     Voice input
  Model Router       Shadow Loop          Docker sandbox     Canvas/A2UI
  Memory Manager     Discord bot          Vector memory      iOS/Android nodes
  File tools         WebChat UI           Cron/Webhooks      Window management
  Shell tool         Control Panel UI     Plugin channels
  Telegram bot       Soul evolution
  CLI REPL           FACTS.json
  SOUL.md            Audit logging
```

---

## Phase 1: Core MVP

> **Goal:** A working personal AI assistant with an agent loop, memory compression, and tool calling — the 3 things that make it feel like a real agent.

### MVP Fast-Track (build these 3 things first)

| Component | Why It Matters |
|---|---|
| ✅ **Agent Loop** | The plan→execute→evaluate→refine cycle is what makes it feel intelligent |
| ✅ **Memory Compression** | Without this, you'll hit millions of tokens per day and go broke |
| ✅ **Tool Calling** | `file_read`, `shell_execute`, `web_search` — enough to be useful |

_"After that, you basically have OpenClaw."_

### Full Phase 1 Deliverables

| Component | Details | Priority |
|---|---|---|
| **Gateway Server** | WebSocket + HTTP server on `127.0.0.1:19789` | P0 |
| **Config System** | Load `~/.talon/config.json`, Zod validation, env var expansion | P0 |
| **Agent Loop** | State machine: plan→decide→execute→evaluate→compress | P0 |
| **Model Router** | Select cheapest capable model per task type | P0 |
| **Memory Manager** | Compression, ≤800 token summaries, tool log truncation | P0 |
| **Tool Registry** | Tool registration, dispatch, result formatting + truncation | P0 |
| **File Tools** | `file_read`, `file_write`, `file_edit`, `file_list`, `file_search` | P0 |
| **Shell Tool** | `shell_execute` with confirmation for destructive commands | P0 |
| **Telegram Channel** | grammŸ bot, DM support, media handling | P0 |
| **CLI Channel** | Interactive REPL with streaming + syntax highlighting | P0 |
| **Session Manager** | Create/resume sessions, compressed history persistence | P0 |
| **SOUL.md** | Static persona file, injected into system prompt | P1 |

### Implementation Order

```
Week 1:  Config system → Gateway server → Event bus
Week 2:  Agent loop (state machine) → Model router → Memory manager
Week 3:  Tool registry → File tools → Shell tool
Week 4:  CLI REPL → Telegram channel → Session manager
Week 5:  Memory compression tuning → SOUL.md → Testing
```

### Success Criteria

- [ ] `talon` command starts the Gateway and CLI
- [ ] Send a message on Telegram → get AI response
- [ ] AI can read/write files on your system
- [ ] AI can run shell commands (with confirmation for destructive ones)
- [ ] Agent loop iterates until task is complete (not one-shot)
- [ ] Memory summary stays ≤800 tokens regardless of conversation length
- [ ] Model router picks cheap model for simple tasks, premium for complex
- [ ] Conversation history persists (compressed) across restarts
- [ ] SOUL.md personality is reflected in responses

---

## Phase 2: Enhanced Capabilities

> **Goal:** Sub-agents, browser control, proactive intelligence, a web UI, and deeper personalization.

### Deliverables

| Component | Details | Priority |
|---|---|---|
| **Sub-Agent Manager** | Spawn specialist agents (Research, Planner, Writer, Critic) | P0 |
| **Browser Tools** | Playwright CDP — navigate, click, type, extract, screenshot | P0 |
| **Discord Channel** | discord.js integration, slash commands | P1 |
| **WebChat** | React-based chat UI at `/chat` | P1 |
| **Control Panel** | React dashboard at `/` — sessions, config, health | P1 |
| **Shadow Loop** | Filesystem watcher (chokidar) + Ghost Messages | P1 |
| **FACTS.json** | Structured fact store + auto-extraction | P0 |
| **Soul Evolution** | `soul_update` tool + confirmation flow | P1 |
| **OS Tools** | `os_notify`, `clipboard_read`, `clipboard_write` | P2 |
| **Multi-Provider** | OpenAI + Ollama support with failover | P1 |
| **Audit Logging** | Security event logging to JSONL | P2 |

### Success Criteria

- [ ] AI can browse the web and extract information
- [ ] Sub-agents handle research/planning/writing as separate cheap LLM calls
- [ ] WebChat accessible at `http://127.0.0.1:19789/chat`
- [ ] Shadow Loop detects file changes and sends proactive suggestions
- [ ] Facts automatically extracted from conversations
- [ ] Fall back to OpenAI if Anthropic is unavailable
- [ ] Control Panel shows active sessions and health

---

## Phase 3: Ecosystem

> **Goal:** Extensibility, additional channels, and advanced memory.

### Deliverables

| Component | Details | Priority |
|---|---|---|
| **Skills System** | Skill discovery, SKILL.md format, install/activate lifecycle | P0 |
| **WhatsApp Channel** | Baileys integration | P1 |
| **Slack Channel** | Bolt integration | P1 |
| **Docker Sandbox** | Container-based isolation for non-owner sessions | P1 |
| **Vector Memory** | SQLite-vec for semantic search over conversation history | P1 |
| **Cron** | Scheduled task execution | P2 |
| **Webhooks** | Inbound HTTP hooks for external triggers | P2 |
| **Plugin Architecture** | Channel plugin interface for community contributions | P2 |
| **Remote Access** | Tailscale Serve/Funnel automation | P2 |

### Success Criteria

- [ ] Install a community skill and use it in conversation
- [ ] Chat on WhatsApp and Slack
- [ ] Semantic search: "what did we discuss about React last week?"
- [ ] Group chats safely sandboxed

---

## Phase 4: Polish & Native (Future)

> **Goal:** Native apps, voice, canvas, and multi-agent coordination.

### Deliverables

| Component | Details |
|---|---|
| **macOS App** | Menu bar app with Voice Wake, PTT, Canvas |
| **Voice Input** | Whisper-based speech-to-text |
| **Text-to-Speech** | Voice responses via system TTS or API |
| **Canvas/A2UI** | Visual workspace for diagrams, dashboards, interactive elements |
| **iOS/Android Nodes** | Mobile nodes for camera, location, notifications |
| **Multi-Agent** | Inter-session messaging, agent specialization |
| **Window Management** | Control desktop windows, switch apps |

---

## Technical Debt & Maintenance

Items to address throughout all phases:

| Area | Task |
|---|---|
| **Testing** | Unit tests for tools, integration tests for channels |
| **Error Handling** | Graceful degradation, retry logic, user-visible errors |
| **Logging** | Structured logging with levels (debug/info/warn/error) |
| **Documentation** | Keep docs in sync with implementation |
| **Performance** | Profile token usage, optimize context building |
| **Upgrades** | Track dependency updates, especially LLM SDK versions |

---

## Decision Log

Key architectural decisions and their rationale:

| Decision | Choice | Alternatives Considered | Rationale |
|---|---|---|---|
| **Runtime** | Node.js | Python, Go, Rust | Same as OpenClaw; excellent async I/O, huge npm ecosystem |
| **Language** | TypeScript | JavaScript | Type safety critical for tool interfaces and config validation |
| **Architecture** | Agent Loop (state machine) | Simple request→response | OpenClaw's real power is plan→execute→evaluate→refine |
| **Model strategy** | Router (cheapest per task) | Single premium model | Cost control: sub-agents on cheap models, reasoning on premium |
| **Memory** | Aggressive compression (≤800 tk summary) | Full history | Full history = millions of tokens/day = bankruptcy |
| **Sub-agents** | Specialist delegation | Single model does everything | Focused context = better quality + cheaper |
| **Primary LLM** | Mid-tier for orchestration | Always premium | Premium only for complex reasoning; mid-tier for decision-making |
| **Browser Engine** | Playwright | Puppeteer, CDP direct | Multi-browser support, better API, more reliable |
| **Chat Framework** | grammŸ (Telegram) | node-telegram-bot-api | TypeScript-first, better middleware, active maintenance |
| **Storage (MVP)** | JSON files | SQLite, PostgreSQL | Zero-dependency, human-readable, easy debugging |
| **Config Validation** | Zod | JSON Schema, joi | TypeScript integration, great DX, runtime + compile-time |
| **Monolith vs Mono-repo** | Monolith | Turborepo, Nx | Simpler for solo dev, lower overhead, faster iteration |
