import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getDefaultStore, type WritableAtom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (String(args[0]).startsWith("[DEPRECATED] atomFamily")) return;
    warn(...args);
  };
});
const viewer = vi.hoisted(() => ({
  current: { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" },
}));

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@/ee/base/hooks/use-viewer-date-context", () => ({
  useViewerDateContext: () => viewer.current,
}));
vi.mock("@/ee/base/hooks/use-grid-autoscroll", () => ({ useGridAutoScroll: () => {} }));
vi.mock("@/ee/base/hooks/use-row-autoscroll", () => ({ useRowAutoScroll: () => {} }));
vi.mock("@/ee/base/queries/base-page-resolver-query", () => ({
  useResolvedPages: () => ({ pages: new Map(), isLoading: false }),
  useHydrateResolvedPage: () => () => {},
}));

import { queryClient } from "@/main.tsx";
import { editingCellAtomFamily, focusedCellAtomFamily } from "@/ee/base/atoms/base-atoms";
import { useBaseTable } from "@/ee/base/hooks/use-base-table";
import type {
  EditingCell,
  FocusedCell,
  IBase,
  IBaseRow,
  IBaseView,
} from "@/ee/base/types/base.types";
import { cancelRowsRefresh, scheduleRowsRefresh } from "@/ee/base/queries/rows-refresh";
import { GridContainer } from "./grid-container";

function stubMatchMedia() {
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

const pageId = "grid-base";
const base = {
  id: pageId,
  properties: [{ id: "name", pageId, name: "Name", type: "text", position: "a1", typeOptions: {}, isPrimary: true }],
  views: [],
} as unknown as IBase;
const view = { id: "v", pageId, type: "table", config: {} } as unknown as IBaseView;
const row = (id: string) => ({ id, pageId, cells: { name: id }, position: id }) as unknown as IBaseRow;

const editingAtom = editingCellAtomFamily(pageId) as unknown as WritableAtom<EditingCell, [EditingCell], void>;
const focusedAtom = focusedCellAtomFamily(pageId) as unknown as WritableAtom<FocusedCell, [FocusedCell], void>;
const store = getDefaultStore();

type GridProps = {
  rows: IBaseRow[];
  base?: IBase;
  onCellUpdate?: (rowId: string, propertyId: string, value: unknown) => void;
};

function Grid({ rows, base: gridBase = base, onCellUpdate = vi.fn() }: GridProps) {
  const { table } = useBaseTable(gridBase, rows, view);
  return (
    <GridContainer
      table={table}
      properties={gridBase.properties}
      onCellUpdate={onCellUpdate}
      pageId={pageId}
      scrollElement={null}
    />
  );
}

const ui = (rows: IBaseRow[], props: Omit<GridProps, "rows"> = {}) => (
  <QueryClientProvider client={queryClient}>
    <MantineProvider env="test">
      <Grid rows={rows} {...props} />
    </MantineProvider>
  </QueryClientProvider>
);

beforeEach(() => {
  stubMatchMedia();
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
  cancelRowsRefresh(pageId);
  store.set(editingAtom, null);
  store.set(focusedAtom, null);
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GridContainer and the cell in edit mode", () => {
  it("clears the editing cell when its row leaves the rows it is given", () => {
    const { rerender } = render(ui([row("r1"), row("r2")]));
    act(() => store.set(editingAtom, { rowId: "r1", propertyId: "name" }));
    rerender(ui([row("r1"), row("r2")]));
    expect(store.get(editingAtom)).toEqual({ rowId: "r1", propertyId: "name" });
    rerender(ui([row("r2")]));
    expect(store.get(editingAtom)).toBeNull();
  });

  it("clears the editing cell when the grid unmounts", () => {
    const { unmount } = render(ui([row("r1")]));
    act(() => store.set(editingAtom, { rowId: "r1", propertyId: "name" }));
    unmount();
    expect(store.get(editingAtom)).toBeNull();
  });

  it("lets a refresh held by the edited cell run once that cell's row is gone", () => {
    vi.useFakeTimers();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { rerender } = render(ui([row("r1"), row("r2")]));
    act(() => store.set(editingAtom, { rowId: "r1", propertyId: "name" }));
    scheduleRowsRefresh(pageId, "all");
    act(() => vi.advanceTimersByTime(10_000));
    expect(invalidate).not.toHaveBeenCalled();
    rerender(ui([row("r2")]));
    act(() => vi.advanceTimersByTime(300));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["base-rows", pageId] });
  });
});

describe("GridContainer and Delete on a focused cell", () => {
  it("clearing a relation cell sends no row update", () => {
    const relation = {
      id: "rel",
      pageId,
      name: "Projects",
      type: "relation",
      position: "a2",
      isPrimary: false,
      typeOptions: {
        relationId: "relation-1",
        targetBaseId: "b2",
        direction: "source",
        inversePropertyId: null,
        allowMultiple: true,
      },
    };
    const withRelation = { ...base, properties: [...base.properties, relation] } as unknown as IBase;
    const onCellUpdate = vi.fn();
    render(ui([row("r1")], { base: withRelation, onCellUpdate }));
    const grid = screen.getByRole("grid");

    act(() => store.set(focusedAtom, { rowId: "r1", propertyId: "rel" }));
    fireEvent.keyDown(grid, { key: "Delete" });
    fireEvent.keyDown(grid, { key: "Backspace" });
    expect(onCellUpdate).not.toHaveBeenCalled();

    act(() => store.set(focusedAtom, { rowId: "r1", propertyId: "name" }));
    fireEvent.keyDown(grid, { key: "Delete" });
    expect(onCellUpdate).toHaveBeenCalledWith("r1", "name", null);
  });
});

