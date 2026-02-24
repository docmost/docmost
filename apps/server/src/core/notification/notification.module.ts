import { Module, forwardRef } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationProcessor } from './notification.processor';
import { CommentNotificationService } from './services/comment.notification';
import { PageNotificationService } from './services/page.notification';
import { WsModule } from '../../ws/ws.module';
import { WebhookModule } from '../../integrations/webhook/webhook.module';

@Module({
  imports: [WsModule, forwardRef(() => WebhookModule)],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationProcessor,
    CommentNotificationService,
    PageNotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
