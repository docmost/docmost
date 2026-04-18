import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventName } from '../../../common/events/event.contants';
import { BaseWsService } from './base-ws.service';
import {
  BasePropertyCreatedEvent,
  BasePropertyDeletedEvent,
  BasePropertyReorderedEvent,
  BasePropertyUpdatedEvent,
  BaseRowCreatedEvent,
  BaseRowDeletedEvent,
  BaseRowsDeletedEvent,
  BaseRowReorderedEvent,
  BaseRowUpdatedEvent,
  BaseSchemaBumpedEvent,
  BaseViewCreatedEvent,
  BaseViewDeletedEvent,
  BaseViewUpdatedEvent,
} from '../events/base-events';

/*
 * In-process listeners that forward base domain events onto the
 * `base-{baseId}` socket.io room. Originating clients suppress their own
 * echoes via `requestId`.
 */
@Injectable()
export class BaseWsConsumers {
  private readonly logger = new Logger(BaseWsConsumers.name);

  constructor(private readonly ws: BaseWsService) {}

  @OnEvent(EventName.BASE_ROW_CREATED)
  onRowCreated(e: BaseRowCreatedEvent) {
    this.ws.emitToBase(e.baseId, {
      operation: 'base:row:created',
      baseId: e.baseId,
      row: e.row,
      actorId: e.actorId ?? null,
      requestId: e.requestId ?? null,
    });
  }

  @OnEvent(EventName.BASE_ROW_UPDATED)
  onRowUpdated(e: BaseRowUpdatedEvent) {
    this.ws.emitToBase(e.baseId, {
      operation: 'base:row:updated',
      baseId: e.baseId,
      rowId: e.rowId,
      patch: e.patch,
      updatedCells: e.updatedCells,
      actorId: e.actorId ?? null,
      requestId: e.requestId ?? null,
    });
  }

  @OnEvent(EventName.BASE_ROW_DELETED)
  onRowDeleted(e: BaseRowDeletedEvent) {
    this.ws.emitToBase(e.baseId, {
      operation: 'base:row:deleted',
      baseId: e.baseId,
      rowId: e.rowId,
      actorId: e.actorId ?? null,
      requestId: e.requestId ?? null,
    });
  }

  @OnEvent(EventName.BASE_ROWS_DELETED)
  onRowsDeleted(e: BaseRowsDeletedEvent) {
    this.ws.emitToBase(e.baseId, {
      operation: 'base:rows:deleted',
      baseId: e.baseId,
      rowIds: e.rowIds,
      actorId: e.actorId ?? null,
      requestId: e.requestId ?? null,
    });
  }

  @OnEvent(EventName.BASE_ROW_REORDERED)
  onRowReordered(e: BaseRowReorderedEvent) {
    this.ws.emitToBase(e.baseId, {
      operation: 'base:row:reordered',
      baseId: e.baseId,
      rowId: e.rowId,
      position: e.position,
      actorId: e.actorId ?? null,
      requestId: e.requestId ?? null,
    });
  }

  @OnEvent(EventName.BASE_PROPERTY_CREATED)
  onPropertyCreated(e: BasePropertyCreatedEvent) {
    this.ws.emitToBase(e.baseId, {
      operation: 'base:property:created',
      baseId: e.baseId,
      property: e.property,
      actorId: e.actorId ?? null,
      requestId: e.requestId ?? null,
    });
  }

  @OnEvent(EventName.BASE_PROPERTY_UPDATED)
  onPropertyUpdated(e: BasePropertyUpdatedEvent) {
    this.ws.emitToBase(e.baseId, {
      operation: 'base:property:updated',
      baseId: e.baseId,
      property: e.property,
      schemaVersion: e.schemaVersion,
      actorId: e.actorId ?? null,
      requestId: e.requestId ?? null,
    });
  }

  @OnEvent(EventName.BASE_PROPERTY_DELETED)
  onPropertyDeleted(e: BasePropertyDeletedEvent) {
    this.ws.emitToBase(e.baseId, {
      operation: 'base:property:deleted',
      baseId: e.baseId,
      propertyId: e.propertyId,
      actorId: e.actorId ?? null,
      requestId: e.requestId ?? null,
    });
  }

  @OnEvent(EventName.BASE_PROPERTY_REORDERED)
  onPropertyReordered(e: BasePropertyReorderedEvent) {
    this.ws.emitToBase(e.baseId, {
      operation: 'base:property:reordered',
      baseId: e.baseId,
      propertyId: e.propertyId,
      position: e.position,
      actorId: e.actorId ?? null,
      requestId: e.requestId ?? null,
    });
  }

  @OnEvent(EventName.BASE_VIEW_CREATED)
  onViewCreated(e: BaseViewCreatedEvent) {
    this.ws.emitToBase(e.baseId, {
      operation: 'base:view:created',
      baseId: e.baseId,
      view: e.view,
      actorId: e.actorId ?? null,
      requestId: e.requestId ?? null,
    });
  }

  @OnEvent(EventName.BASE_VIEW_UPDATED)
  onViewUpdated(e: BaseViewUpdatedEvent) {
    this.ws.emitToBase(e.baseId, {
      operation: 'base:view:updated',
      baseId: e.baseId,
      view: e.view,
      actorId: e.actorId ?? null,
      requestId: e.requestId ?? null,
    });
  }

  @OnEvent(EventName.BASE_VIEW_DELETED)
  onViewDeleted(e: BaseViewDeletedEvent) {
    this.ws.emitToBase(e.baseId, {
      operation: 'base:view:deleted',
      baseId: e.baseId,
      viewId: e.viewId,
      actorId: e.actorId ?? null,
      requestId: e.requestId ?? null,
    });
  }

  @OnEvent(EventName.BASE_SCHEMA_BUMPED)
  onSchemaBumped(e: BaseSchemaBumpedEvent) {
    this.ws.emitToBase(e.baseId, {
      operation: 'base:schema:bumped',
      baseId: e.baseId,
      schemaVersion: e.schemaVersion,
    });
  }
}
