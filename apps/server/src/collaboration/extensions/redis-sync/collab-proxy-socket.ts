import type RedisClient from 'ioredis';
import { EventEmitter } from 'tseep';
import type {
  Pack,
  RSAMessageClose,
  RSAMessagePing,
  RSAMessageSend,
} from './redis-sync.extension';

export class CollabProxySocket extends EventEmitter {
  private replyTo: string;
  private pongChannel: string;
  private socketId: string;
  private pub: RedisClient;
  private pack: Pack;
  readyState = 1;

  constructor(
    pub: RedisClient,
    pack: Pack,
    replyTo: string,
    pongChannel: string,
    socketId: string,
  ) {
    super();
    this.replyTo = replyTo;
    this.pongChannel = pongChannel;
    this.socketId = socketId;
    this.pub = pub;
    this.pack = pack;
    this.once('close', () => {
      this.readyState = 3;
    });
  }

  private publish(msg: RSAMessageClose | RSAMessagePing | RSAMessageSend) {
    this.pub.publish(this.replyTo, this.pack(msg));
  }

  close(code?: number, reason?: string) {
    if (this.readyState !== 1) return;
    const msg: RSAMessageClose = {
      type: 'close',
      code,
      reason,
      socketId: this.socketId,
    };
    this.publish(msg);
  }

  ping() {
    if (this.readyState !== 1) return;
    const msg: RSAMessagePing = {
      type: 'ping',
      socketId: this.socketId,
      respondTo: this.pongChannel,
    };
    this.publish(msg);
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
