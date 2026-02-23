# Feature: Talon CLI System

## 1. Purpose
- Provides the command-line interface for Talon with setup wizard, TUI, service management, and command routing.
- Solves the problem of user interaction, configuration, and system management through terminal commands.
- Exists as the primary user interface and system administration tool for Talon.
- Does NOT handle: AI reasoning (agent), channel communication (channels), memory management (memory), or tool execution (tools).

## 2. Scope Boundaries
- Belongs inside: Command parsing, user interaction, configuration management, service lifecycle, TUI rendering.
- Must NEVER contain: AI model logic, network server code, session state management, or tool implementations.
- Dependencies: gateway/ (for service control), config/ (for settings), channels/ (for CLI channel), utils/ (for logging).
- Ownership boundaries: CLI owns user interaction and system management. Gateway owns service execution. Channels owns CLI communication interface.

## 3. Architecture Overview
```
User → CLI Command → Router → Command Handler → Action → Result → User
  ↑        ↑           ↑           ↑              ↑        ↑       ↑
Terminal  Parsing    Dispatch   Implementation  Gateway  Format  Display
          (index.ts)            (wizard.ts,     Service  Output  (TUI)
                                service.ts,              (JSON,
                                provider.ts)             Text)
```

Entry points:
- `index.ts` main() - CLI command router and dispatcher
- `runWizard()` - Interactive setup wizard entry
- `startTUI()` - Terminal user interface entry
- `addProvider()` - Provider management entry
- Service commands (start/stop/restart/status) - Service management

Core modules:
- `CommandRouter`: Parses CLI arguments and dispatches to handlers
- `SetupWizard`: Interactive configuration with step-by-step guidance
- `TUIClient`: Terminal user interface for interactive sessions
- `ServiceManager`: System service lifecycle (install/start/stop/status)
- `ProviderManager`: AI provider configuration and switching
- `HealthChecker`: System health and status reporting

State management: Command-line arguments (stateless), wizard state (step-by-step), TUI session state (WebSocket connection), service state (running/stopped).

Data flow: CLI arguments → command parsing → handler lookup → execution → result formatting → output display.

## 4. Folder Structure Explanation

**index.ts** (14,496 lines)
- What: Main CLI entry point and command router
- Why: Single entry for all `talon` commands with argument parsing
- Who calls: Node.js via shebang (`#!/usr/bin/env node`)
- What calls: All command handlers (wizard, TUI, service, provider)
- Side effects: Executes commands, starts/stops services, manages processes
- Critical assumptions: Node.js >= 22, proper permissions, workspace exists

**wizard.ts** (32,307 lines)
- What: Interactive setup wizard with 8-step configuration
- Why: Guides users through initial setup and complex configuration
- Who calls: `talon setup` command from CLI router
- What calls: Inquirer prompts, file system operations, configuration validation
- Side effects: Creates config files, sets up workspace, validates API keys
- Critical assumptions: User has terminal access, dependencies installed, network available

**tui.ts** (20,547 lines)
- What: Terminal user interface for interactive sessions
- Why: Provides rich interactive experience without web UI
- Who calls: `talon tui` command from CLI router
- What calls: WebSocket client, TerminalRenderer, readline interface
- Side effects: Connects to gateway, renders streaming output, manages TTY
- Critical assumptions: Gateway running, terminal supports ANSI, WebSocket available

**service.ts** (13,311 lines)
- What: System service management (install/start/stop/status)
- Why: Enables background operation and system integration
- Who calls: `talon service *` commands from CLI router
- What calls: Platform-specific service managers (launchd/systemd), process control
- Side effects: Installs/uninstalls services, starts/stops processes, manages PID files
- Critical assumptions: Platform supports service management (macOS/Linux), proper permissions

**provider.ts** (10,991 lines)
- What: AI provider management and configuration
- Why: Allows users to add/change AI providers and switch models
- Who calls: `talon provider` and `talon switch` commands
- What calls: Configuration file operations, API key validation, model checking
- Side effects: Updates config files, validates API keys, restarts services
- Critical assumptions: Provider APIs accessible, API keys valid, config writable

**providers.ts** (6,829 lines)
- What: Provider registry and API definitions
- Why: Central source of provider configurations and capabilities
- Who calls: Provider manager, setup wizard, configuration system
- What calls: Provider APIs for model validation, rate limit checking
- Side effects: Validates provider configurations, checks API availability
- Critical assumptions: Provider APIs stable, network accessible, rate limits known

