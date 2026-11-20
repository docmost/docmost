import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getPageById } from "@/features/page/services/page-service";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import { queryClient } from "@/main.tsx";
import { PageRouteFallback } from "./page-loading";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return {
    queryClient: new QueryClient({
      defaultOptions: { queries: { retry: false } },
    }),
  };
});
vi.mock("@/features/page/services/page-service", () => ({
  getPageById: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderLoadingPage() {
  const store = createStore();
  const parent = {
    id: "parent",
    slugId: "parentSlug",
    name: "Project",
    position: "a0",
    spaceId: "team",
    parentPageId: null,
    hasChildren: true,
  };
  store.set(treeDataAtom, [
    {
      ...parent,
      children: [
        {
          ...parent,
          id: "child",
          slugId: "childSlug",
          name: "Design notes",
          parentPageId: parent.id,
          hasChildren: false,
          children: [],
        },
      ],
    },
  ]);
  render(
    <MantineProvider env="test">
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <MemoryRouter initialEntries={["/s/team/p/design-notes-childSlug"]}>
            <Link to="/s/team/p/new-doc-newSlug">Next page</Link>
            <Routes>
              <Route
                path="/s/:spaceSlug/p/:pageSlug"
                element={<PageRouteFallback />}
              />
            </Routes>
          </MemoryRouter>
        </Provider>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it("shows the matching sidebar title and drops it when the next page has no known title", () => {
  vi.mocked(getPageById).mockReturnValue(new Promise(() => {}));
  renderLoadingPage();
  expect(screen.getByRole("heading", { name: "Design notes" })).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "Next page" }));
  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.getByRole("status", { name: "Loading…" })).toBeTruthy();
});

it("removes a stale sidebar title as soon as the page request denies access", async () => {
  vi.mocked(getPageById).mockRejectedValue(
    Object.assign(new Error("Forbidden"), { status: 403 }),
  );
  renderLoadingPage();
  expect(await screen.findByText("Page not found")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Design notes" })).toBeNull();
});
