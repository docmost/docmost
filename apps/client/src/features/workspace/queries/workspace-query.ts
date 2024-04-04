import { useQuery } from "@tanstack/react-query";
import { getWorkspaceMembers } from "@/features/workspace/services/workspace-service";
import { QueryParams } from "@/lib/types.ts";

export function useWorkspaceMembersQuery(params?: QueryParams) {
  return useQuery({
    queryKey: ["workspaceMembers", params],
    queryFn: () => getWorkspaceMembers(params),
  });
}
