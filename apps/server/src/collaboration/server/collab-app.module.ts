import { Module } from '@nestjs/common';
import { AppController } from '../../app.controller.js';
import { AppService } from '../../app.service.js';
import { EnvironmentModule } from '../../integrations/environment/environment.module.js';
import { EnvironmentService } from '../../integrations/environment/environment.service.js';
import { CollaborationModule } from '../collaboration.module.js';
import { DatabaseModule } from '@docmost/db/database.module.js';
import { QueueModule } from '../../integrations/queue/queue.module.js';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthModule } from '../../integrations/health/health.module.js';
import { CollaborationController } from './collaboration.controller.js';
import { LoggerModule } from '../../common/logger/logger.module.js';
import { RedisModule } from '@nestjs-labs/nestjs-ioredis';
import { RedisConfigService } from '../../integrations/redis/redis-config.service.js';
import { CaslModule } from '../../core/casl/casl.module.js';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis, { defaultReconnectStrategy } from '@keyv/redis';
import { parseRedisUrl } from '../../common/helpers/index.js';

@Module({
  imports: [
    LoggerModule,
    DatabaseModule,
    EnvironmentModule,
    CaslModule,
    CollaborationModule,
    QueueModule,
    HealthModule,
    EventEmitterModule.forRoot(),
    RedisModule.forRootAsync({
      useClass: RedisConfigService,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (environmentService: EnvironmentService) => {
        const redisUrl = environmentService.getRedisUrl();
        const { family, tls } = parseRedisUrl(redisUrl);

        return {
          ttl: 5 * 1000,
          stores: [
            new KeyvRedis({
              url: redisUrl,
              socket: {
                family,
                reconnectStrategy: defaultReconnectStrategy,
                ...tls,
              },
            }),
          ],
        };
      },
      inject: [EnvironmentService],
    }),
  ],
  controllers: [
    AppController,
    ...(process.env.COLLAB_SHOW_STATS?.toLowerCase() === 'true'
      ? [CollaborationController]
      : []),
  ],
  providers: [AppService],
})
export class CollabAppModule {}
