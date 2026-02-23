# Cron System — Issues, Gaps & Technical Debt

> **Created**: 2026-02-23  
> **Audited by**: Antigravity AI Agent  
> **Scope**: `src/cron/index.ts`, `src/cron/README.md`, cron wiring in both gateways  
> **Reference**: OpenClaw cron spec (provided by user), `src/cron/README.md`  
> **Status**: Open — ready for AI agent implementation  
> **Context**: Cron is the Gateway's built-in scheduler. OpenClaw spec says it persists jobs, wakes the agent at the right time, and delivers output to a chat. **Talon's implementation does almost none of this.**

---

## 0. OpenClaw Spec vs Talon Implementation — Gap Analysis

This is the most revealing part. The user provided the full OpenClaw cron spec. Let's compare feature-by-feature:

### Feature Parity Matrix

| OpenClaw Feature | Spec | Talon Status | Notes |
|-----------------|------|-------------|-------|
| **Job persistence** (`~/.openclaw/cron/jobs.json`) | ✅ Required | ❌ **Not implemented** | Memory-only; all jobs lost on restart |
| **Schedule kinds**: `at`, `every`, `cron` | 3 kinds | ⚠️ **Partial** | Only `cron` expressions. No `at` (one-shot) or `every` (interval) |
| **One-shot reminders** (`schedule.kind = "at"`) | ✅ | ❌ **Not implemented** | Can't do "remind me at 4PM" |
| **Fixed interval** (`schedule.kind = "every"`) | ✅ | ❌ **Not implemented** | Can't do "every 5 minutes" without cron |
| **Timezone support** (`schedule.tz`) | ✅ IANA timezone | ❌ **Not implemented** | Uses system time only |
| **Session target**: `main` vs `isolated` | ✅ | ❌ **Not implemented** | No session concept; just emits event |
| **Payload kinds**: `systemEvent` vs `agentTurn` | ✅ | ❌ **Not implemented** | Only has generic `command` string |
| **Delivery modes**: `announce`, `webhook`, `none` | ✅ | ❌ **Not implemented** | Emits event to nowhere |
| **Wake modes**: `now` vs `next heartbeat` | ✅ | ❌ **Not implemented** | Only checks on interval |
| **`deleteAfterRun`** for one-shot jobs | ✅ | ❌ **Not implemented** | — |
| **Agent binding** (`agentId`) | ✅ | ❌ **Not implemented** | — |
| **Stagger window** (`staggerMs`) | ✅ | ❌ **Not implemented** | — |
| **6-field cron** (with seconds) | ✅ via croner | ❌ **Not implemented** | Only 5-field |
| **CLI commands** (`cron add/list/run/runs`) | ✅ | ❌ **Not implemented** | No CLI integration |
| **Tool-call API** for cron management | ✅ | ❌ **Not implemented** | No tool registered |
| **Webhook delivery** per job | ✅ | ❌ **Not implemented** | — |
| **Run history** (`cron runs --id`) | ✅ | ⚠️ **In-memory only** | Logs exist but lost on restart |
| **Cron expression parsing** | ✅ via croner | ⚠️ **Custom parser** | Buggy custom parser (see CRON-005) |
| **Retry with backoff** | ✅ | ⚠️ **Mentioned in README but not implemented** | See CRON-008 |
| **Job execution via agent** | ✅ | ❌ **Placeholder** | `executeCommand()` just emits event and returns placeholder string |

### Implementation Completeness: **~15%**

The cron system has a solid skeleton (Zod schemas, event emitter, cron parser, job management) but is effectively a **mock**. The execution pipeline ends at a placeholder comment:

```typescript
// This is a placeholder - in a real implementation,
// this would execute the command through the agent or shell
this.emit('executeCommand', job);
return `Executed: ${job.command}`;
```

---

## 1. CRITICAL: Cron is Dead Code (Same Pattern as SubAgents)

