# Talon - Missing Features Roadmap

> **What's Left**: The proactive intelligence layer and advanced tooling that will make Talon truly autonomous.

---

## 🚧 MISSING IMPLEMENTATIONS

### 1. The Shadow Loop (Proactive Intelligence) ❌

**Status:** Config schema exists, but NO implementation

**What Needs to Be Built:**

```text
src/shadow/
├── index.ts          # Main shadow loop orchestrator
├── watcher.ts        # Filesystem monitoring (chokidar)
├── heuristics.ts     # Event filtering rules
└── ghost.ts          # Ghost message system
```

**Features to Implement:**
- **Background Observer**: Monitor filesystem with `chokidar`
- **Shell History Monitoring**: Watch for command failures
- **Terminal Error Detection**: Catch build errors, test failures
- **Event-Driven Intelligence**: Filter "interesting" moments
- **Ghost Messages**: Send proactive suggestions to gateway
- **Non-intrusive Notifications**: Propose fixes without interrupting

**Example Flow:**
1. User saves `App.tsx`
2. Shadow detects TypeScript error
3. Sends ghost message: *"I noticed a type error in App.tsx. Want me to fix it?"*
4. User approves → Agent executes fix

---

### 2. Browser Automation Tools ❌

**Status:** Config schema exists, but NO implementation

**What Needs to Be Built:**

```text
src/tools/browser.ts
```

**Tools to Implement:**
- `browser_open` - Open URL in browser
- `browser_navigate` - Navigate to page
- `browser_click` - Click element
- `browser_type` - Type text
- `browser_screenshot` - Capture screenshot
- `browser_extract` - Extract page content

**Integration:**
- Playwright or Puppeteer
- Chrome DevTools Protocol (CDP)
- Headless/headed mode toggle

---

### 3. OS Integration Tools ❌

**Status:** Not implemented

**What Needs to Be Built:**

```text
src/tools/os.ts
```

**Tools to Implement:**
- `os_notify` - System notifications (macOS/Linux/Windows)
- `clipboard_read` - Read clipboard content
- `clipboard_write` - Write to clipboard
- `screen_capture` - Take screenshots

---

### 4. Long-term Ledger (Vector/SQLite) ❌

**Status:** Not implemented

**What Needs to Be Built:**

```text
src/memory/
├── vector.ts         # Vector embeddings
├── sqlite.ts         # SQLite database
└── search.ts         # Semantic search
```

**Features to Implement:**
- SQLite database for all conversations
- Vector embeddings for semantic search
- Searchable history across all sessions
- Fact extraction and indexing

**Current State:**
- ✅ In-memory sessions
- ✅ JSON-based FACTS.json
- ✅ Memory compression
- ❌ No persistent searchable history

---

### 5. Subagent Execution Framework ❌

**Status:** Prompts exist, but NO execution system

**What Needs to Be Built:**

```text
src/agent/subagents/
├── index.ts          # Subagent spawner
├── router.ts         # Task delegation
└── parser.ts         # JSON result parsing
```

**Features to Implement:**
- Spawn subagents with minimal context
- Route tasks to specialized agents (research, writer, critic, etc.)
- Parse structured JSON responses
- Integrate results back to main agent

**Current State:**
- ✅ `buildSubAgentPrompt()` with 5 roles defined
- ❌ No spawning/routing logic
- ❌ No execution framework

---

### 6. Web Dashboard UI ❌

**Status:** Not implemented

**What Needs to Be Built:**

```text
ui/
├── components/       # React components
│   ├── Chat.tsx
│   ├── Canvas.tsx
│   └── Sidebar.tsx
├── hooks/            # WebSocket hooks
└── pages/            # Next.js pages
```

**Features to Implement:**
- React/Next.js frontend
- WebSocket connection to gateway
- Chat interface
- "Canvas" view for side-by-side execution
- Session management UI
- Model/provider switching UI

**Current State:**
- ✅ TUI client (terminal-based)
- ✅ WebSocket protocol ready
- ❌ No web UI

---

### 7. Advanced Features ❌

**Missing:**
- ❌ BOOT.md hook execution (schema exists, not implemented)
- ❌ "Budget/Power" mode toggle for model selection
- ❌ Model tier routing (Gemini Flash Lite, GPT-5 Nano, DeepSeek)
- ❌ Automatic fact extraction to FACTS.json
- ❌ Shell history monitoring
- ❌ Git event watching

---

## 📋 Implementation Priority

### Phase 1: Proactive Intelligence (High Priority)
1. **Shadow Loop** - Core watcher + heuristics
2. **Ghost Messages** - Proactive notification system
3. **Shell/Terminal Monitoring** - Error detection

### Phase 2: Advanced Tools (Medium Priority)
1. **Browser Automation** - Playwright integration
2. **OS Tools** - Notifications, clipboard, screenshots
3. **Subagent Framework** - Task delegation system

### Phase 3: Long-term Memory (Medium Priority)
1. **SQLite Database** - Persistent storage
2. **Vector Embeddings** - Semantic search
3. **Fact Extraction** - Automatic learning

### Phase 4: UI & Polish (Low Priority)
1. **Web Dashboard** - React/Next.js UI
2. **Canvas View** - Side-by-side execution
3. **Budget Mode** - Model tier selection

---

## 📊 Current Progress

| Feature | Status |
|---------|--------|
| Core Agent Loop | ✅ Complete |
| Memory System | ✅ Complete |
| Basic Tools (File, Shell, Web, Memory) | ✅ Complete |
| Multi-Channel (CLI, TUI, Telegram, WhatsApp) | ✅ Complete |
| Service Management | ✅ Complete |
| Provider Management | ✅ Complete |
| **Shadow Loop** | ❌ Missing |
| **Browser Tools** | ❌ Missing |
| **OS Tools** | ❌ Missing |
| **Vector/SQLite** | ❌ Missing |
| **Subagent Framework** | ❌ Missing |
| **Web UI** | ❌ Missing |

**Overall: ~65% complete** - Foundation is solid, proactive intelligence layer is missing.
