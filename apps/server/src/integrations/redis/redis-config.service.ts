import { Injectable } from '@nestjs/common';
import {
  RedisModuleOptions,
  RedisOptionsFactory,
} from '@nestjs-labs/nestjs-ioredis';
import { createRetryStrategy, parseRedisUrl } from '../../common/helpers';
import { EnvironmentService } from '../environment/environment.service';

@Injectable()
export class RedisConfigService implements RedisOptionsFactory {
  constructor(private readonly environmentService: EnvironmentService) {}
  createRedisOptions(): RedisModuleOptions {
    const redisConfig = parseRedisUrl(this.environmentService.getRedisUrl());
    return {
      readyLog: true,
      config: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        family: redisConfig.family,
        retryStrategy: createRetryStrategy(),
      },
    };
  }
}
