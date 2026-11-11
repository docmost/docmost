import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { AxiosError } from "axios";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import { notifications } from "@mantine/notifications";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { Feature } from "@/ee/features";
import {
  ANNOUNCEMENTS_KEY,
  getAnnouncementLimitConflict,
  getAnnouncementReplacement,
  useAnnouncementsQuery,
  useArchiveAnnouncementMutation,
  useCreateAnnouncementMutation,
  useDeleteAnnouncementMutation,
  useUnarchiveAnnouncementMutation,
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
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
    i18n: { language: "en-US" },
  }),
}));
vi.mock("../services/announcement-service");

const banners: IAnnouncementBanner[] = [
  {
    id: "a1",
    type: "info",
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

const requestError = (data: unknown, status = 409) =>
  new AxiosError(
    `Request failed with status code ${status}`,
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    { status, data, statusText: "", headers: {}, config: {} as never },
  );

// the server answers with its clock beside the list
const visible = (now = new Date().toISOString()) => ({ now, items: banners });

const enterprise = (features: string[]) => ({
  cloud: false,
  tier: "enterprise" as const,
  features,
});

// features: the workspace entitlements; leave undefined for "not loaded yet"
function setup<T>(useHook: () => T, features?: string[]) {
  const store = createStore();
  if (features) {
    store.set(entitlementAtom, enterprise(features));
  }
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
    <JotaiProvider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </JotaiProvider>
  );
  return { store, queryClient, wrapper, ...renderHook(useHook, { wrapper }) };
}

afterEach(() => vi.useRealTimers());

beforeEach(() => {
  vi.resetAllMocks();
  mocks.isCloud.mockReturnValue(false);
  // the entitlement atom persists to localStorage and would rehydrate on mount
  localStorage.clear();
});

// react-query only re-renders for the fields read during render
const flush = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));

function useVisibleState(surface: AnnouncementSurface) {
  const { data, isError, fetchStatus, refetch } = useVisibleAnnouncementsQuery(surface);
  return { data, isError, fetchStatus, refetch };
}

