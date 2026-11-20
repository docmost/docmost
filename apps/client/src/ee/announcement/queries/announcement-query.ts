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
import { getApiErrorMessage } from "@/lib/api-error";
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
  IVisibleBanners,
  IAnnouncementIdInput,
  IAnnouncementInput,
  IAnnouncementLimitConflict,
  IAnnouncementListParams,
  IAnnouncementReplacement,
  IUpdateAnnouncementInput,
} from "@/ee/announcement/types/announcement.types";

export const ANNOUNCEMENTS_KEY = ["announcements"];

type ErrorResponseData = {
  conflict?: IAnnouncementLimitConflict;
  replaces?: IAnnouncementReplacement["replaces"];
  replacedBy?: IAnnouncementReplacement["replacedBy"];
};

function getErrorResponseData(error: unknown): ErrorResponseData | undefined {
  return (error as { response?: { data?: ErrorResponseData } } | null)
    ?.response?.data;
}

export function getAnnouncementLimitConflict(
  error: unknown,
): IAnnouncementLimitConflict | null {
  const conflict = getErrorResponseData(error)?.conflict;
  return Array.isArray(conflict?.announcements) ? conflict : null;
}

export function getAnnouncementReplacement(
  error: unknown,
): IAnnouncementReplacement | null {
  const { replaces, replacedBy } = getErrorResponseData(error) ?? {};
  if (!Array.isArray(replaces) && !Array.isArray(replacedBy)) {
    return null;
  }
  return {
    replaces: Array.isArray(replaces) ? replaces : [],
    replacedBy: Array.isArray(replacedBy) ? replacedBy : [],
  };
}

// A 404 means the server has no announcements routes (no ee module)
export function isNotFound(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}

function showError(error: Error, fallback: string) {
  notifications.show({
    message: getApiErrorMessage(error, fallback),
    color: "red",
  });
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
): UseQueryResult<IVisibleBanners, Error> {
  const hasFeature = useHasFeature(Feature.ANNOUNCEMENTS);
  return useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, "visible", surface],
    queryFn: async () => {
      const { now, items } = await (surface === "app"
        ? getVisibleAnnouncements()
        : getPublicAnnouncements());
      return { items, offsetMs: Date.parse(now) - Date.now() };
    },
    enabled: surface === "public" || hasFeature,
    staleTime: 60_000,
    // The app default (false) would keep an invalidated list until the next poll
    refetchOnMount: true,
    refetchInterval: (query) =>
      isNotFound(query.state.error) ? false : 300_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 1,
  });
}

export function useCreateAnnouncementMutation() {
  const { t } = useTranslation();
  const invalidate = useInvalidateAnnouncements();
  return useMutation<IAnnouncement, Error, IAnnouncementInput>({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      notifications.show({ message: t("Announcement created") });
      invalidate();
    },
  });
}

export function useUpdateAnnouncementMutation() {
  const { t } = useTranslation();
  const invalidate = useInvalidateAnnouncements();
  return useMutation<IAnnouncement, Error, IUpdateAnnouncementInput>({
    mutationFn: updateAnnouncement,
    onSuccess: () => {
      notifications.show({ message: t("Announcement updated") });
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
    onError: (error) => showError(error, t("Failed to archive announcement")),
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
        showError(error, t("Failed to unarchive announcement"));
        return;
      }
      notifications.show({
        color: "red",
        title: t("Only one announcement can show at a time."),
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
    onError: (error) => showError(error, t("Failed to delete announcement")),
  });
}
