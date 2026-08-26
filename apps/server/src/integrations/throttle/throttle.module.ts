import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { EnvironmentService } from '../environment/environment.service';
import { EnvironmentModule } from '../environment/environment.module';
import { createRetryStrategy, parseRedisUrl } from '../../common/helpers';
import {
  AUTH_THROTTLER,
  AI_CHAT_THROTTLER,
  OAUTH_REGISTER_THROTTLER,
  OAUTH_TOKEN_THROTTLER,
  OAUTH_AUTHORIZE_THROTTLER,
} from './throttler-names';
import Redis from 'ioredis';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [EnvironmentModule],
      useFactory: (environmentService: EnvironmentService) => {
        const redisConfig = parseRedisUrl(environmentService.getRedisUrl());

        return {
          throttlers: [
            { name: AUTH_THROTTLER, ttl: 60_000, limit: 10 },
            { name: AI_CHAT_THROTTLER, ttl: 60_000, limit: 25 },
            { name: OAUTH_REGISTER_THROTTLER, ttl: 3_600_000, limit: 10 },
            { name: OAUTH_TOKEN_THROTTLER, ttl: 60_000, limit: 60 },
            { name: OAUTH_AUTHORIZE_THROTTLER, ttl: 60_000, limit: 30 },
          ],
          errorMessage: 'Too many requests',
          storage: new ThrottlerStorageRedisService(
            new Redis({
              host: redisConfig.host,
              port: redisConfig.port,
              username: redisConfig.username,
              password: redisConfig.password,
              db: redisConfig.db,
              family: redisConfig.family,
              tls: redisConfig.tls,
              retryStrategy: createRetryStrategy(),
              keyPrefix: 'throttle:',
            }),
          ),
        };
      },
      inject: [EnvironmentService],
    }),
  ],
})
export class ThrottleModule {}
