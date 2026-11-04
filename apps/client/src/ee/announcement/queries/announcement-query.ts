import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { isCloud } from "@/lib/config.ts";
import { IPagination } from "@/lib/types";
import { Feature } from "@/ee/features";
import { useHasFeature } from "@/ee/hooks/use-feature";
import {
  archiveAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  getArchivedAnnouncements,
  getCurrentAnnouncements,
  getPublicAnnouncements,
  getVisibleAnnouncements,
  restoreAnnouncement,
  updateAnnouncement,
} from "@/ee/announcement/services/announcement-service";
import {
  AnnouncementSurface,
  IAnnouncement,
  IAnnouncementArchivedParams,
  IAnnouncementBanner,
  IAnnouncementIdInput,
  IAnnouncementInput,
  IAnnouncementLimitConflict,
  IUpdateAnnouncementInput,
} from "@/ee/announcement/types/announcement.types";

export const ANNOUNCEMENTS_KEY = ["announcements"];

type ErrorResponseData = {
  message?: string | string[];
  conflict?: IAnnouncementLimitConflict;
};

function getErrorResponseData(error: unknown): ErrorResponseData | undefined {
  return (error as { response?: { data?: ErrorResponseData } } | null)
    ?.response?.data;
}

export function getAnnouncementErrorMessage(error: unknown): string {
  const message =
    getErrorResponseData(error)?.message ??
    (error as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) {
    return message.join(", ");
  }
  return message == null ? "" : String(message);
}

export function getAnnouncementLimitConflict(
  error: unknown,
): IAnnouncementLimitConflict | null {
  const conflict = getErrorResponseData(error)?.conflict;
  return Array.isArray(conflict?.announcements) ? conflict : null;
}

function showError(error: Error) {
  notifications.show({
    message: getAnnouncementErrorMessage(error),
    color: "red",
  });
}

// A 404 means the server has no announcements routes (no ee module), so neither retry nor poll
function isNotFound(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}

function useInvalidateAnnouncements() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
}

// Both admin lists refetch on mount: the app default (false) would keep an invalidated list stale
export function useCurrentAnnouncementsQuery(
  enabled: boolean,
): UseQueryResult<IAnnouncement[], Error> {
  return useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, "current"],
    queryFn: getCurrentAnnouncements,
    enabled,
    refetchOnMount: "always",
  });
}

export function useArchivedAnnouncementsQuery(
  params: IAnnouncementArchivedParams,
  enabled: boolean,
): UseQueryResult<IPagination<IAnnouncement>, Error> {
  return useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, "archived", params],
    queryFn: () => getArchivedAnnouncements(params),
    enabled,
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });
}

export function useVisibleAnnouncementsQuery(
  surface: AnnouncementSurface,
): UseQueryResult<IAnnouncementBanner[], Error> {
  const hasFeature = useHasFeature(Feature.ANNOUNCEMENTS);
  return useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, "visible", surface],
    queryFn:
      surface === "app" ? getVisibleAnnouncements : getPublicAnnouncements,
    enabled: !isCloud() && (surface === "public" || hasFeature),
    staleTime: 60_000,
    refetchInterval: (query) =>
      isNotFound(query.state.error) ? false : 300_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 1,
  });
}

export function useCreateAnnouncementMutation() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation<IAnnouncement, Error, IAnnouncementInput>({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useUpdateAnnouncementMutation() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation<IAnnouncement, Error, IUpdateAnnouncementInput>({
    mutationFn: updateAnnouncement,
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useArchiveAnnouncementMutation() {
  const { t } = useTranslation();
  const invalidate = useInvalidateAnnouncements();
  return useMutation<IAnnouncement, Error, IAnnouncementIdInput>({
    mutationFn: archiveAnnouncement,
    onSuccess: () => {
      notifications.show({ message: t("Announcement archived") });
      invalidate();
    },
    onError: showError,
  });
}

export function useRestoreAnnouncementMutation() {
  const { t } = useTranslation();
  const invalidate = useInvalidateAnnouncements();
  return useMutation<IAnnouncement, Error, IAnnouncementIdInput>({
    mutationFn: restoreAnnouncement,
    onSuccess: () => {
      notifications.show({ message: t("Announcement restored") });
      invalidate();
    },
    onError: showError,
  });
}

export function useDeleteAnnouncementMutation() {
  const { t } = useTranslation();
  const invalidate = useInvalidateAnnouncements();
  return useMutation<void, Error, IAnnouncementIdInput>({
    mutationFn: deleteAnnouncement,
    onSuccess: () => {
      notifications.show({ message: t("Announcement deleted") });
      invalidate();
    },
    onError: showError,
  });
}
