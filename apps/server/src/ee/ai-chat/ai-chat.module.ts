import { Module } from '@nestjs/common';
import { AiChatService } from './ai-chat.service';
import { AiChatController } from './ai-chat.controller';
import { AiChatRepo } from './ai-chat.repo';

@Module({
  providers: [AiChatService, AiChatRepo],
  controllers: [AiChatController],
})
export class AiChatModule {}
