import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGridKeyboardNav } from "./use-grid-keyboard-nav";

type Options = Parameters<typeof useGridKeyboardNav>[0];

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useGridKeyboardNav while editing", () => {
  it("blurs the cell input, which saves it, before leaving edit mode on Esc", () => {
    const container = document.createElement("div");
    const input = document.createElement("input");
    container.appendChild(input);
    document.body.appendChild(container);

    const order: string[] = [];
    input.addEventListener("blur", () => order.push("blur"));
    const setEditingCell = vi.fn(() => {
      order.push("stop editing");
    });

    renderHook(() =>
      useGridKeyboardNav({
        table: {
          getVisibleLeafColumns: () => [],
          getRowModel: () => ({ rows: [] }),
        },
        properties: [],
        containerRef: { current: container },
        focusedCell: null,
        setFocusedCell: vi.fn(),
        editingCell: { rowId: "r1", propertyId: "p1" },
        setEditingCell,
        openEditor: vi.fn(),
        clearCell: vi.fn(),
        beginTypeToEdit: vi.fn(),
        scrollCellIntoView: vi.fn(),
        selectionCount: 0,
        clearSelection: vi.fn(),
        deleteSelected: vi.fn(),
        toggleRowSelection: vi.fn(),
        expandRow: vi.fn(),
        addRow: vi.fn(),
      } as unknown as Options),
    );

    input.focus();
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(order).toEqual(["blur", "stop editing"]);
  });
});
