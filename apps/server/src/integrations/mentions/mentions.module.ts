import { Global, Module } from '@nestjs/common';
import { MentionNotificationService } from './mentions.service';

@Global()
@Module({
  providers: [MentionNotificationService],
  exports: [MentionNotificationService],
})
export class MentionsModule {}


