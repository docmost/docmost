import { EventEmitter } from 'events';
import type WebSocket from 'ws';
export declare class WsSocketWrapper extends EventEmitter {
    private ws;
    readyState: number;
    constructor(ws: WebSocket);
    close(code?: number, reason?: string): void;
    ping(): void;
    send(message: Uint8Array): void;
}
