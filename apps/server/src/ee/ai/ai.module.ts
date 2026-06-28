import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { SearchModule } from '../../core/search/search.module';

@Module({
  imports: [SearchModule],
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}
