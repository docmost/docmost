import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  IAddPagePermission,
  IPagePermission,
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
import { notifications } from "@mantine/notifications";
import { IPagination, QueryParams } from "@/lib/types";
import { useTranslation } from "react-i18next";

export function usePageRestrictionInfoQuery(
  pageId: string,
): UseQueryResult<IPageRestrictionInfo, Error> {
  return useQuery({
    queryKey: ["page-restriction-info", pageId],
    queryFn: () => getPageRestrictionInfo(pageId),
    enabled: !!pageId,
  });
}

export function usePagePermissionsQuery(
  pageId: string,
  params?: QueryParams,
): UseQueryResult<IPagination<IPagePermission>, Error> {
  return useQuery({
    queryKey: ["page-permissions", pageId, params],
    queryFn: () => getPagePermissions(pageId, params),
    enabled: !!pageId,
    placeholderData: keepPreviousData,
  });
}

export function useRestrictPageMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (pageId) => restrictPage(pageId),
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({
        queryKey: ["page-restriction-info", pageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["page-permissions", pageId],
      });
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
      queryClient.invalidateQueries({
        queryKey: ["page-restriction-info", pageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["page-permissions", pageId],
      });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to unrestrict page"),
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
        message: errorMessage || t("Failed to add page permission"),
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
        message: errorMessage || t("Failed to remove page permission"),
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
        message: errorMessage || t("Failed to update page permission role"),
        color: "red",
      });
    },
  });
}
