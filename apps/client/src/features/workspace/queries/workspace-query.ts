import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeMemberRole,
  getWorkspaceMembers,
} from "@/features/workspace/services/workspace-service";
import { QueryParams } from "@/lib/types.ts";
import { notifications } from "@mantine/notifications";

export function useWorkspaceMembersQuery(params?: QueryParams) {
  return useQuery({
    queryKey: ["workspaceMembers", params],
    queryFn: () => getWorkspaceMembers(params),
  });
}

export function useChangeMemberRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, any>({
    mutationFn: (data) => changeMemberRole(data),
    onSuccess: (data, variables) => {
      notifications.show({ message: "Member role updated successfully" });
      queryClient.refetchQueries({
        queryKey: ["workspaceMembers", variables.spaceId],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}
