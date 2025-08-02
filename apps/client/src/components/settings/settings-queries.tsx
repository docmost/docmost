import { queryClient } from "@/main.tsx";
import { getSpaces } from "@/features/space/services/space-service.ts";
import { getGroups } from "@/features/group/services/group-service.ts";
import { QueryParams } from "@/lib/types.ts";
import { getWorkspaceMembers } from "@/features/workspace/services/workspace-service.ts";
import { getShares } from "@/features/share/services/share-service.ts";

export const prefetchWorkspaceMembers = () => {
  const params = { limit: 100, page: 1, query: "" } as QueryParams;
  queryClient.prefetchQuery({
    queryKey: ["workspaceMembers", params],
    queryFn: () => getWorkspaceMembers(params),
  });
};

export const prefetchSpaces = () => {
  queryClient.prefetchQuery({
    queryKey: ["spaces", { page: 1 }],
    queryFn: () => getSpaces({ page: 1 }),
  });
};

export const prefetchGroups = () => {
  queryClient.prefetchQuery({
    queryKey: ["groups", { page: 1 }],
    queryFn: () => getGroups({ page: 1 }),
  });
};

export const prefetchShares = () => {
  queryClient.prefetchQuery({
    queryKey: ["share-list", { page: 1 }],
    queryFn: () => getShares({ page: 1, limit: 100 }),
  });
};
