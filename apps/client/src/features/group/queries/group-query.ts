import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { IGroup } from '@/features/group/types/group.types';
import {
  addGroupMember,
  createGroup,
  deleteGroup,
  getGroupById,
  getGroupMembers,
  getGroups,
  removeGroupMember,
  updateGroup,
} from '@/features/group/services/group-service';
import { notifications } from '@mantine/notifications';
import { QueryParams } from '@/lib/types.ts';

export function useGetGroupsQuery(
  params?: QueryParams
): UseQueryResult<any, Error> {
  return useQuery({
    queryKey: ['groups', params],
    queryFn: () => getGroups(params),
  });
}

export function useGroupQuery(groupId: string): UseQueryResult<IGroup, Error> {
  return useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => getGroupById(groupId),
    enabled: !!groupId,
  });
}

export function useGroupMembersQuery(groupId: string) {
  return useQuery({
    queryKey: ['groupMembers', groupId],
    queryFn: () => getGroupMembers(groupId),
    enabled: !!groupId,
  });
}

export function useCreateGroupMutation() {
  return useMutation<IGroup, Error, Partial<IGroup>>({
    mutationFn: (data) => createGroup(data),
    onSuccess: () => {
      notifications.show({ message: 'Group created successfully' });
    },
    onError: () => {
      notifications.show({ message: 'Failed to create group', color: 'red' });
    },
  });
}

export function useUpdateGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation<IGroup, Error, Partial<IGroup>>({
    mutationFn: (data) => updateGroup(data),
    onSuccess: (data, variables) => {
      notifications.show({ message: 'Group updated successfully' });
      queryClient.invalidateQueries({
        queryKey: ['group', variables.groupId],
      });
    },
    onError: (error) => {
      const errorMessage = error['response']?.data?.message;
      notifications.show({ message: errorMessage, color: 'red' });
    },
  });
}

export function useDeleteGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) => deleteGroup({ groupId }),
    onSuccess: (data, variables) => {
      notifications.show({ message: 'Group deleted successfully' });

      const groups = queryClient.getQueryData(['groups']) as any;
      if (groups) {
        groups.items = groups.items?.filter(
          (group: IGroup) => group.id !== variables
        );
        queryClient.setQueryData(['groups'], groups);
      }
    },
    onError: (error) => {
      const errorMessage = error['response']?.data?.message;
      notifications.show({ message: errorMessage, color: 'red' });
    },
  });
}

export function useAddGroupMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { groupId: string; userIds: string[] }>({
    mutationFn: (data) => addGroupMember(data),
    onSuccess: (data, variables) => {
      notifications.show({ message: 'Added successfully' });
      queryClient.invalidateQueries({
        queryKey: ['groupMembers', variables.groupId],
      });
    },
    onError: () => {
      notifications.show({
        message: 'Failed to add group members',
        color: 'red',
      });
    },
  });
}

export function useRemoveGroupMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    {
      groupId: string;
      userId: string;
    }
  >({
    mutationFn: (data) => removeGroupMember(data),
    onSuccess: (data, variables) => {
      notifications.show({ message: 'Removed successfully' });
      queryClient.invalidateQueries({
        queryKey: ['groupMembers', variables.groupId],
      });
    },
    onError: (error) => {
      const errorMessage = error['response']?.data?.message;
      notifications.show({ message: errorMessage, color: 'red' });
    },
  });
}
