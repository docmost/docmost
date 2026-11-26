import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import type { Cell } from "@tanstack/react-table";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
vi.mock("@/ee/base/queries/base-page-resolver-query", () => ({
  useResolvedPages: () => ({ pages: new Map(), isLoading: false }),
}));

import { GridCell } from "./grid-cell";
import type { IBaseProperty, IBaseRow, RelationPreview } from "@/ee/base/types/base.types";

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(cleanup);

const property = {
  id: "rel",
  name: "Links",
  type: "relation",
  isPrimary: false,
  typeOptions: { targetBaseId: "b2" },
} as unknown as IBaseProperty;

const makeCell = (relations: Record<string, RelationPreview>) =>
  ({
    getValue: () => undefined,
    row: { id: "r1", original: { id: "r1", cells: {}, relations } as IBaseRow },
    column: {
      id: "rel",
      columnDef: { meta: { property } },
      getIsPinned: () => false,
      getStart: () => 0,
    },
    getContext: () => ({}),
  }) as unknown as Cell<IBaseRow, unknown>;

const preview = (title: string): RelationPreview => ({
  count: 1,
  rows: [{ id: "t1", title }],
});

describe("GridCell relation previews", () => {
  it("re-renders when only the relation preview changes", () => {
    const onCellUpdate = vi.fn();
    const ui = (relations: Record<string, RelationPreview>) => (
      <MantineProvider>
        <GridCell cell={makeCell(relations)} rowIndex={0} onCellUpdate={onCellUpdate} pageId="p1" />
      </MantineProvider>
    );
    const { rerender } = render(ui({ rel: preview("Alpha") }));
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);

    rerender(ui({ rel: preview("Beta") }));
    expect(screen.getAllByText("Beta").length).toBeGreaterThan(0);
    expect(screen.queryByText("Alpha")).toBeNull();
  });
});
