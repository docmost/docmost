import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EnvironmentService } from '../environment/environment.service';
import { GeneralQueueProcessor } from './processors/general-queue.processor';
import { bullConfigFactory } from './queue.registrations';
import { QueueProducersModule } from './queue-producers.module';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: bullConfigFactory,
      inject: [EnvironmentService],
    }),
    QueueProducersModule,
  ],
  exports: [BullModule],
  providers: [GeneralQueueProcessor],
})
export class QueueModule {}
