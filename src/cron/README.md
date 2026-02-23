# Talon Scheduled Task System

## Purpose
Background task scheduling and execution system for automated, time-based operations. Based on OpenClaw's cron architecture, provides cron expression parsing, job management, execution logging, and retry logic for scheduled tasks.

## Scope Boundaries
- **IN SCOPE**: Cron expression parsing, job scheduling, execution management, retry logic, execution logging, job lifecycle events
- **OUT OF SCOPE**: Task execution logic (delegated to agent), persistent storage (jobs stored in memory), user interface for job management
- **BOUNDARIES**: Cron service schedules and triggers jobs, but actual execution is delegated to the agent system via event emission. Jobs are memory-resident (not persisted across restarts).

## Architecture Overview
```
Cron Service → Job Scheduler → Cron Expression Parser → Job Execution → Agent System
    ↑              ↑                ↑              ↑
Job Management  Timing Logic    Schedule Calc  Event Emission
```

**Core Design**: EventEmitter-based service with in-memory job storage. Uses custom cron expression parser supporting standard cron syntax and special keywords (`@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly`, `@reboot`).

**Key Components**:
1. `CronService` - Main service managing job lifecycle and scheduling
2. `CronExpression` - Parser for cron expressions with next occurrence calculation
3. `CronJob` - Job definition with Zod schema validation
4. `CronRunLog` - Execution logging with status tracking

## Folder Structure Explanation
```
cron/
├── index.ts              # Complete cron system (496 lines)
└── README.md             # This documentation
```

**Single File Architecture**: All cron system code resides in `index.ts` containing:
- Zod schemas for job and run log validation
- Cron expression parser with full cron syntax support
- Cron service with job management and scheduling
- Singleton `cronService` instance exported

## Public API
```typescript
// Core Types
interface CronJob {
    id: string;                    // Unique job identifier
    name: string;                  // Human-readable name
    schedule: string;              // Cron expression or special keyword
    command: string;               // Command to execute (passed to agent)
    args: unknown[];               // Command arguments
    enabled: boolean;              // Whether job is active
    timeout: number;               // Execution timeout in ms (default: 30000)
    retryCount: number;            // Retry attempts on failure (default: 3)
    metadata?: Record<string, unknown>; // Optional metadata
    createdAt: number;             // Unix timestamp when job created
    lastRun?: number;              // Last execution time
    nextRun?: number;              // Next scheduled execution time
    runCount: number;              // Total execution count
    failCount: number;             // Total failure count
}

interface CronRunLog {
    id: string;                    // Unique run identifier
    jobId: string;                 // Associated job ID
    startedAt: number;             // Start timestamp
    completedAt?: number;          // Completion timestamp
    status: 'running' | 'completed' | 'failed' | 'timeout';
    output?: string;               // Execution output
    error?: string;                // Error message if failed
    duration?: number;             // Execution duration in ms
}

// Cron Expression Parser
class CronExpression {
    constructor(expression: string);
    next(from?: Date): Date;       // Get next occurrence after date
    matches(date: Date): boolean;  // Check if date matches expression
    toString(): string;            // Return original expression
}

// Cron Service
class CronService extends EventEmitter {
    constructor(checkFrequencyMs?: number); // Default: 60000 (1 minute)
    
    // Lifecycle
    start(): void;                 // Start scheduling service
    stop(): void;                  // Stop service and clear timers
    
    // Job Management
    addJob(job: Omit<CronJob, 'id' | 'createdAt' | 'runCount' | 'failCount'>): CronJob;
    removeJob(id: string): boolean;
    updateJob(id: string, updates: Partial<CronJob>): CronJob | null;
    getJob(id: string): CronJob | undefined;
    getAllJobs(): CronJob[];
    enableJob(id: string): boolean;
    disableJob(id: string): boolean;
    
    // Execution Control
    runJobNow(id: string): Promise<CronRunLog>;
    cancelJob(id: string): boolean;
    
    // Logs and Status
    getJobLogs(id: string): CronRunLog[];
    getStatus(): { jobCount: number; runningCount: number; nextRun?: number };
    clearJobLogs(id: string): void;
    
    // Events
    on(event: 'started' | 'stopped', listener: () => void): this;
    on(event: 'jobAdded' | 'jobRemoved' | 'jobUpdated', listener: (job: CronJob) => void): this;
    on(event: 'jobEnabled' | 'jobDisabled', listener: (jobId: string) => void): this;
    on(event: 'jobStarted', listener: (job: CronJob, runId: string) => void): this;
    on(event: 'jobCompleted', listener: (job: CronJob, log: CronRunLog) => void): this;
    on(event: 'jobFailed', listener: (job: CronJob, log: CronRunLog, error: Error) => void): this;
    on(event: 'executeCommand', listener: (job: CronJob) => void): this;
}

// Singleton Instance
export const cronService = new CronService();
```

