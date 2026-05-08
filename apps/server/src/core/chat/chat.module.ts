import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './services/chat.service';
import { MinimaxService } from './services/minimax.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, MinimaxService],
  exports: [ChatService],
})
export class ChatModule {}
