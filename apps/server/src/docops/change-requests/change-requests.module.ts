import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChangeRequestsController } from './change-requests.controller';
import { ChangeRequestsService } from './change-requests.service';
import { ChangeRequestsRepository } from './change-requests.repository';
import { CrEditLockGuard } from './guards/cr-edit-lock.guard';
import { CrEventsEmitter } from './events/cr-events.emitter';
import { DocopsAuditModule } from '../audit/audit.module';
import { DocopsWebhooksModule } from '../webhooks/webhooks.module';
import { QueueName } from '../../integrations/queue/constants';

@Module({
  imports: [
    DocopsAuditModule,
    DocopsWebhooksModule,
    BullModule.registerQueue({ name: QueueName.SEARCH_QUEUE }),
  ],
  controllers: [ChangeRequestsController],
  providers: [
    ChangeRequestsService,
    ChangeRequestsRepository,
    CrEditLockGuard,
    CrEventsEmitter,
  ],
  exports: [ChangeRequestsService, CrEditLockGuard],
})
export class DocopsChangeRequestsModule {}
