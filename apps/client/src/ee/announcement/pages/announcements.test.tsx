import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ModalsProvider } from "@mantine/modals";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
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

const LICENSE_ALERT = "Announcements are available in the Docmost paid editions.";

const announcement: IAnnouncement = {
  id: "a1",
  title: "Maintenance window",
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

const chooseArchived = () => {
  // jsdom has no scrollIntoView, which Mantine's combobox calls
  Element.prototype.scrollIntoView = () => {};
  fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
  fireEvent.click(screen.getByRole("option", { name: "Archived" }));
};

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
    expect(
      screen
        .getAllByRole("table", { hidden: true })
        .map((table) => table.getAttribute("aria-busy")),
    ).toEqual(["true"]);
  });

  it("says only one announcement shows at a time", () => {
    renderPage();
    expect(
      screen.getByText("Show a banner at the top of every page. Only one can show at a time."),
    ).toBeTruthy();
  });

  it("asks for a license once the entitlements lack the feature, and still lists", async () => {
    vi.mocked(service.getAnnouncements).mockResolvedValue(page([]));
    renderPage([]);
    expect(screen.getByText(LICENSE_ALERT)).toBeTruthy();
    expect(newAnnouncementButton().disabled).toBe(true);
    expect(await screen.findByText("No active announcements")).toBeTruthy();
    expect(service.getAnnouncements).toHaveBeenCalledWith({ limit: 20, query: "" });
  });

  it("lets an admin without the feature archive an announcement but not edit it", async () => {
    vi.mocked(service.getAnnouncements).mockResolvedValue(page([announcement]));
    vi.mocked(service.archiveAnnouncement).mockResolvedValue({
      ...announcement,
      status: "archived",
    });
    renderPage([]);
    await screen.findByText("Maintenance window");

    fireEvent.click(
      screen.getByRole("button", { name: "Actions for Maintenance window" }),
    );
    expect(
      (await screen.findAllByRole("menuitem")).map((item) => item.textContent),
    ).toEqual(["Archive"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));

    await waitFor(() =>
      expect(vi.mocked(service.archiveAnnouncement).mock.calls[0][0]).toEqual({
        announcementId: "a1",
      }),
    );
  });

  it("shows the empty list, not an error, when the server has no announcements routes", async () => {
    vi.mocked(service.getAnnouncements).mockRejectedValue(
      Object.assign(new Error("Not Found"), { response: { status: 404 } }),
    );
    renderPage([]);
    await waitFor(() => expect(service.getAnnouncements).toHaveBeenCalled());
    expect(await screen.findByText("No active announcements")).toBeTruthy();
    expect(screen.queryByText("Failed to load announcements")).toBeNull();
  });

  it("lists the current announcements when licensed", async () => {
    vi.mocked(service.getAnnouncements).mockResolvedValue(page([announcement]));
    renderPage([Feature.ANNOUNCEMENTS]);
    expect(await screen.findByText("Maintenance window")).toBeTruthy();
    expect(service.getAnnouncements).toHaveBeenCalledTimes(1);
    expect(service.getAnnouncements).toHaveBeenCalledWith({ limit: 20, query: "" });
    expect(screen.queryByText(LICENSE_ALERT)).toBeNull();
    expect(newAnnouncementButton().disabled).toBe(false);
  });

  it("searches by what the admin types and shows the matches", async () => {
    vi.mocked(service.getAnnouncements).mockImplementation(async (params) =>
      page(params.query ? [{ ...announcement, title: "Holiday hours" }] : [announcement]),
    );
    renderPage([Feature.ANNOUNCEMENTS]);
    await screen.findByText("Maintenance window");

    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), {
      target: { value: "holiday" },
    });

    expect(await screen.findByText("Holiday hours", {}, { timeout: 3000 })).toBeTruthy();
    expect(service.getAnnouncements).toHaveBeenCalledWith({
      limit: 20,
      query: "holiday",
    });
    expect(screen.queryByText("Maintenance window")).toBeNull();
  });

  it("says nothing matched when a search finds no announcements", async () => {
    vi.mocked(service.getAnnouncements).mockImplementation(async (params) =>
      page(params.query ? [] : [announcement]),
    );
    renderPage([Feature.ANNOUNCEMENTS]);
    await screen.findByText("Maintenance window");

    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), {
      target: { value: "nothing" },
    });

    expect(
      await screen.findByText("No results found...", {}, { timeout: 3000 }),
    ).toBeTruthy();
  });

  it("says there are no active announcements for an empty list", async () => {
    vi.mocked(service.getAnnouncements).mockResolvedValue(page([]));
    renderPage([Feature.ANNOUNCEMENTS]);
    expect(await screen.findByText("No active announcements")).toBeTruthy();
  });

  it("says there are no archived announcements for an empty archived list", async () => {
    vi.mocked(service.getAnnouncements).mockResolvedValue(page([]));
    renderPage([Feature.ANNOUNCEMENTS]);
    await screen.findByText("No active announcements");

    chooseArchived();

    expect(await screen.findByText("No archived announcements")).toBeTruthy();
    expect(screen.queryByText("No active announcements")).toBeNull();
  });

  it("switches to the archived list with the status filter", async () => {
    const archivedAnnouncement: IAnnouncement = {
      ...announcement,
      id: "a2",
      title: "Old notice",
      archivedAt: "2026-11-05T09:00:00.000Z",
      status: "archived",
    };
    vi.mocked(service.getAnnouncements).mockImplementation(async (params) =>
      page(params.archived ? [archivedAnnouncement] : [announcement]),
    );
    renderPage([Feature.ANNOUNCEMENTS]);
    await screen.findByText("Maintenance window");

    chooseArchived();

    expect(await screen.findByText("Old notice")).toBeTruthy();
    expect(service.getAnnouncements).toHaveBeenCalledWith({
      archived: true,
      limit: 20,
      query: "",
    });
    expect(screen.queryByText("Maintenance window")).toBeNull();
  });

  it("keeps the search text when the filter changes", async () => {
    vi.mocked(service.getAnnouncements).mockResolvedValue(page([announcement]));
    renderPage([Feature.ANNOUNCEMENTS]);
    await screen.findByText("Maintenance window");
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), {
      target: { value: "holiday" },
    });
    await waitFor(
      () =>
        expect(service.getAnnouncements).toHaveBeenCalledWith({
          limit: 20,
          query: "holiday",
        }),
      { timeout: 3000 },
    );

    chooseArchived();

    await waitFor(() =>
      expect(service.getAnnouncements).toHaveBeenCalledWith({
        archived: true,
        limit: 20,
        query: "holiday",
      }),
    );
  });

  it("goes back to the first page when the filter changes after paging", async () => {
    vi.mocked(service.getAnnouncements).mockImplementation(async (params) =>
      params.cursor || params.archived
        ? page([announcement])
        : {
            items: [announcement],
            meta: {
              limit: 20,
              hasNextPage: true,
              hasPrevPage: false,
              nextCursor: "c2",
              prevCursor: null,
            },
          },
    );
    renderPage([Feature.ANNOUNCEMENTS]);
    await screen.findByText("Maintenance window");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(service.getAnnouncements).toHaveBeenCalledWith({
        cursor: "c2",
        limit: 20,
        query: "",
      }),
    );

    chooseArchived();

    await waitFor(() =>
      expect(service.getAnnouncements).toHaveBeenLastCalledWith({
        archived: true,
        limit: 20,
        query: "",
      }),
    );
  });

  it("says nothing matched when an archived search finds nothing", async () => {
    vi.mocked(service.getAnnouncements).mockImplementation(async (params) =>
      page(params.archived && params.query ? [] : [announcement]),
    );
    renderPage([Feature.ANNOUNCEMENTS]);
    await screen.findByText("Maintenance window");
    chooseArchived();
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), {
      target: { value: "nothing" },
    });

    expect(
      await screen.findByText("No results found...", {}, { timeout: 3000 }),
    ).toBeTruthy();
  });

  it("keeps the list when a refresh fails", async () => {
    vi.mocked(service.getAnnouncements)
      .mockResolvedValueOnce(page([announcement]))
      .mockRejectedValue(new Error("Network Error"));
    const { queryClient } = renderPage([Feature.ANNOUNCEMENTS]);
    await screen.findByText("Maintenance window");

    await act(async () => {
      await queryClient.refetchQueries();
      // react-query tells its observers on a zero timeout
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(
      queryClient.getQueryState([...ANNOUNCEMENTS_KEY, "list", { limit: 20, query: "" }])
        ?.status,
    ).toBe("error");
    expect(screen.getByText("Maintenance window")).toBeTruthy();
    expect(screen.queryByText("Failed to load announcements")).toBeNull();
  });

  it("names the announcement in the delete confirmation", async () => {
    vi.mocked(service.getAnnouncements).mockResolvedValue(
      page([{ ...announcement, status: "archived" }]),
    );
    renderPage([Feature.ANNOUNCEMENTS]);
    await screen.findByText("Maintenance window");

    fireEvent.click(
      screen.getByRole("button", { name: "Actions for Maintenance window" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));

    expect(
      await screen.findByText("“Maintenance window” will be permanently deleted."),
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
