import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
export declare class WsRedisIoAdapter extends IoAdapter {
    private adapterConstructor;
    private redisConfig;
    connectToRedis(): Promise<void>;
    createIOServer(port: number, options?: ServerOptions): any;
}
