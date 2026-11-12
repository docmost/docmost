import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api-error";
import { IPagination } from "@/lib/types";
import {
  createLegalHold,
  createLegalHoldExport,
  getLegalHold,
  getLegalHoldExports,
  getLegalHolds,
  getLegalHoldStats,
  getPreservedItem,
  getPreservedItems,
  releaseLegalHold,
  searchLegalHoldSpaces,
  searchLegalHoldUsers,
  updateLegalHold,
} from "@/ee/legal-hold/services/legal-hold-service";
import {
  CreateLegalHoldInput,
  LegalHoldDetail,
  LegalHoldExportView,
  LegalHoldIdInput,
  LegalHoldListItem,
  LegalHoldListParams,
  LegalHoldSearchParams,
  LegalHoldSpaceView,
  LegalHoldStats,
  LegalHoldUserView,
  PreservedItemDetail,
  PreservedItemListParams,
  PreservedItemView,
  UpdateLegalHoldInput,
} from "@/ee/legal-hold/types/legal-hold.types";

export const LEGAL_HOLDS_KEY = ["legal-holds"];

// A 404 means the server has no legal hold routes (no ee module)
export function isNotFound(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}

function useInvalidateLegalHolds() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: LEGAL_HOLDS_KEY });
}

// These views refetch on mount: the app default (false) would keep an invalidated list stale
export function useLegalHoldsQuery(
  params: LegalHoldListParams,
  enabled: boolean,
): UseQueryResult<IPagination<LegalHoldListItem>, Error> {
  return useQuery({
    queryKey: [...LEGAL_HOLDS_KEY, "list", params],
    queryFn: () => getLegalHolds(params),
    enabled,
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });
}

export function useLegalHoldQuery(
  legalHoldId: string | null | undefined,
): UseQueryResult<LegalHoldDetail, Error> {
  return useQuery({
    queryKey: [...LEGAL_HOLDS_KEY, "info", legalHoldId],
    queryFn: () => getLegalHold({ legalHoldId }),
    enabled: !!legalHoldId,
    refetchOnMount: "always",
  });
}

export function useLegalHoldStatsQuery(
  legalHoldId: string | null | undefined,
): UseQueryResult<LegalHoldStats, Error> {
  return useQuery({
    queryKey: [...LEGAL_HOLDS_KEY, "stats", legalHoldId],
    queryFn: () => getLegalHoldStats({ legalHoldId }),
    enabled: !!legalHoldId,
    refetchOnMount: "always",
  });
}

export function usePreservedItemsQuery(
  params: PreservedItemListParams,
): UseQueryResult<IPagination<PreservedItemView>, Error> {
  return useQuery({
    queryKey: [...LEGAL_HOLDS_KEY, "items", params],
    queryFn: () => getPreservedItems(params),
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });
}

export function usePreservedItemQuery(
  legalHoldId: string,
  itemId: string | null,
): UseQueryResult<PreservedItemDetail, Error> {
  return useQuery({
    queryKey: [...LEGAL_HOLDS_KEY, "item", legalHoldId, itemId],
    queryFn: () => getPreservedItem({ legalHoldId, itemId }),
    enabled: !!itemId,
  });
}

export function useLegalHoldExportsQuery(
  legalHoldId: string,
): UseQueryResult<LegalHoldExportView[], Error> {
  return useQuery({
    queryKey: [...LEGAL_HOLDS_KEY, "exports", legalHoldId],
    queryFn: () => getLegalHoldExports({ legalHoldId }),
    refetchOnMount: "always",
    refetchInterval: (query) =>
      query.state.data?.some((item) => item.status === "processing")
        ? 3_000
        : false,
  });
}

export function useLegalHoldUsersQuery(
  params: LegalHoldSearchParams,
): UseQueryResult<IPagination<LegalHoldUserView>, Error> {
  return useQuery({
    queryKey: [...LEGAL_HOLDS_KEY, "users", params],
    queryFn: () => searchLegalHoldUsers(params),
    placeholderData: keepPreviousData,
  });
}

export function useLegalHoldSpacesQuery(
  params: LegalHoldSearchParams,
): UseQueryResult<IPagination<LegalHoldSpaceView>, Error> {
  return useQuery({
    queryKey: [...LEGAL_HOLDS_KEY, "spaces", params],
    queryFn: () => searchLegalHoldSpaces(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateLegalHoldMutation() {
  const { t } = useTranslation();
  const invalidate = useInvalidateLegalHolds();
  return useMutation<LegalHoldDetail, Error, CreateLegalHoldInput>({
    mutationFn: createLegalHold,
    onSuccess: () => {
      notifications.show({ message: t("Legal hold created") });
      invalidate();
    },
  });
}

export function useUpdateLegalHoldMutation() {
  const { t } = useTranslation();
  const invalidate = useInvalidateLegalHolds();
  return useMutation<LegalHoldDetail, Error, UpdateLegalHoldInput>({
    mutationFn: updateLegalHold,
    onSuccess: () => {
      notifications.show({ message: t("Legal hold updated") });
      invalidate();
    },
  });
}

export function useReleaseLegalHoldMutation() {
  const { t } = useTranslation();
  const invalidate = useInvalidateLegalHolds();
  return useMutation<LegalHoldDetail, Error, LegalHoldIdInput>({
    mutationFn: releaseLegalHold,
    onSuccess: () => {
      notifications.show({ message: t("Legal hold released") });
      invalidate();
    },
    onError: (error) =>
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to release legal hold")),
        color: "red",
      }),
  });
}

export function useCreateLegalHoldExportMutation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation<LegalHoldExportView, Error, LegalHoldIdInput>({
    mutationFn: createLegalHoldExport,
    onSuccess: (_data, { legalHoldId }) => {
      notifications.show({ message: t("Export started") });
      queryClient.invalidateQueries({
        queryKey: [...LEGAL_HOLDS_KEY, "exports", legalHoldId],
      });
    },
    onError: (error) =>
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to start export")),
        color: "red",
      }),
  });
}