### CRON-001: Cron service is NEVER started in the main gateway
- [ ] **Severity**: 🔴 Critical — **The entire cron system doesn't work**
- **Files**: `src/gateway/index.ts`, `src/gateway/enhanced-index.ts`
- **Problem**: Same pattern as SUB-001. The main gateway (`index.ts`) has zero references to cron. `cronService.start()` is called only in `enhanced-index.ts` (line 268), which is dead code.
  
  ```
  gateway/index.ts:      grep "cron" → 0 results
  gateway/enhanced-index.ts: grep "cron" → 28 results (never used)
  tools/:                grep "cron" → 0 results
  cli/:                  grep "cron" → 0 results
  config/:               grep "cron" → 0 results
  tests/:                grep "cron" → 0 results
  ```
  
  Nobody imports `cronService`. Nobody calls `.start()`. Nobody listens for `executeCommand`. The scheduler never runs.

- **Fix**: Add cron initialization to `src/gateway/index.ts`:
  ```typescript
  import { cronService } from '../cron/index.js';
  
  // After tool registration:
  cronService.start();
  cronService.on('executeCommand', async (job) => {
      // Route job.command to agent loop
  });
  ```

### CRON-002: `executeCommand()` is a placeholder that never executes anything
- [ ] **Severity**: 🔴 Critical
- **File**: `src/cron/index.ts`, lines 453-461
- **Problem**: The actual command execution is fake:
  ```typescript
  private async executeCommand(job: CronJob): Promise<string> {
      // This is a placeholder - in a real implementation,
      // this would execute the command through the agent or shell
      this.emit('executeCommand', job);
      return `Executed: ${job.command}`;
  }
  ```
  Even if the cron service was started, jobs would "succeed" immediately with a static string. No actual agent call, no tool execution, no command processing. The event is emitted but even in `enhanced-index.ts`, the listener also does nothing (line 297: `// In a real implementation, this would route to the agent`).
  
- **Fix**: Implement actual execution — either:
  - **(A)** Inject an execution callback via constructor
  - **(B)** Require an `AgentLoop` reference and call `agentLoop.executeTool()`
  - **(C)** Use the event bus to emit `message.inbound` as if the user sent the command

### CRON-003: No CLI commands for cron management
- [ ] **Severity**: 🟡 Medium
- **Files**: `src/cli/` (no cron files)
- **Problem**: OpenClaw spec has full CLI: `cron add`, `cron list`, `cron run`, `cron runs`, `cron edit`. Talon has zero CLI commands for cron. Users can't create, view, or manage scheduled jobs.
- **Fix**: Implement CLI commands that call `cronService` methods.

### CRON-004: No tool for agent-driven cron management
- [ ] **Severity**: 🟡 Medium
- **Files**: `src/tools/` (no cron tool)
- **Problem**: OpenClaw spec says the agent can manage cron via tool calls. Talon has no `cron_add`, `cron_list`, or similar tools. The user can't say "remind me to check email every morning at 9" because the agent has no tool to create cron jobs.
- **Fix**: Create `src/tools/cron-tool.ts`:
  ```typescript
  export function createCronTools(cronService: CronService) {
      return [
          { name: 'cron_add', ... },
          { name: 'cron_list', ... },
          { name: 'cron_remove', ... },
          { name: 'cron_run_now', ... },
      ];
  }
  ```

---

## 2. Functional Bugs

### CRON-005: Custom cron parser has multiple bugs
- [ ] **Severity**: 🟡 Medium
- **File**: `src/cron/index.ts`, lines 45-156
- **Problem**: The custom `CronExpression` parser has several issues vs the OpenClaw spec (which uses `croner`):

  **Bug A**: `parseField()` stores wildcard `*` as `[0, max]` range pair at line 83, but `max` for day-of-month is 31. Days start at 1, not 0. So `* * * * *` includes day 0, which `getDate()` never returns. Harmless but wasteful.
  
  **Bug B**: Month field uses `getMonth() + 1` at line 148, which is correct. But day-of-week with value 7 (Sunday in some cron implementations) is not handled. `getDay()` returns 0-6, so `7` in a cron expression will never match Sunday. Standard cron allows both 0 and 7 for Sunday.
  
  **Bug C**: `next()` iterates minute-by-minute (line 132) starting from now. For a job scheduled far in the future (e.g., `0 0 25 12 *` — Christmas), this iterates through up to ~2.1M minutes. While it has a cap of `366*24*60*4 ≈ 2.1M` iterations, this is extremely slow. A proper implementation should jump by field (next valid month → next valid day → next valid hour → next valid minute).
  
  **Bug D**: No support for 6-field cron (with seconds) as required by OpenClaw spec. Only 5-field cron is accepted. `parts.length !== 5` throws on line 71.
  
  **Bug E**: `@reboot` is mapped to `[[0], [0], [1], [1], [1]]` which matches midnight on January 1st — not "run once at startup". The `checkJobs()` method will keep executing it every January 1st.

