import { BaseProperty, BaseRow, BaseView } from '@docmost/db/types/entity.types';

/*
 * Domain event payloads emitted by the base services after each mutation
 * commits. `base-ws-consumers.ts` picks these up and fans them out onto
 * the appropriate socket.io room. `requestId` lets the originating client
 * skip replaying its own echo.
 */

type BaseEventBase = {
  baseId: string;
  workspaceId: string;
  actorId?: string | null;
  requestId?: string | null;
};

export type BaseRowCreatedEvent = BaseEventBase & { row: BaseRow };
export type BaseRowUpdatedEvent = BaseEventBase & {
  rowId: string;
  patch: Record<string, unknown>;
  updatedCells: Record<string, unknown>;
};
export type BaseRowDeletedEvent = BaseEventBase & { rowId: string };
export type BaseRowRestoredEvent = BaseEventBase & { rowId: string };
export type BaseRowReorderedEvent = BaseEventBase & {
  rowId: string;
  position: string;
};

export type BasePropertyCreatedEvent = BaseEventBase & {
  property: BaseProperty;
};
export type BasePropertyUpdatedEvent = BaseEventBase & {
  property: BaseProperty;
  schemaVersion: number;
};
export type BasePropertyDeletedEvent = BaseEventBase & { propertyId: string };
export type BasePropertyReorderedEvent = BaseEventBase & {
  propertyId: string;
  position: string;
};

export type BaseViewCreatedEvent = BaseEventBase & { view: BaseView };
export type BaseViewUpdatedEvent = BaseEventBase & { view: BaseView };
export type BaseViewDeletedEvent = BaseEventBase & { viewId: string };

export type BaseSchemaBumpedEvent = BaseEventBase & { schemaVersion: number };
