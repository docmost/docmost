import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render } from "@testing-library/react";
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

import { queryClient } from "@/main.tsx";
import { editingCellAtomFamily } from "@/ee/base/atoms/base-atoms";
import { useBaseTable } from "@/ee/base/hooks/use-base-table";
import type { EditingCell, IBase, IBaseRow, IBaseView } from "@/ee/base/types/base.types";
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
const store = getDefaultStore();

function Grid({ rows }: { rows: IBaseRow[] }) {
  const { table } = useBaseTable(base, rows, view);
  return (
    <GridContainer
      table={table}
      properties={base.properties}
      onCellUpdate={vi.fn()}
      pageId={pageId}
      scrollElement={null}
    />
  );
}

const ui = (rows: IBaseRow[]) => (
  <QueryClientProvider client={queryClient}>
    <MantineProvider env="test">
      <Grid rows={rows} />
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

