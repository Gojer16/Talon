// ─── Custom Error Classes ─────────────────────────────────────────

export class TalonError extends Error {
    code: string;

    constructor(code: string, message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'TalonError';
        this.code = code;
    }
}

export class ConfigError extends TalonError {
    constructor(message: string, options?: ErrorOptions) {
        super('CONFIG_ERROR', message, options);
        this.name = 'ConfigError';
    }
}

export class SessionError extends TalonError {
    constructor(message: string, options?: ErrorOptions) {
        super('SESSION_ERROR', message, options);
        this.name = 'SessionError';
    }
}

export class ChannelError extends TalonError {
    constructor(channel: string, message: string, options?: ErrorOptions) {
        super('CHANNEL_ERROR', `[${channel}] ${message}`, options);
        this.name = 'ChannelError';
    }
}

export class ToolError extends TalonError {
    constructor(tool: string, message: string, options?: ErrorOptions) {
        super('TOOL_ERROR', `[${tool}] ${message}`, options);
        this.name = 'ToolError';
    }
}

export class AgentError extends TalonError {
    constructor(message: string, options?: ErrorOptions) {
        super('AGENT_ERROR', message, options);
        this.name = 'AgentError';
    }
}
