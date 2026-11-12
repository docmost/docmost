import { InfiniteData, QueryKey } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { getRowInfo, IBaseRowsPage } from "@/ee/base/services/base-service";
import { IBaseRow, UpdateRowInput } from "@/ee/base/types/base.types";
import { queryClient } from "@/main";
import {
  invalidateBaseRows,
  invalidateCalendarRows,
} from "@/ee/base/queries/base-row-query";

export type RowUpdateContext = {
  previousRows: [QueryKey, IBaseRow][];
  seq: number;
  supersedes: boolean;
};

type RowUpdateChain = {
  seq: number;
  reconcile: boolean;
  regrouped: boolean;
  calendarTouched: boolean;
  rowsOrdered: boolean;
};

export const BASE_ROW_MUTATION_KEY = ["base-row"] as const;
export const ROW_UPDATE_MUTATION_KEY = [...BASE_ROW_MUTATION_KEY, "update"] as const;

const rowUpdateChains = new Map<string, RowUpdateChain>();
const rowUpdateRequests = new Map<string, Promise<unknown>>();
const rowReconciles = new Map<string, object>();
let rowUpdateSeq = 0;

export function enqueueRowUpdate<T>(
  rowId: string,
  send: () => Promise<T>,
): Promise<T> {
  const request = (rowUpdateRequests.get(rowId) ?? Promise.resolve())
    .catch(() => undefined)
    .then(send);
  rowUpdateRequests.set(rowId, request);
  const release = () => {
    if (rowUpdateRequests.get(rowId) === request) {
      rowUpdateRequests.delete(rowId);
    }
  };
  request.then(release, release);
  return request;
}

export function beginRowUpdate(rowId: string): {
  seq: number;
  supersedes: boolean;
} {
  const seq = ++rowUpdateSeq;
  rowReconciles.delete(rowId);
  const pending = rowUpdateChains.get(rowId);
  rowUpdateChains.set(rowId, {
    reconcile: false,
    regrouped: false,
    calendarTouched: false,
    rowsOrdered: false,
    ...pending,
    seq,
  });
  return { seq, supersedes: !!pending };
}

export function getRowUpdateChain(rowId: string): RowUpdateChain | undefined {
  return rowUpdateChains.get(rowId);
}

export function endRowUpdateChain(rowId: string): void {
  rowUpdateChains.delete(rowId);
}

export function mapCachedRow(
  data: InfiniteData<IBaseRowsPage> | undefined,
  rowId: string,
  update: (row: IBaseRow) => IBaseRow | null,
): InfiniteData<IBaseRowsPage> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.flatMap((row) => {
        if (row.id !== rowId) return [row];
        const next = update(row);
        return next ? [next] : [];
      }),
    })),
  };
}

export function revertRowUpdate(
  row: IBaseRow,
  previous: IBaseRow,
  variables: UpdateRowInput,
): IBaseRow {
  const cells = { ...row.cells };
  for (const propertyId of Object.keys(variables.cells ?? {})) {
    if (propertyId in previous.cells) cells[propertyId] = previous.cells[propertyId];
    else delete cells[propertyId];
  }
  return {
    ...row,
    cells,
    ...(variables.position !== undefined && { position: previous.position }),
  };
}

export function reconcileRow(pageId: string, rowId: string): void {
  const token = {};
  rowReconciles.set(rowId, token);
  const settle = (apply: () => void) => {
    const current = rowReconciles.get(rowId);
    if (current === token) {
      rowReconciles.delete(rowId);
      apply();
      return;
    }
    if (current !== undefined) return;
    const pending = rowUpdateChains.get(rowId);
    if (pending) pending.reconcile = true;
    else reconcileRow(pageId, rowId);
  };
  const replaceRow = (fresh: IBaseRow | null) => {
    queryClient.setQueriesData<InfiniteData<IBaseRowsPage>>(
      { queryKey: ["base-rows", pageId] },
      (old) => mapCachedRow(old, rowId, (row) => (fresh ? { ...row, ...fresh } : null)),
    );
    invalidateCalendarRows(pageId);
  };
  getRowInfo(rowId, pageId).then(
    (fresh) =>
      settle(() => {
        replaceRow(fresh);
        queryClient.setQueryData<IBaseRow>(
          ["base-row", pageId, rowId],
          (old) => (old ? fresh : old),
        );
      }),
    (error) =>
      settle(() => {
        if (isAxiosError(error) && error.response?.status === 404) {
          replaceRow(null);
        } else {
          invalidateBaseRows(pageId);
        }
        queryClient.invalidateQueries({
          queryKey: ["base-row", pageId, rowId],
        });
      }),
  );
}
