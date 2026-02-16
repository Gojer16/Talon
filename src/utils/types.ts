// ─── Shared TypeScript Types ──────────────────────────────────────
// Canonical message types matching 02-COMPONENTS.md interfaces

import { type WebSocket } from 'ws';

// ─── WebSocket Protocol ───────────────────────────────────────────

export type MessageType =
    | 'channel.message'
    | 'agent.response'
    | 'agent.response.end'
    | 'tool.call'
    | 'tool.result'
    | 'tool.stream'
    | 'shadow.ghost'
    | 'session.created'
    | 'session.resumed'
    | 'config.updated'
    | 'error';

export interface WSMessage {
    id: string;
    type: MessageType;
    timestamp: number;
    payload: unknown;
}

// ─── Messages ─────────────────────────────────────────────────────

export interface InboundMessage {
    channel: string;
    senderId: string;
    senderName: string;
    text: string;
    media: MediaAttachment | null;
    isGroup: boolean;
    groupId: string | null;
}

export interface MediaAttachment {
    type: 'image' | 'audio' | 'video' | 'document';
    url: string;
    mimeType: string;
    size?: number;
}

export interface OutboundMessage {
    sessionId: string;
    text: string;
    media?: MediaAttachment | null;
    replyTo?: string;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    timestamp: number;
    channel?: string;
}

// ─── Tools ────────────────────────────────────────────────────────

export interface ToolCall {
    id: string;
    tool: string;
    args: Record<string, unknown>;
}

export interface ToolResult {
    success: boolean;
    output: string;
    metadata?: {
        executionTime: number;
        truncated?: boolean;
        confirmation?: string;
    };
}

// ─── Sessions ─────────────────────────────────────────────────────

export type SessionState = 'created' | 'active' | 'idle';

export interface Session {
    id: string;
    senderId: string;
    channel: string;
    state: SessionState;
    messages: Message[];
    memorySummary: string;
    metadata: {
        createdAt: number;
        lastActiveAt: number;
        messageCount: number;
        model: string;
    };
    config: {
        model?: string;
        thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
        verboseLevel?: boolean;
    };
}

// ─── Channel ──────────────────────────────────────────────────────

export interface Channel {
    name: string;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(sessionId: string, message: OutboundMessage): Promise<void>;
    onMessage(handler: (msg: InboundMessage) => void): void;
}

// ─── Event Bus Types ──────────────────────────────────────────────

export interface EventMap {
    'message.inbound': { message: InboundMessage; sessionId: string };
    'message.outbound': { message: OutboundMessage; sessionId: string };
    'tool.execute': { sessionId: string; tool: string; args: Record<string, unknown> };
    'tool.complete': { sessionId: string; tool: string; result: ToolResult };
    'session.created': { session: Session };
    'session.idle': { sessionId: string };
    'session.resumed': { session: Session };
    'shadow.event': { type: string; data: unknown };
    'shadow.ghost': { sessionId: string; message: string };
    'config.changed': { key: string; value: unknown };
    'agent.thinking': { sessionId: string };
}

// ─── WebSocket Client Tracking ────────────────────────────────────

export interface WSClient {
    ws: WebSocket;
    id: string;
    connectedAt: number;
    sessionId?: string;
}
