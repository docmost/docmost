import { QueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IPagination } from "@/lib/types";
import type { IPage } from "@/features/page/types/page.types";

const mocks = vi.hoisted(() => ({
  queryClient: undefined as any,
}));

vi.mock("@/main.tsx", () => ({
  get queryClient() {
    return mocks.queryClient;
  },
}));

import {
  addPageToSidebarCache,
  invalidateOnCreatePage,
  invalidateOnDeletePage,
  invalidateOnUpdatePage,
  updateCacheOnMovePage,
} from "./page-query";

function makePage(overrides: Partial<IPage> & { id: string }): IPage {
  return {
    id: overrides.id,
    slugId: overrides.slugId ?? `${overrides.id}-slug`,
    title: overrides.title ?? overrides.id,
    content: "",
    icon: overrides.icon ?? null,
    coverPhoto: null,
    parentPageId: overrides.parentPageId ?? null,
    creatorId: "user-1",
    spaceId: overrides.spaceId ?? "space-1",
    workspaceId: "workspace-1",
    isLocked: false,
    lastUpdatedById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    position: overrides.position ?? "a0",
    hasChildren: overrides.hasChildren ?? false,
    creator: null,
    lastUpdatedBy: null,
    deletedBy: null,
    space: { id: overrides.spaceId ?? "space-1", slug: "space-1" },
    ...overrides,
  };
}

function makeInfiniteData<T>(
  items: T[],
): InfiniteData<IPagination<T>, unknown> {
  return {
    pageParams: [undefined],
    pages: [
      {
        items,
        meta: {
          hasNextPage: false,
          nextCursor: null,
        } as any,
      },
    ],
  };
}

function sidebarItems(queryKey: unknown[]) {
  const queryClient = mocks.queryClient as QueryClient;
  return queryClient
    .getQueryData<InfiniteData<IPagination<Partial<IPage>>, unknown>>(queryKey)
    ?.pages.flatMap((page) => page.items);
}

