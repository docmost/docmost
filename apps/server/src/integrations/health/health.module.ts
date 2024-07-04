import { Global, Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Global()
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
