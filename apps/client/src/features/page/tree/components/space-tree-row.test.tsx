import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider as JotaiProvider } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import api from "@/lib/api-client";
import { queryClient } from "@/main.tsx";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import type { SpaceTreeNode } from "@/features/page/tree/types";
import { SpaceTreeRow } from "./space-tree-row";

const { emit } = vi.hoisted(() => ({ emit: vi.fn() }));

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
vi.mock("@/features/websocket/use-query-emit.ts", () => ({
  useQueryEmit: () => emit,
}));
vi.mock("@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts", () => ({
  useToggleSidebar: () => vi.fn(),
}));
vi.mock("./space-tree-node-menu", () => ({ NodeMenu: () => null }));
vi.mock("@/components/ui/emoji-picker.tsx", () => ({
  default: ({
    onEmojiSelect,
    removeEmojiAction,
  }: {
    onEmojiSelect: (emoji: { native: string }) => void;
    removeEmojiAction: () => void;
  }) => (
    <>
      <button onClick={() => onEmojiSelect({ native: "🔥" })}>pick</button>
      <button onClick={removeEmojiAction}>remove</button>
    </>
  ),
}));

const node: SpaceTreeNode = {
  id: "page-1",
  slugId: "slug-1",
  name: "Original",
  icon: "📘",
  position: "a",
  spaceId: "space-1",
  parentPageId: null,
  hasChildren: false,
  children: [],
};

function renderRow() {
  const store = createStore();
  store.set(treeDataAtom, [node]);
  render(
    <JotaiProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <MemoryRouter initialEntries={["/s/space"]}>
            <Routes>
              <Route
                path="/s/:spaceSlug"
                element={
                  <SpaceTreeRow
                    node={node}
                    level={0}
                    isOpen={false}
                    hasChildren={false}
                    isSelected={false}
                    isDragging={false}
                    isReceivingDrop={null}
                    rowRef={null}
                    tabIndex={0}
                    treeItemProps={{} as never}
                    toggleOpen={() => undefined}
                    readOnly={false}
                  />
                }
              />
            </Routes>
          </MemoryRouter>
        </MantineProvider>
      </QueryClientProvider>
    </JotaiProvider>,
  );
  return { icon: () => store.get(treeDataAtom)[0].icon };
}

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  emit.mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(notifications.show).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByText(name));
  });
};

describe("SpaceTreeRow icon changes", () => {
  it("keeps the new emoji and tells other users once the server accepted it", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: "page-1", slugId: "slug-1", icon: "🔥", spaceId: "space-1" },
    });
    const { icon } = renderRow();

    await click("pick");
    await act(() => vi.advanceTimersByTimeAsync(60));

    expect(icon()).toBe("🔥");
    expect(api.post).toHaveBeenCalledWith("/pages/update", {
      pageId: "page-1",
      icon: "🔥",
      draft: true,
    });
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "updateOne",
        id: "page-1",
        payload: expect.objectContaining({ icon: "🔥" }),
      }),
    );
  });

  it("puts the old emoji back and shows the server message when it is refused", async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: {
        data: { message: "This page is in review and cannot be edited." },
      },
    });
    const { icon } = renderRow();

    await click("pick");
    await act(() => vi.advanceTimersByTimeAsync(60));

    await waitFor(() => expect(icon()).toBe("📘"));
    expect(notifications.show).toHaveBeenCalledWith({
      message: "This page is in review and cannot be edited.",
      color: "red",
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it("puts a removed emoji back when the removal is refused", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("Network Error"));
    const { icon } = renderRow();

    await click("remove");
    await act(() => vi.advanceTimersByTimeAsync(60));

    await waitFor(() => expect(icon()).toBe("📘"));
    expect(notifications.show).toHaveBeenCalledWith({
      message: "Failed to update page",
      color: "red",
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it("removes the emoji for everyone once the server accepted it", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: "page-1", slugId: "slug-1", icon: null, spaceId: "space-1" },
    });
    const { icon } = renderRow();

    await click("remove");
    await act(() => vi.advanceTimersByTimeAsync(60));

    expect(icon()).toBeNull();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "updateOne",
        payload: { icon: null },
      }),
    );
  });
});