**commands/** (directory)
- What: Individual CLI command implementations
- Why: Modular command system for extensibility
- Who calls: CLI router based on command name
- What calls: Various subsystems based on command purpose
- Side effects: Command-specific operations
- Critical assumptions: Commands properly registered, dependencies available

## 5. Public API

**Exported functions:**
- `runWizard()` - Starts interactive setup wizard
- `startTUI()` - Starts terminal user interface
- `addProvider()` - Adds/changes AI provider
- `switchModel()` - Switches between configured models
- Service functions: `startService()`, `stopService()`, `restartService()`, `checkServiceStatus()`

**Input types:**
- `CLIArguments`: Array of strings from process.argv
- `WizardOptions`: Configuration options for setup wizard
- `TUIConfig`: TUI display and connection settings
- `ServiceOptions`: Platform-specific service configuration
- `ProviderConfig`: Provider API keys and settings

**Output types:**
- `CommandResult`: {success: boolean, message: string, data?: any}
- `WizardResult`: Complete configuration object
- `TUIState`: TUI connection and rendering state
- `ServiceStatus`: {installed: boolean, running: boolean, pid?: number}
- `ProviderStatus`: {configured: boolean, valid: boolean, models: string[]}

**Error behavior:**
- Invalid commands: Shows help text with available commands
- Configuration errors: Guides user to run setup wizard
- Service errors: Provides platform-specific troubleshooting
- Network errors: Suggests checking connectivity and API keys
- Permission errors: Guides on fixing file permissions
- Missing dependencies: Shows installation instructions

**Edge cases:**
- No TTY available: Falls back to non-interactive mode
- Gateway already running: Offers to stop or force restart
- Invalid API keys: Provides validation and re-entry
- Service already installed: Offers reinstall or uninstall
- Configuration corruption: Offers to reset or restore backup

**Idempotency notes:**
- Setup wizard: Not idempotent (overwrites configuration)
- Service commands: Idempotent (start on started = no-op, stop on stopped = no-op)
- Provider management: Idempotent for same configuration
- TUI: Not idempotent (creates new session each time)
- Health check: Idempotent (read-only)

## 6. Internal Logic Details

**Core algorithms:**
- Command routing: Prefix matching with fallback to help
- Wizard flow: 8-step sequential progression with validation and backtracking
- TUI rendering: WebSocket message to terminal chunk conversion with streaming
- Service management: Platform detection with launchd (macOS) / systemd (Linux) implementations
- Provider validation: API key testing with model listing and rate limit checking

**Important decision trees:**
1. CLI command → Parse arguments → Match command → Validate prerequisites → Execute handler → Format output
2. Setup wizard → Check existing config → Offer backup → Step 1-8 with validation → Write config → Test
3. TUI startup → Check gateway health → Connect WebSocket → Initialize renderer → Handle input/output
4. Service install → Check platform → Generate service file → Install → Start → Verify
5. Provider add → Select provider → Check existing key → Validate → Update config → Restart if needed

**Guardrails:**
- Command validation: Checks prerequisites before execution
- Configuration backup: Automatic .bak files before overwrites
- Service conflict prevention: PID file locking and port checking
- API key security: Never logs keys, secure file permissions
- User confirmation: Destructive operations require confirmation
- Missing: Command timeout protection

**Validation strategy:**
- CLI arguments: Required/optional validation, type checking
- Configuration: Zod schema validation with helpful errors
- API keys: Test calls with simple prompts
- Service files: Syntax validation before installation
- Platform compatibility: Feature detection before attempting operations
- Missing: Input sanitization for command arguments

**Retry logic:**
- API validation: 2 retries with delay for network issues
- Service startup: Health check polling with timeout
- WebSocket connection: Auto-reconnect with backoff
- File operations: No retry (fail fast with clear error)
- Missing: Circuit breaker for failing providers

## 7. Data Contracts

**Schemas used:**
- `CLICommandSchema`: Zod schema for command definitions
- `WizardConfigSchema`: Zod schema for wizard configuration
- `ServiceConfigSchema`: Zod schema for service configuration
- `ProviderConfigSchema`: Zod schema for provider settings
- `TUIConfigSchema`: Zod schema for TUI settings

**Validation rules:**
- CLI commands: Required name, handler function, description
- Wizard steps: Sequential validation, required fields, type checking
- Service files: Platform-specific syntax, required fields
- Provider config: API key format, base URL validation
- TUI config: Connection timeout, rendering options

**Expected shape of objects:**
```typescript
CLICommand: {
  name: string;           // e.g., "setup"
  description: string;    // Help text
  handler: (args: string[]) => Promise<void>;
  options?: Array<{flag: string, description: string}>;
}

WizardResult: {
  agent: {model: string, providers: Record<string, any>};
  gateway: {host: string, port: number, auth: any};
  channels: {telegram: any, whatsapp: any};
  workspace: {root: string};
  tools: {webSearch: any};
}
```

**Breaking-change risk areas:**
- CLI command interface: Changes break user scripts and documentation
- Configuration format: Changes require migration or break existing configs
- Service file format: Changes break existing installations
- Provider API: Changes break provider management
- TUI protocol: Changes break client-server compatibility

## 8. Failure Modes

**Known failure cases:**
- Node.js version incompatible: CLI fails to start
- Configuration file corrupted: Commands fail with parse errors
- Service file syntax error: Service fails to install/start
- Network unavailable: API validation and TUI connection fail
- Permission denied: File operations and service management fail
- Terminal incompatible: TUI rendering fails or looks broken

**Silent failure risks:**
- Command handler errors: Swallowed exceptions not reported
- Configuration write failures: Changes not persisted
- Service start timeout: Appears hung without feedback
- WebSocket disconnection: TUI appears frozen
- Missing: Health check false positives

**Race conditions:**
- Concurrent configuration writes: File corruption
- Multiple service starts: Port conflicts
- TUI input during rendering: Display corruption
- CLI commands during service restart: Unpredictable state
- Missing: File locking for configuration

**Memory issues:**
- Large configuration files: Memory consumption in wizard
- TUI buffer accumulation: Unbounded message queue
- Service process leakage: Child processes not cleaned up
- Provider cache growth: Unbounded model list caching
- Missing: Memory usage monitoring

**Performance bottlenecks:**
- Wizard API validation: Sequential provider testing
- TUI rendering: Large message processing blocks input
- Service health checks: Polling interval latency
- Configuration parsing: Large config file processing
- Provider model listing: Network API calls

## 9. Observability

**Logs produced:**
- Command execution: INFO level with command and arguments
- Wizard steps: INFO level with step completion and choices
- Service operations: INFO level with install/start/stop events
- Provider operations: INFO level with add/change/validation
- TUI events: DEBUG level with connection and message flow
- Missing: Command execution timing metrics

**Metrics to track:**
- Command usage frequency (by command)
- Wizard completion rate (steps completed vs abandoned)
- Service uptime (percentage time running)
- TUI session duration and message count
- Provider validation success rate
- Error rate by command and error type
- Missing: User interaction patterns

**Debug strategy:**
1. Enable CLI debug: `DEBUG=cli:*` environment variable
2. Verbose mode: `talon --verbose <command>`
3. Dry run: `talon --dry-run <command>` (where supported)
4. Configuration inspection: `talon config` command
5. Health check: `talon health --detailed`
6. Service logs: Platform-specific log locations

**How to test locally:**
1. Unit tests: `npm test src/cli/` (coverage varies)
2. Integration: Run each command with various arguments
3. Wizard testing: Complete setup flow, verify config
4. TUI testing: Start gateway, connect TUI, send messages
5. Service testing: Install, start, stop, verify status
6. Provider testing: Add providers, switch models, validate

## 10. AI Agent Instructions

**How an AI agent should modify this feature:**
1. Understand command routing before adding new commands
2. Test backward compatibility for configuration changes
3. Verify platform support for new features
4. Check user experience for interactive components
5. Run CLI tests before committing changes

**What files must be read before editing:**
- `index.ts`: Command routing and main entry point
- Target command file (wizard.ts, service.ts, etc.)
- Configuration schema for any new settings
- Platform detection logic for cross-platform features
- Error handling patterns across CLI

**Safe refactoring rules:**
1. Keep CLI command interface backward compatible
2. Maintain configuration file compatibility
3. Preserve service file formats across platforms
4. Don't break wizard flow for existing users
5. Keep error messages helpful and actionable

**Forbidden modifications:**
- Changing CLI command names without migration
- Breaking configuration file format without migration
- Removing required wizard steps
- Changing service file syntax without migration
- Breaking TUI WebSocket protocol

## 11. Extension Points

**Where new functionality can be safely added:**
- New CLI commands: Add to index.ts with handler
- Additional wizard steps: Extend wizard.ts with new step
- Enhanced TUI features: Extend tui.ts or TerminalRenderer
- New service platforms: Add platform detection and implementation
- Additional provider types: Add to providers.ts registry
- Configuration exporters: Add export formats for config

**How to extend without breaking contracts:**
1. Add new commands with unique names
2. Use optional wizard steps with feature flags
3. Add TUI features with backward compatibility
4. Version service file formats
5. Use configuration migration for format changes

## 12. Technical Debt & TODO

**Weak areas:**
- Large monolithic files (wizard.ts 32k lines)
- Limited test coverage for interactive components
- Platform-specific code duplication (service management)
- No command timeout protection
- Missing: CLI plugin system for extensibility
- Missing: Configuration versioning and migration

**Refactor targets:**
- Split wizard.ts into modular step implementations
- Increase test coverage for interactive components
- Abstract platform-specific code with better patterns
- Add command timeout and cancellation
- Implement plugin system for third-party commands
- Missing: Dependency injection for testability

**Simplification ideas:**
- Reduce wizard complexity with sensible defaults
- Consolidate service management code
- Simplify command routing with metadata-driven approach
- Reduce configuration options with opinionated defaults
- Merge similar provider management code
- Missing: Unified configuration management interface