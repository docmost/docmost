import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationProcessor } from './notification.processor';
import { WsModule } from '../../ws/ws.module';

@Module({
  imports: [WsModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationProcessor],
  exports: [NotificationService],
})
export class NotificationModule {}
