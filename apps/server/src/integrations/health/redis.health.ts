import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentService } from '../environment/environment.service';
import { Redis } from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(private environmentService: EnvironmentService) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    let isHealthy = false;

    try {
      const redis = new Redis(this.environmentService.getRedisUrl(), {
        maxRetriesPerRequest: 15,
      });

      await redis.ping();
      isHealthy = true;
    } catch (e) {
      this.logger.error(e);
    }

    if (isHealthy) {
      return this.getStatus(key, isHealthy);
    } else {
      throw new HealthCheckError(
        `${key} is not available`,
        this.getStatus(key, isHealthy),
      );
    }
  }
}
