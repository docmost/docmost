import { WebSocket } from 'ws';
import type { WebSocketLike } from '@hocuspocus/server';

/**
 * Wrapper around ws WebSocket that Hocuspocus only writes to.
 * Incoming socket events are forwarded separately by the gateway,
 * which prevents double-handling with RedisSyncExtension.
 */
export class WsSocketWrapper implements WebSocketLike {
  constructor(
    private readonly ws: WebSocket,
    private readonly onFailure: (err: unknown) => void,
  ) {}

  get readyState() {
    return this.ws.readyState;
  }

  close(code?: number, reason?: string) {
    if (this.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.close(code, reason);
    } catch (err) {
      this.onFailure(err);
    }
  }

  private readonly onWrite = (err?: Error) => {
    if (err) this.onFailure(err);
  };

  send(message: Uint8Array) {
    if (this.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(message, this.onWrite);
    } catch (err) {
      this.onFailure(err);
    }
  }
}
