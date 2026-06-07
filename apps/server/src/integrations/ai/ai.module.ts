import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiProviderService } from './ai-provider.service';
import { AiIndexingService } from './ai-indexing.service';
import { AiQueueProcessor } from './processors/ai-queue.processor';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    AiProviderService,
    AiIndexingService,
    AiQueueProcessor,
  ],
  exports: [AiService, AiProviderService, AiIndexingService],
})
export class AiModule {}
