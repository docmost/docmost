import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiProviderService } from './ai-provider.service';
import { AiIndexingService } from './ai-indexing.service';
import { AiAnswerService } from './ai-answer.service';
import { AiQueueProcessor } from './processors/ai-queue.processor';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    AiProviderService,
    AiIndexingService,
    AiAnswerService,
    AiQueueProcessor,
  ],
  exports: [AiService, AiProviderService, AiIndexingService],
})
export class AiModule {}