describe("useVisibleAnnouncementsQuery", () => {
  it("loads the logged-in list on the app surface", async () => {
    vi.mocked(service.getVisibleAnnouncements).mockResolvedValue(visible());
    const { result } = setup(() => useVisibleState("app"), [Feature.ANNOUNCEMENTS]);
    await waitFor(() => expect(result.current.data?.items).toEqual(banners));
    expect(service.getPublicAnnouncements).not.toHaveBeenCalled();
  });

  it("does not ask for the logged-in list when the workspace lacks the feature", () => {
    const { result } = setup(() => useVisibleState("app"), []);
    expect(result.current.fetchStatus).toBe("idle");
    expect(service.getVisibleAnnouncements).not.toHaveBeenCalled();
  });

  it("starts asking for the logged-in list once the entitlements load", async () => {
    vi.mocked(service.getVisibleAnnouncements).mockResolvedValue(visible());
    const { result, store } = setup(() => useVisibleState("app"));
    expect(service.getVisibleAnnouncements).not.toHaveBeenCalled();

    act(() => {
      store.set(entitlementAtom, enterprise([Feature.ANNOUNCEMENTS]));
    });

    await waitFor(() => expect(result.current.data?.items).toEqual(banners));
  });

  it("loads the public list on the public surface without any entitlement", async () => {
    vi.mocked(service.getPublicAnnouncements).mockResolvedValue(visible());
    const { result } = setup(() => useVisibleState("public"));
    await waitFor(() => expect(result.current.data?.items).toEqual(banners));
    expect(service.getVisibleAnnouncements).not.toHaveBeenCalled();
  });

  it.each(["app", "public"] as const)("loads on cloud too (%s surface)", async (surface) => {
    mocks.isCloud.mockReturnValue(true);
    vi.mocked(service.getVisibleAnnouncements).mockResolvedValue(visible());
    vi.mocked(service.getPublicAnnouncements).mockResolvedValue(visible());
    const { result } = setup(() => useVisibleState(surface), [Feature.ANNOUNCEMENTS]);
    await waitFor(() => expect(result.current.data?.items).toEqual(banners));
  });

  it("keeps the last list when a refresh fails", async () => {
    vi.mocked(service.getVisibleAnnouncements).mockResolvedValueOnce(visible());
    const { result } = setup(() => useVisibleState("app"), [Feature.ANNOUNCEMENTS]);
    await waitFor(() => expect(result.current.data?.items).toEqual(banners));

    vi.mocked(service.getVisibleAnnouncements).mockRejectedValue(new Error("offline"));
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data?.items).toEqual(banners);
  });

  it("does not retry a 404, because the server has no announcements routes", async () => {
    vi.mocked(service.getPublicAnnouncements).mockRejectedValue(requestError({ message: "Not Found" }, 404));
    const { result } = setup(() => useVisibleState("public"));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(service.getPublicAnnouncements).toHaveBeenCalledTimes(1);
  });

  it("retries any other error once", async () => {
    vi.mocked(service.getPublicAnnouncements).mockRejectedValue(requestError({ message: "Bad Gateway" }, 502));
    const { result } = setup(() => useVisibleState("public"));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(service.getPublicAnnouncements).toHaveBeenCalledTimes(2);
  });

  it("measures the server clock against the local one when the response arrives", async () => {
    const localNow = new Date("2026-11-05T10:00:00.000Z");
    vi.useFakeTimers({ now: localNow });
    vi.mocked(service.getPublicAnnouncements).mockResolvedValue(visible("2026-11-05T10:02:00.000Z"));
    const { result } = setup(() => useVisibleState("public"));
    await flush();
    expect(result.current.data?.offsetMs).toBe(120_000);
  });

  describe("refreshing", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      focusManager.setFocused(undefined);
    });

    it("refetches every 5 minutes", async () => {
      vi.mocked(service.getPublicAnnouncements).mockResolvedValue(visible());
      setup(() => useVisibleState("public"));
      await flush();
      expect(service.getPublicAnnouncements).toHaveBeenCalledTimes(1);

      await flush(299_000);
      expect(service.getPublicAnnouncements).toHaveBeenCalledTimes(1);

      await flush(1_000);
      expect(service.getPublicAnnouncements).toHaveBeenCalledTimes(2);
    });

    it("stops refetching after a 404", async () => {
      vi.mocked(service.getPublicAnnouncements).mockResolvedValueOnce(visible());
      const { result } = setup(() => useVisibleState("public"));
      await flush();

      vi.mocked(service.getPublicAnnouncements).mockRejectedValue(requestError({ message: "Not Found" }, 404));
      await flush(300_000);
      await flush(1);
      expect(result.current.isError).toBe(true);
      expect(service.getPublicAnnouncements).toHaveBeenCalledTimes(2);

      await flush(1_800_000);
      expect(service.getPublicAnnouncements).toHaveBeenCalledTimes(2);
    });

    it("keeps polling every 5 minutes after a non-404 error", async () => {
      vi.mocked(service.getPublicAnnouncements).mockRejectedValue(requestError({ message: "Server error" }, 500));
      setup(() => useVisibleState("public"));
      await flush();
      await flush(1);
      const initial = vi.mocked(service.getPublicAnnouncements).mock.calls.length;

      await flush(300_000);
      expect(vi.mocked(service.getPublicAnnouncements).mock.calls.length).toBeGreaterThan(initial);
    });

    it("refetches on window focus once the list is a minute old, not before", async () => {
      vi.mocked(service.getPublicAnnouncements).mockResolvedValue(visible());
      setup(() => useVisibleState("public"));
      await flush();

      await flush(30_000);
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await flush();
      expect(service.getPublicAnnouncements).toHaveBeenCalledTimes(1);

      await flush(31_000);
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await flush();
      expect(service.getPublicAnnouncements).toHaveBeenCalledTimes(2);
    });
  });

  it("refetches an invalidated list when a banner area mounts again", async () => {
    vi.mocked(service.getPublicAnnouncements).mockResolvedValue(visible());
    const { queryClient, wrapper, result, unmount } = setup(() => useVisibleState("public"));
    await waitFor(() => expect(result.current.data?.items).toEqual(banners));
    unmount();

    await queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
    renderHook(() => useVisibleState("public"), { wrapper });

    await waitFor(() => expect(service.getPublicAnnouncements).toHaveBeenCalledTimes(2));
  });
});

describe("admin lists", () => {
  const emptyPage = {
    items: [],
    meta: { limit: 20, hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null },
  };

  it.each([
    ["unfiltered", { limit: 20 }],
    ["searched", { limit: 20, query: "holiday" }],
  ])("%s list asks for its params and refetches on mount after an invalidation", async (_name, params) => {
    vi.mocked(service.getAnnouncements).mockResolvedValue(emptyPage);
    const { queryClient, wrapper, result, unmount } = setup(() => useAnnouncementsQuery(params, true));
    await waitFor(() => expect(result.current.data).toEqual(emptyPage));
    expect(service.getAnnouncements).toHaveBeenCalledWith(params);
    unmount();

    await queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
    renderHook(() => useAnnouncementsQuery(params, true), { wrapper });

    await waitFor(() => expect(service.getAnnouncements).toHaveBeenCalledTimes(2));
  });

  it("does not load a list until enabled", () => {
    setup(() => useAnnouncementsQuery({ limit: 20 }, false));
    expect(service.getAnnouncements).not.toHaveBeenCalled();
  });
});

