import { useEffect } from "react";
import { useAtomValue, getDefaultStore } from "jotai";
import { useQueryClient, InfiniteData } from "@tanstack/react-query";
import { socketAtom } from "@/features/websocket/atoms/socket-atom";
import {
  IBase,
  IBaseProperty,
  IBaseRow,
  IBaseView,
} from "@/ee/base/types/base.types";
import { selectedRowIdsAtomFamily } from "@/ee/base/atoms/base-atoms";
import { formulaRecomputeAtom } from "@/ee/base/atoms/formula-recompute-atom";
import { IPagination } from "@/lib/types";
import { invalidateBaseRows } from "@/ee/base/queries/base-row-query";

type BaseRowCreated = {
  operation: "base:row:created";
  pageId: string;
  row: IBaseRow;
  requestId?: string | null;
};

type BaseRowUpdated = {
  operation: "base:row:updated";
  pageId: string;
  rowId: string;
  updatedCells: Record<string, unknown>;
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
  | BaseFormulaRecomputeStarted
  | BaseFormulaRecomputeCompleted
  | BaseSchemaBumped
  | BaseSubscribed
  | BasePropertyEvent
  | BaseViewEvent
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

// Realtime bridge for a single base. Joins the base-{pageId} room on mount,
// leaves on unmount, and reconciles React Query caches on inbound events.
export function useBaseSocket(pageId: string | undefined): void {
  const socket = useAtomValue(socketAtom);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !pageId) return;

    socket.emit("message", { operation: "base:subscribe", pageId });

    const handler = (raw: unknown) => {
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
          const baseForCreate = queryClient.getQueryData<IBase>(["bases", pageId]);
          const hasKanbanForCreate = (baseForCreate?.views ?? []).some((v) => v.type === "kanban");
          if (hasKanbanForCreate) {
            invalidateBaseRows(pageId);
          } else {
            queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
              { queryKey: ["base-rows", pageId] },
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
          }
          break;
        }
        case "base:row:updated": {
          const e = event as BaseRowUpdated;
          const baseForUpdate = queryClient.getQueryData<IBase>(["bases", pageId]);
          const hasKanbanForUpdate = (baseForUpdate?.views ?? []).some((v) => v.type === "kanban");
          if (hasKanbanForUpdate) {
            invalidateBaseRows(pageId);
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
                            ? {
                                ...row,
                                cells: { ...row.cells, ...e.updatedCells },
                              }
                            : row,
                        ),
                      })),
                    },
            );
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
            invalidateBaseRows(pageId);
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
            queryClient.invalidateQueries({ queryKey: ["base-rows", pageId] });
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
          if (cached && cached.baseSchemaVersion !== e.schemaVersion) {
            queryClient.invalidateQueries({ queryKey: ["base-rows", pageId] });
            queryClient.invalidateQueries({ queryKey: ["bases", pageId] });
          }
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
          queryClient.invalidateQueries({ queryKey: ["bases", pageId] });
          break;
        }
        default:
          break;
      }
    };

    socket.on("message", handler);

    return () => {
      socket.off("message", handler);
      socket.emit("message", { operation: "base:unsubscribe", pageId });
    };
  }, [socket, pageId, queryClient]);
}