**Usage Pattern**:
```typescript
import { cronService } from './cron/index.js';

// Start service
cronService.start();

// Add a job
const job = cronService.addJob({
    name: 'Daily Summary',
    schedule: '0 9 * * *', // 9 AM daily
    command: 'generate_daily_summary',
    args: [],
    enabled: true,
    timeout: 60000,
    retryCount: 3,
});

// Listen for execution events
cronService.on('executeCommand', async (job) => {
    console.log(`Executing: ${job.command}`);
    // Delegate to agent system
});

// Get status
const status = cronService.getStatus();
console.log(`Active jobs: ${status.jobCount}`);
```

## Internal Logic Details
**Cron Expression Parsing** (`index.ts:45-156`):
1. Supports special keywords: `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly`, `@reboot`
2. Parses standard cron fields: minute, hour, day of month, month, day of week
3. Supports wildcards (`*`), ranges (`1-5`), steps (`*/15`), lists (`1,3,5`)
4. `@reboot` schedules job to run once at service startup

**Next Occurrence Calculation** (`index.ts:118-136`):
1. Start from given date (or now)
2. Add 1 minute to find next potential match
3. Iterate minute by minute (max 4 years) checking `matches()`
4. Return first matching date or throw error

**Job Scheduling** (`index.ts:160-210`):
1. Service runs with configurable check frequency (default: 1 minute)
2. Each check evaluates all enabled jobs for execution
3. Jobs scheduled via `setTimeout()` for precise timing between checks
4. Timer cleared on job execution or service stop

**Job Execution Flow** (`index.ts:300-400`):
1. Job marked as running with `CronRunLog` created
2. `jobStarted` event emitted with job and run ID
3. `executeCommand` event emitted for agent to handle
4. Agent executes command and returns result
5. Job marked as completed/failed with appropriate logging
6. `jobCompleted` or `jobFailed` event emitted

**Retry Logic** (`index.ts:380-395`):
1. Failed jobs retry up to `retryCount` times (default: 3)
2. Exponential backoff with jitter: `Math.min(30000, 1000 * Math.pow(2, attempt))`
3. Retry scheduled as new job execution
4. Original failure logged, retry creates new run log

## Data Contracts
**Cron Job Schema** (`index.ts:11-28`):
```typescript
{
    id: string;                    // Auto-generated: `cron_${timestamp}_${random}`
    name: string;                  // Required: Descriptive name
    schedule: string;              // Required: Valid cron expression
    command: string;               // Required: Command for agent to execute
    args: unknown[];               // Optional: Defaults to []
    enabled: boolean;              // Optional: Defaults to true
    timeout: number;               // Optional: Defaults to 30000 (30s)
    retryCount: number;            // Optional: Defaults to 3
    metadata?: Record<string, unknown>; // Optional: Custom metadata
    createdAt: number;             // Auto-set: Unix timestamp
    lastRun?: number;              // Optional: Last execution time
    nextRun?: number;              // Auto-calculated: Next scheduled run
    runCount: number;              // Auto-incremented: Starts at 0
    failCount: number;             // Auto-incremented: Starts at 0
}
```

