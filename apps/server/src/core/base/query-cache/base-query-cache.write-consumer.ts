import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import type { Redis } from 'ioredis';
import { EventName } from '../../../common/events/event.contants';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import {
  BasePropertyCreatedEvent,
  BasePropertyDeletedEvent,
  BasePropertyUpdatedEvent,
  BaseRowCreatedEvent,
  BaseRowDeletedEvent,
  BaseRowReorderedEvent,
  BaseRowUpdatedEvent,
  BaseRowsDeletedEvent,
  BaseSchemaBumpedEvent,
} from '../events/base-events';
import { QueryCacheConfigProvider } from './query-cache.config';
import { ChangeEnvelope } from './query-cache.types';

/*
 * Bridges in-process base domain events onto a Redis pub/sub channel so every
 * node running the query-cache can keep its resident DuckDB collections in
 * sync. Each base gets its own channel (`base-query-cache:changes:${baseId}`)
 * to keep pattern matching cheap. When the feature flag is off this class
 * registers as a no-op so we pay zero overhead.
 */
@Injectable()
export class BaseQueryCacheWriteConsumer {
  private readonly logger = new Logger(BaseQueryCacheWriteConsumer.name);
  private _redis: Redis | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly configProvider: QueryCacheConfigProvider,
    private readonly baseRowRepo: BaseRowRepo,
  ) {}

  private get redis(): Redis {
    if (!this._redis) this._redis = this.redisService.getOrThrow();
    return this._redis;
  }

  @OnEvent(EventName.BASE_ROW_CREATED)
  async onRowCreated(e: BaseRowCreatedEvent): Promise<void> {
    if (!this.configProvider.config.enabled) return;
    await this.publish(e.baseId, {
      kind: 'row-upsert',
      baseId: e.baseId,
      row: e.row as unknown as Record<string, unknown>,
    });
  }

  @OnEvent(EventName.BASE_ROW_UPDATED)
  async onRowUpdated(e: BaseRowUpdatedEvent): Promise<void> {
    if (!this.configProvider.config.enabled) return;
    const row = await this.baseRowRepo.findById(e.rowId, {
      workspaceId: e.workspaceId,
    });
    if (!row) return;
    await this.publish(e.baseId, {
      kind: 'row-upsert',
      baseId: e.baseId,
      row: row as unknown as Record<string, unknown>,
    });
  }

  @OnEvent(EventName.BASE_ROW_DELETED)
  async onRowDeleted(e: BaseRowDeletedEvent): Promise<void> {
    if (!this.configProvider.config.enabled) return;
    await this.publish(e.baseId, {
      kind: 'row-delete',
      baseId: e.baseId,
      rowId: e.rowId,
    });
  }

  @OnEvent(EventName.BASE_ROWS_DELETED)
  async onRowsDeleted(e: BaseRowsDeletedEvent): Promise<void> {
    if (!this.configProvider.config.enabled) return;
    await this.publish(e.baseId, {
      kind: 'rows-delete',
      baseId: e.baseId,
      rowIds: e.rowIds,
    });
  }

  @OnEvent(EventName.BASE_ROW_REORDERED)
  async onRowReordered(e: BaseRowReorderedEvent): Promise<void> {
    if (!this.configProvider.config.enabled) return;
    await this.publish(e.baseId, {
      kind: 'row-reorder',
      baseId: e.baseId,
      rowId: e.rowId,
      position: e.position,
    });
  }

  @OnEvent(EventName.BASE_SCHEMA_BUMPED)
  async onSchemaBumped(e: BaseSchemaBumpedEvent): Promise<void> {
    if (!this.configProvider.config.enabled) return;
    await this.publish(e.baseId, {
      kind: 'schema-invalidate',
      baseId: e.baseId,
      schemaVersion: e.schemaVersion,
    });
  }

  @OnEvent(EventName.BASE_PROPERTY_UPDATED)
  async onPropertyUpdated(e: BasePropertyUpdatedEvent): Promise<void> {
    if (!this.configProvider.config.enabled) return;
    await this.publish(e.baseId, {
      kind: 'schema-invalidate',
      baseId: e.baseId,
      schemaVersion: e.schemaVersion,
    });
  }

  @OnEvent(EventName.BASE_PROPERTY_CREATED)
  async onPropertyCreated(e: BasePropertyCreatedEvent): Promise<void> {
    if (!this.configProvider.config.enabled) return;
    // Property CREATED / DELETED events don't carry a schemaVersion. Use
    // Number.MAX_SAFE_INTEGER as a sentinel so `applyChange`'s
    // `envVersion > cachedVersion` check unconditionally invalidates — any
    // real schemaVersion will be smaller. A follow-up could plumb the real
    // schemaVersion through the event payload and drop the sentinel.
    await this.publish(e.baseId, {
      kind: 'schema-invalidate',
      baseId: e.baseId,
      schemaVersion: Number.MAX_SAFE_INTEGER,
    });
  }

  @OnEvent(EventName.BASE_PROPERTY_DELETED)
  async onPropertyDeleted(e: BasePropertyDeletedEvent): Promise<void> {
    if (!this.configProvider.config.enabled) return;
    await this.publish(e.baseId, {
      kind: 'schema-invalidate',
      baseId: e.baseId,
      schemaVersion: Number.MAX_SAFE_INTEGER,
    });
  }

  private async publish(
    baseId: string,
    envelope: ChangeEnvelope,
  ): Promise<void> {
    const channel = `base-query-cache:changes:${baseId}`;
    try {
      await this.redis.publish(channel, JSON.stringify(envelope));
    } catch (err) {
      const error = err as Error;
      this.logger.warn(
        `Failed to publish cache change for ${baseId}: ${error.message}`,
      );
    }
  }
}
