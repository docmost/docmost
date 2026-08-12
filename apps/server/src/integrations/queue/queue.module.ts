import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EnvironmentService } from '../environment/environment.service';
import { GeneralQueueProcessor } from './processors/general-queue.processor';
import {
  bullConfigFactory,
  createQueueRegistrations,
} from './queue.registrations';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: bullConfigFactory,
      inject: [EnvironmentService],
    }),
    ...createQueueRegistrations(),
  ],
  exports: [BullModule],
  providers: [GeneralQueueProcessor],
})
export class QueueModule {}
