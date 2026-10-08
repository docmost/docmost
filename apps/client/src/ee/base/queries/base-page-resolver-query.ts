import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { expandPagesBatched } from "./page-expand-loader";

export type ResolvedPage = {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  spaceId: string;
  space: { id: string; slug: string; name: string } | null;
};

async function resolvePages(pageIds: string[]): Promise<ResolvedPage[]> {
  if (pageIds.length === 0) return [];
  const map = await expandPagesBatched(pageIds);
  const out: ResolvedPage[] = [];
  for (const id of pageIds) {
    const p = map.get(id);
    if (p) out.push(p);
  }
  return out;
}

// Stable, sorted, deduped list so the query key is consistent regardless of caller ordering.
function normalize(ids: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    if (typeof id === "string" && id.length > 0) set.add(id);
  }
  return Array.from(set).sort();
}

export type PageResolution = {
  // Map lookup states: key absent = not requested, undefined = resolving, null = inaccessible, ResolvedPage = accessible.
  pages: Map<string, ResolvedPage | null | undefined>;
  isLoading: boolean;
};

export function useResolvedPages(
  pageIds: (string | null | undefined)[],
): PageResolution {
  const normalized = useMemo(() => normalize(pageIds), [pageIds]);

  const { data, isSuccess, isLoading } = useQuery({
    queryKey: ["bases", "pages", "expand", normalized],
    queryFn: () => resolvePages(normalized),
    enabled: normalized.length > 0,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const pages = useMemo(() => {
    const map = new Map<string, ResolvedPage | null | undefined>();
    for (const id of normalized) map.set(id, isSuccess ? null : undefined);
    for (const item of data ?? []) map.set(item.id, item);
    return map;
  }, [normalized, data, isSuccess]);

  return { pages, isLoading };
}
