import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisConfigService } from '../redis/redis-config.service';

@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private redisConfigService: RedisConfigService,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const config = this.redisConfigService.getOptions();
      config.maxRetriesPerRequest = 15;
      const redis = new Redis(config);

      await redis.ping();
      redis.disconnect();
      return indicator.up();
    } catch (e) {
      this.logger.error(e);
      return indicator.down(`${key} is not available`);
    }
  }
}
