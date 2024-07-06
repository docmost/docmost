import { Global, Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { PostgresHealthIndicator } from './postgres.health';
import { RedisHealthIndicator } from './redis.health';

@Global()
@Module({
  controllers: [HealthController],
  providers: [PostgresHealthIndicator, RedisHealthIndicator],
  imports: [TerminusModule],
})
export class HealthModule {}
