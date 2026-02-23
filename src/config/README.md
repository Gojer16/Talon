# Feature: Talon Configuration System

## 1. Purpose
- Provides centralized configuration management with schema validation, environment variable resolution, and hot reload.
- Solves the problem of consistent configuration across all Talon components with type safety and runtime validation.
- Exists as the single source of truth for all Talon settings, enabling secure and flexible configuration.
- Does NOT handle: User interaction (CLI), AI model logic (agent), session management (gateway), or tool execution (tools).

## 2. Scope Boundaries
- Belongs inside: Configuration schema definition, configuration loading/validation, environment variable resolution, hot reload watching.
- Must NEVER contain: Business logic, AI algorithms, network server code, or user interface components.
- Dependencies: utils/ (for errors and logging), zod (for schema validation).
- Ownership boundaries: Config owns configuration validation and loading. All other components consume validated configuration. CLI owns configuration creation/modification.

## 3. Architecture Overview
```
Config Files → Loader → Env Var Resolution → Zod Validation → Config Object → Components
    ↑           ↑              ↑                 ↑               ↑              ↑
~/.talon/    File I/O      ${VAR_NAME}       Schema         Type-safe      Gateway,
config.json  Operations    Replacement      Validation      Interface      Agent,
.env                      Process.env                     (TalonConfig)   Channels,
                           Lookup                                        Memory,
                                                                         Tools
```

Entry points:
- `loadConfig()` - Main configuration loading with validation
- `TalonConfigSchema.parse()` - Raw configuration validation
- `ConfigReloader.start()` - Hot reload watcher initialization
- `resolveEnvVars()` - Environment variable resolution utility

Core modules:
- `Schema System`: Zod schema definitions for all configuration sections
- `Loader System`: File loading, environment variable resolution, validation
- `Reload System`: File watching with debouncing and change detection
- `Validation System`: Runtime type checking with helpful error messages
- `Default System`: Sensible defaults for all configuration options

State management: Configuration object (immutable after validation), reload watcher state (watching/not watching), environment variable cache.

Data flow: Configuration files → raw JSON parsing → environment variable substitution → Zod validation → typed configuration object → component consumption.

## 4. Folder Structure Explanation

**schema.ts** (310+ lines)
- What: Zod schema definitions for entire Talon configuration
- Why: Provides type-safe configuration with runtime validation
- Who calls: Config loader during validation, TypeScript for type checking
- What calls: Zod library for schema definition and validation
- Side effects: Defines configuration structure, provides TypeScript types
- Critical assumptions: Schema matches documentation, all options have defaults

**loader.ts** (208+ lines)
- What: Configuration loading with file I/O and environment variable resolution
- Why: Handles configuration file reading, parsing, and preprocessing
- Who calls: Gateway during initialization, CLI during setup
- What calls: File system operations, environment variable lookup, schema validation
- Side effects: Reads config files, resolves env vars, creates directories
- Critical assumptions: Config files exist or can be created, env vars accessible

**reload.ts** (180+ lines)
- What: Configuration hot reload with file watching and debouncing
- Why: Allows configuration changes without restarting Talon
- Who calls: Gateway during startup to enable hot reload
- What calls: File system watcher, debounce timer, event handlers
- Side effects: Watches config file, triggers reload events, manages timers
- Critical assumptions: File system supports watching, changes are atomic

**index.ts** (5 lines)
- What: Public API exports for configuration module
- Why: Central export point for all configuration functionality
- Who calls: All other Talon components needing configuration
- What calls: All config modules for re-export
- Side effects: None (just exports)
- Critical assumptions: All modules properly implemented and exported

## 5. Public API

**Exported functions/classes:**
- `loadConfig(sourceDir?)` - Loads and validates configuration
- `TalonConfigSchema` - Zod schema for configuration validation
- `TalonConfig` - TypeScript type for configuration
- `ConfigReloader` - Hot reload watcher class
- `resolveEnvVars(value)` - Environment variable resolver
- `ensureRuntimeDirs()` - Creates required runtime directories
- `TALON_HOME` - Constant path to ~/.talon directory

**Input types:**
- `RawConfig`: Untrusted JSON configuration (from file or user input)
- `EnvVarString`: String containing `${VAR_NAME}` patterns
- `ReloadHandler`: Function called on configuration changes
- `SourceDir`: Optional template directory for workspace defaults

**Output types:**
- `TalonConfig`: Fully validated and typed configuration object
- `ConfigError`: Specialized error for configuration problems
- `ReloadEvent`: Configuration change event with old/new config
- `ValidationResult`: Zod validation result with errors/details

**Error behavior:**
- Schema validation errors: Detailed Zod errors with path and message
- File not found errors: Clear guidance to run setup wizard
- Environment variable errors: Shows missing variable names
- Permission errors: File access issues with path and suggested fixes
- Parse errors: JSON syntax errors with line/column information

