import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationProcessor } from './notification.processor';
import { CommentNotificationService } from './services/comment.notification';
import { PageNotificationService } from './services/page.notification';
import { PageUpdateEmailRateLimiter } from './services/page-update-email-rate-limiter';

@Module({
  imports: [],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationProcessor,
    CommentNotificationService,
    PageNotificationService,
    PageUpdateEmailRateLimiter,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
