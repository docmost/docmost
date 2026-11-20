import { Suspense } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { Provider } from "jotai";
import { afterEach, expect, it, vi } from "vitest";
import SpaceTree from "./space-tree";

const pages = {
  pages: [
    {
      items: ["First", "Second", "Third"].map((title, i) => ({
        id: title,
        slugId: String(i),
        title,
        position: String(i),
        spaceId: "team",
      })),
    },
  ],
};

vi.mock("@/main.tsx", () => ({ queryClient: {} }));
vi.mock("@/features/page/queries/page-query", () => ({
  useGetRootSidebarPagesQuery: () => ({ data: pages }),
  usePageQuery: () => ({}),
  useUpdatePageMutation: () => ({}),
}));
vi.mock("../hooks/use-tree-mutation", () => ({ useTreeMutation: () => ({}) }));
vi.mock("./space-tree-node-menu", () => ({ NodeMenu: () => null }));
vi.mock("@/components/ui/emoji-picker", () => ({ default: () => null }));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 32,
        size: 32,
      })),
    getTotalSize: () => count * 32,
    scrollToIndex: () => {},
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

function renderTree() {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  window.history.replaceState(null, "", "/s/team/p/first-0");
  let resume: () => void;
  let blocked = true;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  function Page() {
    const { pageSlug } = useParams();
    if (pageSlug === "second-1" && blocked) throw gate;
    return <h1>{pageSlug}</h1>;
  }
  render(
    <MantineProvider env="test">
      <Provider>
        <BrowserRouter>
          <Suspense fallback={null}>
            <Routes>
              <Route
                path="/s/:spaceSlug/p/:pageSlug"
                element={
                  <>
                    <SpaceTree spaceId="team" readOnly />
                    <Page />
                  </>
                }
              />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </Provider>
    </MantineProvider>,
  );
  return () =>
    act(async () => {
      blocked = false;
      resume();
    });
}

const row = (name: string) => screen.getByRole("treeitem", { name });
function mousePointer(link: HTMLElement, type: "pointerdown" | "pointerup") {
  // jsdom does not provide a PointerEvent constructor.
  fireEvent(
    link,
    Object.assign(new MouseEvent(type, { bubbles: true, button: 0 }), {
      pointerType: "mouse",
    }),
  );
}
async function clickRow(name: string) {
  const link = row(name);
  mousePointer(link, "pointerdown");
  expect(link.getAttribute("aria-selected")).toBe("true");
  mousePointer(link, "pointerup");
  fireEvent.click(link);
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

it("keeps the clicked row selected from mouse-down until the new route commits", async () => {
  const finish = renderTree();
  await clickRow("Second");
  expect(window.location.pathname).toBe("/s/team/p/second-1");
  expect(screen.getByRole("heading").textContent).toBe("first-0");
  expect(row("Second").getAttribute("aria-selected")).toBe("true");
  expect(row("First").hasAttribute("aria-selected")).toBe(false);
  await finish();
  expect(screen.getByRole("heading").textContent).toBe("second-1");
  expect(row("Second").getAttribute("aria-selected")).toBe("true");
});

it("gives the latest click the selection when it supersedes a pending page", async () => {
  const finish = renderTree();
  await clickRow("Second");
  await clickRow("Third");
  await finish();
  expect(screen.getByRole("heading").textContent).toBe("third-2");
  expect(row("Third").getAttribute("aria-current")).toBe("page");
});

it("restores the current selection when the mouse is released outside the tree", () => {
  renderTree();
  mousePointer(row("Second"), "pointerdown");
  expect(row("Second").getAttribute("aria-selected")).toBe("true");
  mousePointer(screen.getByRole("heading"), "pointerup");
  expect(row("First").getAttribute("aria-selected")).toBe("true");
  expect(window.location.pathname).toBe("/s/team/p/first-0");
});

it("follows Back when the clicked route has not committed yet", async () => {
  const finish = renderTree();
  await clickRow("Second");
  await act(async () => {
    const back = new Promise<Event>((resolve) =>
      window.addEventListener("popstate", resolve, { once: true }),
    );
    window.history.back();
    await back;
  });
  expect(window.location.pathname).toBe("/s/team/p/first-0");
  expect(row("First").getAttribute("aria-selected")).toBe("true");
  await finish();
});
