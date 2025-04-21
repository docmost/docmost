import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis, { RedisOptions } from 'ioredis';
import {
  createRetryStrategy,
  parseRedisUrl,
  RedisConfig,
} from '../../common/helpers';

export class WsRedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private redisConfig: RedisConfig;

  async connectToRedis(): Promise<void> {
    this.redisConfig = parseRedisUrl(process.env.REDIS_URL);

    const options: RedisOptions = {
      family: this.redisConfig.family,
      retryStrategy: createRetryStrategy(),
    };

    const pubClient = new Redis(process.env.REDIS_URL, options);
    const subClient = new Redis(process.env.REDIS_URL, options);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
