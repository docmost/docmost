import { useMutation, useQuery, UseQueryResult } from '@tanstack/react-query';
import { ICurrentUserResponse } from '@/features/user/types/user.types';
import { getUserInfo } from '@/features/user/services/user-service';
import { createPage, deletePage, getPageById, updatePage } from '@/features/page/services/page-service';
import { IPage } from '@/features/page/types/page.types';


export default function usePage() {

  const createMutation = useMutation(
    (data: Partial<IPage>) => createPage(data),
  );

  const getPageByIdQuery = (id: string) => ({
    queryKey: ['page', id],
    queryFn: async () => getPageById(id),
  });

  const updateMutation = useMutation(
    (data: Partial<IPage>) => updatePage(data),
  );


  const deleteMutation = useMutation(
    (id: string) => deletePage(id),
  );

  return {
    create: createMutation.mutate,
    getPageById: getPageByIdQuery,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
  };
}
