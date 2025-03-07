import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { IWorkspace } from "@/features/workspace/types/workspace.types.ts";
import { getJoinedWorkspaces } from "@/ee/cloud/service/cloud-service.ts";

export function useJoinedWorkspacesQuery(): UseQueryResult<
  Partial<IWorkspace[]>,
  Error
> {
  return useQuery({
    queryKey: ["joined-workspaces"],
    queryFn: () => getJoinedWorkspaces(),
  });
}
