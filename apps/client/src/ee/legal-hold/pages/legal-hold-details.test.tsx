import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LegalHoldDetails from "./legal-hold-details";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import type { ICurrentUser } from "@/features/user/types/user.types";
import * as service from "../services/legal-hold-service";
import type {
  LegalHoldDetail,
  LegalHoldExportView,
  PreservedItemView,
} from "../types/legal-hold.types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@/i18n.ts", () => ({
  default: { language: "en-US", t: (value: string) => value },
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("../services/legal-hold-service");

const legalHold: LegalHoldDetail = {
  id: "h1",
  name: "Contract dispute",
  description: "Case 42",
  status: "active",
  custodianCount: 1,
  spaceCount: 1,
  custodians: [
    {
      id: "u1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      avatarUrl: null,
      deactivatedAt: "2026-11-01T10:00:00.000Z",
      deletedAt: null,
    },
  ],
  spaces: [
    {
      id: "s1",
      name: "Engineering",
      slug: "engineering",
      logo: null,
      archivedAt: null,
      deleted: true,
    },
  ],
  creator: { id: "u2", name: "Grace Hopper", avatarUrl: null },
  releasedBy: null,
  createdAt: "2026-11-12T10:00:00.000Z",
  updatedAt: "2026-11-12T10:00:00.000Z",
  releasedAt: null,
  preservedItemCount: 1,
  pagesInScopeCount: 12,
};

const exportView = (
  id: string,
  status: LegalHoldExportView["status"],
): LegalHoldExportView => ({
  id,
  legalHoldId: "h1",
  status,
  fileName: `${id}.zip`,
  fileSize: status === "success" ? 1536 : null,
  errorMessage: null,
  creator: null,
  createdAt: "2026-11-12T10:00:00.000Z",
  updatedAt: "2026-11-12T10:00:00.000Z",
  expiresAt: null,
});

const preservedPage: PreservedItemView = {
  id: "i1",
  type: "page",
  reason: "deleted",
  itemId: "p1",
  pageId: "p1",
  spaceId: "s1",
  spaceName: "Engineering",
  title: "Supplier contract",
  actor: { id: "u1", name: "Ada Lovelace", avatarUrl: null },
  childCounts: { page_history: 3 },
  createdAt: "2026-11-12T11:00:00.000Z",
  releasedAt: null,
  purgeAt: null,
};

function LocationSearch() {
  return <output aria-label="search">{useLocation().search}</output>;
}

function renderPage(search = "") {
  const store = createStore();
  store.set(currentUserAtom, {
    user: { role: "owner" },
    workspace: {},
  } as unknown as ICurrentUser);
  store.set(entitlementAtom, {
    cloud: false,
    tier: "enterprise",
    features: ["legal-holds"],
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <JotaiProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider env="test">
          <HelmetProvider>
            <MemoryRouter initialEntries={[`/settings/legal-holds/h1${search}`]}>
              <Routes>
                <Route
                  path="/settings/legal-holds/:legalHoldId"
                  element={
                    <>
                      <LegalHoldDetails />
                      <LocationSearch />
                    </>
                  }
                />
              </Routes>
            </MemoryRouter>
          </HelmetProvider>
        </MantineProvider>
      </QueryClientProvider>
    </JotaiProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.mocked(service.getLegalHold).mockResolvedValue(legalHold);
  vi.mocked(service.getPreservedItems).mockResolvedValue({
    items: [preservedPage],
    meta: {
      limit: 20,
      hasNextPage: false,
      hasPrevPage: false,
      nextCursor: null,
      prevCursor: null,
    },
  });
  vi.mocked(service.getPreservedItem).mockResolvedValue({
    ...preservedPage,
    html: "<p>Payment terms</p><img src=x onerror=alert(1)>",
    fileName: null,
    fileSize: null,
    mimeType: null,
  });
  vi.mocked(service.getLegalHoldExports).mockResolvedValue([
    exportView("ready", "success"),
    exportView("running", "processing"),
  ]);
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

describe("LegalHoldDetails", () => {
  it("shows the hold with its custodians first", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Contract dispute" }),
    ).toBeTruthy();
    expect(screen.getByText("Created Nov 12, 2026 by Grace Hopper")).toBeTruthy();
    expect(screen.getByText("12 pages in scope")).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Custodians (1)", selected: true }),
    ).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Deactivated")).toBeTruthy();
  });

  it("keeps the chosen tab in the address", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("tab", { name: "Spaces (1)" }));

    expect(await screen.findByText("Deleted space")).toBeTruthy();
    expect(screen.getByRole("status", { name: "search" }).textContent).toBe(
      "?tab=spaces",
    );
  });

  it("opens the tab from the address and only offers ready exports for download", async () => {
    renderPage("?tab=exports");

    const ready = await screen.findByRole("link", { name: "Download ready.zip" });
    expect(ready.getAttribute("href")).toBe(
      "/api/legal-holds/exports/ready/download",
    );
    expect(screen.getByText("1.5 KB")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Download running.zip",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("previews preserved content as sanitized editor HTML", async () => {
    renderPage("?tab=preserved");

    fireEvent.click(
      await screen.findByRole("button", { name: "Supplier contract" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Supplier contract",
    });
    const paragraph = await screen.findByText("Payment terms");
    expect(paragraph.closest(".ProseMirror")).toBeTruthy();
    expect(dialog.querySelector("img")?.getAttribute("onerror")).toBeFalsy();
    expect(screen.getByText("Page version: 3")).toBeTruthy();
  });
});
