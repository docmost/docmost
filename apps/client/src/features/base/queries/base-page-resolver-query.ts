import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import api from "@/lib/api-client";

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
  const res = await api.post<{ items: ResolvedPage[] }>(
    "/bases/pages/resolve",
    { pageIds },
  );
  return res.data.items;
}

// Stable, sorted, deduped list so the query key is consistent across renders
// no matter what order the caller hands us the ids in.
function normalize(ids: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    if (typeof id === "string" && id.length > 0) set.add(id);
  }
  return Array.from(set).sort();
}

export type PageResolution = {
  // Map distinguishes three states via lookup:
  //   - key absent            → id not requested
  //   - value undefined       → still resolving (query pending, or stale fetch in flight)
  //   - value null            → resolved and not accessible (deleted, restricted, cross-workspace)
  //   - value ResolvedPage    → resolved and accessible
  pages: Map<string, ResolvedPage | null | undefined>;
  isLoading: boolean;
};

export function useResolvedPages(
  pageIds: (string | null | undefined)[],
): PageResolution {
  const normalized = useMemo(() => normalize(pageIds), [pageIds]);

  const { data, isSuccess, isLoading } = useQuery({
    queryKey: ["bases", "pages", "resolve", normalized],
    queryFn: () => resolvePages(normalized),
    enabled: normalized.length > 0,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const pages = useMemo(() => {
    const map = new Map<string, ResolvedPage | null | undefined>();
    // Seed with undefined (= "still resolving") until the fetch succeeds.
    for (const id of normalized) map.set(id, isSuccess ? null : undefined);
    for (const item of data ?? []) map.set(item.id, item);
    return map;
  }, [normalized, data, isSuccess]);

  return { pages, isLoading };
}
