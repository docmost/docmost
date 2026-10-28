import { MantineProvider } from "@mantine/core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  M365FolderView,
  M365Item,
} from "@/features/microsoft/types/microsoft.types";
import {
  DEFAULT_FOLDER_SORT,
  FOLDER_ITEM_LIMIT,
  FOLDER_PAGE_SIZE,
} from "./folder-table.constants";
import type { FolderCrumb } from "./folder-table.types";
import { FolderTable } from "./folder-table";

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

type Props = ComponentProps<typeof FolderTable>;

const reports: M365FolderView["folder"] = {
  driveId: "drive-1",
  itemId: "folder-reports",
  name: "Reports",
  webUrl: "https://contoso.sharepoint.com/sites/team/Shared%20Documents/Reports",
};

const crumbs: FolderCrumb[] = [
  { key: "trail-0", name: "Team Site", depth: null },
  { key: "trail-1", name: "Documents", depth: null },
  { key: "root", name: "Reports", depth: null },
];

function entry(
  kind: M365Item["kind"],
  name: string,
  extra: Partial<M365Item> = {},
): M365Item {
  return {
    kind,
    driveId: "drive-1",
    itemId: `${kind}-${name}`,
    name,
    webUrl: `https://contoso.sharepoint.com/sites/team/Reports/${name}`,
    ...extra,
  };
}

const file = (name: string, extra?: Partial<M365Item>) =>
  entry("file", name, extra);
const folder = (name: string, extra?: Partial<M365Item>) =>
  entry("folder", name, extra);
const numberedFiles = (count: number) =>
  Array.from({ length: count }, (_, index) => file(`File ${index + 1}.docx`));

function viewOf(
  items: M365Item[],
  extra: Partial<M365FolderView> = {},
): M365FolderView {
  return {
    folder: reports,
    trail: ["Team Site", "Documents"],
    items,
    truncated: false,
    ...extra,
  };
}

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

function renderTable(props: Partial<Props> = {}) {
  const handlers = {
    onSortChange: vi.fn(),
    onNavigate: vi.fn(),
    onOpenFolder: vi.fn(),
  };
  const base: Props = {
    view: viewOf([]),
    crumbs,
    sort: DEFAULT_FOLDER_SORT,
    parent: null,
    ...handlers,
  };
  const ui = (overrides: Partial<Props>) => (
    <MantineProvider>
      <FolderTable {...base} {...props} {...overrides} />
    </MantineProvider>
  );
  const { rerender } = render(ui({}));
  return {
    ...handlers,
    rerender: (overrides: Partial<Props>) => rerender(ui(overrides)),
  };
}

const table = () => screen.getByRole("table");
const bodyRows = () => within(table()).getAllByRole("row").slice(1);
const fileNames = () =>
  within(table())
    .queryAllByRole("link")
    .map((link) => link.textContent);
const previousButton = () =>
  screen.getByRole("button", { name: "Previous page of Reports" });
const nextButton = () =>
  screen.getByRole("button", { name: "Next page of Reports" });
const isDisabled = (button: HTMLElement) =>
  (button as HTMLButtonElement).disabled;

