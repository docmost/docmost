import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBaseProperty } from "@/ee/base/types/base.types";
import type { ResolvedPage } from "@/ee/base/queries/base-page-resolver-query";

const mocks = vi.hoisted(() => ({
  suggestions: vi.fn(),
  resolve: vi.fn(),
  pages: new Map<string, ResolvedPage | null | undefined>(),
}));

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
  }),
}));
vi.mock("@/ee/base/queries/base-relation-query", () => ({
  useRelationSuggestionsInfiniteQuery: (args: unknown) => mocks.suggestions(args),
  useResolveRelationRows: (args: unknown) => mocks.resolve(args),
}));
vi.mock("@/ee/base/queries/base-page-resolver-query", () => ({
  useResolvedPages: () => ({ pages: mocks.pages, isLoading: false }),
}));

import { FilterRelationInput } from "./filter-relation-input";

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

const projects: ResolvedPage = {
  id: "b2",
  slugId: "s2",
  title: "Projects",
  icon: null,
  spaceId: "sp",
  space: { id: "sp", slug: "eng", name: "Engineering" },
};

const rows = [
  { id: "a", title: "Alpha" },
  { id: "b", title: "Beta" },
];

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed: Element[] = [];
  constructor(
    private callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.observed.push(target);
  }
  unobserve() {}
  disconnect() {
    this.observed = [];
  }
  takeRecords() {
    return [];
  }
  intersect() {
    const entries = this.observed.map((target) => ({ target, isIntersecting: true }));
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

const watchingObserver = () =>
  FakeIntersectionObserver.instances.find((observer) => observer.observed.length > 0);

function renderInput(value: string[] | undefined) {
  const onChange = vi.fn();
  const view = (next: string[] | undefined) => (
    <MantineProvider env="test">
      <FilterRelationInput property={property} value={next} onChange={onChange} />
    </MantineProvider>
  );
  const { rerender } = render(view(value));
  return { onChange, rerender: (next: string[] | undefined) => rerender(view(next)) };
}

beforeEach(() => {
  mocks.pages = new Map([["b2", projects]]);
  mocks.suggestions.mockReset();
  mocks.suggestions.mockReturnValue({ data: rows, error: null });
  mocks.resolve.mockReset();
  mocks.resolve.mockImplementation(({ rowIds }: { rowIds: string[] }) => ({
    data: { items: rows.filter((row) => rowIds.includes(row.id)) },
    isLoading: false,
  }));
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
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  FakeIntersectionObserver.instances = [];
});

describe("FilterRelationInput", () => {
  it("filter input emits selected ids and clears to undefined", () => {
    const { onChange, rerender } = renderInput(undefined);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(mocks.suggestions).toHaveBeenLastCalledWith({
      pageId: "base-1",
      propertyId: "rel",
      query: "",
      enabled: true,
    });
    fireEvent.click(screen.getByRole("option", { name: "Alpha" }));
    expect(onChange).toHaveBeenLastCalledWith(["a"]);

    rerender(["a"]);
    expect(mocks.resolve).toHaveBeenLastCalledWith({
      pageId: "base-1",
      propertyId: "rel",
      rowIds: ["a"],
    });
    expect(screen.queryByRole("option", { name: "Alpha" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Beta" }));
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Alpha" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("filter input stops at 100 selected rows", () => {
    mocks.resolve.mockImplementation(({ rowIds }: { rowIds: string[] }) => ({
      data: { items: rowIds.map((id) => ({ id, title: id })) },
      isLoading: false,
    }));
    const full = Array.from({ length: 100 }, (_, i) => `row-${i}`);
    const { onChange, rerender } = renderInput(full);

    fireEvent.click(screen.getByRole("button", { name: /^row-0/ }));
    expect(screen.getByText("Up to 100 rows")).toBeTruthy();
    const alpha = screen.getByRole("option", { name: "Alpha" });
    expect(alpha.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(alpha);
    const search = screen.getByRole("combobox", { name: "Search Projects" });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();

    rerender(full.slice(1));
    expect(screen.queryByText("Up to 100 rows")).toBeNull();
    expect(screen.getByRole("option", { name: "Alpha" }).getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Alpha" }));
    expect(onChange).toHaveBeenLastCalledWith([...full.slice(1), "a"]);
  });

  it("the filter input loads more suggestions when scrolled to the end", () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    const page = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => ({ id: `r${from + i}`, title: `Row ${from + i}` }));
    const pages = [page(1, 25), page(26, 30)];
    const fetchNextPage = vi.fn();
    mocks.suggestions.mockImplementation(function useFakeSuggestions() {
      const [loaded, setLoaded] = useState(1);
      fetchNextPage.mockImplementation(() => setLoaded((n) => n + 1));
      return {
        data: pages.slice(0, loaded).flat(),
        error: null,
        hasNextPage: loaded < pages.length,
        isFetching: false,
        fetchNextPage,
      };
    });
    mocks.resolve.mockImplementation(({ rowIds }: { rowIds: string[] }) => ({
      data: { items: pages[0].filter((row) => rowIds.includes(row.id)) },
      isLoading: false,
    }));
    // every row of the first page is already picked, so the list can't scroll
    renderInput(pages[0].map((row) => row.id));

    fireEvent.click(screen.getByRole("button", { name: /Row 25/ }));
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.queryByText("No matching rows")).toBeNull();
    const observer = watchingObserver();
    expect(observer?.options?.root).toBe(screen.getByRole("listbox"));
    act(() => observer!.intersect());

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Row 26",
      "Row 27",
      "Row 28",
      "Row 29",
      "Row 30",
    ]);
  });

  it("shows No access instead of a search when the other base can't be opened", () => {
    mocks.pages = new Map([["b2", null]]);
    renderInput(["a"]);

    expect(screen.getByText("No access")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "No access" }));
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(mocks.resolve).toHaveBeenLastCalledWith(expect.objectContaining({ rowIds: [] }));
  });

  it("shows a picked row that was deleted as a chip you can remove", () => {
    const { onChange } = renderInput(["a", "gone"]);

    expect(screen.getAllByText("Deleted row").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Deleted row/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Deleted row" }));
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
  });

  it("names no row deleted while the picked rows are still loading", () => {
    mocks.resolve.mockReturnValue({ data: undefined, isLoading: true });
    renderInput(["gone"]);

    expect(screen.queryByText("Deleted row")).toBeNull();
  });
});
