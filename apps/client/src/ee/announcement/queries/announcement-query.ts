import { createElement } from "react";
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
import { AnnouncementConflictSummary } from "@/ee/announcement/components/announcement-conflict-summary";
import {
  archiveAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  getPublicAnnouncements,
  getVisibleAnnouncements,
  unarchiveAnnouncement,
  updateAnnouncement,
} from "@/ee/announcement/services/announcement-service";
import {
  AnnouncementSurface,
  IAnnouncement,
  IAnnouncementBanner,
  IAnnouncementIdInput,
  IAnnouncementInput,
  IAnnouncementLimitConflict,
  IAnnouncementListParams,
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

// The admin list refetches on mount: the app default (false) would keep an invalidated list stale
export function useAnnouncementsQuery(
  params: IAnnouncementListParams,
  enabled: boolean,
): UseQueryResult<IPagination<IAnnouncement>, Error> {
  return useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, "list", params],
    queryFn: () => getAnnouncements(params),
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

export function useUnarchiveAnnouncementMutation() {
  const { t } = useTranslation();
  const invalidate = useInvalidateAnnouncements();
  return useMutation<IAnnouncement, Error, IAnnouncementIdInput>({
    mutationFn: unarchiveAnnouncement,
    onSuccess: () => {
      notifications.show({ message: t("Announcement unarchived") });
      invalidate();
    },
    onError: (error) => {
      const conflict = getAnnouncementLimitConflict(error);
      if (!conflict) {
        showError(error);
        return;
      }
      notifications.show({
        color: "red",
        title: t("Up to two announcements can show at the same time."),
        message: createElement(AnnouncementConflictSummary, { conflict }),
        autoClose: 10_000,
      });
    },
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
