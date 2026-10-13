import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider as JotaiProvider } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import type { SubpagesSortBy } from "@docmost/editor-ext";
import { getSidebarPages } from "@/features/page/services/page-service";
import { sharedTreeDataAtom } from "@/features/share/atoms/shared-page-atom";
import { publicSpaceTreeDataAtom } from "@/features/public-space/atoms/public-space-atoms.ts";
import { buildSharedPageTree } from "@/features/share/utils";
import { useSubpages } from "./use-subpages";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

vi.mock("@/features/page/services/page-service", () => ({
  getSidebarPages: vi.fn(),
}));

const sidebarPage = (
  id: string,
  title: string,
  position: string,
  updatedAt: string,
  hasChildren: boolean,
) => ({
  id,
  slugId: `slug-${id}`,
  title,
  icon: null,
  position,
  parentPageId: "p1",
  spaceId: "space-1",
  creatorId: "user-1",
  isBase: false,
  deletedAt: null,
  hasChildren,
  canEdit: true,
  updatedAt,
});

const treePage = (
  id: string,
  title: string,
  position: string,
  parentPageId: string | null,
  updatedAt: string,
) => ({
  id,
  slugId: `slug-${id}`,
  title,
  icon: null,
  position,
  parentPageId,
  spaceId: "space-1",
  workspaceId: "workspace-1",
  isRestricted: false,
  updatedAt,
});

const treePages = [
  treePage("p1", "Parent", "a0", null, "2026-10-01T00:00:00.000Z"),
  treePage("c1", "Older child", "a0", "p1", "2026-10-02T00:00:00.000Z"),
  treePage("c2", "Newer child", "a1", "p1", "2026-10-05T00:00:00.000Z"),
  treePage("g1", "Grandchild", "a0", "c1", "2026-10-03T00:00:00.000Z"),
];

function renderSubpages(
  path: string,
  pageId: string,
  sortBy: SubpagesSortBy,
  { enabled = true, store = createStore() } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/s/:spaceSlug/p/:pageSlug" element={children} />
            <Route path="/share/:shareId/p/:pageSlug" element={children} />
            <Route path="/share/p/:pageSlug" element={children} />
            <Route path="/docs/:spaceSlug/:pageSlug" element={children} />
          </Routes>
        </MemoryRouter>
      </JotaiProvider>
    </QueryClientProvider>
  );

  return renderHook(() => useSubpages(pageId, sortBy, enabled), { wrapper });
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("useSubpages", () => {
  beforeEach(() => {
    vi.mocked(getSidebarPages).mockReset();
  });

  it("loads children of the page from the sidebar API in the app", async () => {
    vi.mocked(getSidebarPages).mockResolvedValue({
      items: [
        sidebarPage("c1", "Older child", "a0", "2026-10-02T00:00:00.000Z", true),
        sidebarPage("c2", "Newer child", "a1", "2026-10-05T00:00:00.000Z", false),
      ],
      meta: {
        limit: 100,
        hasNextPage: false,
        hasPrevPage: false,
        nextCursor: null,
        prevCursor: null,
      },
    } as never);

    const { result } = renderSubpages("/s/general/p/parent-p1", "p1", "recent");

    await waitFor(() => expect(ids(result.current.subpages)).toEqual(["c2", "c1"]));
    expect(getSidebarPages).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: "p1" }),
    );
  });

  it("does not request children until enabled", () => {
    const { result } = renderSubpages("/s/general/p/parent-p1", "p1", "default", {
      enabled: false,
    });

    expect(result.current.subpages).toEqual([]);
    expect(getSidebarPages).not.toHaveBeenCalled();
  });

  it("reads children from the share tree without calling the API", () => {
    const store = createStore();
    store.set(sharedTreeDataAtom, buildSharedPageTree(treePages as never));

    const { result } = renderSubpages("/share/abc/p/parent-slug-p1", "slug-p1", "recent", {
      store,
    });

    expect(ids(result.current.subpages)).toEqual(["c2", "c1"]);
    expect(getSidebarPages).not.toHaveBeenCalled();
  });

  it("treats a share link without a share key as a share", () => {
    const store = createStore();
    store.set(sharedTreeDataAtom, buildSharedPageTree(treePages as never));

    const { result } = renderSubpages("/share/p/parent-slug-p1", "slug-p1", "default", {
      store,
    });

    expect(ids(result.current.subpages)).toEqual(["c1", "c2"]);
    expect(getSidebarPages).not.toHaveBeenCalled();
  });

  it("reads children from the public docs tree without calling the API", () => {
    const store = createStore();
    store.set(publicSpaceTreeDataAtom, buildSharedPageTree(treePages as never));

    const { result } = renderSubpages("/docs/handbook/parent-slug-p1", "p1", "default", {
      store,
    });

    expect(
      result.current.subpages.map(({ id, slugId, title, hasChildren }) => ({
        id,
        slugId,
        title,
        hasChildren,
      })),
    ).toEqual([
      { id: "c1", slugId: "slug-c1", title: "Older child", hasChildren: true },
      { id: "c2", slugId: "slug-c2", title: "Newer child", hasChildren: false },
    ]);
    expect(getSidebarPages).not.toHaveBeenCalled();
  });
});
