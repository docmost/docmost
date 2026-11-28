import { useEffect } from "react";
import { useAtomValue, getDefaultStore } from "jotai";
import { useQueryClient, InfiniteData, QueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { socketAtom } from "@/features/websocket/atoms/socket-atom";
import {
  IBase,
  IBaseProperty,
  IBaseRow,
  IBaseView,
  RelationTypeOptions,
  RowReferences,
} from "@/ee/base/types/base.types";
import {
  baseImportProgressAtomFamily,
  baseImportResultAtomFamily,
  selectedRowIdsAtomFamily,
} from "@/ee/base/atoms/base-atoms";
import type {
  BaseImportProgress,
  BaseImportResult,
} from "@/ee/base/csv-import/csv-import.types";
import { formulaRecomputeAtom } from "@/ee/base/atoms/formula-recompute-atom";
import {
  mergeReferences,
  referenceStoreAtomFamily,
} from "@/ee/base/atoms/reference-store-atom";
import { IPagination } from "@/lib/types";
import {
  invalidateAffectedCalendarWindows,
  rowsOrderDependsOn,
} from "@/ee/base/queries/base-row-query";
import {
  cancelRowsRefresh,
  scheduleRowsRefresh,
} from "@/ee/base/queries/rows-refresh";
import { patchRelationPreviews } from "@/ee/base/queries/base-relation-query";
import { expandRows } from "@/ee/base/services/base-service";
import { RELATION_MAX_IDS_PER_CALL } from "@/ee/base/constants/relations";
import {
  formShareQueryKey,
  invalidatePublicFormForView,
} from "@/ee/base/queries/base-form-query";

type BaseRowCreated = {
  operation: "base:row:created";
  pageId: string;
  row: IBaseRow;
  references?: RowReferences;
  requestId?: string | null;
};

type BaseRowUpdated = {
  operation: "base:row:updated";
  pageId: string;
  rowId: string;
  updatedCells: Record<string, unknown>;
  updatedAt?: string;
  lastUpdatedById?: string | null;
  requestId?: string | null;
};

type BaseRowDeleted = {
  operation: "base:row:deleted";
  pageId: string;
  rowId: string;
  requestId?: string | null;
};

type BaseRowsDeleted = {
  operation: "base:rows:deleted";
  pageId: string;
  rowIds: string[];
  requestId?: string | null;
};

type BaseRowReordered = {
  operation: "base:row:reordered";
  pageId: string;
  rowId: string;
  position: string;
  requestId?: string | null;
};

type BasePropertyEvent = {
  operation:
    | "base:property:created"
    | "base:property:updated"
    | "base:property:deleted"
    | "base:property:reordered";
  pageId: string;
  property?: IBaseProperty;
  propertyId?: string;
  requestId?: string | null;
};

type BaseViewEvent = {
  operation:
    | "base:view:created"
    | "base:view:updated"
    | "base:view:deleted";
  pageId: string;
  view?: IBaseView;
  viewId?: string;
};

type BaseViewShareUpdated = {
  operation: "base:view:share:updated";
  pageId: string;
  viewId: string;
  requestId?: string | null;
};

type BaseRowsUpdated = {
  operation: "base:rows:updated";
  pageId: string;
  rowIds: string[];
  propertyIds: string[];
  requestId?: string | null;
};

type BaseFormulaRecomputeStarted = {
  operation: "base:formula:recompute:started";
  pageId: string;
  propertyIds: string[];
  jobId: string;
};

type BaseFormulaRecomputeCompleted = {
  operation: "base:formula:recompute:completed";
  pageId: string;
  propertyIds: string[];
  jobId: string;
  processed: number;
  errored: number;
};

type BaseSchemaBumped = {
  operation: "base:schema:bumped";
  pageId: string;
  schemaVersion: number;
};

type BaseImportProgressEvent = {
  operation: "base:import:progress";
  pageId: string;
} & BaseImportProgress;

type BaseImportCompletedEvent = {
  operation: "base:import:completed";
  pageId: string;
  totalRows: number;
} & BaseImportResult;

type BaseSubscribed = {
  operation: "base:subscribed";
  pageId: string;
  schemaVersion: number;
};

type BaseInboundEvent =
  | BaseRowCreated
  | BaseRowUpdated
  | BaseRowDeleted
  | BaseRowsDeleted
  | BaseRowReordered
  | BaseRowsUpdated
  | BaseRelationsUpdated
  | BaseFormulaRecomputeStarted
  | BaseFormulaRecomputeCompleted
  | BaseSchemaBumped
  | BaseImportProgressEvent
  | BaseImportCompletedEvent
  | BaseSubscribed
  | BasePropertyEvent
  | BaseViewEvent
  | BaseViewShareUpdated
  | { operation: string; pageId: string };

// Module-level set of requestIds we've just sent. When the socket echoes back
// a mutation with a matching requestId we drop it, as the local mutation
// already updated the cache. Bounded to prevent unbounded growth on long tabs.
const outboundRequestIds = new Set<string>();
const OUTBOUND_MAX = 256;

export function markRequestIdOutbound(requestId: string): void {
  outboundRequestIds.add(requestId);
  if (outboundRequestIds.size > OUTBOUND_MAX) {
    const oldest = outboundRequestIds.values().next().value;
    if (oldest) outboundRequestIds.delete(oldest);
  }
}

// Link edits this tab sent. Their echo can name rows this tab didn't patch, so it
// isn't dropped; the handler skips only the cell and list the edit already refreshed.
const ownRelationEdits = new Map<string, { rowId: string; propertyId: string }>();

export function markRelationEditOutbound(
  requestId: string,
  edit: { rowId: string; propertyId: string },
): void {
  ownRelationEdits.set(requestId, edit);
  if (ownRelationEdits.size > OUTBOUND_MAX) {
    const oldest = ownRelationEdits.keys().next().value;
    if (oldest) ownRelationEdits.delete(oldest);
  }
}

// A failed edit may still have saved; its echo then refreshes like anyone else's.
export function forgetRelationEditOutbound(requestId: string): void {
  ownRelationEdits.delete(requestId);
}

type BaseRelationsUpdated = {
  operation: "base:relations:updated";
  pageId: string;
  rowIds: string[];
  propertyIds: string[];
  actorId: string | null;
  requestId: string | null;
  // sent when a link edit counts as an edit of these rows
  updatedAt?: string;
  lastUpdatedById?: string | null;
};

type BaseSubscriptionState = {
  missedEvents: boolean;
  relationRefresh?: {
    timer: ReturnType<typeof setTimeout>;
    rowIds: Set<string>;
  };
};

const RELATIONS_REFRESH_DELAY_MS = 150;

function cachedRowIds(queryClient: QueryClient, pageId: string): Set<string> {
  const ids = new Set<string>();
  for (const [, data] of queryClient.getQueriesData<
    InfiniteData<IPagination<IBaseRow>>
  >({ queryKey: ["base-rows", pageId] })) {
    for (const page of data?.pages ?? []) {
      for (const row of page.items) ids.add(row.id);
    }
  }
  // a row modal opened from a link holds its row outside the lists
  for (const [, row] of queryClient.getQueriesData<IBaseRow>({
    queryKey: ["base-row", pageId],
  })) {
    if (row) ids.add(row.id);
  }
  return ids;
}

function scheduleRelationPreviewRefresh(
  pageId: string,
  queryClient: QueryClient,
  state: BaseSubscriptionState,
  rowIds: string[],
) {
  const cached = cachedRowIds(queryClient, pageId);
  const touched = rowIds.filter((id) => cached.has(id));
  if (touched.length === 0) return;

  const pending = state.relationRefresh;
  if (pending) {
    touched.forEach((id) => pending.rowIds.add(id));
    return;
  }
  const next = {
    rowIds: new Set(touched),
    timer: setTimeout(() => {
      state.relationRefresh = undefined;
      const stillCached = cachedRowIds(queryClient, pageId);
      const ids = [...next.rowIds].filter((id) => stillCached.has(id));
      if (ids.length === 0) return;
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += RELATION_MAX_IDS_PER_CALL) {
        chunks.push(ids.slice(i, i + RELATION_MAX_IDS_PER_CALL));
      }
      Promise.all(chunks.map((chunk) => expandRows(pageId, chunk)))
        .then((results) => {
          const relationsByRow: Record<string, NonNullable<IBaseRow["relations"]>> = {};
          for (const items of results) {
            for (const [rowId, row] of Object.entries(items)) {
              if (row.relations) relationsByRow[rowId] = row.relations;
            }
          }
          patchRelationPreviews(queryClient, pageId, relationsByRow);
        })
        // refetched rows carry fresh previews, so no chip is left stale
        .catch(() => scheduleRowsRefresh(pageId, "all"));
    }, RELATIONS_REFRESH_DELAY_MS),
  };
  state.relationRefresh = next;
}

