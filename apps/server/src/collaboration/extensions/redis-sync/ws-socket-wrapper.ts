import type WebSocket from 'ws';
import type { WebSocketLike } from '@hocuspocus/server';

/**
 * Wrapper around ws WebSocket that only receives events via emit().
 * This prevents double-handling when used with RedisSyncExtension.
 */
export class WsSocketWrapper implements WebSocketLike {
  private ws: WebSocket;
  readyState = 1;

  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  close(code?: number, reason?: string) {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    try {
      this.ws.close(code, reason);
    } catch (e) {
      // Socket already closed
    }
  }

  send(message: Uint8Array) {
    if (this.readyState !== 1) return;
    try {
      this.ws.send(message);
    } catch (e) {
      // Socket already closed
    }
  }
}