**Edge cases:**
- Empty configuration: Uses all defaults
- Missing required files: Creates with defaults or errors
- Environment variable cycles: Detects and reports circular references
- Invalid file paths: Validates and provides corrections
- Unicode/encoding issues: Handles different file encodings

**Idempotency notes:**
- Configuration loading: Idempotent (same files → same config)
- Environment resolution: Idempotent (same env → same values)
- Directory creation: Idempotent (exists → no-op)
- Hot reload: Not idempotent (triggers handlers each change)
- Validation: Idempotent (valid config stays valid)

## 6. Internal Logic Details

**Core algorithms:**
- Environment variable resolution: Regex `${VAR_NAME}` pattern matching with process.env lookup
- Schema validation: Zod recursive validation with custom error formatting
- Hot reload debouncing: 300ms debounce to prevent rapid reloads
- File watching: fs.watch with change detection and content comparison
- Default application: Deep merge of user config with schema defaults

**Important decision trees:**
1. Load config → Check file exists → Read and parse → Resolve env vars → Validate schema → Return config
2. Env var resolution → Find `${VAR}` patterns → Lookup in process.env → If found replace, else keep pattern → Recursively process objects/arrays
3. Hot reload → File change detected → Debounce timer → Read new content → Compare with old → If different → Parse and validate → Notify handlers
4. Validation error → Format Zod error → Extract path and message → Suggest fixes → Throw ConfigError

**Guardrails:**
- Schema validation: All configuration validated against Zod schema
- Environment variable security: Never log resolved values containing secrets
- File permissions: Secure default permissions for config files
- Change detection: Content hash comparison to avoid unnecessary reloads
- Error recovery: Graceful fallback on validation failure
- Missing: Configuration backup before overwrites

**Validation strategy:**
- Type validation: Zod schema ensures correct types
- Range validation: Number bounds, string patterns, enum values
- Required fields: Conditional requirements based on other fields
- Cross-field validation: Dependencies between configuration sections
- Security validation: Path traversal prevention, URL validation
- Missing: Semantic validation (e.g., valid API endpoints)

**Retry logic:**
- File reads: No retry (fail fast with clear error)
- Environment resolution: No retry (static lookup)
- Schema validation: No retry (deterministic)
- Hot reload: Automatic retry on watch errors
- Missing: Configuration fallback to previous version

## 7. Data Contracts

**Schemas used:**
- `TalonConfigSchema`: Main configuration schema (310+ lines)
- `GatewaySchema`: Gateway server configuration
- `AgentSchema`: AI agent configuration
- `ChannelsSchema`: Communication channels configuration
- `ToolsSchema`: Tool system configuration
- `MemorySchema`: Memory system configuration
- `WorkspaceSchema`: Workspace directory configuration

**Validation rules:**
- Gateway port: 1-65535 integer, default 19789
- API keys: Optional strings, validated when used
- File paths: Must be valid paths, home directory expansion supported
- URLs: Must be valid URL format when required
- Arrays: Must contain correct types, optional defaults
- Enums: Must be one of allowed values

**Expected shape of objects:**
```typescript
TalonConfig: {
  gateway: {
    host: string;
    port: number;
    auth: {mode: 'none' | 'token', token?: string};
    tailscale: {enabled: boolean, mode: string};
    cors: {origins: string[]};
  };
  agent: {
    model: string;
    subagentModel: string;
    providers: Record<string, {apiKey?: string, baseUrl?: string, models?: string[]}>;
    maxTokens: number;
    maxIterations: number;
    temperature: number;
  };
  channels: {
    telegram: {enabled: boolean, botToken?: string};
    whatsapp: {enabled: boolean, phoneNumber?: string};
    cli: {enabled: boolean};
    webchat: {enabled: boolean};
  };
  tools: {
    files: {enabled: boolean, allowedPaths: string[], deniedPaths: string[], maxFileSize: number};
    shell: {enabled: boolean, blockedCommands: string[], confirmDestructive: boolean};
    browser: {enabled: boolean, headless: boolean};
    web: {search: {provider: string, apiKey?: string}};
  };
  memory: {
    compaction: {keepRecentMessages: number};
  };
  workspace: {
    root: string;
  };
}
```

**Breaking-change risk areas:**
- Schema structure: Adding/removing fields breaks existing configs
- Environment variable syntax: Changing `${VAR}` pattern breaks existing configs
- Default values: Changing defaults affects behavior without config changes
- Validation rules: Stricter validation rejects previously valid configs
- File locations: Changing TALON_HOME breaks existing installations

## 8. Failure Modes

**Known failure cases:**
- Config file corruption: JSON parse fails
- Missing environment variables: `${VAR}` patterns not resolved
- Schema evolution: Old config files missing new required fields
- Permission denied: Cannot read/write config files
- File system watcher limits: Too many open watchers (OS-dependent)
- Circular environment references: Infinite resolution loop

