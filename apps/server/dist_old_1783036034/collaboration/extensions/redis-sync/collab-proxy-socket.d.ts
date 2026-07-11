import type RedisClient from 'ioredis';
import { EventEmitter } from 'tseep';
import type { Pack } from './redis-sync.types';
export declare class CollabProxySocket extends EventEmitter {
    private readonly replyTo;
    private readonly serverChannel;
    private readonly socketId;
    private pub;
    private readonly pack;
    readyState: number;
    constructor(pub: RedisClient, pack: Pack, replyTo: string, serverChannel: string, socketId: string);
    private publish;
    close(code?: number, reason?: string): void;
    ping(): void;
    send(message: Uint8Array): void;
}
