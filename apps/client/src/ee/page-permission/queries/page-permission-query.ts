import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  IAddPagePermission,
  IPageRestrictionInfo,
  IRemovePagePermission,
  IUpdatePagePermissionRole,
} from "@/ee/page-permission/types/page-permission.types";
import {
  addPagePermission,
  getPagePermissions,
  getPageRestrictionInfo,
  removePagePermission,
  restrictPage,
  unrestrictPage,
  updatePagePermissionRole,
} from "@/ee/page-permission/services/page-permission-service";
import { IPage } from "@/features/page/types/page.types";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export function usePageRestrictionInfoQuery(
  pageId: string | undefined,
): UseQueryResult<IPageRestrictionInfo, Error> {
  return useQuery({
    queryKey: ["page-restriction-info", pageId],
    queryFn: () => getPageRestrictionInfo(pageId),
    enabled: !!pageId,
  });
}

export function usePagePermissionsQuery(pageId: string) {
  return useInfiniteQuery({
    queryKey: ["page-permissions", pageId],
    queryFn: ({ pageParam }) => getPagePermissions(pageId, pageParam),
    enabled: !!pageId,
    //gcTime: 5000,
    placeholderData: keepPreviousData,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
  });
}

function updatePageRestrictionCache(
  queryClient: ReturnType<typeof useQueryClient>,
  pageId: string,
  hasRestriction: boolean,
) {
  queryClient.setQueriesData<IPage>(
    { queryKey: ["pages"] },
    (old) => {
      if (old?.id === pageId) {
        return {
          ...old,
          permissions: { ...old.permissions, hasRestriction },
        };
      }
      return old;
    },
  );
  queryClient.invalidateQueries({
    queryKey: ["page-restriction-info", pageId],
  });
  queryClient.removeQueries({
    queryKey: ["page-permissions", pageId],
  });
}

export function useRestrictPageMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (pageId) => restrictPage(pageId),
    onSuccess: (_, pageId) => {
      updatePageRestrictionCache(queryClient, pageId, true);
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to restrict page"),
        color: "red",
      });
    },
  });
}

export function useUnrestrictPageMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (pageId) => unrestrictPage(pageId),
    onSuccess: (_, pageId) => {
      updatePageRestrictionCache(queryClient, pageId, false);
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to remove page restriction"),
        color: "red",
      });
    },
  });
}

export function useAddPagePermissionMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, IAddPagePermission>({
    mutationFn: (data) => addPagePermission(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["page-permissions", variables.pageId],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to add permission"),
        color: "red",
      });
    },
  });
}

export function useRemovePagePermissionMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, IRemovePagePermission>({
    mutationFn: (data) => removePagePermission(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["page-permissions", variables.pageId],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to remove permission"),
        color: "red",
      });
    },
  });
}

export function useUpdatePagePermissionRoleMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, IUpdatePagePermissionRole>({
    mutationFn: (data) => updatePagePermissionRole(data),
    onSuccess: (_, variables) => {
      queryClient.refetchQueries({
        queryKey: ["page-permissions", variables.pageId],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to update permission"),
        color: "red",
      });
    },
  });
}
