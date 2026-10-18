import {
  keepPreviousData,
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  IPageVerificationInfo,
  IRejectApproval,
  IRemoveVerification,
  ISetupVerification,
  ISpaceApprovalInfo,
  ISubmitForApproval,
  IUpdateSpaceApprovalSettings,
  IUpdateVerification,
  IVerificationListItem,
  IVerificationListParams,
  IVerifyPage,
} from "@/ee/page-verification/types/page-verification.types";
import {
  getSpaceApprovalSettings,
  getVerificationInfo,
  getVerificationList,
  markObsolete,
  rejectApproval,
  removeVerification,
  restoreObsolete,
  setupVerification,
  submitForApproval,
  updateSpaceApprovalSettings,
  updateVerification,
  verifyPage,
  withdrawApproval,
} from "@/ee/page-verification/services/page-verification-service";
import { invalidatePageInfo } from "@/features/page/queries/page-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { IPagination } from "@/lib/types";

// An approval change alters what the page shows, who can edit it and its history.
function invalidateApprovalQueries(queryClient: QueryClient, pageId: string) {
  queryClient.invalidateQueries({
    queryKey: ["page-verification-info", pageId],
  });
  invalidatePageInfo(pageId);
  queryClient.invalidateQueries({ queryKey: ["page-history-list", pageId] });
  queryClient.invalidateQueries({ queryKey: ["verification-list"] });
}

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
      invalidateApprovalQueries(queryClient, variables.pageId);
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

type AddPageApprovers = { pageId: string; verifierIds: string[] };

// A page in an approval space has no row of its own until it gets page approvers, so adding them is a setup.
export function useAddPageApproversMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, AddPageApprovers>({
    mutationFn: ({ pageId, verifierIds }) =>
      setupVerification({ pageId, type: "qms", verifierIds }),
    onSuccess: (_, variables) => {
      invalidateApprovalQueries(queryClient, variables.pageId);
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

export function useUpdateVerificationMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, IUpdateVerification>({
    mutationFn: (data) => updateVerification(data),
    onSuccess: (_, variables) => {
      invalidateApprovalQueries(queryClient, variables.pageId);
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

  return useMutation<void, Error, IRemoveVerification>({
    mutationFn: (data) => removeVerification(data),
    onSuccess: (_, variables) => {
      invalidateApprovalQueries(queryClient, variables.pageId);
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

  return useMutation<void, Error, IVerifyPage>({
    mutationFn: (data) => verifyPage(data),
    onSuccess: (_, variables) => {
      invalidateApprovalQueries(queryClient, variables.pageId);
      notifications.show({ message: t("Page verified") });
    },
    onError: (error, variables) => {
      // The submission was withdrawn or replaced after the approver opened it.
      if (error["response"]?.status === 409) {
        invalidateApprovalQueries(queryClient, variables.pageId);
        notifications.show({
          message: t("This submission changed. Review the new version."),
          color: "red",
        });
        return;
      }
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

  return useMutation<void, Error, ISubmitForApproval>({
    mutationFn: (data) => submitForApproval(data),
    onSuccess: (_, variables) => {
      invalidateApprovalQueries(queryClient, variables.pageId);
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

  return useMutation<void, Error, IRejectApproval>({
    mutationFn: (data) => rejectApproval(data),
    onSuccess: (_, variables) => {
      invalidateApprovalQueries(queryClient, variables.pageId);
      notifications.show({ message: t("Changes requested") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to request changes"),
        color: "red",
      });
    },
  });
}

export function useWithdrawApprovalMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (pageId) => withdrawApproval(pageId),
    onSuccess: (_, pageId) => {
      invalidateApprovalQueries(queryClient, pageId);
      notifications.show({ message: t("Approval withdrawn") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to withdraw approval"),
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
      invalidateApprovalQueries(queryClient, pageId);
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

export function useRestoreObsoleteMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (pageId) => restoreObsolete(pageId),
    onSuccess: (_, pageId) => {
      invalidateApprovalQueries(queryClient, pageId);
      notifications.show({ message: t("Page restored from obsolete") });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to restore from obsolete"),
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

export function useSpaceApprovalSettingsQuery(
  spaceId: string | undefined,
): UseQueryResult<ISpaceApprovalInfo, Error> {
  return useQuery({
    queryKey: ["space-approval-settings", spaceId],
    queryFn: () => getSpaceApprovalSettings(spaceId!),
    enabled: !!spaceId,
  });
}

export function useUpdateSpaceApprovalSettingsMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<ISpaceApprovalInfo, Error, IUpdateSpaceApprovalSettings>({
    mutationFn: (data) => updateSpaceApprovalSettings(data),
    onSuccess: (info, variables) => {
      queryClient.setQueryData(
        ["space-approval-settings", variables.spaceId],
        info,
      );
      // The setting changes the approval state of every page in the space.
      queryClient.invalidateQueries({ queryKey: ["space"] });
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      queryClient.invalidateQueries({ queryKey: ["page-verification-info"] });
      queryClient.invalidateQueries({ queryKey: ["page-history-list"] });
      queryClient.invalidateQueries({ queryKey: ["verification-list"] });
      notifications.show({ message: t("Approval settings updated") });
    },
    onError: (error, variables) => {
      // A turn-off that stopped halfway only shows in the space settings, and a conflict means they moved on.
      queryClient.invalidateQueries({
        queryKey: ["space-approval-settings", variables.spaceId],
      });
      queryClient.invalidateQueries({ queryKey: ["space"] });

      if (error["response"]?.status === 409) {
        notifications.show({
          message: t(
            "The approval settings changed in the meantime. Review them and try again.",
          ),
          color: "red",
        });
        return;
      }

      const errorMessage = error["response"]?.data?.message;
      notifications.show({
        message: errorMessage || t("Failed to update approval settings"),
        color: "red",
      });
    },
  });
}
