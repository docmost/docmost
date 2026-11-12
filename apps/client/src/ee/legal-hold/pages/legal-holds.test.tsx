import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LegalHolds from "./legal-holds";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import type { ICurrentUser } from "@/features/user/types/user.types";
import * as service from "../services/legal-hold-service";
import type {
  LegalHoldListItem,
  LegalHoldUserView,
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

const UNLICENSED_NOTICE =
  "Your plan doesn't include legal holds. You can still release existing holds and export their content.";

const custodian = (index: number): LegalHoldUserView => ({
  id: `u${index}`,
  name: `Member ${index}`,
  email: `member${index}@example.com`,
  avatarUrl: null,
  deactivatedAt: null,
  deletedAt: null,
});

const legalHold: LegalHoldListItem = {
  id: "h1",
  name: "Contract dispute",
  description: "Case 42",
  status: "active",
  custodianCount: 7,
  spaceCount: 2,
  custodians: [1, 2, 3, 4, 5].map(custodian),
  creator: null,
  releasedBy: null,
  createdAt: "2026-11-12T10:00:00.000Z",
  updatedAt: "2026-11-12T10:00:00.000Z",
  releasedAt: null,
};

const page = (items: LegalHoldListItem[]) => ({
  items,
  meta: {
    limit: 20,
    hasNextPage: false,
    hasPrevPage: false,
    nextCursor: null,
    prevCursor: null,
  },
});

function renderPage({
  role = "owner",
  features = ["legal-holds"],
}: { role?: string; features?: string[] } = {}) {
  const store = createStore();
  store.set(currentUserAtom, {
    user: { role },
    workspace: {},
  } as unknown as ICurrentUser);
  store.set(entitlementAtom, { cloud: false, tier: "enterprise", features });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <JotaiProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider env="test">
          <HelmetProvider>
            <MemoryRouter initialEntries={["/settings/legal-holds"]}>
              <Routes>
                <Route path="/settings/legal-holds" element={<LegalHolds />} />
                <Route
                  path="/settings/legal-holds/:legalHoldId"
                  element={<p>Details page</p>}
                />
              </Routes>
            </MemoryRouter>
          </HelmetProvider>
        </MantineProvider>
      </QueryClientProvider>
    </JotaiProvider>,
  );
}

const openRowMenu = async () =>
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Actions for Contract dispute",
    }),
  );

beforeEach(() => {
  vi.resetAllMocks();
  // the entitlement atom persists to localStorage and would rehydrate on mount
  localStorage.clear();
  vi.mocked(service.getLegalHolds).mockResolvedValue(page([legalHold]));
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

describe("LegalHolds", () => {
  it("renders nothing for an admin", () => {
    renderPage({ role: "admin" });
    expect(screen.queryByText("Legal holds")).toBeNull();
    expect(service.getLegalHolds).not.toHaveBeenCalled();
  });

  it("lists active holds with the first custodians and a count of the rest", async () => {
    renderPage();

    expect(await screen.findByText("Contract dispute")).toBeTruthy();
    expect(screen.getByText("Case 42")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    expect(service.getLegalHolds).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 20,
      query: "",
    });
    expect(screen.getByRole("button", { name: "New legal hold" })).toBeTruthy();
    expect(screen.queryByText(UNLICENSED_NOTICE)).toBeNull();

    await openRowMenu();
    expect(await screen.findByRole("menuitem", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Export" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Release" })).toBeTruthy();
  });

  it("lets an unlicensed owner release and export, but not create or edit", async () => {
    renderPage({ features: [] });

    expect(await screen.findByText(UNLICENSED_NOTICE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New legal hold" })).toBeNull();

    await openRowMenu();
    expect(await screen.findByRole("menuitem", { name: "Export" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Release" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull();
  });

  it("starts an export and opens the hold's exports", async () => {
    vi.mocked(service.createLegalHoldExport).mockResolvedValue({
      id: "e1",
      legalHoldId: "h1",
      status: "processing",
      fileName: "contract-dispute-legal-hold-2026-11-12.zip",
      fileSize: null,
      errorMessage: null,
      creator: null,
      createdAt: "2026-11-12T10:00:00.000Z",
      updatedAt: "2026-11-12T10:00:00.000Z",
      expiresAt: null,
    });
    renderPage();

    await openRowMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Export" }));

    expect(await screen.findByText("Details page")).toBeTruthy();
    expect(vi.mocked(service.createLegalHoldExport).mock.calls[0][0]).toEqual({
      legalHoldId: "h1",
    });
  });

  it("shows an empty list when the server has no legal hold routes", async () => {
    vi.mocked(service.getLegalHolds).mockRejectedValue({
      response: { status: 404, data: { message: "Not Found" } },
    });
    renderPage();

    expect(await screen.findByText("No active legal holds")).toBeTruthy();
  });
});
