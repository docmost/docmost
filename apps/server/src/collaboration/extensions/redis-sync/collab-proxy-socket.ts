import type RedisClient from 'ioredis';
import type { WebSocketLike } from '@hocuspocus/server';
import type { Pack, RSAMessageClose, RSAMessageSend } from './redis-sync.types';

// Stands in for the client WebSocket on the server that owns the document.
// Outgoing traffic is relayed over redis to the origin server, which holds the real socket.
export class CollabProxySocket implements WebSocketLike {
  private readonly replyTo: string;
  private readonly socketId: string;
  private pub: RedisClient;
  private readonly pack: Pack;
  readyState = 1;
  onClose?: (code?: number, reason?: string) => void;

  constructor(pub: RedisClient, pack: Pack, replyTo: string, socketId: string) {
    this.replyTo = replyTo;
    this.socketId = socketId;
    this.pub = pub;
    this.pack = pack;
  }

  private publish(msg: RSAMessageClose | RSAMessageSend) {
    this.pub.publish(this.replyTo, this.pack(msg));
  }

  // The origin server already closed the real socket; stop relaying without echoing a close back
  markClosed() {
    this.readyState = 3;
  }

  close(code?: number, reason?: string) {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    this.onClose?.(code, reason);
  }

  send(message: Uint8Array) {
    if (this.readyState !== 1) return;
    const msg: RSAMessageSend = {
      type: 'send',
      socketId: this.socketId,
      message,
    };
    this.publish(msg);
  }
}
