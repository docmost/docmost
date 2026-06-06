import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiProviderService } from './ai-provider.service';

@Module({
  controllers: [AiController],
  providers: [AiService, AiProviderService],
  exports: [AiService, AiProviderService],
})
export class AiModule {}
