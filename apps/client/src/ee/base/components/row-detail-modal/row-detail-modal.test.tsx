import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBase, IBaseRow } from "@/ee/base/types/base.types";
import { queryClient } from "@/main.tsx";
import { RowDetailModal } from "./row-detail-modal";

const mocks = vi.hoisted(() => {
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (String(args[0]).startsWith("[DEPRECATED] atomFamily")) return;
    warn(...args);
  };
  return { updateRow: vi.fn(), getRowInfo: vi.fn() };
});

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTranslation: () => ({ t: (value: string) => value }),
}));

vi.mock("@/ee/base/services/base-service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRowInfo: mocks.getRowInfo,
}));

vi.mock("@/ee/base/queries/base-row-query", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useUpdateRowMutation: () => ({ mutate: mocks.updateRow, isPending: false }),
  useDeleteRowMutation: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/ee/base/context/base-editable", () => ({
  useBaseEditable: () => true,
}));

vi.mock("@/ee/base/components/property/create-property-popover", () => ({
  CreatePropertyPopover: () => null,
}));

const base = {
  id: "base-1",
  properties: [
    {
      id: "p1",
      pageId: "base-1",
      name: "Name",
      type: "text",
      position: "a",
      typeOptions: {},
      isPrimary: true,
    },
  ],
} as unknown as IBase;

const row = {
  id: "r1",
  pageId: "base-1",
  cells: {},
  position: "a",
} as unknown as IBaseRow;

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

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MantineProvider env="test">{children}</MantineProvider>
  </QueryClientProvider>
);

function renderModal(onClose: () => void, rows: IBaseRow[] = [row]) {
  const ui = (list: IBaseRow[]) => (
    <RowDetailModal
      base={base}
      rows={list}
      openRowId="r1"
      onClose={onClose}
      onNavigate={vi.fn()}
    />
  );
  const { rerender } = render(ui(rows), { wrapper });
  return (list: IBaseRow[]) => rerender(ui(list));
}

beforeEach(() => {
  setMediaMatch();
  mocks.updateRow.mockReset();
  mocks.getRowInfo.mockReset();
  queryClient.clear();
});

afterEach(cleanup);

describe("RowDetailModal Esc", () => {
  it("saves a typed title, then closes, in one press", () => {
    const onClose = vi.fn();
    renderModal(onClose);
    const title = screen.getByRole("textbox", { name: "Name" });

    act(() => title.focus());
    fireEvent.change(title, { target: { value: "dddddd" } });
    fireEvent.keyDown(title, { key: "Escape" });

    expect(mocks.updateRow).toHaveBeenCalledWith({
      rowId: "r1",
      pageId: "base-1",
      cells: { p1: "dddddd" },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.updateRow.mock.invocationCallOrder[0]).toBeLessThan(
      onClose.mock.invocationCallOrder[0],
    );
  });
});

describe("RowDetailModal when its row leaves the list", () => {
  const listed = { ...row, cells: { p1: "Alpha" } } as unknown as IBaseRow;

  it("keeps the row and a typed draft on screen until the row request answers, then shows the answer", async () => {
    let answer!: (value: IBaseRow) => void;
    mocks.getRowInfo.mockReturnValue(new Promise<IBaseRow>((resolve) => (answer = resolve)));
    const setRows = renderModal(vi.fn(), [listed]);
    const title = screen.getByRole("textbox", { name: "Name" });
    act(() => title.focus());
    fireEvent.change(title, { target: { value: "Alpha draft" } });

    setRows([]);
    expect(mocks.getRowInfo).toHaveBeenCalledWith("r1", "base-1");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Alpha draft");
    expect(document.querySelector(".mantine-Skeleton-root")).toBeNull();

    act(() => title.blur());
    await act(async () => answer({ ...listed, cells: { p1: "Beta" } } as unknown as IBaseRow));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Beta"));
  });

  it("closes when the row request says the row is gone", async () => {
    mocks.getRowInfo.mockRejectedValue(new Error("not found"));
    const onClose = vi.fn();
    const setRows = renderModal(onClose, [listed]);
    setRows([]);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

