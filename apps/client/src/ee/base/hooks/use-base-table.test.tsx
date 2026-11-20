import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

import { queryClient } from "@/main.tsx";
import type { IBase, IBaseRow, IBaseView } from "@/ee/base/types/base.types";
import { useBaseTable } from "./use-base-table";

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

const base = {
  id: "b",
  properties: [{ id: "due", pageId: "b", name: "Due", type: "date", position: "a1", typeOptions: {}, isPrimary: false }],
} as unknown as IBase;
const view = {
  id: "v",
  pageId: "b",
  type: "table",
  config: { sorts: [{ propertyId: "due", direction: "asc" }] },
} as unknown as IBaseView;
const row = (id: string, due: unknown) => ({ id, pageId: "b", cells: { due }, position: id }) as unknown as IBaseRow;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(stubMatchMedia);
afterEach(cleanup);

describe("useBaseTable", () => {
  it("shows rows in the order the server sent them, also under a date sort", () => {
    const rows = [
      row("r2", { start: "2026-11-20" }),
      row("r1", { start: "2026-11-12" }),
      row("r3", { start: "2026-11-15" }),
    ];
    const { result } = renderHook(() => useBaseTable(base, rows, view), { wrapper });
    expect(result.current.table.getRowModel().rows.map((r) => r.id)).toEqual(["r2", "r1", "r3"]);
  });

  it("hands the stored cell to the date column untouched, readable or not", () => {
    const { result } = renderHook(() => useBaseTable(base, [row("r1", { start: "nope" })], view), { wrapper });
    expect(result.current.table.getRow("r1").getValue("due")).toEqual({ start: "nope" });
  });
});
