import api from "@/lib/api-client";
import type { ResolvedPage } from "./base-page-resolver-query";

/*
 * Per-cell `useResolvedPages([id])` calls each mount with a different
 * queryKey, so React Query can't dedupe them — a 20-row grid with a page
 * column used to fire 20 requests on first paint. This loader sits under
 * the hook: incoming id lists accumulate in a pending batch, a microtask
 * flushes a single `POST /bases/pages/expand` for the union, and each
 * caller's promise resolves with a Map containing just the ids it asked
 * for. Unknown ids are absent from the map (hook treats absence as "not
 * accessible", matching the old per-call semantics).
 *
 * Microtask window = one React commit. Cells that mount in a single
 * commit batch together; cells added later (e.g. infinite-scroll page
 * load) form their own batch. Good enough in practice; a setTimeout(0)
 * window would widen it but adds an observable delay.
 */

type Waiter = {
  requestedIds: readonly string[];
  resolve: (m: Map<string, ResolvedPage>) => void;
  reject: (err: unknown) => void;
};

type PendingBatch = {
  ids: Set<string>;
  waiters: Waiter[];
};

let pending: PendingBatch | null = null;

export function expandPagesBatched(
  ids: readonly string[],
): Promise<Map<string, ResolvedPage>> {
  if (ids.length === 0) return Promise.resolve(new Map());

  return new Promise((resolve, reject) => {
    if (!pending) {
      pending = { ids: new Set(), waiters: [] };
      queueMicrotask(flush);
    }
    for (const id of ids) pending.ids.add(id);
    pending.waiters.push({ requestedIds: ids, resolve, reject });
  });
}

async function flush(): Promise<void> {
  const batch = pending;
  pending = null;
  if (!batch) return;

  const unionIds = Array.from(batch.ids);
  try {
    const res = await api.post<{ items: ResolvedPage[] }>(
      "/bases/pages/expand",
      { pageIds: unionIds },
    );
    const byId = new Map<string, ResolvedPage>();
    for (const item of res.data.items) byId.set(item.id, item);

    for (const w of batch.waiters) {
      const subset = new Map<string, ResolvedPage>();
      for (const id of w.requestedIds) {
        const page = byId.get(id);
        if (page) subset.set(id, page);
      }
      w.resolve(subset);
    }
  } catch (err) {
    for (const w of batch.waiters) w.reject(err);
  }
}