**Silent failure risks:**
- Environment variable resolution fails: Patterns remain unresolved
- Schema validation passes but semantic invalid: e.g., invalid API endpoint
- Hot reload misses changes: File system event missed
- Default values incorrect: Misconfigured system
- Missing: Configuration drift detection

**Race conditions:**
- Concurrent config writes: File corruption
- Hot reload during validation: Inconsistent state
- Environment variable changes during resolution: Inconsistent values
- Multiple loaders: Different config instances
- Missing: File locking for config updates

**Memory issues:**
- Large configuration files: Memory consumption
- Watcher accumulation: Multiple reloader instances
- Environment variable cache: Unbounded growth
- Validation error objects: Large error stacks
- Missing: Configuration size limits

**Performance bottlenecks:**
- Schema validation: Deep object traversal on each load
- Environment resolution: Regex matching on all strings
- File watching: OS-dependent performance
- Directory creation: Recursive mkdir on each load
- Missing: Configuration caching

## 9. Observability

**Logs produced:**
- Configuration loading: INFO level with file paths and validation result
- Environment resolution: DEBUG level with resolved patterns (values masked)
- Schema validation: WARN level with validation errors
- Hot reload: INFO level with change detection and handler execution
- Directory operations: DEBUG level with created directories
- Missing: Configuration usage statistics

**Metrics to track:**
- Configuration load time (file read + validation + resolution)
- Validation error rate (percentage of invalid configs)
- Environment resolution success rate (percentage resolved)
- Hot reload frequency and latency
- Configuration size (bytes, nested depth, field count)
- Missing: Configuration change frequency

**Debug strategy:**
1. Enable config debug: `DEBUG=config:*` environment variable
2. Validate config: `node -e "require('./dist/config/index.js').TalonConfigSchema.parse(require('fs').readFileSync('~/.talon/config.json'))"`
3. Check env vars: `node -e "console.log(process.env)" | grep TALON`
4. Test reload: Modify config file, watch logs for reload events
5. Schema inspection: Examine Zod schema structure

**How to test locally:**
1. Unit tests: `npm test src/config/` (coverage: high)
2. Schema validation: Test with valid/invalid configs
3. Environment resolution: Test `${VAR}` pattern resolution
4. Hot reload: Modify config file, verify handlers called
5. Error handling: Test with corrupted/missing configs
6. Integration: Load config in gateway, verify components receive it

## 10. AI Agent Instructions

**How an AI agent should modify this feature:**
1. Understand Zod schema structure before modifying
2. Test backward compatibility for schema changes
3. Verify environment variable resolution still works
4. Check hot reload behavior with changes
5. Run config tests before committing changes

**What files must be read before editing:**
- `schema.ts`: Complete configuration structure and validation
- `loader.ts`: Configuration loading and preprocessing
- `reload.ts`: Hot reload implementation
- Documentation for configuration options
- Existing configuration files in test suites

**Safe refactoring rules:**
1. Keep Zod schema backward compatible (add optional fields)
2. Maintain environment variable syntax `${VAR}`
3. Preserve hot reload debounce behavior
4. Don't break configuration file location defaults
5. Keep error messages helpful and actionable

**Forbidden modifications:**
- Changing environment variable syntax without migration
- Removing required fields without default values
- Breaking configuration file format without migration
- Removing hot reload without replacement
- Changing TALON_HOME location without migration

## 11. Extension Points

**Where new functionality can be safely added:**
- New configuration sections: Add to schema.ts with defaults
- Additional validation rules: Extend Zod schema with custom checks
- New environment variable sources: Extend resolution system
- Configuration providers: Add support for other config sources (YAML, etc.)
- Configuration encryption: Add secret management layer
- Configuration templates: Add template system for common setups

**How to extend without breaking contracts:**
1. Add new optional fields to existing schemas
2. Use feature flags for new configuration options
3. Version configuration schema with migration
4. Add new environment variable patterns alongside existing
5. Use configuration inheritance for complex setups

## 12. Technical Debt & TODO

**Weak areas:**
- No configuration versioning or migration system
- Limited error recovery (fails fast on validation errors)
- No configuration encryption for secrets
- Environment variable resolution basic (no nested lookups)
- Missing: Configuration diff and audit logging
- Missing: Configuration validation test suite

**Refactor targets:**
- Implement configuration versioning with migration scripts
- Add graceful degradation for validation errors
- Implement secret management with encryption
- Enhance environment resolution with nested lookups
- Add comprehensive configuration test suite
- Missing: Dependency injection for testability

**Simplification ideas:**
- Reduce configuration complexity with opinionated defaults
- Consolidate similar configuration sections
- Simplify schema validation with fewer conditional rules
- Reduce environment variable resolution complexity
- Merge configuration loading steps
- Missing: Unified configuration interface