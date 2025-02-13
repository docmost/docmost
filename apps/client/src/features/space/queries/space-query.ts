import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  IAddSpaceMember,
  IChangeSpaceMemberRole,
  IRemoveSpaceMember,
  ISpace,
  ISpaceMember,
} from "@/features/space/types/space.types";
import {
  addSpaceMember,
  changeMemberRole,
  getSpaceById,
  getSpaceMembers,
  getSpaces,
  removeSpaceMember,
  createSpace,
  updateSpace,
  deleteSpace,
} from "@/features/space/services/space-service.ts";
import { notifications } from "@mantine/notifications";
import { IPagination, QueryParams } from "@/lib/types.ts";

export function useGetSpacesQuery(
  params?: QueryParams,
): UseQueryResult<IPagination<ISpace>, Error> {
  return useQuery({
    queryKey: ["spaces", params],
    queryFn: () => getSpaces(params),
    placeholderData: keepPreviousData,
  });
}

export function useSpaceQuery(spaceId: string): UseQueryResult<ISpace, Error> {
  return useQuery({
    queryKey: ["space", spaceId],
    queryFn: () => getSpaceById(spaceId),
    enabled: !!spaceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSpaceMutation() {
  const queryClient = useQueryClient();

  return useMutation<ISpace, Error, Partial<ISpace>>({
    mutationFn: (data) => createSpace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["spaces"],
      });
      notifications.show({ message: "Space created successfully" });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useGetSpaceBySlugQuery(
  spaceId: string,
): UseQueryResult<ISpace, Error> {
  return useQuery({
    queryKey: ["space", spaceId],
    queryFn: () => getSpaceById(spaceId),
    enabled: !!spaceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSpaceMutation() {
  const queryClient = useQueryClient();

  return useMutation<ISpace, Error, Partial<ISpace>>({
    mutationFn: (data) => updateSpace(data),
    onSuccess: (data, variables) => {
      notifications.show({ message: "Space updated successfully" });

      const space = queryClient.getQueryData([
        "space",
        variables.spaceId,
      ]) as ISpace;
      if (space) {
        const updatedSpace = { ...space, ...data };
        queryClient.setQueryData(["space", variables.spaceId], updatedSpace);
        queryClient.setQueryData(["space", data.slug], updatedSpace);
      }

      queryClient.invalidateQueries({
        queryKey: ["spaces"],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useDeleteSpaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<ISpace>) => deleteSpace(data.id),
    onSuccess: (data, variables) => {
      notifications.show({ message: "Space deleted successfully" });

      if (variables.slug) {
        queryClient.removeQueries({
          queryKey: ["space", variables.slug],
          exact: true,
        });
      }

      const spaces = queryClient.getQueryData(["spaces"]) as any;
      if (spaces) {
        spaces.items = spaces.items?.filter(
          (space: ISpace) => space.id !== variables.id,
        );
        queryClient.setQueryData(["spaces"], spaces);
      }
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useSpaceMembersQuery(
  spaceId: string,
  params?: QueryParams,
): UseQueryResult<IPagination<ISpaceMember>, Error> {
  return useQuery({
    queryKey: ["spaceMembers", spaceId, params],
    queryFn: () => getSpaceMembers(spaceId, params),
    enabled: !!spaceId,
    placeholderData: keepPreviousData,
  });
}

export function useAddSpaceMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, IAddSpaceMember>({
    mutationFn: (data) => addSpaceMember(data),
    onSuccess: (data, variables) => {
      notifications.show({ message: "Members added successfully" });
      queryClient.invalidateQueries({
        queryKey: ["spaceMembers", variables.spaceId],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useRemoveSpaceMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, IRemoveSpaceMember>({
    mutationFn: (data) => removeSpaceMember(data),
    onSuccess: (data, variables) => {
      notifications.show({ message: "Removed successfully" });
      queryClient.invalidateQueries({
        queryKey: ["spaceMembers", variables.spaceId],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}

export function useChangeSpaceMemberRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, IChangeSpaceMemberRole>({
    mutationFn: (data) => changeMemberRole(data),
    onSuccess: (data, variables) => {
      notifications.show({ message: "Member role updated successfully" });
      // due to pagination levels, change in cache instead
      queryClient.refetchQueries({
        queryKey: ["spaceMembers", variables.spaceId],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}
