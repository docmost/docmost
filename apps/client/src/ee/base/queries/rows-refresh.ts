import { queryClient } from "@/main";
import {
  invalidateBaseRows,
  invalidateCalendarRows,
} from "@/ee/base/queries/base-row-query";
import { BASE_ROW_MUTATION_KEY } from "@/ee/base/queries/row-update-chain";

export type RowsRefreshScope = "calendar" | "all";

const ROWS_REFRESH_DELAY_MS = 300;
const ROWS_REFRESH_INTERVAL_MS = 2000;
const ROWS_REFRESH_MAX_DEFERRALS = 10;
const ROWS_REFRESH_MAX_FETCH_WAITS = 100;

type RowsRefreshState = {
  timer?: ReturnType<typeof setTimeout>;
  scope?: RowsRefreshScope;
  deferrals: number;
  fetchWaits: number;
  lastRefreshAt: number;
};

const refreshStates = new Map<string, RowsRefreshState>();

function runRefresh(pageId: string, state: RowsRefreshState) {
  state.timer = undefined;
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
  if (state.timer !== undefined) return;
  const pending = state;
  state.timer = setTimeout(
    () => runRefresh(pageId, pending),
    Math.max(
      ROWS_REFRESH_DELAY_MS,
      state.lastRefreshAt + ROWS_REFRESH_INTERVAL_MS - performance.now(),
    ),
  );
}

export function cancelRowsRefresh(pageId: string) {
  clearTimeout(refreshStates.get(pageId)?.timer);
  refreshStates.delete(pageId);
}