function createBaseEventHandler(
  pageId: string,
  queryClient: QueryClient,
  state: BaseSubscriptionState,
): (raw: unknown) => void {
  return (raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    const event = raw as BaseInboundEvent;
    if (event.pageId !== pageId) return;

    const requestId = (event as any).requestId as string | undefined;
    if (requestId && outboundRequestIds.has(requestId)) {
      outboundRequestIds.delete(requestId);
      return;
    }

    switch (event.operation) {
      case "base:row:created": {
        const e = event as BaseRowCreated;
        const store = getDefaultStore();
        const referencesAtom = referenceStoreAtomFamily(pageId);
        if (e.references && Object.keys(e.references.users).length > 0) {
          store.set(
            referencesAtom,
            mergeReferences(store.get(referencesAtom), e.references),
          );
        }
        const baseForCreate = queryClient.getQueryData<IBase>(["bases", pageId]);
        const hasKanbanForCreate = (baseForCreate?.views ?? []).some((v) => v.type === "kanban");
        const createProperties = baseForCreate?.properties ?? [];
        const showsRowUsers = createProperties.some(
          (p) => p.type === "createdBy" || p.type === "lastEditedBy",
        );
        const knownUsers = store.get(referencesAtom).users;
        const referencedUserIds = [
          ...(showsRowUsers ? [e.row.creatorId, e.row.lastUpdatedById] : []),
          ...createProperties
            .filter((p) => p.type === "person")
            .flatMap((p) => e.row.cells?.[p.id] ?? []),
        ];
        const usersUnresolved = referencedUserIds.some(
          (id) => typeof id === "string" && !knownUsers[id],
        );
        const refreshCalendar = invalidateAffectedCalendarWindows(queryClient, pageId, "any");
        if (hasKanbanForCreate || usersUnresolved) {
          scheduleRowsRefresh(pageId, "all");
        } else {
          queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
            {
              queryKey: ["base-rows", pageId],
              predicate: (query) => query.queryKey[2] !== "calendar",
            },
            (old) => {
              if (!old) return old;
              const lastPageIndex = old.pages.length - 1;
              return {
                ...old,
                pages: old.pages.map((page, index) =>
                  index === lastPageIndex
                    ? { ...page, items: [...page.items, e.row] }
                    : page,
                ),
              };
            },
          );
          if (rowsOrderDependsOn(pageId, "any", baseForCreate)) {
            scheduleRowsRefresh(pageId, "all");
          } else {
            if (refreshCalendar) scheduleRowsRefresh(pageId, "calendar");
            // previews follow each viewer's access, so the event leaves them out
            if (createProperties.some((p) => p.type === "relation")) {
              scheduleRelationPreviewRefresh(pageId, queryClient, state, [e.row.id]);
            }
          }
        }
        break;
      }
      case "base:row:updated": {
        const e = event as BaseRowUpdated;
        const baseForUpdate = queryClient.getQueryData<IBase>(["bases", pageId]);
        const hasKanbanForUpdate = (baseForUpdate?.views ?? []).some((v) => v.type === "kanban");
        const editStamp: Partial<IBaseRow> = {};
        if (typeof e.updatedAt === "string") editStamp.updatedAt = e.updatedAt;
        if (
          "lastUpdatedById" in e &&
          (typeof e.lastUpdatedById === "string" || e.lastUpdatedById === null)
        ) {
          editStamp.lastUpdatedById = e.lastUpdatedById;
        }
        if (!hasKanbanForUpdate) {
          queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
            { queryKey: ["base-rows", pageId] },
            (old) =>
              !old
                ? old
                : {
                    ...old,
                    pages: old.pages.map((page) => ({
                      ...page,
                      items: page.items.map((row) =>
                        row.id === e.rowId
                          ? {
                              ...row,
                              ...editStamp,
                              cells: { ...row.cells, ...e.updatedCells },
                            }
                          : row,
                      ),
                    })),
                  },
          );
        }
        const changedPropertyIds = Object.keys(e.updatedCells ?? {});
        const refreshCalendar = invalidateAffectedCalendarWindows(
          queryClient, pageId, changedPropertyIds, baseForUpdate,
        );
        const editorUnknown =
          typeof e.lastUpdatedById === "string" &&
          (baseForUpdate?.properties ?? []).some((p) => p.type === "lastEditedBy") &&
          !getDefaultStore().get(referenceStoreAtomFamily(pageId)).users[e.lastUpdatedById];
        if (
          hasKanbanForUpdate ||
          editorUnknown ||
          rowsOrderDependsOn(pageId, changedPropertyIds, baseForUpdate)
        ) {
          scheduleRowsRefresh(pageId, "all");
        } else if (refreshCalendar) {
          scheduleRowsRefresh(pageId, "calendar");
        }
        break;
      }
      case "base:row:deleted": {
        const e = event as BaseRowDeleted;
        queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
          { queryKey: ["base-rows", pageId] },
          (old) =>
            !old
              ? old
              : {
                  ...old,
                  pages: old.pages.map((page) => ({
                    ...page,
                    items: page.items.filter((row) => row.id !== e.rowId),
                  })),
                },
        );
        const store = getDefaultStore();
        const selectedIdsAtom = selectedRowIdsAtomFamily(pageId);
        const current = store.get(selectedIdsAtom);
        if (current.has(e.rowId)) {
          const next = new Set(current);
          next.delete(e.rowId);
          store.set(selectedIdsAtom, next);
        }
        break;
      }
      case "base:rows:deleted": {
        const e = event as BaseRowsDeleted;
        const removeSet = new Set(e.rowIds);
        queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
          { queryKey: ["base-rows", pageId] },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.filter((row) => !removeSet.has(row.id)),
              })),
            };
          },
        );
        const store = getDefaultStore();
        const selectedIdsAtom = selectedRowIdsAtomFamily(pageId);
        const current = store.get(selectedIdsAtom);
        if (current.size > 0) {
          let changed = false;
          const next = new Set(current);
          for (const id of e.rowIds) {
            if (next.delete(id)) changed = true;
          }
          if (changed) store.set(selectedIdsAtom, next);
        }
        break;
      }
      case "base:row:reordered": {
        const e = event as BaseRowReordered;
        const baseForReorder = queryClient.getQueryData<IBase>(["bases", pageId]);
        const hasKanbanForReorder = (baseForReorder?.views ?? []).some((v) => v.type === "kanban");
        if (hasKanbanForReorder) {
          scheduleRowsRefresh(pageId, "all");
        } else {
          queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
            { queryKey: ["base-rows", pageId] },
            (old) =>
              !old
                ? old
                : {
                    ...old,
                    pages: old.pages.map((page) => ({
                      ...page,
                      items: page.items.map((row) =>
                        row.id === e.rowId
                          ? { ...row, position: e.position }
                          : row,
                      ),
                    })),
                  },
          );
        }
        break;
      }
      case "base:rows:updated": {
        const e = event as BaseRowsUpdated;
        // Only refetch if the batch touches rows currently in cache; formula
        // backfills emit one event per 500 rows so this avoids redundant fetches.
        const updatedIds = new Set(e.rowIds);
        const caches = queryClient.getQueriesData<
          InfiniteData<IPagination<IBaseRow>>
        >({ queryKey: ["base-rows", pageId] });
        let touchesCache = false;
        outer: for (const [, data] of caches) {
          if (!data) continue;
          for (const page of data.pages) {
            for (const row of page.items) {
              if (updatedIds.has(row.id)) {
                touchesCache = true;
                break outer;
              }
            }
          }
        }
        if (touchesCache) {
          scheduleRowsRefresh(pageId, "all");
        }
        break;
      }
      case "base:relations:updated": {
        const e = event as BaseRelationsUpdated;
        const own = e.requestId ? ownRelationEdits.get(e.requestId) : undefined;
        if (e.requestId) ownRelationEdits.delete(e.requestId);
        // the edit's response patched its cell, unless the change also reached other fields
        const ownCellOnly = own !== undefined && e.propertyIds.every((id) => id === own.propertyId);
        scheduleRelationPreviewRefresh(
          pageId,
          queryClient,
          state,
          ownCellOnly ? e.rowIds.filter((id) => id !== own?.rowId) : e.rowIds,
        );
        // an open full list (row modal "Show all") refetches; closed ones go stale
        const rowIds = new Set(e.rowIds);
        const propertyIds = new Set(e.propertyIds);
        queryClient.invalidateQueries({
          queryKey: ["base-relations", "list", pageId],
          predicate: ({ queryKey }) =>
            rowIds.has(queryKey[3] as string) &&
            propertyIds.has(queryKey[4] as string) &&
            // the edit refetches its own list once it succeeds
            !(own && queryKey[3] === own.rowId && queryKey[4] === own.propertyId),
        });
        const baseForLinks = queryClient.getQueryData<IBase>(["bases", pageId]);
        // a deleted row's links go without stamping the rows that showed them
        const updatedAt = typeof e.updatedAt === "string" ? e.updatedAt : undefined;
        let linkEditorUnknown = false;
        if (updatedAt !== undefined) {
          const stamp = { updatedAt, lastUpdatedById: e.lastUpdatedById ?? null };
          const stampRow = (row: IBaseRow) => (rowIds.has(row.id) ? { ...row, ...stamp } : row);
          queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
            { queryKey: ["base-rows", pageId] },
            (old) =>
              old && {
                ...old,
                pages: old.pages.map((page) => ({ ...page, items: page.items.map(stampRow) })),
              },
          );
          for (const rowId of e.rowIds) {
            queryClient.setQueryData<IBaseRow>(["base-row", pageId, rowId], (old) => old && stampRow(old));
          }
          linkEditorUnknown =
            typeof stamp.lastUpdatedById === "string" &&
            (baseForLinks?.properties ?? []).some((p) => p.type === "lastEditedBy") &&
            !getDefaultStore().get(referenceStoreAtomFamily(pageId)).users[stamp.lastUpdatedById];
        }
        const changeOptions = { stampsRows: updatedAt !== undefined };
        if (
          linkEditorUnknown ||
          rowsOrderDependsOn(pageId, e.propertyIds, baseForLinks, changeOptions)
        ) {
          scheduleRowsRefresh(pageId, "all");
        } else if (
          invalidateAffectedCalendarWindows(queryClient, pageId, e.propertyIds, baseForLinks, changeOptions)
        ) {
          scheduleRowsRefresh(pageId, "calendar");
        }
        break;
      }
      case "base:schema:bumped": {
        // Worker committed a type conversion or cell GC; re-fetch under the new schema.
        queryClient.invalidateQueries({ queryKey: ["base-rows", pageId] });
        queryClient.invalidateQueries({ queryKey: ["bases", pageId] });
        break;
      }
      case "base:subscribed": {
        const e = event as BaseSubscribed;
        const cached = queryClient.getQueryData<IBase>(["bases", pageId]);
        if (
          state.missedEvents ||
          (cached && cached.baseSchemaVersion !== e.schemaVersion)
        ) {
          state.missedEvents = false;
          queryClient.invalidateQueries({ queryKey: ["base-rows", pageId] });
          queryClient.invalidateQueries({ queryKey: ["bases", pageId] });
          for (const view of cached?.views ?? []) {
            if (view.type !== "form") continue;
            invalidatePublicFormForView(pageId, view.id);
            queryClient.invalidateQueries({
              queryKey: formShareQueryKey(pageId, view.id),
            });
          }
        }
        // a completion sent while away never arrives; a running import's next progress event restores it
        getDefaultStore().set(baseImportProgressAtomFamily(pageId), null);
        break;
      }
      case "base:import:progress": {
        const e = event as BaseImportProgressEvent;
        getDefaultStore().set(baseImportProgressAtomFamily(pageId), {
          fileTaskId: e.fileTaskId,
          processedRows: e.processedRows,
          totalRows: e.totalRows,
        });
        break;
      }
      case "base:import:completed": {
        const e = event as BaseImportCompletedEvent;
        // the import's only event, so new properties and rows arrive in one refetch
        if (e.status === "success") {
          queryClient.invalidateQueries({ queryKey: ["base-rows", pageId] });
          queryClient.invalidateQueries({ queryKey: ["bases", pageId] });
        }
        const store = getDefaultStore();
        store.set(baseImportProgressAtomFamily(pageId), null);
        store.set(baseImportResultAtomFamily(pageId), {
          fileTaskId: e.fileTaskId,
          status: e.status,
          importedRows: e.importedRows,
          skippedValues: e.skippedValues,
          error: e.error,
        });
        break;
      }
      case "base:formula:recompute:started": {
        const e = event as BaseFormulaRecomputeStarted;
        const store = getDefaultStore();
        store.set(formulaRecomputeAtom, {
          ...store.get(formulaRecomputeAtom),
          [e.jobId]: e.propertyIds,
        });
        break;
      }
      case "base:formula:recompute:completed": {
        const e = event as BaseFormulaRecomputeCompleted;
        const store = getDefaultStore();
        const current = store.get(formulaRecomputeAtom);
        if (e.jobId in current) {
          const next = { ...current };
          delete next[e.jobId];
          store.set(formulaRecomputeAtom, next);
        }
        break;
      }
      case "base:property:created":
      case "base:property:updated":
      case "base:property:deleted":
      case "base:property:reordered":
      case "base:view:created":
      case "base:view:updated":
      case "base:view:deleted": {
        // Schema/metadata events only affect properties/views, not cell data.
        const e = event as BasePropertyEvent | BaseViewEvent;
        const cachedBase = queryClient.getQueryData<IBase>(["bases", pageId]);
        queryClient.invalidateQueries({ queryKey: ["bases", pageId] });
        if (e.operation === "base:property:updated" && e.property) {
          const propertyId = e.property.id;
          for (const view of cachedBase?.views ?? []) {
            if (
              view.config?.form?.fields?.some(
                (field) => field.propertyId === propertyId,
              )
            ) {
              invalidatePublicFormForView(pageId, view.id);
            }
          }
          const inverseOf = (property: IBaseProperty | undefined) =>
            (property?.typeOptions as RelationTypeOptions | undefined)?.inversePropertyId ?? null;
          const before = cachedBase?.properties?.find((property) => property.id === propertyId);
          // editing links needs edit on the other base only while the relation shows there
          if (e.property.type === "relation" && inverseOf(before) !== inverseOf(e.property)) {
            scheduleRowsRefresh(pageId, "all");
          }
        } else if (e.operation === "base:property:created" && e.property?.type === "relation") {
          // rows loaded before this side existed carry no preview for it
          scheduleRowsRefresh(pageId, "all");
        } else if (e.operation === "base:view:updated" && e.view?.type === "form") {
          invalidatePublicFormForView(pageId, e.view.id);
        } else if (e.operation === "base:view:deleted" && e.viewId) {
          queryClient.invalidateQueries({
            queryKey: formShareQueryKey(pageId, e.viewId),
          });
        }
        break;
      }
      case "base:view:share:updated": {
        const e = event as BaseViewShareUpdated;
        invalidatePublicFormForView(pageId, e.viewId);
        queryClient.invalidateQueries({
          queryKey: formShareQueryKey(pageId, e.viewId),
        });
        break;
      }
      default:
        break;
    }
  };
}

