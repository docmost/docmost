import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  IPageVerificationInfo,
  ISetupVerification,
  IUpdateVerification,
  IVerificationListItem,
  IVerificationListParams,
} from "@/ee/page-verification/types/page-verification.types";
import {
  getVerificationInfo,
  getVerificationList,
  markObsolete,
  rejectApproval,
  removeVerification,
  setupVerification,
  submitForApproval,
  updateVerification,
  verifyPage,
} from "@/ee/page-verification/services/page-verification-service";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { IPagination } from "@/lib/types";

export function usePageVerificationInfoQuery(
  pageId: string | undefined,
): UseQueryResult<IPageVerificationInfo, Error> {
  return useQuery({
    queryKey: ["page-verification-info", pageId],
    queryFn: () => getVerificationInfo(pageId!),
    enabled: !!pageId,
  });
}

export function useSetupVerificationMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, ISetupVerification>({
    mutationFn: (data) => setupVerification(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["page-verification-info", variables.pageId],
      });
      notifications.show({ message: t("Verification enabled") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to enable verification"),
        color: "red",
      });
    },
  });
}

export function useUpdateVerificationMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, IUpdateVerification>({
    mutationFn: (data) => updateVerification(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["page-verification-info", variables.pageId],
      });
      notifications.show({ message: t("Verification updated") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to update verification"),
        color: "red",
      });
    },
  });
}

export function useRemoveVerificationMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (pageId) => removeVerification(pageId),
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({
        queryKey: ["page-verification-info", pageId],
      });
      notifications.show({ message: t("Verification removed") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to remove verification"),
        color: "red",
      });
    },
  });
}

export function useVerifyPageMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (pageId) => verifyPage(pageId),
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({
        queryKey: ["page-verification-info", pageId],
      });
      notifications.show({ message: t("Page verified") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to verify page"),
        color: "red",
      });
    },
  });
}

export function useSubmitForApprovalMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (pageId) => submitForApproval(pageId),
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({
        queryKey: ["page-verification-info", pageId],
      });
      notifications.show({ message: t("Submitted for approval") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to submit for approval"),
        color: "red",
      });
    },
  });
}

export function useRejectApprovalMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, { pageId: string; comment?: string }>({
    mutationFn: (data) => rejectApproval(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["page-verification-info", variables.pageId],
      });
      notifications.show({ message: t("Approval rejected") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to reject approval"),
        color: "red",
      });
    },
  });
}

export function useMarkObsoleteMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (pageId) => markObsolete(pageId),
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({
        queryKey: ["page-verification-info", pageId],
      });
      notifications.show({ message: t("Page marked as obsolete") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to mark as obsolete"),
        color: "red",
      });
    },
  });
}

export function useVerificationListQuery(
  params?: IVerificationListParams,
): UseQueryResult<IPagination<IVerificationListItem>, Error> {
  return useQuery({
    queryKey: ["verification-list", params],
    queryFn: () => getVerificationList(params),
    placeholderData: keepPreviousData,
  });
}
