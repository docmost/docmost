import { Module } from '@nestjs/common';
import { RedisConfigService } from './redis-config.service';

@Module({
  providers: [RedisConfigService],
  exports: [RedisConfigService],
})
export class RedisConfigModule {}
