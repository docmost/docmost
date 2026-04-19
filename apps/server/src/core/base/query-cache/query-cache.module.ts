import { Module } from '@nestjs/common';
import { QueryCacheConfigProvider } from './query-cache.config';
import { BaseQueryCacheService } from './base-query-cache.service';
import { BaseQueryRouter } from './base-query-router';

@Module({
  providers: [QueryCacheConfigProvider, BaseQueryCacheService, BaseQueryRouter],
  exports: [BaseQueryCacheService, BaseQueryRouter, QueryCacheConfigProvider],
})
export class BaseQueryCacheModule {}
