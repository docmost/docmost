import { Module } from '@nestjs/common';
import { PageVerificationService } from './page-verification.service';
import { PageVerificationController } from './page-verification.controller';
import { PageVerificationRepo } from './page-verification.repo';
import { PageVerificationSchedulerService } from './page-verification-scheduler.service';
import { PageContentUpdatedListener } from './page-content-updated.listener';
import { ReviewNotificationService } from './review-notification.service';
import { PageAccessModule } from '../../core/page/page-access/page-access.module';
import { QueueModule } from '../../integrations/queue/queue.module';
import { NotificationModule } from '../../core/notification/notification.module';

@Module({
  imports: [PageAccessModule, QueueModule, NotificationModule],
  providers: [
    PageVerificationService,
    PageVerificationRepo,
    PageVerificationSchedulerService,
    PageContentUpdatedListener,
    ReviewNotificationService,
  ],
  controllers: [PageVerificationController],
  exports: [PageVerificationSchedulerService],
})
export class PageVerificationModule {}