- **Fix**: Replace with `croner` library (as OpenClaw uses):
  ```typescript
  import { Cron } from 'croner';
  // Cron handles 5/6 fields, timezones, next() efficiently
  ```

### CRON-006: `@reboot` doesn't actually run at startup
- [ ] **Severity**: 🟡 Medium
- **File**: `src/cron/index.ts`, lines 65-67, 340-348
- **Problem**: `@reboot` is parsed as `[[0], [0], [1], [1], [1]]` (midnight Jan 1). The `start()` method calls `checkJobs()` immediately (line 184), which checks `job.nextRun <= now`. But `@reboot` jobs get their `nextRun` calculated via `CronExpression.next()`, which returns the next January 1st — not "now". So `@reboot` jobs don't run at startup; they run on New Year's Day.
- **Fix**: Detect `@reboot` jobs in `start()` and execute them immediately:
  ```typescript
  start(): void {
      // ... existing start logic
      // Run @reboot jobs immediately
      for (const job of this.getEnabledJobs()) {
          if (job.schedule === '@reboot') {
              this.executeJob(job);
          }
      }
  }
  ```

### CRON-007: No persistence — all jobs vanish on restart
- [ ] **Severity**: 🔴 Critical (per OpenClaw spec)
- **File**: `src/cron/index.ts`
- **Problem**: Jobs are stored in `Map<string, CronJob>` (line 161). No `fs.writeFile()`, no `JSON.stringify()`, no `~/.talon/cron/jobs.json`. When the process restarts, all scheduled jobs are gone. The README correctly acknowledges this (line 248), but it's a core requirement of the OpenClaw spec.
  
  OpenClaw: *"Cron jobs are persisted on the Gateway host at `~/.openclaw/cron/jobs.json`"*
  
- **Fix**: Add persistence:
  ```typescript
  private readonly jobsPath = path.join(TALON_HOME, 'cron', 'jobs.json');
  
  private saveJobs(): void {
      fs.mkdirSync(path.dirname(this.jobsPath), { recursive: true });
      fs.writeFileSync(this.jobsPath, JSON.stringify([...this.jobs.values()], null, 2));
  }
  
  private loadJobs(): void {
      if (fs.existsSync(this.jobsPath)) {
          const data = JSON.parse(fs.readFileSync(this.jobsPath, 'utf-8'));
          for (const job of data) { this.jobs.set(job.id, CronJobSchema.parse(job)); }
      }
  }
  ```

### CRON-008: README claims retry/backoff but it's not implemented
- [ ] **Severity**: 🟡 Medium
- **Files**: `src/cron/README.md` lines 174-178, `src/cron/index.ts`
- **Problem**: The README says:
  > "Failed jobs retry up to retryCount times (default: 3). Exponential backoff with jitter: `Math.min(30000, 1000 * Math.pow(2, attempt))`"
  
  But the actual code in `executeJob()` (lines 368-427) has NO retry logic. When a job fails:
  1. `failCount++` is incremented
  2. `jobFailed` event is emitted
  3. Nothing else. No retry scheduling, no backoff.
  
  The `retryCount` field exists in the schema but is never read during execution.
  
- **Fix**: Add retry after failure:
  ```typescript
  } catch (err) {
      job.failCount++;
      // ...existing failure handling...
      
      // Retry if attempts remaining
      if (job.failCount <= job.retryCount) {
          const delay = Math.min(30000, 1000 * Math.pow(2, job.failCount));
          setTimeout(() => this.executeJob(job), delay);
          logger.info({ jobId: job.id, attempt: job.failCount, delayMs: delay }, 'Retry scheduled');
      }
  }
  ```

---

