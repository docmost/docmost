import api from "@/lib/api-client";
import type { ResolvedPage } from "./base-page-resolver-query";

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
