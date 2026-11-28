import { useCallback, useMemo } from "react";
import { useResolvedPages } from "@/ee/base/queries/base-page-resolver-query";
import { buildPageUrl } from "@/features/page/page.utils";

export function useRelationRowHref(
  targetBaseId: string,
): (rowId: string) => string | null {
  const pageIds = useMemo(() => [targetBaseId], [targetBaseId]);
  const page = useResolvedPages(pageIds).pages.get(targetBaseId);
  return useCallback(
    (rowId: string) => {
      if (!page?.space) return null;
      const params = new URLSearchParams({ row: rowId, rowBase: targetBaseId });
      return `${buildPageUrl(page.space.slug, page.slugId, page.title ?? undefined)}?${params}`;
    },
    [page, targetBaseId],
  );
}
