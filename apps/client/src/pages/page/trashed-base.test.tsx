import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/main";
import { getBaseInfo } from "@/ee/base/services/base-service";
import BasePage from "@/ee/base/pages/base-page";
import Page from "./page";

vi.mock("@/main", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  }),
}));
vi.mock("@/ee/base/services/base-service", () => ({ getBaseInfo: vi.fn() }));
vi.mock("@/features/editor/full-editor", () => ({ FullEditor: () => null }));
vi.mock("@/features/editor/title-editor", () => ({ TitleEditor: () => null }));
vi.mock("@/features/page/components/header/page-header", () => ({
  default: () => null,
}));
vi.mock("@/features/page-history/components/history-modal", () => ({
  default: () => null,
}));
vi.mock("@/features/comment/hooks/use-comment-deep-link", () => ({
  useCommentDeepLink: () => {},
}));

const space = {
  id: "space-1",
  slug: "general",
  membership: { permissions: [{ action: "edit", subject: "page" }] },
};
const page = {
  id: "00000000-0000-4000-8000-000000000001",
  slugId: "testBase",
  title: "Triage",
  isBase: true,
  deletedAt: new Date(),
  space,
};

describe("opening a trashed base", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    queryClient.setQueryData(["pages", page.slugId], page);
    queryClient.setQueryData(["pages", page.id], page);
    queryClient.setQueryData(["space", space.slug], space);
    queryClient.setQueryData(["entitlements"], {
      cloud: false,
      tier: "enterprise",
      features: ["bases"],
    });
    vi.mocked(getBaseInfo).mockRejectedValue(new Error("Base not found"));
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([`/s/general/p/triage-${page.slugId}`, `/base/${page.id}`])(
    "shows the page trash banner without loading base data at %s",
    (url) => {
      render(
        <MantineProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[url]}>
              <Routes>
                <Route path="/s/:spaceSlug/p/:pageSlug" element={<Page />} />
                <Route path="/base/:pageId" element={<BasePage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </MantineProvider>,
      );

      expect(screen.getByText(/moved this page to Trash/)).toBeTruthy();
      expect(
        screen.getAllByRole("button", { name: "Restore page" }).length,
      ).toBeGreaterThan(0);
      expect(getBaseInfo).not.toHaveBeenCalled();
    },
  );
});
