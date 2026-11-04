import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { notifications } from "@mantine/notifications";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANNOUNCEMENTS_KEY,
  getAnnouncementErrorMessage,
  getAnnouncementLimitConflict,
  useArchiveAnnouncementMutation,
  useArchivedAnnouncementsQuery,
  useCreateAnnouncementMutation,
  useCurrentAnnouncementsQuery,
  useDeleteAnnouncementMutation,
  useRestoreAnnouncementMutation,
  useUpdateAnnouncementMutation,
  useVisibleAnnouncementsQuery,
} from "./announcement-query";
import * as service from "../services/announcement-service";
import type {
  AnnouncementSurface,
  IAnnouncementBanner,
} from "../types/announcement.types";

const mocks = vi.hoisted(() => ({ isCloud: vi.fn() }));

vi.mock("@/lib/config", () => ({ isCloud: mocks.isCloud }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../services/announcement-service");

const banners: IAnnouncementBanner[] = [
  {
    id: "a1",
    kind: "info",
    color: "blue",
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
    },
    isDismissible: true,
    startsAt: "2026-11-04T09:00:00.000Z",
    endsAt: null,
  },
];

const requestError = (data: unknown) =>
  Object.assign(new Error("Request failed with status code 409"), {
    response: { status: 409, data },
  });

function setup<T>(useHook: () => T) {
  // the app's defaults from main.tsx, without the retry delay
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: false,
        retryDelay: 0,
        staleTime: 5 * 60 * 1000,
      },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper, ...renderHook(useHook, { wrapper }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.isCloud.mockReturnValue(false);
});

// react-query only re-renders for the fields read during render
function useVisibleState(surface: AnnouncementSurface) {
  const { data, isError, fetchStatus, refetch } = useVisibleAnnouncementsQuery(surface);
  return { data, isError, fetchStatus, refetch };
}

describe("useVisibleAnnouncementsQuery", () => {
  it("loads the logged-in list on the app surface", async () => {
    vi.mocked(service.getVisibleAnnouncements).mockResolvedValue(banners);
    const { result } = setup(() => useVisibleState("app"));
    await waitFor(() => expect(result.current.data).toEqual(banners));
    expect(service.getPublicAnnouncements).not.toHaveBeenCalled();
  });

  it("loads the public list on the public surface", async () => {
    vi.mocked(service.getPublicAnnouncements).mockResolvedValue(banners);
    const { result } = setup(() => useVisibleState("public"));
    await waitFor(() => expect(result.current.data).toEqual(banners));
    expect(service.getVisibleAnnouncements).not.toHaveBeenCalled();
  });

  it("does not load anything on cloud", () => {
    mocks.isCloud.mockReturnValue(true);
    const { result } = setup(() => useVisibleState("app"));
    expect(result.current.fetchStatus).toBe("idle");
    expect(service.getVisibleAnnouncements).not.toHaveBeenCalled();
  });

  it("keeps the last list when a refresh fails", async () => {
    vi.mocked(service.getVisibleAnnouncements).mockResolvedValueOnce(banners);
    const { result } = setup(() => useVisibleState("app"));
    await waitFor(() => expect(result.current.data).toEqual(banners));

    vi.mocked(service.getVisibleAnnouncements).mockRejectedValue(new Error("offline"));
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toEqual(banners);
  });
});

describe("admin lists", () => {
  it.each([
    ["current", () => useCurrentAnnouncementsQuery(true), service.getCurrentAnnouncements],
    ["archived", () => useArchivedAnnouncementsQuery({ limit: 20 }, true), service.getArchivedAnnouncements],
  ])("%s list refetches on mount after an invalidation", async (_name, useHook, serviceFn) => {
    vi.mocked(serviceFn).mockResolvedValue([] as never);
    const { queryClient, wrapper, result, unmount } = setup(() => useHook());
    await waitFor(() => expect(result.current.data).toEqual([]));
    unmount();

    await queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
    renderHook(() => useHook(), { wrapper });

    await waitFor(() => expect(serviceFn).toHaveBeenCalledTimes(2));
  });

  it("does not load the archived list until enabled", () => {
    setup(() => useArchivedAnnouncementsQuery({ limit: 20 }, false));
    expect(service.getArchivedAnnouncements).not.toHaveBeenCalled();
  });
});

