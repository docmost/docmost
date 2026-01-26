import type RedisClient from 'ioredis';
import { EventEmitter } from 'tseep';
import type {
  Pack,
  RSAMessageClose,
  RSAMessagePing,
  RSAMessageSend,
} from './redis-sync.types';

export class CollabProxySocket extends EventEmitter {
  private readonly replyTo: string;
  private readonly serverChannel: string;
  private readonly socketId: string;
  private pub: RedisClient;
  private readonly pack: Pack;
  readyState = 1;

  constructor(
    pub: RedisClient,
    pack: Pack,
    replyTo: string,
    serverChannel: string,
    socketId: string,
  ) {
    super();
    this.replyTo = replyTo;
    this.socketId = socketId;
    this.serverChannel = serverChannel;
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
      replyTo: this.serverChannel,
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
