import { Global, Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { TerminusModule } from '@nestjs/terminus';
import { PostgresHealthIndicator } from './postgres.health.js';
import { RedisHealthIndicator } from './redis.health.js';

@Global()
@Module({
  controllers: [HealthController],
  providers: [PostgresHealthIndicator, RedisHealthIndicator],
  imports: [TerminusModule],
})
export class HealthModule {}