## 3. Missing OpenClaw Concepts

### CRON-009: No `schedule.kind` differentiation (`at` / `every` / `cron`)
- [ ] **Severity**: 🟡 Medium
- **File**: `src/cron/index.ts`
- **Problem**: OpenClaw supports 3 schedule kinds:
  - `at`: One-shot ISO 8601 timestamp — "run at 2026-02-01T16:00:00Z"
  - `every`: Fixed interval in ms — "run every 300000ms"
  - `cron`: 5/6-field cron expression — "run at `0 7 * * *`"
  
  Talon only supports `cron` expressions. There's no way to say "remind me at 4PM today" (one-shot) or "check every 5 minutes" (interval) without converting to cron syntax.
- **Fix**: Extend the schema:
  ```typescript
  schedule: z.union([
      z.object({ kind: z.literal('at'), at: z.string() }),      // ISO 8601
      z.object({ kind: z.literal('every'), intervalMs: z.number() }),
      z.object({ kind: z.literal('cron'), expression: z.string(), tz: z.string().optional() }),
  ]);
  ```

### CRON-010: No session target (`main` vs `isolated`)
- [ ] **Severity**: 🟡 Medium
- **File**: `src/cron/index.ts`
- **Problem**: OpenClaw distinguishes:
  - `sessionTarget: "main"` → run in the main conversation context (system event)
  - `sessionTarget: "isolated"` → run a dedicated agent turn in `cron:<jobId>` session
  
  Talon has no session concept. When a job executes, it doesn't know which session to run in. The `executeCommand()` placeholder just emits an event with no session context.
- **Fix**: Add session targeting to the job schema and execution flow.

### CRON-011: No delivery modes (`announce` / `webhook` / `none`)
- [ ] **Severity**: 🟡 Medium
- **File**: `src/cron/index.ts`
- **Problem**: OpenClaw lets you deliver cron output to a chat channel, webhook URL, or silently. Talon has no delivery concept. Even if execution worked, results go nowhere.
- **Fix**: Add delivery configuration to job schema:
  ```typescript
  delivery: z.object({
      mode: z.enum(['announce', 'webhook', 'none']).default('announce'),
      channel: z.string().optional(),  // Which channel to announce on
      to: z.string().optional(),       // Webhook URL
  }).optional();
  ```

### CRON-012: No timezone support
- [ ] **Severity**: 🟢 Low
- **File**: `src/cron/index.ts`
- **Problem**: OpenClaw supports `schedule.tz` with IANA timezones. Talon's cron parser uses `new Date()` which is always local timezone. Can't schedule "7 AM Los Angeles time" if the server is in UTC.
- **Fix**: Use `croner` with timezone support, or manually offset dates.

---

## 4. README Issues

### CRON-013: README claims features that don't exist
- [ ] **Severity**: 🟡 Medium
- **File**: `src/cron/README.md`
- **Hallucinated features**:

  | README Claim | Line | Reality |
  |-------------|------|---------|
  | "retry logic" / "exponential backoff" | 4, 174-178 | ❌ Not implemented (CRON-008) |
  | "execution logging" | 4 | ⚠️ In-memory only, no persistence |
  | Line count "496 lines" | 29 | ✅ Accurate (actually 497) |
  | `enableJob(id)` / `disableJob(id)` methods | 93 | ❌ Method is `setEnabled(id, boolean)` |
  | `updateJob(id, updates)` method | 89 | ❌ Not implemented |
  | `cancelJob(id)` method | 97 | ❌ Not implemented |
  | `clearJobLogs(id)` method | 102 | ❌ Not implemented |
  | `getJobLogs(id)` method | 100 | ⚠️ Named `getRunLogs(id)` |
  | Event `jobEnabled` / `jobDisabled` | 107 | ❌ Event is `jobStatusChanged` |
  | Event payloads in `utils/types.ts` | 215-222 | ❌ Not defined there |
  | "comprehensive event emission" | 252 | ⚠️ Events emitted but nobody listens |

### CRON-014: README line count is accurate (rare!)
- [x] **Severity**: 🟢 None — **Actually correct**
- The README says "496 lines" and the file is 497 lines. Close enough to be honest. This is the only README across all modules with an approximately correct line count.