describe("mutations that confirm with a toast", () => {
  const rows = [
    ["archive", useArchiveAnnouncementMutation, service.archiveAnnouncement, "Announcement archived"],
    ["restore", useRestoreAnnouncementMutation, service.restoreAnnouncement, "Announcement restored"],
    ["delete", useDeleteAnnouncementMutation, service.deleteAnnouncement, "Announcement deleted"],
  ] as const;

  it.each(rows)("%s confirms and refreshes the announcements", async (_name, useHook, serviceFn, message) => {
    vi.mocked(serviceFn).mockResolvedValue(undefined);
    const { result, queryClient } = setup(() => useHook());
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.mutateAsync({ announcementId: "a1" });
    });

    expect(vi.mocked(serviceFn).mock.calls[0][0]).toEqual({ announcementId: "a1" });
    expect(notifications.show).toHaveBeenCalledWith({ message });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ANNOUNCEMENTS_KEY });
  });

  it.each(rows)("%s shows the server error in a red toast", async (_name, useHook, serviceFn) => {
    vi.mocked(serviceFn).mockRejectedValue(requestError({ message: "Announcement not found" }));
    const { result } = setup(() => useHook());

    await act(async () => {
      await result.current.mutateAsync({ announcementId: "a1" }).catch(() => undefined);
    });

    expect(notifications.show).toHaveBeenCalledWith({ message: "Announcement not found", color: "red" });
  });
});

describe("create and update", () => {
  const input = {
    kind: "info",
    color: "blue",
    content: banners[0].content,
    isDismissible: true,
    audience: "members",
    startsAt: null,
    endsAt: null,
  } as const;
  const rows = [
    ["create", useCreateAnnouncementMutation, service.createAnnouncement, input],
    ["update", useUpdateAnnouncementMutation, service.updateAnnouncement, { ...input, announcementId: "a1" }],
  ] as const;

  it.each(rows)("%s refreshes the announcements without a toast", async (_name, useHook, serviceFn, variables) => {
    vi.mocked(serviceFn).mockResolvedValue({} as never);
    const { result, queryClient } = setup(() => useHook());
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.mutateAsync(variables as never);
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ANNOUNCEMENTS_KEY });
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it.each(rows)("%s rejects with the error and leaves it to the modal", async (_name, useHook, serviceFn, variables) => {
    const error = requestError({ message: "Announcement message is required" });
    vi.mocked(serviceFn).mockRejectedValue(error);
    const { result } = setup(() => useHook());

    await act(async () => {
      await expect(result.current.mutateAsync(variables as never)).rejects.toBe(error);
    });

    expect(notifications.show).not.toHaveBeenCalled();
  });
});

describe("getAnnouncementLimitConflict", () => {
  const conflict = {
    from: "2026-11-05T09:00:00.000Z",
    to: null,
    announcements: [
      { id: "a", preview: "Maintenance tonight" },
      { id: "b", preview: "New policy" },
    ],
  };

  it("reads the conflict from the response body", () => {
    const error = requestError({ message: "Up to two announcements can show at the same time", conflict });
    expect(getAnnouncementLimitConflict(error)).toEqual(conflict);
  });

  it.each([
    ["a plain error", new Error("boom")],
    ["an error without a conflict", requestError({ message: "Bad request" })],
    ["a malformed conflict", requestError({ conflict: { from: "2026-11-05T09:00:00.000Z" } })],
    ["a non-json body", requestError("<html>Bad gateway</html>")],
    ["null", null],
    ["undefined", undefined],
  ])("returns null for %s", (_label, error) => {
    expect(getAnnouncementLimitConflict(error)).toBeNull();
  });
});

describe("getAnnouncementErrorMessage", () => {
  it("uses the server message", () => {
    expect(getAnnouncementErrorMessage(requestError({ message: "Announcement not found" }))).toBe("Announcement not found");
  });

  it("joins validation messages", () => {
    expect(getAnnouncementErrorMessage(requestError({ message: ["kind must be valid", "color must be valid"] }))).toBe("kind must be valid, color must be valid");
  });

  it("falls back to the error message", () => {
    expect(getAnnouncementErrorMessage(new Error("Network Error"))).toBe("Network Error");
  });
});
