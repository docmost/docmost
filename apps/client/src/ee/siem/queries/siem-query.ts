import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  createSiemDestination,
  deleteSiemDestination,
  getSiemDestinations,
  retrySiemDestination,
  testSiemDestination,
  updateSiemDestination,
} from "@/ee/siem/services/siem-service";
import {
  ISiemDestination,
  ISiemDestinationInput,
  ISiemTestResult,
  ITestSiemDestinationInput,
  IUpdateSiemDestinationInput,
} from "@/ee/siem/types/siem.types";

export const SIEM_DESTINATIONS_KEY = ["siem-destinations"];

export function extractErrorMessage(error: Error): string {
  const data = (error as any)?.response?.data;
  const message = data?.message ?? error.message;
  return Array.isArray(message) ? message.join(", ") : String(message);
}

function showError(error: Error) {
  notifications.show({ message: extractErrorMessage(error), color: "red" });
}

function isForbidden(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 403;
}

export function useSiemDestinationsQuery(
  enabled = true,
): UseQueryResult<ISiemDestination[], Error> {
  return useQuery({
    queryKey: SIEM_DESTINATIONS_KEY,
    queryFn: getSiemDestinations,
    enabled,
    retry: (failureCount, error) => !isForbidden(error) && failureCount < 2,
    refetchInterval: (query) => (query.state.status === "error" ? false : 15_000),
  });
}

function useInvalidateDestinations() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: SIEM_DESTINATIONS_KEY });
}

export function useCreateSiemDestinationMutation() {
  const { t } = useTranslation();
  const invalidate = useInvalidateDestinations();
  return useMutation<ISiemDestination, Error, ISiemDestinationInput>({
    mutationFn: createSiemDestination,
    onSuccess: () => {
      notifications.show({ message: t("Destination created") });
      invalidate();
    },
    onError: showError,
  });
}

export function useUpdateSiemDestinationMutation() {
  const { t } = useTranslation();
  const invalidate = useInvalidateDestinations();
  return useMutation<ISiemDestination, Error, IUpdateSiemDestinationInput>({
    mutationFn: updateSiemDestination,
    onSuccess: () => {
      notifications.show({ message: t("Destination updated") });
      invalidate();
    },
    onError: showError,
  });
}

export function useDeleteSiemDestinationMutation() {
  const { t } = useTranslation();
  const invalidate = useInvalidateDestinations();
  return useMutation<void, Error, { destinationId: string }>({
    mutationFn: deleteSiemDestination,
    onSuccess: () => {
      notifications.show({ message: t("Destination deleted") });
      invalidate();
    },
    onError: showError,
  });
}

export function useRetrySiemDestinationMutation() {
  const { t } = useTranslation();
  const invalidate = useInvalidateDestinations();
  return useMutation<void, Error, { destinationId: string }>({
    mutationFn: retrySiemDestination,
    onSuccess: () => {
      notifications.show({ message: t("Retry scheduled") });
      invalidate();
    },
    onError: showError,
  });
}

export function useTestSiemDestinationMutation() {
  return useMutation<ISiemTestResult, Error, ITestSiemDestinationInput>({
    mutationFn: testSiemDestination,
    onError: showError,
  });
}
