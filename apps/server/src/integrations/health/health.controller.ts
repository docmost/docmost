import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PostgresHealthIndicator } from './postgres.health.js';
import { RedisHealthIndicator } from './redis.health.js';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator.js';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private postgres: PostgresHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @SkipTransform()
  @Get()
  @HealthCheck()
  async check() {
    return this.health.check([
      () => this.postgres.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }

  @Get('live')
  async checkLive() {
    return 'ok';
  }
}
