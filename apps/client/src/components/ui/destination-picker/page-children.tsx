import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { getSidebarPages } from "@/features/page/services/page-service";
import { IPage } from "@/features/page/types/page.types";
import { IPagination } from "@/lib/types";
import { PageRow } from "./page-row";
import classes from "./destination-picker.module.css";

type PageChildrenProps = {
  spaceId: string;
  pageId?: string;
  depth: number;
  limit: number;
  selectedId: string | null;
  excludePageId?: string;
  onSelectPage: (page: Partial<IPage>) => void;
};

export function PageChildren({
  spaceId,
  pageId,
  depth,
  limit,
  selectedId,
  excludePageId,
  onSelectPage,
}: PageChildrenProps) {
  const { t } = useTranslation();

  const { data, isLoading, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["destination-pages", spaceId, pageId ?? "root"],
    queryFn: ({ pageParam }) =>
      getSidebarPages({
        spaceId,
        pageId,
        limit,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: IPagination<IPage>) =>
      lastPage.meta?.nextCursor ?? undefined,
  });

  const pages = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading) {
    return (
      <div className={classes.emptyState}>
        <Loader size="xs" />
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className={classes.emptyState}>
        {pageId ? t("No pages inside") : t("No pages in this space")}
      </div>
    );
  }

  return (
    <>
      {pages.map((page) => (
        <PageRow
          key={page.id}
          page={page}
          depth={depth}
          limit={limit}
          selectedId={selectedId}
          excludePageId={excludePageId}
          onSelect={onSelectPage}
        />
      ))}
      {hasNextPage && (
        <div className={classes.loadMore} onClick={() => fetchNextPage()}>
          {t("Load more")}
        </div>
      )}
    </>
  );
}