**Cron Run Log Schema** (`index.ts:30-41`):
```typescript
{
    id: string;                    // Auto-generated: `run_${timestamp}_${random}`
    jobId: string;                 // Required: Associated job ID
    startedAt: number;             // Required: Start timestamp
    completedAt?: number;          // Optional: Completion timestamp
    status: 'running' | 'completed' | 'failed' | 'timeout';
    output?: string;               // Optional: Execution output
    error?: string;                // Optional: Error message
    duration?: number;             // Optional: completedAt - startedAt
}
```

**Event Payloads** (`utils/types.ts`):
```typescript
'cron.job.added': { jobId: string; jobName: string; schedule: string };
'cron.job.removed': { jobId: string; jobName: string };
'cron.job.started': { jobId: string; runId: string };
'cron.job.completed': { jobId: string; runId: string; duration: number };
'cron.job.failed': { jobId: string; runId: string; error: string };
```

**Supported Cron Expressions**:
- Standard: `* * * * *` (every minute)
- Ranges: `0 9-17 * * 1-5` (9 AM to 5 PM, Mon-Fri)
- Steps: `*/15 * * * *` (every 15 minutes)
- Lists: `0 0 1,15 * *` (1st and 15th of month)
- Special: `@daily`, `@hourly`, `@reboot`

## Failure Modes
1. **Invalid Cron Expression** (`index.ts:230-232`): Throws `Error("Invalid cron expression: ${schedule}")` when expression cannot be parsed.

2. **Job Execution Timeout** (`index.ts:370-375`): Marks job as `'timeout'` status after `timeout` milliseconds, emits `jobFailed` event.

3. **Execution Failure**: Marks job as `'failed'` status, increments `failCount`, schedules retry if `retryCount` not exhausted.

4. **Service Already Running/Stopped**: `start()` and `stop()` methods are idempotent, no error thrown for duplicate calls.

5. **Missing Job**: `getJob()`, `removeJob()`, `updateJob()` return `undefined`/`false`/`null` for non-existent jobs.

6. **System Clock Changes**: Cron uses system time, clock changes may cause missed or duplicate executions. Missing: NTP synchronization awareness.

**Recovery Strategies**:
- Failed jobs retry with exponential backoff
- Timeout protection prevents hung jobs
- Memory cleanup on service stop
- Missing: Persistent job storage for crash recovery
- Missing: Distributed lock for multi-instance deployment

## Observability
**Current State**: Comprehensive event emission and logging for all job lifecycle events.

**Log Events**:
- Service start/stop: `'Cron service started'`, `'Cron service stopped'`
- Job added: `{ jobId, name, schedule }`
- Job execution: `{ jobId, runId }` start/complete/fail
- Execution details: `{ jobId, command }` when command executed

**Event Emission**:
- `jobAdded`, `jobRemoved`, `jobUpdated` - Job management
- `jobEnabled`, `jobDisabled` - State changes
- `jobStarted`, `jobCompleted`, `jobFailed` - Execution lifecycle
- `executeCommand` - Delegation to agent system

**Missing Observability**:
1. **Metrics**: Job execution rates, success/failure ratios, average duration, queue depth
2. **Tracing**: End-to-end execution tracing across cron→agent→tools
3. **Health Checks**: Job staleness detection, schedule validation
4. **Audit Log**: Complete job modification history with user context

**Required Enhancements**:
- Prometheus metrics endpoint for job statistics
- Distributed tracing integration
- Job dependency graph visualization
- Predictive analytics for job timing patterns

## AI Agent Instructions
**Cron Job Design Guidelines**:
1. **Command Selection**: Use agent-recognizable commands from available tools and capabilities.

