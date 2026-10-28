import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import { getDefaultStore, type PrimitiveAtom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MicrosoftFileItem } from "@docmost/editor-ext";
import {
  microsoftFullscreenAtom,
  microsoftFullscreenHostsAtom,
} from "@/features/microsoft/atoms/microsoft-atoms";
import type {
  M365FolderView,
  M365Item,
} from "@/features/microsoft/types/microsoft.types";
import MicrosoftFolderView from "./microsoft-folder-view";

const mocks = vi.hoisted(() => ({
  intersecting: true,
  refetch: vi.fn(),
  useM365Folder: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? "")),
  }),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: () => "3 days ago",
  formattedDate: () => "Oct 3, 2026, 9:00AM",
}));

vi.mock("@mantine/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mantine/hooks")>()),
  useIntersection: () => ({
    ref: () => {},
    entry: { isIntersecting: mocks.intersecting },
  }),
}));

vi.mock("@/features/microsoft/queries/microsoft-query", () => ({
  useM365Folder: (...args: unknown[]) => mocks.useM365Folder(...args),
}));

const WEB_URL =
  "https://contoso.sharepoint.com/sites/team/Shared%20Documents/Marketing/Reports";

function entry(kind: M365Item["kind"], itemId: string, name: string): M365Item {
  return {
    kind,
    driveId: "b!d",
    itemId,
    name,
    webUrl: `${WEB_URL}/${name}`,
  };
}

const views: Record<string, M365FolderView> = {
  F1: {
    folder: { driveId: "b!d", itemId: "F1", name: "Reports", webUrl: WEB_URL },
    trail: ["Marketing", "Documents"],
    items: [entry("folder", "F2", "Q3"), entry("file", "I1", "Summary.docx")],
    truncated: false,
  },
  F2: {
    folder: {
      driveId: "b!d",
      itemId: "F2",
      name: "Q3",
      webUrl: `${WEB_URL}/Q3`,
    },
    trail: ["Marketing", "Documents", "Reports"],
    items: [entry("folder", "F4", "Drafts"), entry("file", "I2", "Budget.xlsx")],
    truncated: false,
  },
  F3: {
    folder: {
      driveId: "b!d",
      itemId: "F3",
      name: "Policies",
      webUrl: "https://contoso.sharepoint.com/sites/legal/Policies",
    },
    trail: ["Legal", "Documents"],
    items: [entry("file", "I3", "Handbook.pdf")],
    truncated: false,
  },
};

function setMediaMatch() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderView(attrs: Record<string, string> = {}) {
  const ui = (overrides: Record<string, string> = {}) => {
    const props = {
      node: {
        attrs: {
          driveId: "b!d",
          itemId: "F1",
          webUrl: WEB_URL,
          name: "Reports",
          ...attrs,
          ...overrides,
        },
      },
      selected: false,
      editor: { isEditable: false },
    } as unknown as NodeViewProps;
    return (
      <MantineProvider>
        <MicrosoftFolderView {...props} />
      </MantineProvider>
    );
  };
  const { container, rerender } = render(ui());
  return {
    container,
    rerender: (overrides: Record<string, string> = {}) =>
      rerender(ui(overrides)),
  };
}

const loaded = (itemId: string) => ({
  state: "loaded",
  data: views[itemId],
  refetch: mocks.refetch,
});
const loading = { state: "loading", refetch: mocks.refetch };

const header = (name: string) => screen.getByRole("columnheader", { name });
const openFolder = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const skeleton = (container: HTMLElement) =>
  container.querySelector('[aria-busy="true"]');
const folderTable = (name: string) =>
  screen.queryByRole("table", { name: `Contents of ${name}` });
const focusTarget = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[tabindex="-1"]');

const store = getDefaultStore();
const fullscreenAtom =
  microsoftFullscreenAtom as PrimitiveAtom<MicrosoftFileItem | null>;

// Reports whether the app took the click over, then cancels it so jsdom never navigates
function clickPrevented(element: HTMLElement) {
  let prevented = false;
  const record = (event: Event) => {
    prevented = event.defaultPrevented;
    event.preventDefault();
  };
  window.addEventListener("click", record);
  fireEvent.click(element);
  window.removeEventListener("click", record);
  return prevented;
}

