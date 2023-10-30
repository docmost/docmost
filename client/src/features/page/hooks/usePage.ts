import { useMutation, useQuery, UseQueryResult } from '@tanstack/react-query';
import { createPage, deletePage, getPageById, updatePage } from '@/features/page/services/page-service';
import { IPage } from '@/features/page/types/page.types';
import { useAtom } from 'jotai/index';
import { pageAtom } from '@/features/page/atoms/page-atom';

export default function usePage(pageId?: string) {
  const [page, setPage] = useAtom(pageAtom<IPage>(pageId));

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

  const updateMutation = useMutation(
    (data: Partial<IPage>) => updatePage(data),
    {
      onSuccess: (updatedPageData) => {
        setPage(updatedPageData);
      },
    },
  );

  const removeMutation = useMutation(
    (id: string) => deletePage(id),
  );

  return {
    create: createMutation.mutate,
    pageQuery: pageQueryResult,
    updatePageMutation: updateMutation.mutate,
    remove: removeMutation.mutate,
  };
}
