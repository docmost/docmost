import { useMutation, useQuery, UseQueryResult } from '@tanstack/react-query';
import { createPage, deletePage, getPageById, getRecentChanges, updatePage } from '@/features/page/services/page-service';
import { IPage } from '@/features/page/types/page.types';

export default function usePage(pageId?: string) {
  const createMutation = useMutation(
    (data: Partial<IPage>) => createPage(data),
  );

  const pageQueryResult: UseQueryResult<IPage, unknown> = useQuery(
    ['page', pageId],
    () => getPageById(pageId as string),
    {
      enabled: !!pageId,
    },
  );

  const recentPagesQuery: UseQueryResult<IPage[], unknown> = useQuery(
    ['recentChanges'],
    () => getRecentChanges()
  );

  const updateMutation = useMutation(
    (data: Partial<IPage>) => updatePage(data),
  );

  const removeMutation = useMutation(
    (id: string) => deletePage(id),
  );

  return {
    pageQuery: pageQueryResult,
    recentPagesQuery: recentPagesQuery,
    create: createMutation.mutate,
    updatePageMutation: updateMutation.mutate,
    remove: removeMutation.mutate,
  };
}
