import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBaseProperty } from "@/ee/base/types/base.types";
import type { ResolvedPage } from "@/ee/base/queries/base-page-resolver-query";

const mocks = vi.hoisted(() => ({
  candidates: vi.fn(),
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
  useRelationCandidatesQuery: (args: unknown) => mocks.candidates(args),
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
  mocks.candidates.mockReset();
  mocks.candidates.mockReturnValue({ data: { items: rows, meta: {} }, error: null });
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
afterEach(cleanup);

describe("FilterRelationInput", () => {
  it("filter input emits selected ids and clears to undefined", () => {
    const { onChange, rerender } = renderInput(undefined);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(mocks.candidates).toHaveBeenLastCalledWith({
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

  it("shows No access instead of a search when the other base can't be opened", () => {
    mocks.pages = new Map([["b2", null]]);
    renderInput(["a"]);

    expect(screen.getByText("No access")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "No access" }));
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(mocks.resolve).toHaveBeenLastCalledWith(expect.objectContaining({ rowIds: [] }));
  });
});
