import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBaseProperty, RelationPreview } from "@/ee/base/types/base.types";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
}));
vi.mock("@/ee/base/services/base-relation-service", () => ({
  updateRelationLinks: vi.fn(),
  listRelationRows: vi.fn(),
  suggestRelationRows: vi.fn(),
  resolveRelationRows: vi.fn(),
  searchRelationTargets: vi.fn(),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
  }),
}));
vi.mock("@/ee/base/queries/base-page-resolver-query", () => ({
  useResolvedPages: () => ({
    pages: new Map([
      [
        "b2",
        {
          id: "b2",
          slugId: "s2",
          title: "Projects",
          icon: null,
          spaceId: "sp",
          space: { id: "sp", slug: "eng", name: "Engineering" },
        },
      ],
    ]),
    isLoading: false,
  }),
}));

import { queryClient } from "@/main.tsx";
import {
  listRelationRows,
  suggestRelationRows,
  updateRelationLinks,
} from "@/ee/base/services/base-relation-service";
import { FieldRelation } from "./field-relation";

const property = {
  id: "rel",
  pageId: "base-1",
  name: "Projects",
  type: "relation",
  isPrimary: false,
  typeOptions: {
    relationId: "relation-1",
    targetBaseId: "b2",
    direction: "source",
    inversePropertyId: null,
    allowMultiple: true,
  },
} as unknown as IBaseProperty;

const linked = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    id: `t${from + i}`,
    title: `Row ${from + i}`,
  }));

