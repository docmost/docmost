import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider as JotaiProvider } from "jotai";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { notifications } from "@mantine/notifications";
import api from "@/lib/api-client";
import { queryClient } from "@/main.tsx";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import type { SpaceTreeNode } from "@/features/page/tree/types";
import { useTreeMutation } from "./use-tree-mutation";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const node = (overrides: Partial<SpaceTreeNode> = {}): SpaceTreeNode => ({
  id: "page-1",
  slugId: "slug-1",
  name: "Original",
  position: "a",
  spaceId: "space-1",
  parentPageId: null,
  hasChildren: false,
  children: [],
  ...overrides,
});

function renderMutation() {
  const store = createStore();
  store.set(treeDataAtom, [
    node(),
    node({ id: "page-2", slugId: "slug-2", name: "Other" }),
  ]);
  const { result } = renderHook(() => useTreeMutation("space-1"), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <JotaiProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      </JotaiProvider>
    ),
  });
  const names = () => store.get(treeDataAtom).map((entry) => entry.name);
  return { result, names };
}

beforeEach(() => {
  vi.mocked(api.post).mockReset();
  vi.mocked(notifications.show).mockReset();
});

describe("useTreeMutation handleRename", () => {
  it("keeps the new name once the server accepted it", async () => {
    // The api client hands back the response envelope.
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: "page-1",
        slugId: "slug-1",
        title: "Renamed",
        spaceId: "space-1",
        parentPageId: null,
      },
    });
    const { result, names } = renderMutation();

    await act(() => result.current.handleRename("page-1", "Renamed"));

    expect(api.post).toHaveBeenCalledWith("/pages/update", {
      pageId: "page-1",
      title: "Renamed",
      draft: true,
    });
    expect(names()).toEqual(["Renamed", "Other"]);
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it("puts the old name back and shows the server message when the rename is refused", async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: {
        data: { message: "This page is in review and cannot be edited." },
      },
    });
    const { result, names } = renderMutation();

    await act(() => result.current.handleRename("page-1", "Renamed"));

    expect(names()).toEqual(["Original", "Other"]);
    expect(notifications.show).toHaveBeenCalledWith({
      message: "This page is in review and cannot be edited.",
      color: "red",
    });
  });

  it("falls back to a generic message when the server gives none", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("Network Error"));
    const { result, names } = renderMutation();

    await act(() => result.current.handleRename("page-1", "Renamed"));

    expect(names()).toEqual(["Original", "Other"]);
    expect(notifications.show).toHaveBeenCalledWith({
      message: "Failed to update page",
      color: "red",
    });
  });
});
