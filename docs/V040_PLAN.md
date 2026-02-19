# 🚀 Talon v0.4.0 — Feature Development Plan

**Date:** 2026-02-19  
**Status:** 🚧 Planning  
**Previous:** v0.3.3 (Shipped ✅)  
**Target:** Ship v0.4.0 today

---

## 📊 v0.3.3 Completion Summary

✅ **SHIPPED** — 2026-02-19

- ✅ Structured WebSocket protocol (16 event types)
- ✅ Direct tool execution via WebSocket
- ✅ 514/515 tests passing (99.8%)
- ✅ 27+ tools with safety checks
- ✅ Process management (PID tracking, graceful shutdown)
- ✅ File-based session persistence
- ✅ Complete documentation

---

## 🎯 v0.4.0 Goals

### Theme: **Production Enhancements & Web Dashboard**

Ship production-grade enhancements that were deferred from v0.3.3:

1. **SQLite Migration** — Replace file-based persistence with SQLite
2. **Web Dashboard UI** — React-based web interface
3. **Advanced Protocol Features** — Protocol versioning, rate limiting
4. **Performance Optimizations** — Caching, connection pooling
5. **Monitoring & Metrics** — Prometheus metrics, health checks

---

## 📦 Feature Breakdown

### Feature 1: SQLite Migration (Priority 1) — 2 hours

**Goal:** Replace file-based session persistence with SQLite for better performance and reliability.

**Why:**
- Better concurrent access
- ACID transactions
- Query capabilities
- Smaller disk footprint
- Industry standard

**Tasks:**
1. Add `better-sqlite3` dependency
2. Create database schema
3. Implement `SqliteSessionStore` class
4. Migrate existing sessions
5. Update `SessionManager` to use SQLite
6. Add database migrations system
7. Update tests

**Files to Create:**
- `src/storage/sqlite.ts` — SQLite wrapper
- `src/storage/schema.sql` — Database schema
- `src/storage/migrations/` — Migration scripts

**Files to Modify:**
- `src/gateway/sessions.ts` — Use SQLite store
- `package.json` — Add better-sqlite3

**Schema:**
```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    state TEXT NOT NULL,
    memory_summary TEXT,
    created_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL,
    message_count INTEGER DEFAULT 0,
    model TEXT,
    config TEXT
);

CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    token_usage TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_sender ON sessions(sender_id);
CREATE INDEX idx_sessions_channel ON sessions(channel);
CREATE INDEX idx_sessions_state ON sessions(state);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
```

**Acceptance Criteria:**
- [ ] SQLite database created on first boot
- [ ] Sessions persist to SQLite
- [ ] Messages stored in database
- [ ] Existing file-based sessions migrated
- [ ] All session tests pass
- [ ] Performance improved (benchmark)

---

### Feature 2: Web Dashboard UI (Priority 2) — 3 hours

**Goal:** Build a React-based web dashboard for monitoring and interacting with Talon.

**Why:**
- Visual session management
- Real-time monitoring
- Tool execution UI
- Better UX than CLI

**Tech Stack:**
- React 18
- Vite (build tool)
- TailwindCSS (styling)
- WebSocket client
- Recharts (metrics)

**Pages:**
1. **Dashboard** — Overview, stats, recent activity
2. **Sessions** — List, create, view, delete sessions
3. **Tools** — List tools, execute tools, view results
4. **Logs** — Real-time log streaming
5. **Settings** — Gateway configuration

**Tasks:**
1. Setup Vite + React project in `web/`
2. Create WebSocket client hook
3. Build dashboard components
4. Implement session management UI
5. Add tool execution UI
6. Add real-time log streaming
7. Build and serve from gateway

**Files to Create:**
- `web/` — React app directory
- `web/src/hooks/useWebSocket.ts` — WebSocket hook
- `web/src/pages/Dashboard.tsx` — Dashboard page
- `web/src/pages/Sessions.tsx` — Sessions page
- `web/src/pages/Tools.tsx` — Tools page
- `web/src/pages/Logs.tsx` — Logs page
- `web/src/components/` — Reusable components

**Files to Modify:**
- `src/gateway/server.ts` — Serve static files
- `package.json` — Add web build scripts

**Acceptance Criteria:**
- [ ] Dashboard shows gateway status
- [ ] Sessions page lists all sessions
- [ ] Can create and delete sessions
- [ ] Can execute tools from UI
- [ ] Real-time log streaming works
- [ ] Responsive design (mobile-friendly)

---

### Feature 3: Protocol Versioning (Priority 3) — 1 hour

**Goal:** Add protocol versioning to WebSocket messages for future compatibility.

**Why:**
- Future-proof protocol
- Graceful degradation
- Client compatibility checks

**Tasks:**
1. Add `version` field to `WSMessage`
2. Implement version negotiation
3. Add version mismatch handling
4. Update WebSocket client
5. Document versioning strategy

**Message Format:**
```typescript
interface WSMessage {
    id: string;
    type: MessageType;
    version: string; // NEW: "1.0.0"
    timestamp: number;
    payload: unknown;
}
```

