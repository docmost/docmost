import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { NotificationProcessor } from './notification.processor.js';
import { CommentNotificationService } from './services/comment.notification.js';
import { PageNotificationService } from './services/page.notification.js';
import { VerificationNotificationService } from './services/verification.notification.js';
import { PageUpdateEmailRateLimiter } from './services/page-update-email-rate-limiter.js';
import { CollaborationModule } from '../../collaboration/collaboration.module.js';

@Module({
  imports: [CollaborationModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationProcessor,
    CommentNotificationService,
    PageNotificationService,
    VerificationNotificationService,
    PageUpdateEmailRateLimiter,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