describe("page sidebar cache updates", () => {
  beforeEach(() => {
    mocks.queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it("appends created child pages to sidebar caches with and without spaceId", () => {
    const parent = makePage({ id: "parent", hasChildren: false });
    const child = makePage({ id: "child", parentPageId: "parent" });

    const pageIdOnlyKey = ["sidebar-pages", { pageId: "parent" }];
    const pageWithSpaceKey = [
      "sidebar-pages",
      { pageId: "parent", spaceId: "space-1" },
    ];

    mocks.queryClient.setQueryData(pageIdOnlyKey, makeInfiniteData([]));
    mocks.queryClient.setQueryData(pageWithSpaceKey, makeInfiniteData([]));
    mocks.queryClient.setQueryData(
      ["root-sidebar-pages", "space-1"],
      makeInfiniteData([parent]),
    );

    invalidateOnCreatePage(child);

    expect(sidebarItems(pageIdOnlyKey)?.map((page) => page.id)).toEqual([
      "child",
    ]);
    expect(sidebarItems(pageWithSpaceKey)?.map((page) => page.id)).toEqual([
      "child",
    ]);
    expect(
      sidebarItems(["root-sidebar-pages", "space-1"])?.find(
        (page) => page.id === "parent",
      )?.hasChildren,
    ).toBe(true);
  });

  it("dedupes local add operations such as duplicate or restore", () => {
    const child = makePage({ id: "child", parentPageId: "parent" });
    const pageWithSpaceKey = [
      "sidebar-pages",
      { pageId: "parent", spaceId: "space-1" },
    ];

    mocks.queryClient.setQueryData(pageWithSpaceKey, makeInfiniteData([]));

    addPageToSidebarCache(child);
    addPageToSidebarCache(child);

    expect(sidebarItems(pageWithSpaceKey)?.map((page) => page.id)).toEqual([
      "child",
    ]);
  });

  it("updates renamed child pages in both sidebar cache key shapes", () => {
    const child = makePage({ id: "child", parentPageId: "parent" });
    const pageIdOnlyKey = ["sidebar-pages", { pageId: "parent" }];
    const pageWithSpaceKey = [
      "sidebar-pages",
      { pageId: "parent", spaceId: "space-1" },
    ];

    mocks.queryClient.setQueryData(pageIdOnlyKey, makeInfiniteData([child]));
    mocks.queryClient.setQueryData(pageWithSpaceKey, makeInfiniteData([child]));

    invalidateOnUpdatePage("space-1", "parent", "child", "Renamed", "icon");

    expect(sidebarItems(pageIdOnlyKey)?.[0].title).toBe("Renamed");
    expect(sidebarItems(pageIdOnlyKey)?.[0].icon).toBe("icon");
    expect(sidebarItems(pageWithSpaceKey)?.[0].title).toBe("Renamed");
    expect(sidebarItems(pageWithSpaceKey)?.[0].icon).toBe("icon");
  });

  it("removes deleted pages from both sidebar cache key shapes", () => {
    const child = makePage({ id: "child", parentPageId: "parent" });
    const sibling = makePage({ id: "sibling", parentPageId: "parent" });
    const pageIdOnlyKey = ["sidebar-pages", { pageId: "parent" }];
    const pageWithSpaceKey = [
      "sidebar-pages",
      { pageId: "parent", spaceId: "space-1" },
    ];

    mocks.queryClient.setQueryData(
      pageIdOnlyKey,
      makeInfiniteData([child, sibling]),
    );
    mocks.queryClient.setQueryData(
      pageWithSpaceKey,
      makeInfiniteData([child, sibling]),
    );

    invalidateOnDeletePage("child");

    expect(sidebarItems(pageIdOnlyKey)?.map((page) => page.id)).toEqual([
      "sibling",
    ]);
    expect(sidebarItems(pageWithSpaceKey)?.map((page) => page.id)).toEqual([
      "sibling",
    ]);
  });

  it("moves pages between parent sidebar caches with and without spaceId", () => {
    const oldParent = makePage({ id: "old-parent", hasChildren: true });
    const newParent = makePage({ id: "new-parent", hasChildren: false });
    const child = makePage({ id: "child", parentPageId: "old-parent" });
    const movedChild = { ...child, parentPageId: "new-parent" };

    const oldPageIdOnlyKey = ["sidebar-pages", { pageId: "old-parent" }];
    const oldPageWithSpaceKey = [
      "sidebar-pages",
      { pageId: "old-parent", spaceId: "space-1" },
    ];
    const newPageIdOnlyKey = ["sidebar-pages", { pageId: "new-parent" }];
    const newPageWithSpaceKey = [
      "sidebar-pages",
      { pageId: "new-parent", spaceId: "space-1" },
    ];

    mocks.queryClient.setQueryData(oldPageIdOnlyKey, makeInfiniteData([child]));
    mocks.queryClient.setQueryData(
      oldPageWithSpaceKey,
      makeInfiniteData([child]),
    );
    mocks.queryClient.setQueryData(newPageIdOnlyKey, makeInfiniteData([]));
    mocks.queryClient.setQueryData(newPageWithSpaceKey, makeInfiniteData([]));
    mocks.queryClient.setQueryData(
      ["root-sidebar-pages", "space-1"],
      makeInfiniteData([oldParent, newParent]),
    );

    updateCacheOnMovePage(
      "space-1",
      "child",
      "old-parent",
      "new-parent",
      movedChild,
    );

    expect(sidebarItems(oldPageIdOnlyKey)).toEqual([]);
    expect(sidebarItems(oldPageWithSpaceKey)).toEqual([]);
    expect(sidebarItems(newPageIdOnlyKey)?.map((page) => page.id)).toEqual([
      "child",
    ]);
    expect(sidebarItems(newPageWithSpaceKey)?.map((page) => page.id)).toEqual([
      "child",
    ]);
    expect(
      sidebarItems(["root-sidebar-pages", "space-1"])?.find(
        (page) => page.id === "old-parent",
      )?.hasChildren,
    ).toBe(false);
    expect(
      sidebarItems(["root-sidebar-pages", "space-1"])?.find(
        (page) => page.id === "new-parent",
      )?.hasChildren,
    ).toBe(true);
  });
});