function renderField(preview: RelationPreview | undefined, readOnly = false) {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MantineProvider env="test">
          <FieldRelation
            property={property}
            value={undefined}
            rowId="r1"
            readOnly={readOnly}
            onChange={vi.fn()}
            preview={preview}
          />
        </MantineProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  queryClient.clear();
  vi.mocked(listRelationRows).mockReset();
  vi.mocked(listRelationRows).mockResolvedValue({
    items: [],
    meta: { hasNextPage: false, nextCursor: null } as never,
  });
  vi.mocked(updateRelationLinks).mockReset();
  vi.mocked(suggestRelationRows).mockReset();
  vi.mocked(suggestRelationRows).mockResolvedValue({ items: [], meta: {} as never });
  Element.prototype.scrollIntoView = () => {};
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
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FieldRelation", () => {
  it("Show all loads one page and Show more loads the next", async () => {
    vi.mocked(listRelationRows).mockImplementation(async ({ cursor }) =>
      cursor === "c1"
        ? { items: linked(51, 60), meta: { hasNextPage: false, nextCursor: null } as never }
        : { items: linked(1, 50), meta: { hasNextPage: true, nextCursor: "c1" } as never },
    );
    renderField({ count: 60, rows: linked(1, 10) });

    for (const row of linked(1, 10)) {
      expect(screen.getByRole("link", { name: `Open ${row.title}` }).getAttribute("href")).toBe(
        `/s/eng/p/projects-s2?row=${row.id}&rowBase=b2`,
      );
    }
    expect(screen.queryByText("Row 11")).toBeNull();
    expect(listRelationRows).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Show all 60 rows for Projects" }));

    const showMore = await screen.findByRole("button", { name: "Show more rows for Projects" });
    expect(showMore.textContent).toBe("Show more");
    expect(screen.getAllByRole("link", { name: /^Open Row/ })).toHaveLength(50);
    expect(listRelationRows).toHaveBeenCalledTimes(1);

    act(() => showMore.focus());
    fireEvent.click(showMore);

    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: /^Open Row/ })).toHaveLength(60),
    );
    expect(listRelationRows).toHaveBeenCalledTimes(2);
    expect(listRelationRows).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageId: "base-1", rowId: "r1", propertyId: "rel", cursor: "c1" }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("link", { name: "Open Row 51" })),
    );
    expect(screen.queryByRole("button", { name: /^Show (all|more)/ })).toBeNull();
  });

  it("Show more stays on a failed page and retries it", async () => {
    vi.mocked(listRelationRows)
      .mockResolvedValueOnce({
        items: linked(1, 50),
        meta: { hasNextPage: true, nextCursor: "c1" } as never,
      })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        items: linked(51, 60),
        meta: { hasNextPage: false, nextCursor: null } as never,
      });
    renderField({ count: 60, rows: linked(1, 10) });

    fireEvent.click(screen.getByRole("button", { name: "Show all 60 rows for Projects" }));
    const showMore = await screen.findByRole("button", { name: "Show more rows for Projects" });
    fireEvent.click(showMore);
    await waitFor(() => expect(listRelationRows).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(showMore.getAttribute("aria-busy")).toBeNull());
    expect(screen.queryByText("Row 51")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show more rows for Projects" }));

    await waitFor(() => expect(screen.getByText("Row 60")).toBeTruthy());
    expect(listRelationRows).toHaveBeenCalledTimes(3);
    expect(listRelationRows).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "c1" }));
    expect(screen.queryByRole("button", { name: /^Show (all|more)/ })).toBeNull();
  });

  it("Show all keeps keyboard focus in the field", async () => {
    let answer!: (page: Awaited<ReturnType<typeof listRelationRows>>) => void;
    vi.mocked(listRelationRows).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderField({ count: 12, rows: linked(1, 10) });
    const showAll = screen.getByRole("button", { name: "Show all 12 rows for Projects" });
    act(() => showAll.focus());

    fireEvent.click(showAll);

    expect(document.activeElement).toBe(showAll);
    await act(async () =>
      answer({ items: linked(1, 12), meta: { hasNextPage: false, nextCursor: null } as never }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("link", { name: "Open Row 11" })),
    );
    expect(screen.queryByRole("button", { name: /^Show all/ })).toBeNull();
  });

  it("Show all leaves focus alone when the user moved on while it loaded", async () => {
    let answer!: (page: Awaited<ReturnType<typeof listRelationRows>>) => void;
    vi.mocked(listRelationRows).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderField({ count: 12, rows: linked(1, 10) });
    const showAll = screen.getByRole("button", { name: "Show all 12 rows for Projects" });
    act(() => showAll.focus());
    fireEvent.click(showAll);
    const addLink = screen.getByRole("button", { name: "Link a row for Projects" });
    act(() => addLink.focus());

    await act(async () =>
      answer({ items: linked(1, 12), meta: { hasNextPage: false, nextCursor: null } as never }),
    );

    await waitFor(() => expect(screen.getByText("Row 12")).toBeTruthy());
    expect(document.activeElement).toBe(addLink);
  });

  it("field Link a row opens the picker", async () => {
    vi.mocked(listRelationRows).mockResolvedValue({
      items: linked(1, 1),
      meta: { hasNextPage: false, nextCursor: null } as never,
    });
    renderField({ count: 1, rows: linked(1, 1) });

    fireEvent.click(screen.getByRole("button", { name: "Link a row for Projects" }));

    expect(screen.getByRole("combobox", { name: "Search Projects" })).toBeTruthy();
    await waitFor(() =>
      expect(suggestRelationRows).toHaveBeenCalledWith(
        expect.objectContaining({ pageId: "base-1", propertyId: "rel", rowId: "r1" }),
      ),
    );
    expect(listRelationRows).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: "base-1", rowId: "r1", propertyId: "rel", query: undefined }),
    );
    expect(await screen.findByRole("option", { name: "Row 1" })).toBeTruthy();
  });

  it("removing a chip unlinks that row and hides it at once", async () => {
    vi.mocked(updateRelationLinks).mockReturnValue(new Promise(() => {}));
    renderField({ count: 2, rows: linked(1, 2) });

    fireEvent.click(screen.getByRole("button", { name: "Remove Row 1" }));

    expect(screen.queryByText("Row 1")).toBeNull();
    await waitFor(() =>
      expect(updateRelationLinks).toHaveBeenCalledWith(
        expect.objectContaining({ pageId: "base-1", rowId: "r1", propertyId: "rel", remove: ["t1"] }),
      ),
    );
    expect(screen.getByText("Row 2")).toBeTruthy();
  });

  it("two relation fields have distinct accessible names", () => {
    const tasks = { ...property, id: "rel2", name: "Tasks" } as IBaseProperty;
    const field = (prop: IBaseProperty, preview: RelationPreview) => (
      <FieldRelation
        property={prop}
        value={undefined}
        rowId="r1"
        readOnly={false}
        onChange={vi.fn()}
        preview={preview}
      />
    );
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MantineProvider env="test">
            {field(property, { count: 12, rows: linked(1, 10) })}
            {field(tasks, { count: 15, rows: linked(21, 30) })}
          </MantineProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const showAll = screen.getByRole("button", { name: "Show all 12 rows for Projects" });
    expect(showAll.textContent).toBe("Show all (12)");
    expect(screen.getByRole("button", { name: "Show all 15 rows for Tasks" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Link a row for Projects" }).textContent).toBe(
      "Link a row",
    );
    fireEvent.click(screen.getByRole("button", { name: "Link a row for Tasks" }));
    expect(screen.getByRole("dialog", { name: "Link rows for Tasks" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Tasks" })).toBeTruthy();
  });

  it("read-only users see the links without editing controls, restricted users see No access", () => {
    renderField({ count: 12, rows: linked(1, 10) }, true);
    expect(screen.getByRole("link", { name: "Open Row 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show all 12 rows for Projects" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Link a row for Projects" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
    cleanup();

    renderField({ count: 0, rows: [], restricted: true });
    expect(screen.getByText("No access")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Link a row for Projects" })).toBeNull();
  });

  it("an editor sees a relation the server marks read-only without editing controls", () => {
    renderField({ count: 2, rows: linked(1, 2), permissions: { canEdit: false } });
    expect(screen.getByRole("link", { name: "Open Row 1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Link a row for Projects" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
    fireEvent.click(screen.getByRole("group", { name: "Projects" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows no editing controls until the row's relation data arrives", () => {
    renderField(undefined);
    expect(screen.queryByRole("button", { name: "Link a row for Projects" })).toBeNull();
  });
});
