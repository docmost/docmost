import { Module } from '@nestjs/common';
import { QueryCacheConfigProvider } from './query-cache.config';
import { DuckDbRuntime } from './duckdb-runtime';
import { BaseQueryCacheService } from './base-query-cache.service';
import { BaseQueryRouter } from './base-query-router';
import { CollectionLoader } from './collection-loader';
import { BaseQueryCacheWriteConsumer } from './base-query-cache.write-consumer';
import { BaseQueryCacheSubscriber } from './base-query-cache.subscriber';

@Module({
  providers: [
    QueryCacheConfigProvider,
    DuckDbRuntime,
    CollectionLoader,
    BaseQueryCacheService,
    BaseQueryRouter,
    BaseQueryCacheWriteConsumer,
    BaseQueryCacheSubscriber,
  ],
  exports: [
    BaseQueryCacheService,
    BaseQueryRouter,
    DuckDbRuntime,
    QueryCacheConfigProvider,
  ],
})
export class QueryCacheModule {}
