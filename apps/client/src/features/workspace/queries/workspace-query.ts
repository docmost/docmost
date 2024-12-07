import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  changeMemberRole,
  getInvitationById,
  getPendingInvitations,
  getWorkspaceMembers,
  createInvitation,
  resendInvitation,
  revokeInvitation,
  getWorkspace,
  getWorkspacePublicData,
} from "@/features/workspace/services/workspace-service";
import { IPagination, QueryParams } from "@/lib/types.ts";
import { notifications } from "@mantine/notifications";
import {
  ICreateInvite,
  IInvitation,
  IWorkspace,
} from "@/features/workspace/types/workspace.types.ts";

export function useWorkspaceQuery(): UseQueryResult<IWorkspace, Error> {
  return useQuery({
    queryKey: ["workspace"],
    queryFn: () => getWorkspace(),
  });
}

export function useWorkspacePublicDataQuery(): UseQueryResult<
  IWorkspace,
  Error
> {
  return useQuery({
    queryKey: ["workspace-public"],
    queryFn: () => getWorkspacePublicData(),
  });
}

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
      // TODO: change in cache instead
      notifications.show({ message: "Member role updated successfully" });
      queryClient.refetchQueries({
        queryKey: ["workspaceMembers"],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useWorkspaceInvitationsQuery(
  params?: QueryParams,
): UseQueryResult<IPagination<IInvitation>, Error> {
  return useQuery({
    queryKey: ["invitations", params],
    queryFn: () => getPendingInvitations(params),
  });
}

export function useCreateInvitationMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ICreateInvite>({
    mutationFn: (data) => createInvitation(data),
    onSuccess: (data, variables) => {
      notifications.show({ message: "Invitation sent" });
      // TODO: mutate cache
      queryClient.refetchQueries({
        queryKey: ["invitations"],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useResendInvitationMutation() {
  return useMutation<
    void,
    Error,
    {
      invitationId: string;
    }
  >({
    mutationFn: (data) => resendInvitation(data),
    onSuccess: (data, variables) => {
      notifications.show({ message: "Invitation resent" });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useRevokeInvitationMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    {
      invitationId: string;
    }
  >({
    mutationFn: (data) => revokeInvitation(data),
    onSuccess: (data, variables) => {
      notifications.show({ message: "Invitation revoked" });
      queryClient.invalidateQueries({
        queryKey: ["invitations"],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useGetInvitationQuery(
  invitationId: string,
): UseQueryResult<any, Error> {
  return useQuery({
    queryKey: ["invitations", invitationId],
    queryFn: () => getInvitationById({ invitationId }),
    enabled: !!invitationId,
  });
}
