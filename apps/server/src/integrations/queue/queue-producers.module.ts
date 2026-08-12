import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { createQueueRegistrations } from './queue.registrations';

// Global so @InjectQueue tokens resolve anywhere, in the app and in worker contexts.
@Global()
@Module({
  imports: [...createQueueRegistrations()],
  exports: [BullModule],
})
export class QueueProducersModule {}