**Acceptance Criteria:**
- [ ] All messages include version
- [ ] Server rejects incompatible versions
- [ ] Client shows version mismatch error
- [ ] Backward compatibility maintained

---

### Feature 4: Rate Limiting (Priority 4) — 1 hour

**Goal:** Add rate limiting to prevent abuse and ensure fair resource usage.

**Why:**
- Prevent DoS attacks
- Fair resource allocation
- Protect against runaway loops

**Tasks:**
1. Implement rate limiter middleware
2. Add per-client rate limits
3. Add per-session rate limits
4. Add tool execution rate limits
5. Return 429 errors when exceeded

**Limits:**
- WebSocket messages: 100/minute per client
- Tool executions: 20/minute per session
- Session creation: 10/minute per client

**Acceptance Criteria:**
- [ ] Rate limits enforced
- [ ] 429 errors returned
- [ ] Rate limit headers included
- [ ] Configurable limits

---

### Feature 5: Prometheus Metrics (Priority 5) — 1 hour

**Goal:** Export Prometheus metrics for monitoring and alerting.

**Why:**
- Production monitoring
- Performance insights
- Alerting capabilities

**Metrics:**
- `talon_gateway_uptime_seconds`
- `talon_sessions_total`
- `talon_sessions_active`
- `talon_messages_total`
- `talon_tools_executed_total`
- `talon_websocket_connections_total`
- `talon_http_requests_total`
- `talon_http_request_duration_seconds`

**Tasks:**
1. Add `prom-client` dependency
2. Create metrics registry
3. Instrument gateway
4. Add `/metrics` endpoint
5. Document metrics

**Acceptance Criteria:**
- [ ] Metrics exported at `/metrics`
- [ ] All key metrics tracked
- [ ] Prometheus can scrape metrics
- [ ] Grafana dashboard template

---

### Feature 6: Connection Pooling (Priority 6) — 30 min

**Goal:** Add connection pooling for database and HTTP clients.

**Why:**
- Better performance
- Resource efficiency
- Reduced latency

**Tasks:**
1. Add SQLite connection pool
2. Add HTTP client pool (for LLM providers)
3. Configure pool sizes
4. Add pool metrics

**Acceptance Criteria:**
- [ ] Connection pools configured
- [ ] Performance improved
- [ ] Pool metrics exported

---

### Feature 7: Caching Layer (Priority 7) — 30 min

**Goal:** Add caching for frequently accessed data.

**Why:**
- Faster responses
- Reduced database load
- Better UX

**Cache Targets:**
- Session metadata (5 min TTL)
- Tool definitions (10 min TTL)
- Gateway status (30 sec TTL)

**Tasks:**
1. Add in-memory cache (LRU)
2. Cache session metadata
3. Cache tool definitions
4. Add cache metrics

**Acceptance Criteria:**
- [ ] Cache hit rate > 80%
- [ ] Response times improved
- [ ] Cache metrics exported

---

## 🗓️ Implementation Timeline

### Phase 1: SQLite Migration (2 hours)
- Setup SQLite
- Create schema
- Migrate sessions
- Update tests

### Phase 2: Web Dashboard (3 hours)
- Setup React app
- Build components
- Integrate WebSocket
- Deploy

### Phase 3: Protocol & Performance (2 hours)
- Protocol versioning
- Rate limiting
- Metrics
- Caching

### Phase 4: Testing & Documentation (1 hour)
- Integration tests
- Performance benchmarks
- Documentation
- Changelog

**Total:** 8 hours

---

## 📊 Success Metrics

| Metric | v0.3.3 | v0.4.0 Target |
|--------|--------|---------------|
| **Tests Passing** | 514/515 (99.8%) | 550+/550+ (100%) |
| **Session Persistence** | File-based | SQLite |
| **Web UI** | None | Full dashboard |
| **Protocol Version** | None | 1.0.0 |
| **Rate Limiting** | None | Yes |
| **Metrics** | Basic | Prometheus |
| **Performance** | Good | Excellent |

---

## 🚀 Shipping Checklist

### SQLite Migration
- [ ] Database schema created
- [ ] Sessions migrated
- [ ] Messages stored
- [ ] Tests passing
- [ ] Performance benchmarked

### Web Dashboard
- [ ] Dashboard page working
- [ ] Sessions page working
- [ ] Tools page working
- [ ] Logs page working
- [ ] Responsive design
- [ ] Deployed

### Protocol & Performance
- [ ] Protocol versioning implemented
- [ ] Rate limiting working
- [ ] Prometheus metrics exported
- [ ] Caching implemented
- [ ] Connection pooling configured

### Testing & Documentation
- [ ] All tests passing
- [ ] Performance benchmarks run
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] README updated

---

## 📝 Next Steps

1. **Start with SQLite Migration** (highest priority)
2. **Build Web Dashboard** (most visible feature)
3. **Add Protocol Enhancements** (future-proofing)
4. **Test & Document** (quality assurance)
5. **Ship v0.4.0** (celebrate! 🎉)

---

**Status:** 🚧 Ready to start Phase 1 (SQLite Migration)
