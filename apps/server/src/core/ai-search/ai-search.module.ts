import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiSearchController } from './ai-search.controller';
import { AiSearchService } from './services/ai-search.service';
import { VectorService } from './services/vector.service';
import { EmbeddingService } from './services/embedding.service';
import { RedisVectorService } from './services/redis-vector.service';
import { PageUpdateListener } from './listeners/page-update.listener';

@Module({
  imports: [ConfigModule],
  controllers: [AiSearchController],
  providers: [
    AiSearchService,
    VectorService,
    EmbeddingService,
    RedisVectorService,
    PageUpdateListener,
  ],
  exports: [AiSearchService, VectorService, EmbeddingService, RedisVectorService],
})
export class AiSearchModule {} 