---

## 5. Architectural Issues

### CRON-015: Singleton export prevents testing and multi-instance
- [ ] **Severity**: 🟡 Medium
- **File**: `src/cron/index.ts`, line 496
- **Problem**: `export const cronService = new CronService()` creates a module-level singleton. This means:
  - Tests can't create isolated instances
  - Can't have multiple cron services (e.g., one per agent)
  - State leaks between test runs
- **Fix**: Export the class only; let consumers create instances:
  ```typescript
  export { CronService };
  // Remove: export const cronService = new CronService();
  ```

### CRON-016: `executeCommand` returns success before actual execution
- [ ] **Severity**: 🟡 Medium
- **File**: `src/cron/index.ts`, lines 453-461
- **Problem**: `executeCommand()` emits an event and immediately returns `"Executed: ${job.command}"`. The event handler (if any) runs asynchronously. So the job is marked `'completed'` with the placeholder output, even if the actual execution fails.
  
  This means `runLog.status` is always `'completed'` (never `'failed'` from actual execution), `runLog.output` is always `"Executed: ..."`, and the retry mechanism (if it existed) would never trigger.
- **Fix**: Make `executeCommand()` wait for actual execution:
  ```typescript
  private async executeCommand(job: CronJob): Promise<string> {
      return new Promise((resolve, reject) => {
          this.emit('executeCommand', job, resolve, reject);
      });
  }
  ```

### CRON-017: Run logs grow unbounded in memory
- [ ] **Severity**: 🟢 Low
- **File**: `src/cron/index.ts`, lines 379-381
- **Problem**: Every execution appends to `this.runLogs.get(job.id)`. For a job running every minute, that's 1,440 logs/day × forever. No cap, no rotation, no cleanup.
- **Fix**: Cap logs per job:
  ```typescript
  const MAX_LOGS_PER_JOB = 100;
  if (logs.length > MAX_LOGS_PER_JOB) {
      logs.splice(0, logs.length - MAX_LOGS_PER_JOB);
  }
  ```

### CRON-018: `scheduleJobExecution()` uses `setTimeout(fn, 0)` which is pointless
- [ ] **Severity**: 🟢 Low
- **File**: `src/cron/index.ts`, lines 353-363
- **Problem**: When `checkJobs()` finds a due job, it calls `scheduleJobExecution()` which does:
  ```typescript
  const timer = setTimeout(async () => {
      this.timers.delete(job.id);
      await this.executeJob(job);
  }, 0);  // ← delay of 0
  ```
  A `setTimeout(fn, 0)` just defers to the next tick. This adds unnecessary indirection with a timer Map entry for prevention of "duplicate execution" — but since `checkJobs()` is synchronous, duplicates can't happen within a single check. The timer-based dedup only matters if `checkFrequencyMs` is very small.
- **Fix**: Execute directly or explain the dedup rationale.

---

## 6. Security Issues

### CRON-019: No command validation for scheduled jobs
- [ ] **Severity**: 🟡 Medium
- **File**: `src/cron/index.ts`, line 215
- **Problem**: `addJob()` accepts any `command` string. When execution is eventually implemented, this command will be passed to the agent or shell. There's no allowlist, no validation, no sanitization. A malicious or buggy caller could schedule `rm -rf /` as a cron job.
- **Fix**: Add command validation:
  ```typescript
  const ALLOWED_COMMANDS = ['generate_daily_summary', 'cleanup-sessions', ...];
  if (!ALLOWED_COMMANDS.includes(job.command)) {
      throw new Error(`Command not allowed: ${job.command}`);
  }
  ```

---

## 7. Test Coverage

### CRON-020: Zero tests for the entire cron system
- [ ] **Severity**: 🟠 High
- **Files**: `tests/` directory
- **Problem**: Zero test files contain the word "cron". The cron expression parser, job scheduler, and service lifecycle are completely untested. Given the bugs in the cron parser (CRON-005), tests would have caught them immediately.
- **Fix**: Create tests for:
  - Cron expression parsing (all field types, special keywords)
  - `next()` calculation accuracy
  - `matches()` correctness
  - Job lifecycle (add, remove, enable/disable)
  - Execution flow (when implemented)

