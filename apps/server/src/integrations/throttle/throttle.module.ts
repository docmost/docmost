import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { EnvironmentService } from '../environment/environment.service';
import { EnvironmentModule } from '../environment/environment.module';
import { parseRedisUrl } from '../../common/helpers';
import Redis from 'ioredis';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [EnvironmentModule],
      useFactory: (environmentService: EnvironmentService) => {
        const redisConfig = parseRedisUrl(environmentService.getRedisUrl());

        return {
          throttlers: [{ name: 'auth', ttl: 60_000, limit: 10 }],
          errorMessage: 'Too many requests',
          storage: new ThrottlerStorageRedisService(
            new Redis({
              host: redisConfig.host,
              port: redisConfig.port,
              password: redisConfig.password,
              db: redisConfig.db,
              family: redisConfig.family,
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
