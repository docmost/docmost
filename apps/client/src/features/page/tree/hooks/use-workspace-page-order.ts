import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { IWorkspacePageOrder } from '@/features/page/types/page.types';
import { getWorkspacePageOrder } from '@/features/page/services/page-service';

export default function useWorkspacePageOrder(): UseQueryResult<IWorkspacePageOrder> {
  return useQuery({
    queryKey: ["workspace-page-order"],
    queryFn: async () => {
      return await getWorkspacePageOrder();
    },
  });
}
