// ─── Typed Event Bus ──────────────────────────────────────────────
// Internal pub/sub for decoupled communication between subsystems

import { EventEmitter } from 'node:events';
import type { EventMap } from '../utils/types.js';
import { logger } from '../utils/logger.js';

type EventName = keyof EventMap;

/**
 * Typed event bus wrapping Node.js EventEmitter.
 * Provides type-safe emit/on/off/once for all Talon internal events.
 */
export class EventBus {
    private emitter = new EventEmitter();

    constructor() {
        // Allow many listeners (subsystems all listen)
        this.emitter.setMaxListeners(50);
    }

    emit<K extends EventName>(event: K, data: EventMap[K]): void {
        logger.debug({ event }, 'Event emitted');
        this.emitter.emit(event, data);
    }

    on<K extends EventName>(event: K, handler: (data: EventMap[K]) => void): void {
        this.emitter.on(event, handler as (...args: unknown[]) => void);
    }

    off<K extends EventName>(event: K, handler: (data: EventMap[K]) => void): void {
        this.emitter.off(event, handler as (...args: unknown[]) => void);
    }

    once<K extends EventName>(event: K, handler: (data: EventMap[K]) => void): void {
        this.emitter.once(event, handler as (...args: unknown[]) => void);
    }

    removeAllListeners(event?: EventName): void {
        if (event) {
            this.emitter.removeAllListeners(event);
        } else {
            this.emitter.removeAllListeners();
        }
    }

    listenerCount(event: EventName): number {
        return this.emitter.listenerCount(event);
    }
}
