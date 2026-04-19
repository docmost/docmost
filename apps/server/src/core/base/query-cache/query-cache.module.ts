import { Module } from '@nestjs/common';
import { QueryCacheConfigProvider } from './query-cache.config';
import { BaseQueryCacheService } from './base-query-cache.service';
import { BaseQueryRouter } from './base-query-router';
import { CollectionLoader } from './collection-loader';

@Module({
  providers: [
    QueryCacheConfigProvider,
    BaseQueryCacheService,
    BaseQueryRouter,
    CollectionLoader,
  ],
  exports: [BaseQueryCacheService, BaseQueryRouter, QueryCacheConfigProvider],
})
export class BaseQueryCacheModule {}
