import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IBaseProperty } from "@/ee/base/types/base.types";
import { CellText } from "./cell-text";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

const property = {
  id: "p1",
  pageId: "base-1",
  name: "Text",
  type: "text",
  position: "a",
  typeOptions: {},
  isPrimary: false,
} as unknown as IBaseProperty;

afterEach(cleanup);

describe("CellText", () => {
  it("saves what was typed when Esc ends the edit", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <CellText
        value=""
        property={property}
        rowId="r1"
        isEditing
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCommit).toHaveBeenCalledWith("hello");
    expect(onCancel).not.toHaveBeenCalled();
  });
});
