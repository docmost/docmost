import { Global, Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { PostgresHealthIndicator } from './postgres.health';
import { RedisHealthIndicator } from './redis.health';
import { RedisConfigModule } from '../redis/redis-config-module';

@Global()
@Module({
  controllers: [HealthController],
  providers: [PostgresHealthIndicator, RedisHealthIndicator],
  imports: [TerminusModule, RedisConfigModule],
})
export class HealthModule {}
