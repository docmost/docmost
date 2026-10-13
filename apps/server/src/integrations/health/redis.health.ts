import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentService } from '../environment/environment.service';
import { Redis } from 'ioredis';
import { parseRedisUrl } from '../../common/helpers';

@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private environmentService: EnvironmentService,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const redisUrl = this.environmentService.getRedisUrl();
      const redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 15,
        tls: parseRedisUrl(redisUrl).tls,
      });

      await redis.ping();
      redis.disconnect();
      return indicator.up();
    } catch (e) {
      this.logger.error(e);
      return indicator.down(`${key} is not available`);
    }
  }
}