---

## 8. Priority Implementation Order

### 🚨 Must Fix (system doesn't work without these):

| # | Issue | What | Time |
|---|-------|------|------|
| 1 | `CRON-001` | **Wire cron into main gateway** | 10 min |
| 2 | `CRON-002` | **Implement actual command execution** (agent delegation) | 1 hr |
| 3 | `CRON-007` | **Add job persistence** (`~/.talon/cron/jobs.json`) | 30 min |
| 4 | `CRON-005` | **Replace custom parser with `croner`** (or fix bugs) | 30 min |

### 🟡 Should Fix (core OpenClaw features):

| # | Issue | What |
|---|-------|------|
| 5 | `CRON-009` | Add `at` (one-shot) and `every` (interval) schedule kinds |
| 6 | `CRON-008` | Implement the retry/backoff that README claims |
| 7 | `CRON-004` | Create cron tool for agent-driven management |
| 8 | `CRON-010` | Add session targeting (main vs isolated) |
| 9 | `CRON-006` | Fix `@reboot` to actually run at startup |
| 10 | `CRON-016` | Make executeCommand wait for actual result |

### 🟢 Nice-to-have:

| # | Issue | What |
|---|-------|------|
| 11 | `CRON-011` | Delivery modes (announce, webhook) |
| 12 | `CRON-012` | Timezone support |
| 13 | `CRON-003` | CLI commands for cron |
| 14 | `CRON-020` | Write tests |
| 15 | `CRON-013,015,017,018,019` | Everything else |

---

## 9. Files Reference

| File | Lines | Bytes | Status | Critical Issues |
|------|-------|-------|--------|-----------------|
| `src/cron/index.ts` | 497 | 15,055 | 🔴 Placeholder | CRON-001..008, 015-018 |
| `src/cron/README.md` | 373 | 16,443 | 🟡 Partly hallucinated | CRON-013 |
| `src/gateway/index.ts` | 308 | — | 🔴 Missing cron wiring | CRON-001 |
| `src/gateway/enhanced-index.ts` | 612 | — | ⚪ Dead code (has wiring) | — |
| `src/tools/` | — | — | ❌ No cron tool | CRON-004 |
| `src/cli/` | — | — | ❌ No cron commands | CRON-003 |
| `src/config/` | — | — | ❌ No cron config | — |
| `tests/` | — | — | ❌ No cron tests | CRON-020 |

---

## 10. The Honest Assessment

The cron system is best described as a **well-commented prototype**. It has:
- ✅ A clean Zod-validated job schema
- ✅ A working (but buggy) cron expression parser
- ✅ Good EventEmitter-based architecture
- ✅ Proper service lifecycle (start/stop)
- ✅ An honest README (mostly)

But it's missing:
- ❌ Actual execution (placeholder)
- ❌ Persistence (memory-only)
- ❌ Gateway wiring (dead code)
- ❌ CLI commands
- ❌ Agent tools
- ❌ All 3 OpenClaw schedule kinds (only `cron`, no `at` or `every`)
- ❌ Session targeting
- ❌ Delivery modes
- ❌ Timezone support
- ❌ Tests

**Implementation completeness vs OpenClaw spec: ~15%**

---

## 11. Comparison with Previous Audits

| Metric | tools/ | channels/ | agent/ | subagents/ | cron/ |
|--------|--------|----------|--------|-----------|-------|
| Total issues | 32 | 24 | 26 | 19 | **20** |
| Critical/High | 8 | 9 | 3 | 4 | **5** |
| Dead code? | 3 modules | 1 file | 1 method | Entire dir | **Entire dir** |
| Tests? | Partial | None | Nearly none | Mock-only | **None** |
| README accuracy | ~60% | ~50% | ~40% | ~80% | **~60%** |
| Blocks daily use? | No | CHAN-003 | No | No | **No (unused)** |
| OpenClaw parity | N/A | N/A | N/A | N/A | **~15%** |

**Pattern emerging**: `enhanced-index.ts` was meant to be the "complete" gateway with subagents + cron. But it was never wired as the entry point. Two entire subsystems (`subagents/` + `cron/`) are dead because of this single oversight.