describe("FolderTable", () => {
  beforeEach(setMediaMatch);
  afterEach(cleanup);

  it("pages twenty rows at a time", () => {
    const { rerender } = renderTable({ view: viewOf(numberedFiles(21)) });

    expect(fileNames()).toHaveLength(FOLDER_PAGE_SIZE);
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(isDisabled(previousButton())).toBe(true);
    expect(isDisabled(nextButton())).toBe(false);

    fireEvent.click(nextButton());

    expect(fileNames()).toEqual(["File 21.docx"]);
    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(isDisabled(previousButton())).toBe(false);
    expect(isDisabled(nextButton())).toBe(true);

    fireEvent.click(previousButton());
    expect(screen.getByText("1 / 2")).toBeTruthy();

    fireEvent.click(nextButton());
    rerender({ sort: { column: "modified", direction: "desc" } });

    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(fileNames()).toHaveLength(FOLDER_PAGE_SIZE);
  });

  it("shows no footer when everything fits on one page", () => {
    renderTable({ view: viewOf(numberedFiles(FOLDER_PAGE_SIZE)) });

    expect(fileNames()).toHaveLength(FOLDER_PAGE_SIZE);
    expect(screen.queryByText(/^1 \//)).toBeNull();
    expect(screen.queryByRole("button", { name: /Next/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Previous/ })).toBeNull();
  });

  it("does not count the go back row toward the page size", () => {
    renderTable({
      view: viewOf(numberedFiles(21)),
      parent: { name: "Reports", depth: 0 },
    });

    expect(fileNames()).toHaveLength(FOLDER_PAGE_SIZE);
    expect(bodyRows()).toHaveLength(FOLDER_PAGE_SIZE + 1);
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("returns to the first page when another folder opens but not when the same one reloads", () => {
    const items = numberedFiles(21);
    const { rerender } = renderTable({ view: viewOf(items) });

    fireEvent.click(nextButton());
    rerender({ view: viewOf([...items]) });
    expect(screen.getByText("2 / 2")).toBeTruthy();

    rerender({
      view: viewOf(items, {
        folder: { ...reports, itemId: "folder-q3", name: "Q3" },
      }),
    });
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(fileNames()).toHaveLength(FOLDER_PAGE_SIZE);
  });

  it("stays on a page that exists when the folder shrinks", () => {
    const { rerender } = renderTable({ view: viewOf(numberedFiles(21)) });

    fireEvent.click(nextButton());
    rerender({ view: viewOf(numberedFiles(3)) });

    expect(fileNames()).toEqual(["File 1.docx", "File 2.docx", "File 3.docx"]);
    expect(screen.queryByText(/ \/ /)).toBeNull();
  });

  it("opens folders in place and files in SharePoint", () => {
    const archive = folder("Archive");
    const budget = file("Budget.docx");
    const { onOpenFolder } = renderTable({ view: viewOf([archive, budget]) });

    const folderName = screen.getByRole("button", { name: "Archive" });
    fireEvent.click(folderName);
    expect(onOpenFolder).toHaveBeenCalledTimes(1);
    expect(onOpenFolder).toHaveBeenCalledWith(archive);
    expect(folderName.getAttribute("type")).toBe("button");
    expect(screen.queryByRole("link", { name: "Archive" })).toBeNull();

    const fileName = screen.getByRole("link", { name: "Budget.docx" });
    expect(fileName.getAttribute("href")).toBe(budget.webUrl);
    expect(fileName.getAttribute("target")).toBe("_blank");
    expect(fileName.getAttribute("rel")).toBe("noopener");
    expect(screen.queryByRole("button", { name: "Budget.docx" })).toBeNull();
  });

  it("puts the full name in a title so a truncated name can still be read", () => {
    renderTable({
      view: viewOf([folder("Quarterly planning archive"), file("Budget.docx")]),
    });

    expect(
      screen
        .getByRole("button", { name: "Quarterly planning archive" })
        .getAttribute("title"),
    ).toBe("Quarterly planning archive");
    expect(
      screen.getByRole("link", { name: "Budget.docx" }).getAttribute("title"),
    ).toBe("Budget.docx");
  });

  it("styles folder names and file names alike", () => {
    renderTable({ view: viewOf([folder("Archive"), file("Budget.docx")]) });

    const folderName = screen.getByRole("button", { name: "Archive" });
    const fileName = screen.getByRole("link", { name: "Budget.docx" });

    expect(folderName.className).toBe(fileName.className);
    expect(folderName.getAttribute("style")).toBe(
      fileName.getAttribute("style"),
    );
  });

  it("shows the go back row only inside a subfolder", () => {
    const { onNavigate, rerender } = renderTable({
      view: viewOf([file("a.docx")]),
      parent: { name: "Reports", depth: 0 },
    });

    const goBack = screen.getByRole("button", { name: "Go back to Reports" });
    expect(goBack.textContent).toBe("Go back to Reports");
    expect(goBack.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(bodyRows()[0].contains(goBack)).toBe(true);
    expect(
      within(bodyRows()[0]).getByRole("cell").getAttribute("colspan"),
    ).toBe("3");

    fireEvent.click(goBack);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(0);

    rerender({ parent: null });
    expect(screen.queryByText(/Go back to/)).toBeNull();
  });

  it("sorts from the column headers", () => {
    const items = [
      file("alpha.docx", {
        lastModifiedDateTime: "2026-09-01T09:00:00Z",
        lastModifiedBy: "Ann",
      }),
      file("bravo.docx"),
      file("charlie.docx", {
        lastModifiedDateTime: "2026-10-03T09:00:00Z",
        lastModifiedBy: "Bob",
      }),
    ];
    const { onSortChange, rerender } = renderTable({ view: viewOf(items) });
    const header = (name: string) => screen.getByRole("columnheader", { name });

    expect(header("Name").getAttribute("aria-sort")).toBe("ascending");
    expect(header("Modified").getAttribute("aria-sort")).toBe("none");
    expect(header("Modified By").getAttribute("aria-sort")).toBe("none");
    expect(fileNames()).toEqual(["alpha.docx", "bravo.docx", "charlie.docx"]);

    fireEvent.click(screen.getByRole("button", { name: "Modified" }));
    expect(onSortChange).toHaveBeenLastCalledWith({
      column: "modified",
      direction: "desc",
    });

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenLastCalledWith({
      column: "name",
      direction: "desc",
    });

    rerender({ sort: { column: "modified", direction: "desc" } });
    expect(header("Modified").getAttribute("aria-sort")).toBe("descending");
    expect(header("Name").getAttribute("aria-sort")).toBe("none");
    expect(fileNames()).toEqual(["charlie.docx", "alpha.docx", "bravo.docx"]);

    const modifiedCell = (name: string) =>
      within(
        screen.getByRole("link", { name }).closest("tr") as HTMLElement,
      ).getAllByRole("cell")[1];
    expect(modifiedCell("charlie.docx").textContent).toBe("3 days ago");
    expect(modifiedCell("bravo.docx").textContent).toBe("");
  });

  it("shows when and by whom each item was modified, leaving missing dates empty", () => {
    renderTable({
      view: viewOf([
        file("dated.docx", {
          lastModifiedDateTime: "2026-10-03T09:00:00Z",
          lastModifiedBy: "Bob",
        }),
        file("undated.docx"),
      ]),
    });
    const rowOf = (name: string) =>
      screen.getByRole("link", { name }).closest("tr") as HTMLElement;
    const cellsOf = (name: string) => within(rowOf(name)).getAllByRole("cell");

    expect(cellsOf("dated.docx")[1].textContent).toBe("3 days ago");
    expect(
      within(rowOf("dated.docx")).getByTitle("Oct 3, 2026, 9:00AM").textContent,
    ).toBe("3 days ago");
    expect(cellsOf("dated.docx")[2].textContent).toBe("Bob");

    expect(cellsOf("undated.docx")[1].textContent).toBe("");
    expect(within(cellsOf("undated.docx")[1]).queryByTitle(/./)).toBeNull();
    expect(cellsOf("undated.docx")[2].textContent).toBe("");
  });

  it("marks only the sorted column with a chevron", () => {
    const { rerender } = renderTable({ view: viewOf([file("a.docx")]) });
    const header = (name: string) => screen.getByRole("columnheader", { name });

    expect(header("Name").querySelector(".tabler-icon-chevron-up")).not.toBeNull();
    expect(header("Modified").querySelector("svg")).toBeNull();
    expect(header("Modified By").querySelector("svg")).toBeNull();

    rerender({ sort: { column: "modifiedBy", direction: "desc" } });
    expect(header("Name").querySelector("svg")).toBeNull();
    expect(
      header("Modified By").querySelector(".tabler-icon-chevron-down"),
    ).not.toBeNull();
  });

  it("shows the empty and truncated notes", () => {
    const { rerender } = renderTable({
      view: viewOf([]),
      parent: { name: "Reports", depth: 0 },
    });

    expect(screen.getByText("This folder is empty")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Go back to Reports" }),
    ).toBeTruthy();
    expect(screen.queryByText(/Showing the first/)).toBeNull();

    rerender({ view: viewOf([file("a.docx")], { truncated: true }) });

    expect(screen.queryByText("This folder is empty")).toBeNull();
    expect(
      screen.getByText(
        `Showing the first ${FOLDER_ITEM_LIMIT.toLocaleString()} items. Open in SharePoint to see everything.`,
      ),
    ).toBeTruthy();
  });

  it("labels the table and links to the folder in SharePoint", () => {
    renderTable({ view: viewOf([file("a.docx")]) });

    expect(
      screen.getByRole("table", { name: "Contents of Reports" }),
    ).toBeTruthy();

    const open = screen.getByRole("link", { name: "Open Reports in SharePoint" });
    expect(open.getAttribute("href")).toBe(reports.webUrl);
    expect(open.getAttribute("target")).toBe("_blank");
    expect(open.getAttribute("rel")).toBe("noopener");
  });

  it("navigates from the clickable breadcrumbs only", () => {
    const { onNavigate } = renderTable({
      crumbs: [
        { key: "trail-0", name: "Team Site", depth: null },
        { key: "root", name: "Reports", depth: 0 },
        { key: "path-0", name: "Q3", depth: null },
      ],
    });

    expect(screen.getByText("Team Site")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Team Site" })).toBeNull();
    expect(screen.getByText("Team Site").style.fontWeight).toBe("");
    expect(screen.getByText("Q3").style.fontWeight).toBe("500");
    expect(screen.getByText("Q3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Q3" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reports" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(0);
  });
});