type BaseSubscription = {
  count: number;
  state: BaseSubscriptionState;
  handler: (raw: unknown) => void;
  subscribe: () => void;
  markMissedEvents: () => void;
};

const baseSubscriptions = new WeakMap<Socket, Map<string, BaseSubscription>>();

// One room subscription and cache handler per base, shared by every mounted
// view and rejoined on every reconnect.
export function retainBaseSubscription(
  socket: Socket,
  pageId: string,
  queryClient: QueryClient,
): () => void {
  const subscriptions =
    baseSubscriptions.get(socket) ?? new Map<string, BaseSubscription>();
  baseSubscriptions.set(socket, subscriptions);

  let subscription = subscriptions.get(pageId);
  if (!subscription) {
    const state: BaseSubscriptionState = {
      missedEvents: false,
    };
    subscription = {
      count: 0,
      state,
      handler: createBaseEventHandler(pageId, queryClient, state),
      subscribe: () => {
        socket.emit("message", { operation: "base:subscribe", pageId });
      },
      markMissedEvents: () => {
        state.missedEvents = true;
      },
    };
    subscriptions.set(pageId, subscription);
    socket.on("message", subscription.handler);
    socket.on("connect", subscription.subscribe);
    socket.on("disconnect", subscription.markMissedEvents);
    if (socket.connected) subscription.subscribe();
  }
  subscription.count += 1;

  const retained = subscription;
  return () => {
    retained.count -= 1;
    if (retained.count > 0) return;
    subscriptions.delete(pageId);
    cancelRowsRefresh(pageId);
    clearTimeout(retained.state.relationRefresh?.timer);
    socket.off("message", retained.handler);
    socket.off("connect", retained.subscribe);
    socket.off("disconnect", retained.markMissedEvents);
    socket.emit("message", { operation: "base:unsubscribe", pageId });
  };
}

// Realtime bridge for a base: reconciles React Query caches on inbound events.
export function useBaseSocket(pageId: string | undefined): void {
  const socket = useAtomValue(socketAtom);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !pageId) return;
    return retainBaseSubscription(socket, pageId, queryClient);
  }, [socket, pageId, queryClient]);
}
