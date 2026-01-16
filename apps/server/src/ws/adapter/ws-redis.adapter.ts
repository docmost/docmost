import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { RedisConfigService } from '../../integrations/redis/redis-config.service';

export class WsRedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(
    private readonly redisConfigService: RedisConfigService,
    app : NestFastifyApplication,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const options = this.redisConfigService.getOptions();

    const pubClient = new Redis(options);
    const subClient = new Redis(options);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
