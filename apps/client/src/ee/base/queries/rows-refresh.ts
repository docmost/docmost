import { getDefaultStore } from "jotai";
import { queryClient } from "@/main";
import { editingCellAtomFamily } from "@/ee/base/atoms/base-atoms";
import {
  invalidateBaseRows,
  invalidateCalendarRows,
} from "@/ee/base/queries/base-row-query";
import { BASE_ROW_MUTATION_KEY } from "@/ee/base/queries/row-update-chain";

export type RowsRefreshScope = "calendar" | "all";

const ROWS_REFRESH_DELAY_MS = 300;
const ROWS_REFRESH_INTERVAL_MS = 2000;
const ROWS_REFRESH_MAX_DEFERRALS = 100;
const ROWS_REFRESH_MAX_FETCH_WAITS = 100;

type RowsRefreshState = {
  timer?: ReturnType<typeof setTimeout>;
  scope?: RowsRefreshScope;
  deferrals: number;
  fetchWaits: number;
  lastRefreshAt: number;
  releaseEditHold?: () => void;
};

const refreshStates = new Map<string, RowsRefreshState>();

function armRefresh(pageId: string, state: RowsRefreshState) {
  state.timer = setTimeout(
    () => runRefresh(pageId, state),
    Math.max(
      ROWS_REFRESH_DELAY_MS,
      state.lastRefreshAt + ROWS_REFRESH_INTERVAL_MS - performance.now(),
    ),
  );
}

function holdWhileEditing(pageId: string, state: RowsRefreshState) {
  const store = getDefaultStore();
  const editingCellAtom = editingCellAtomFamily(pageId);
  if (!store.get(editingCellAtom)) return false;
  const unsubscribe = store.sub(editingCellAtom, () => {
    if (store.get(editingCellAtom)) return;
    state.releaseEditHold?.();
    state.deferrals = 0;
    state.fetchWaits = 0;
    armRefresh(pageId, state);
  });
  state.releaseEditHold = () => {
    unsubscribe();
    state.releaseEditHold = undefined;
  };
  return true;
}

function runRefresh(pageId: string, state: RowsRefreshState) {
  state.timer = undefined;
  if (holdWhileEditing(pageId, state)) return;
  const scope = state.scope ?? "calendar";
  const fetchingRows = queryClient.isFetching({
    queryKey:
      scope === "all" ? ["base-rows", pageId] : ["base-rows", pageId, "calendar"],
  });
  const mutatingRows = queryClient.isMutating({
    mutationKey: BASE_ROW_MUTATION_KEY,
    predicate: (mutation) =>
      (mutation.state.variables as { pageId?: string } | undefined)?.pageId ===
      pageId,
  });
  const waitForFetch =
    fetchingRows > 0 && state.fetchWaits < ROWS_REFRESH_MAX_FETCH_WAITS;
  if (
    waitForFetch ||
    (mutatingRows > 0 && state.deferrals < ROWS_REFRESH_MAX_DEFERRALS)
  ) {
    if (waitForFetch) state.fetchWaits += 1;
    else state.deferrals += 1;
    state.timer = setTimeout(
      () => runRefresh(pageId, state),
      ROWS_REFRESH_DELAY_MS,
    );
    return;
  }
  state.deferrals = 0;
  state.fetchWaits = 0;
  state.scope = undefined;
  state.lastRefreshAt = performance.now();
  if (scope === "all") invalidateBaseRows(pageId);
  else invalidateCalendarRows(pageId);
}

export function scheduleRowsRefresh(pageId: string, scope: RowsRefreshScope) {
  let state = refreshStates.get(pageId);
  if (!state) {
    state = { deferrals: 0, fetchWaits: 0, lastRefreshAt: -Infinity };
    refreshStates.set(pageId, state);
  }
  if (scope === "all" || !state.scope) state.scope = scope;
  if (state.timer !== undefined || state.releaseEditHold) return;
  armRefresh(pageId, state);
}

export function cancelRowsRefresh(pageId: string) {
  const state = refreshStates.get(pageId);
  clearTimeout(state?.timer);
  state?.releaseEditHold?.();
  refreshStates.delete(pageId);
}
