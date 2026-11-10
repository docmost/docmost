import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBase, IBaseRow } from "@/ee/base/types/base.types";
import { RowDetailModal } from "./row-detail-modal";

const mocks = vi.hoisted(() => ({ updateRow: vi.fn() }));

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTranslation: () => ({ t: (value: string) => value }),
}));

vi.mock("@/ee/base/queries/base-row-query", () => ({
  useBaseRowQuery: () => ({ data: undefined, isError: false }),
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

function renderModal(onClose: () => void) {
  render(
    <RowDetailModal
      base={base}
      rows={[row]}
      openRowId="r1"
      onClose={onClose}
      onNavigate={vi.fn()}
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <MantineProvider env="test">{children}</MantineProvider>
      ),
    },
  );
}

beforeEach(() => {
  setMediaMatch();
  mocks.updateRow.mockReset();
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