describe("MicrosoftFolderView", () => {
  beforeEach(() => {
    setMediaMatch();
    mocks.intersecting = true;
    mocks.refetch.mockClear();
    mocks.useM365Folder.mockReset();
    mocks.useM365Folder.mockImplementation(
      (driveId: string, itemId: string, enabled = true) =>
        enabled && driveId && itemId ? loaded(itemId) : loading,
    );
  });
  afterEach(() => {
    cleanup();
    store.set(fullscreenAtom, null);
    store.set(microsoftFullscreenHostsAtom, 0);
  });

  it("opens a file in the full-screen preview", () => {
    store.set(microsoftFullscreenHostsAtom, 1);
    renderView();

    expect(clickPrevented(screen.getByRole("link", { name: "Summary.docx" }))).toBe(
      true,
    );
    expect(store.get(fullscreenAtom)).toEqual({
      driveId: "b!d",
      itemId: "I1",
      webUrl: `${WEB_URL}/Summary.docx`,
      name: "Summary.docx",
    });
  });

  it("leaves file links to the browser on a page without the preview", () => {
    renderView();

    expect(clickPrevented(screen.getByRole("link", { name: "Summary.docx" }))).toBe(
      false,
    );
    expect(store.get(fullscreenAtom)).toBeNull();
  });

  it("opens a subfolder in place and goes back to the embedded folder", () => {
    renderView();

    expect(screen.getByRole("link", { name: "Summary.docx" })).toBeTruthy();
    expect(screen.queryByText(/Go back to/)).toBeNull();

    openFolder("Q3");

    expect(screen.getByRole("link", { name: "Budget.xlsx" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Summary.docx" })).toBeNull();
    const goBack = screen.getByRole("button", { name: "Go back to Reports" });

    fireEvent.click(goBack);

    expect(screen.getByRole("link", { name: "Summary.docx" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Budget.xlsx" })).toBeNull();
    expect(screen.queryByText(/Go back to/)).toBeNull();
  });

  it("never offers the site or library as navigation targets", () => {
    renderView();

    for (const name of ["Marketing", "Documents"]) {
      expect(screen.getByText(name)).toBeTruthy();
      expect(screen.queryByRole("button", { name })).toBeNull();
    }

    openFolder("Q3");

    for (const name of ["Marketing", "Documents"]) {
      expect(screen.getByText(name)).toBeTruthy();
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.getByRole("button", { name: "Reports" })).toBeTruthy();
  });

  it("builds the breadcrumb from the embedded folder, not from the open subfolder", () => {
    renderView();

    openFolder("Q3");

    expect(screen.getAllByText("Reports")).toHaveLength(1);
    expect(screen.getAllByText("Q3")).toHaveLength(1);
  });

  it("keeps the chosen sort while moving between folders", () => {
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Modified" }));
    expect(header("Modified").getAttribute("aria-sort")).toBe("descending");

    openFolder("Q3");
    expect(header("Modified").getAttribute("aria-sort")).toBe("descending");

    openFolder("Go back to Reports");
    expect(header("Modified").getAttribute("aria-sort")).toBe("descending");
  });

  it("starts over at the embedded folder when the node points at another folder", () => {
    const { rerender } = renderView();

    fireEvent.click(screen.getByRole("button", { name: "Modified" }));
    openFolder("Q3");
    expect(screen.getByRole("link", { name: "Budget.xlsx" })).toBeTruthy();

    rerender({ itemId: "F3", name: "Policies" });

    expect(screen.getByRole("link", { name: "Handbook.pdf" })).toBeTruthy();
    expect(screen.queryByText(/Go back to/)).toBeNull();
    expect(header("Name").getAttribute("aria-sort")).toBe("ascending");
    expect(header("Modified").getAttribute("aria-sort")).toBe("none");
    expect(screen.getByText("Legal")).toBeTruthy();
  });

  it("falls back to the stored name when the folder reports none", () => {
    mocks.useM365Folder.mockImplementation((_driveId: string, itemId: string) =>
      itemId === "F1"
        ? {
            ...loaded("F1"),
            data: { ...views.F1, folder: { ...views.F1.folder, name: "" } },
          }
        : loaded(itemId),
    );
    renderView({ name: "Saved name" });

    openFolder("Q3");

    expect(
      screen.getByRole("button", { name: "Go back to Saved name" }),
    ).toBeTruthy();
  });

  it("loads the folder once the embed is near the viewport and keeps it afterwards", () => {
    mocks.intersecting = false;
    const { container, rerender } = renderView();

    expect(mocks.useM365Folder).toHaveBeenLastCalledWith("b!d", "F1", false);
    expect(skeleton(container)).not.toBeNull();
    expect(folderTable("Reports")).toBeNull();

    mocks.intersecting = true;
    rerender();
    expect(folderTable("Reports")).not.toBeNull();
    expect(skeleton(container)).toBeNull();

    mocks.intersecting = false;
    rerender();
    expect(folderTable("Reports")).not.toBeNull();
  });

  it("shows a skeleton while the folder loads", () => {
    mocks.useM365Folder.mockReturnValue(loading);
    const { container } = renderView();

    const frame = screen.getByRole("status", { name: "Loading folder" });
    expect(frame).toBe(skeleton(container));
    expect(frame.getAttribute("aria-busy")).toBe("true");
    expect(header("Name")).toBeTruthy();
    expect(header("Modified")).toBeTruthy();
    expect(header("Modified By")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(6);
    expect(container.querySelector(".mantine-Loader-root")).toBeNull();
    expect(screen.queryByText("Could not load this folder")).toBeNull();
  });

  it("shows the skeleton while a subfolder loads", () => {
    mocks.useM365Folder.mockImplementation((_driveId: string, itemId: string) =>
      itemId === "F2" ? loading : loaded(itemId),
    );
    const { container } = renderView();
    expect(skeleton(container)).toBeNull();

    openFolder("Q3");

    expect(skeleton(container)).not.toBeNull();
    expect(screen.queryByRole("table", { name: /^Contents of/ })).toBeNull();
    expect(container.querySelector(".mantine-Loader-root")).toBeNull();
  });

  it("moves focus to the content wrapper after opening a folder, but not on first render", () => {
    const { container } = renderView();
    const wrapper = focusTarget(container);

    expect(wrapper).not.toBeNull();
    expect(document.activeElement).toBe(document.body);

    openFolder("Q3");

    expect(document.activeElement).toBe(wrapper);
    expect(wrapper.contains(screen.getByRole("table"))).toBe(true);
  });

  it.each([
    ["the go back row", () => openFolder("Go back to Reports")],
    ["a breadcrumb", () => openFolder("Reports")],
  ])("moves focus to the content wrapper after %s", (_label, navigate) => {
    const { container } = renderView();
    openFolder("Q3");
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);

    navigate();

    expect(document.activeElement).toBe(focusTarget(container));
  });

  it("moves focus to the content wrapper after the go back button", () => {
    mocks.useM365Folder.mockImplementation((_driveId: string, itemId: string) =>
      itemId === "F2"
        ? { state: "forbidden", refetch: mocks.refetch }
        : loaded(itemId),
    );
    const { container } = renderView();
    openFolder("Q3");
    (document.activeElement as HTMLElement).blur();

    openFolder("Go back to Reports");

    expect(document.activeElement).toBe(focusTarget(container));
  });

  it("shows the access message when SharePoint forbids the folder", () => {
    mocks.useM365Folder.mockReturnValue({
      state: "forbidden",
      refetch: mocks.refetch,
    });
    const { container } = renderView();

    expect(
      screen.getByText("You do not have access to this folder in SharePoint"),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Go back to/ })).toBeNull();
    expect(container.querySelector(".tabler-icon-folder")).not.toBeNull();

    const open = screen.getByRole("link", { name: "Open in SharePoint" });
    expect(open.getAttribute("href")).toBe(WEB_URL);
    expect(open.getAttribute("target")).toBe("_blank");
    expect(open.getAttribute("rel")).toBe("noopener");
  });

  it("lets the viewer go back when a subfolder cannot be opened", () => {
    mocks.useM365Folder.mockImplementation((_driveId: string, itemId: string) =>
      itemId === "F2"
        ? { state: "forbidden", refetch: mocks.refetch }
        : loaded(itemId),
    );
    renderView();

    openFolder("Q3");

    expect(
      screen.getByText("You do not have access to this folder in SharePoint"),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Summary.docx" })).toBeNull();
    expect(screen.getByText("Q3")).toBeTruthy();
    expect(screen.queryByText("Reports")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Open in SharePoint" })
        .getAttribute("href"),
    ).toBe(`${WEB_URL}/Q3`);

    fireEvent.click(screen.getByRole("button", { name: "Go back to Reports" }));

    expect(screen.getByRole("link", { name: "Summary.docx" })).toBeTruthy();
    expect(
      screen.queryByText("You do not have access to this folder in SharePoint"),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Go back to/ })).toBeNull();
  });

  it.each(["notFound", "error", "needsConnection"])(
    "offers the way back from a %s subfolder too",
    (state) => {
      mocks.useM365Folder.mockImplementation(
        (_driveId: string, itemId: string) =>
          itemId === "F2"
            ? {
                state,
                code: null,
                needsConnection: { code: "needs_connection" },
                refetch: mocks.refetch,
              }
            : loaded(itemId),
      );
      renderView();

      openFolder("Q3");
      fireEvent.click(screen.getByRole("button", { name: "Go back to Reports" }));

      expect(screen.getByRole("link", { name: "Summary.docx" })).toBeTruthy();
    },
  );

  it("names the folder that failed, not the embedded one, two levels down", () => {
    mocks.useM365Folder.mockImplementation((_driveId: string, itemId: string) =>
      itemId === "F4"
        ? { state: "notFound", refetch: mocks.refetch }
        : loaded(itemId),
    );
    renderView();

    openFolder("Q3");
    openFolder("Drafts");

    expect(screen.getByText("Drafts")).toBeTruthy();
    expect(screen.queryByText("Reports")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Open in SharePoint" })
        .getAttribute("href"),
    ).toBe(`${WEB_URL}/Drafts`);
  });

  it.each([
    ["no link at all", ""],
    ["a link that is not https", "http://contoso.sharepoint.com/Reports"],
  ])("offers no Open in SharePoint link for a node with %s", (_label, webUrl) => {
    mocks.useM365Folder.mockReturnValue({
      state: "forbidden",
      refetch: mocks.refetch,
    });
    renderView({ webUrl });

    expect(
      screen.getByText("You do not have access to this folder in SharePoint"),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Open in SharePoint" })).toBeNull();
    expect(screen.queryByText("Open in SharePoint")).toBeNull();
  });

  it("goes back one level at a time from a nested subfolder that cannot be opened", () => {
    mocks.useM365Folder.mockImplementation((_driveId: string, itemId: string) =>
      itemId === "F4"
        ? { state: "forbidden", refetch: mocks.refetch }
        : loaded(itemId),
    );
    renderView();

    openFolder("Q3");
    openFolder("Drafts");
    expect(screen.getByText("Drafts")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go back to Q3" }));

    expect(screen.getByRole("link", { name: "Budget.xlsx" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Go back to Reports" }),
    ).toBeTruthy();
  });

  it.each([
    ["anonymous", {}, "Sign in to Microsoft 365 to see this folder", false],
    [
      "needsConnection",
      { needsConnection: { code: "needs_connection", integrationId: "int-1" } },
      "Connect your Microsoft 365 account to see this folder",
      true,
    ],
    ["notFound", {}, "This folder was moved or deleted", false],
  ])("explains a %s folder", (state, extra, message, canConnect) => {
    mocks.useM365Folder.mockReturnValue({
      state,
      refetch: mocks.refetch,
      ...extra,
    });
    renderView();

    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByText("Reports")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(
      Boolean(
        screen.queryByRole("button", {
          name: "Connect to Microsoft 365 to preview",
        }),
      ),
    ).toBe(canConnect);
  });

  it("retries a failed load", () => {
    mocks.useM365Folder.mockReturnValue({
      state: "error",
      code: null,
      refetch: mocks.refetch,
    });
    renderView();

    expect(screen.getByText("Could not load this folder")).toBeTruthy();
    expect(mocks.refetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("shows a plain message for a node that holds no folder", () => {
    renderView({ driveId: "", itemId: "" });

    expect(screen.getByText("Could not load this folder")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
