import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ModalsProvider } from "@mantine/modals";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Announcements from "./announcements";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { Feature } from "@/ee/features";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import type { ICurrentUser } from "@/features/user/types/user.types";
import { ANNOUNCEMENTS_KEY } from "../queries/announcement-query";
import * as service from "../services/announcement-service";
import type { IAnnouncement } from "../types/announcement.types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("../services/announcement-service");

const LICENSE_ALERT = "Announcements require an Enterprise license.";

const announcement: IAnnouncement = {
  id: "a1",
  type: "info",
  color: "blue",
  content: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Planned maintenance" }] },
    ],
  },
  isDismissible: false,
  audience: "members",
  startsAt: "2026-11-04T09:00:00.000Z",
  endsAt: null,
  archivedAt: null,
  status: "active",
  createdAt: "2026-11-03T09:00:00.000Z",
  updatedAt: "2026-11-03T09:00:00.000Z",
};

const page = (items: IAnnouncement[]) => ({
  items,
  meta: { limit: 20, hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null },
});

// features: the loaded entitlements; leave undefined for "not loaded yet"
function renderPage(features?: string[]) {
  const store = createStore();
  store.set(currentUserAtom, {
    user: { role: "admin" },
    workspace: {},
  } as unknown as ICurrentUser);
  if (features) {
    store.set(entitlementAtom, { cloud: false, tier: "enterprise", features });
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <JotaiProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider env="test">
          <HelmetProvider>
            <ModalsProvider>
              <MemoryRouter>
                <Announcements />
              </MemoryRouter>
            </ModalsProvider>
          </HelmetProvider>
        </MantineProvider>
      </QueryClientProvider>
    </JotaiProvider>,
  );
  return { queryClient };
}

const newAnnouncementButton = () =>
  screen.getByRole("button", { name: "New announcement" }) as HTMLButtonElement;

beforeEach(() => {
  vi.resetAllMocks();
  // both atoms persist to localStorage and would rehydrate on mount
  localStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Announcements page", () => {
  it("does not call the license missing before the entitlements load", () => {
    renderPage();
    expect(screen.queryByText(LICENSE_ALERT)).toBeNull();
    expect(newAnnouncementButton().disabled).toBe(false);
  });

  it("shows skeleton rows, not an empty list, while the entitlements load", () => {
    renderPage();
    expect(screen.queryByText("No active announcements")).toBeNull();
    expect(screen.queryByText("No archived announcements")).toBeNull();
    expect(
      screen
        .getAllByRole("table", { hidden: true })
        .map((table) => table.getAttribute("aria-busy")),
    ).toEqual(["true"]);
  });

  it("asks for a license once the entitlements lack the feature", () => {
    renderPage([]);
    expect(screen.getByText(LICENSE_ALERT)).toBeTruthy();
    expect(newAnnouncementButton().disabled).toBe(true);
  });

  it("lists the current announcements when licensed", async () => {
    vi.mocked(service.getAnnouncements).mockResolvedValue(page([announcement]));
    renderPage([Feature.ANNOUNCEMENTS]);
    expect(await screen.findByText("Planned maintenance")).toBeTruthy();
    expect(service.getAnnouncements).toHaveBeenCalledTimes(1);
    expect(service.getAnnouncements).toHaveBeenCalledWith({ limit: 20 });
    expect(screen.queryByText(LICENSE_ALERT)).toBeNull();
    expect(newAnnouncementButton().disabled).toBe(false);
  });

  it("switches to the archived list with the status filter", async () => {
    // jsdom has no scrollIntoView, which Mantine's combobox calls
    Element.prototype.scrollIntoView = () => {};
    const archivedAnnouncement: IAnnouncement = {
      ...announcement,
      id: "a2",
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Old notice" }] },
        ],
      },
      archivedAt: "2026-11-05T09:00:00.000Z",
      status: "archived",
    };
    vi.mocked(service.getAnnouncements).mockImplementation(async (params) =>
      page(params.archived ? [archivedAnnouncement] : [announcement]),
    );
    renderPage([Feature.ANNOUNCEMENTS]);
    await screen.findByText("Planned maintenance");

    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    fireEvent.click(screen.getByRole("option", { name: "Archived" }));

    expect(await screen.findByText("Old notice")).toBeTruthy();
    expect(service.getAnnouncements).toHaveBeenCalledWith({
      archived: true,
      limit: 20,
    });
    expect(screen.queryByText("Planned maintenance")).toBeNull();
  });

  it("keeps the list when a refresh fails", async () => {
    vi.mocked(service.getAnnouncements)
      .mockResolvedValueOnce(page([announcement]))
      .mockRejectedValue(new Error("Network Error"));
    const { queryClient } = renderPage([Feature.ANNOUNCEMENTS]);
    await screen.findByText("Planned maintenance");

    await act(async () => {
      await queryClient.refetchQueries();
      // react-query tells its observers on a zero timeout
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(
      queryClient.getQueryState([...ANNOUNCEMENTS_KEY, "list", { limit: 20 }])
        ?.status,
    ).toBe("error");
    expect(screen.getByText("Planned maintenance")).toBeTruthy();
    expect(screen.queryByText("Failed to load announcements")).toBeNull();
  });

  it("names the announcement in the delete confirmation", async () => {
    vi.mocked(service.getAnnouncements).mockResolvedValue(
      page([{ ...announcement, status: "ended" }]),
    );
    renderPage([Feature.ANNOUNCEMENTS]);
    await screen.findByText("Planned maintenance");

    fireEvent.click(
      screen.getByRole("button", { name: "Actions for Planned maintenance" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));

    expect(
      await screen.findByText("“Planned maintenance” will be permanently deleted."),
    ).toBeTruthy();
  });

  it("explains a list that failed to load", async () => {
    vi.mocked(service.getAnnouncements).mockRejectedValue(
      new Error("Network Error"),
    );
    renderPage([Feature.ANNOUNCEMENTS]);
    expect(
      await screen.findByText("Failed to load announcements"),
    ).toBeTruthy();
  });
});