2. **Schedule Design**: Choose appropriate frequency - avoid sub-minute schedules for resource-intensive jobs.

3. **Timeout Configuration**: Set realistic timeouts based on command complexity (default: 30s).

4. **Retry Strategy**: Configure `retryCount` based on command idempotency and importance.

5. **Error Handling**: Commands should return meaningful error messages for failure diagnosis.

**Integration with Agent**:
- Cron emits `executeCommand` event with `CronJob` payload
- Agent listens and executes command via tool system
- Execution results returned via callback or event response
- Agent can access job `args` and `metadata` for context

**Job Management**:
- Jobs are memory-resident - add at startup or via runtime API
- Use `@reboot` schedule for initialization tasks
- Monitor `failCount` for problematic jobs
- Consider job dependencies when scheduling related tasks

**Security Considerations**:
- Cron jobs execute with same privileges as agent
- Validate all job commands before adding
- Implement rate limiting for frequent jobs
- Audit job creation and modification
- Missing: Job permission system, command allowlist

**Performance Optimization**:
- Schedule resource-intensive jobs during off-peak hours
- Use appropriate check frequency (default 1 minute sufficient for most use cases)
- Monitor job execution duration and adjust timeouts accordingly
- Consider job batching for related operations

## Extension Points
1. **Storage Backends**: Add persistent job storage (SQLite, Redis, PostgreSQL).

2. **Advanced Scheduling**: Add calendar-based scheduling, business day awareness, holiday calendars.

3. **Job Dependencies**: Add job dependency graph with execution ordering constraints.

4. **Distributed Execution**: Add support for multi-node cron with leader election and workload distribution.

5. **Web UI**: Add administrative interface for job management and monitoring.

6. **Templating**: Add job templates with parameter substitution and dynamic schedule generation.

7. **Alerting**: Add integration with alerting systems for job failures.

8. **Backfill Support**: Add manual execution of missed jobs with historical data.

**Hook System** (Missing): No pre/post execution hooks. Suggested: `beforeExecute(job): boolean`, `afterExecute(job, result): void`, `onFailure(job, error): void`.

**Plugin Architecture** (Missing): No cron job type plugins. Suggested: Custom job types with specialized execution logic beyond simple command execution.

## Technical Debt & TODO
**HIGH PRIORITY**:
1. **Persistence**: Add persistent job storage to survive restarts
2. **Distributed Locks**: Add locking for multi-instance deployment
3. **Validation**: Add comprehensive input validation for job commands and arguments
4. **Security**: Add job permission system and command validation

**MEDIUM PRIORITY**:
5. **Monitoring**: Add comprehensive metrics and health checks
6. **Testing**: Add unit and integration tests for cron expression parser and job execution
7. **Documentation**: Add API documentation and usage examples
8. **Error Recovery**: Add dead letter queue for repeatedly failing jobs

**LOW PRIORITY**:
9. **Web UI**: Add administrative interface for job management
10. **Advanced Scheduling**: Add business calendar, holiday schedules
11. **Job Templates**: Add reusable job templates with parameters
12. **Import/Export**: Add job configuration import/export functionality

**ARCHITECTURAL DEBT**:
- Single large file (`index.ts:496 lines`) - should be split into separate modules
- Memory-only storage - jobs lost on restart
- No interface for storage backend - hardcoded to Map
- Missing abstraction for execution engine - tightly coupled to agent events
- No dependency injection - uses singleton pattern

**PERFORMANCE CONSIDERATIONS**:
- Linear scan of all jobs every check interval (O(n))
- No job prioritization or queue management
- Missing: Bulk job operations for efficiency
- Missing: Job execution concurrency limits

**SECURITY DEBT**:
- Jobs execute arbitrary commands with full agent privileges
- No authentication for job management API
- No audit trail for job modifications
- Missing: Command sandboxing and resource limits
- Missing: Job approval workflow for sensitive operations