describe("mutations that confirm with a toast", () => {
  const rows = [
    ["archive", useArchiveAnnouncementMutation, service.archiveAnnouncement, "Announcement archived", "Failed to archive announcement"],
    ["unarchive", useUnarchiveAnnouncementMutation, service.unarchiveAnnouncement, "Announcement unarchived", "Failed to unarchive announcement"],
    ["delete", useDeleteAnnouncementMutation, service.deleteAnnouncement, "Announcement deleted", "Failed to delete announcement"],
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

  it.each(rows)("%s falls back to a translated message when the error has none", async (_name, useHook, serviceFn, _message, fallback) => {
    vi.mocked(serviceFn).mockRejectedValue(new Error("Network Error"));
    const { result } = setup(() => useHook());

    await act(async () => {
      await result.current.mutateAsync({ announcementId: "a1" }).catch(() => undefined);
    });

    expect(notifications.show).toHaveBeenCalledWith({ message: fallback, color: "red" });
  });
});

describe("unarchiving into a full schedule", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shows the clashing announcements and time in the error toast", async () => {
    vi.mocked(service.unarchiveAnnouncement).mockRejectedValue(
      requestError({
        message: "Only one announcement can show at a time",
        conflict: {
          from: "2026-11-05T09:00:00.000Z",
          to: "2026-11-05T18:00:00.000Z",
          announcements: [
            { id: "b", title: "Acceptable use policy" },
          ],
        },
      }),
    );
    const { result } = setup(() => useUnarchiveAnnouncementMutation());

    await act(async () => {
      await result.current.mutateAsync({ announcementId: "a1" }).catch(() => undefined);
    });

    const { message, ...toast } = vi.mocked(notifications.show).mock.calls[0][0];
    expect(toast).toEqual({
      color: "red",
      title: "Only one announcement can show at a time.",
      autoClose: 10_000,
    });
    render(<MantineProvider env="test">{message}</MantineProvider>);
    expect(screen.getByText("Acceptable use policy")).toBeTruthy();
  });
});

describe("create and update", () => {
  const input = {
    type: "info",
    color: "blue",
    content: banners[0].content,
    isDismissible: true,
    audience: "members",
    startsAt: null,
    endsAt: null,
  } as const;
  const rows = [
    ["create", useCreateAnnouncementMutation, service.createAnnouncement, input, "Announcement created"],
    ["update", useUpdateAnnouncementMutation, service.updateAnnouncement, { ...input, announcementId: "a1" }, "Announcement updated"],
  ] as const;

  it.each(rows)("%s confirms and refreshes the announcements", async (_name, useHook, serviceFn, variables, message) => {
    vi.mocked(serviceFn).mockResolvedValue({} as never);
    const { result, queryClient } = setup(() => useHook());
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.mutateAsync(variables as never);
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ANNOUNCEMENTS_KEY });
    expect(notifications.show).toHaveBeenCalledWith({ message });
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
      { id: "a", title: "Maintenance tonight" },
    ],
  };

  it("reads the conflict from the response body", () => {
    const error = requestError({ message: "Only one announcement can show at a time", conflict });
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

describe("getAnnouncementReplacement", () => {
  const takeover = { id: "a", title: "Maintenance tonight", at: "2026-11-05T09:00:00.000Z" };

  it("reads both lists from the response body", () => {
    const error = requestError({
      message: "This replaces another announcement",
      replaces: [takeover],
      replacedBy: [],
    });
    expect(getAnnouncementReplacement(error)).toEqual({
      replaces: [takeover],
      replacedBy: [],
    });
  });

  it("fills a missing list with an empty one", () => {
    const error = requestError({ replacedBy: [takeover] });
    expect(getAnnouncementReplacement(error)).toEqual({
      replaces: [],
      replacedBy: [takeover],
    });
  });

  it.each([
    ["a limit conflict", requestError({ conflict: { from: "x", to: null, announcements: [] } })],
    ["a plain error", new Error("boom")],
    ["a non-json body", requestError("<html>Bad gateway</html>")],
    ["null", null],
  ])("returns null for %s", (_label, error) => {
    expect(getAnnouncementReplacement(error)).toBeNull();
  });
});
