import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChangeRequestsController } from './change-requests.controller';
import { ChangeRequestsService } from './change-requests.service';
import { ChangeRequestsRepository } from './change-requests.repository';
import { CrEditLockGuard } from './guards/cr-edit-lock.guard';
import { CrEventsEmitter } from './events/cr-events.emitter';
import { CrNotifyEmailProcessor } from './cr-notify-email.processor';
import { DocopsAuditModule } from '../audit/audit.module';
import { DocopsWebhooksModule } from '../webhooks/webhooks.module';
import { QueueName } from '../../integrations/queue/constants';
import { DOCOPS_CR_EMAIL_QUEUE } from './cr-notify-email.constants';

@Module({
  imports: [
    DocopsAuditModule,
    DocopsWebhooksModule,
    BullModule.registerQueue({ name: QueueName.SEARCH_QUEUE }),
    BullModule.registerQueue({ name: DOCOPS_CR_EMAIL_QUEUE }),
  ],
  controllers: [ChangeRequestsController],
  providers: [
    ChangeRequestsService,
    ChangeRequestsRepository,
    CrEditLockGuard,
    CrEventsEmitter,
    CrNotifyEmailProcessor,
  ],
  exports: [ChangeRequestsService, CrEditLockGuard],
})
export class DocopsChangeRequestsModule {}
