import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { useQueryClient, InfiniteData } from "@tanstack/react-query";
import { socketAtom } from "@/features/websocket/atoms/socket-atom";
import {
  IBaseProperty,
  IBaseRow,
  IBaseView,
} from "@/features/base/types/base.types";
import { IPagination } from "@/lib/types";

type BaseRowCreated = {
  operation: "base:row:created";
  baseId: string;
  row: IBaseRow;
  requestId?: string | null;
};

type BaseRowUpdated = {
  operation: "base:row:updated";
  baseId: string;
  rowId: string;
  updatedCells: Record<string, unknown>;
  requestId?: string | null;
};

type BaseRowDeleted = {
  operation: "base:row:deleted";
  baseId: string;
  rowId: string;
  requestId?: string | null;
};

type BaseRowReordered = {
  operation: "base:row:reordered";
  baseId: string;
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
  baseId: string;
  property?: IBaseProperty;
  propertyId?: string;
  requestId?: string | null;
};

type BaseViewEvent = {
  operation:
    | "base:view:created"
    | "base:view:updated"
    | "base:view:deleted";
  baseId: string;
  view?: IBaseView;
  viewId?: string;
};

type BaseSchemaBumped = {
  operation: "base:schema:bumped";
  baseId: string;
  schemaVersion: number;
};

type BaseInboundEvent =
  | BaseRowCreated
  | BaseRowUpdated
  | BaseRowDeleted
  | BaseRowReordered
  | BasePropertyEvent
  | BaseViewEvent
  | BaseSchemaBumped
  | { operation: string; baseId: string };

/*
 * Module-level set of requestIds we've just sent to the server. When the
 * socket echoes back the mutation as a `base:row:*` / `base:property:*`
 * event with a matching `requestId`, the socket handler drops it because
 * the local mutation already updated the cache. Bounded so it can't grow
 * unbounded on a long-lived tab.
 */
const outboundRequestIds = new Set<string>();
const OUTBOUND_MAX = 256;

export function markRequestIdOutbound(requestId: string): void {
  outboundRequestIds.add(requestId);
  if (outboundRequestIds.size > OUTBOUND_MAX) {
    const oldest = outboundRequestIds.values().next().value;
    if (oldest) outboundRequestIds.delete(oldest);
  }
}

/*
 * Realtime bridge for a single base. Joins the server's `base-{baseId}`
 * room on mount, leaves on unmount, and reconciles the React Query caches
 * (`["base-rows", baseId, ...]` and `["bases", baseId]`) when events
 * arrive from other clients.
 */
export function useBaseSocket(baseId: string | undefined): void {
  const socket = useAtomValue(socketAtom);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !baseId) return;

    socket.emit("message", { operation: "base:subscribe", baseId });

    const handler = (raw: unknown) => {
      if (!raw || typeof raw !== "object") return;
      const event = raw as BaseInboundEvent;
      if (event.baseId !== baseId) return;

      const requestId = (event as any).requestId as string | undefined;
      if (requestId && outboundRequestIds.has(requestId)) {
        outboundRequestIds.delete(requestId);
        return;
      }

      switch (event.operation) {
        case "base:row:created": {
          const e = event as BaseRowCreated;
          queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
            { queryKey: ["base-rows", baseId] },
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
          break;
        }
        case "base:row:updated": {
          const e = event as BaseRowUpdated;
          queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
            { queryKey: ["base-rows", baseId] },
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
          break;
        }
        case "base:row:deleted": {
          const e = event as BaseRowDeleted;
          queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
            { queryKey: ["base-rows", baseId] },
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
          break;
        }
        case "base:row:reordered": {
          const e = event as BaseRowReordered;
          queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
            { queryKey: ["base-rows", baseId] },
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
          break;
        }
        case "base:property:created":
        case "base:property:updated":
        case "base:property:deleted":
        case "base:property:reordered":
        case "base:view:created":
        case "base:view:updated":
        case "base:view:deleted": {
          // Schema/metadata events touch `properties` / `views` on the
          // base, not the cell data. The row cache only gets invalidated
          // when a `base:schema:bumped` arrives (i.e. cells actually
          // migrated) — otherwise a big-base conversion would trigger a
          // serial refetch of every cached infinite-query page.
          queryClient.invalidateQueries({ queryKey: ["bases", baseId] });
          break;
        }
        case "base:schema:bumped": {
          queryClient.invalidateQueries({ queryKey: ["bases", baseId] });
          queryClient.invalidateQueries({ queryKey: ["base-rows", baseId] });
          break;
        }
        default:
          break;
      }
    };

    socket.on("message", handler);

    return () => {
      socket.off("message", handler);
      socket.emit("message", { operation: "base:unsubscribe", baseId });
    };
  }, [socket, baseId, queryClient]);
}
