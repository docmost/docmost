import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBaseProperty } from "@/ee/base/types/base.types";
import { CellLongText } from "./cell-long-text";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

const property = {
  id: "p1",
  pageId: "base-1",
  name: "Long text",
  type: "text",
  position: "a",
  typeOptions: {},
  isPrimary: false,
} as unknown as IBaseProperty;

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

beforeEach(() => {
  setMediaMatch();
  // Textarea autosize listens for font loads, which jsdom doesn't implement.
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
});

afterEach(cleanup);

describe("CellLongText", () => {
  it("saves what was typed when Esc closes the editor", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <CellLongText
        value=""
        property={property}
        rowId="r1"
        isEditing
        onCommit={onCommit}
        onValueChange={vi.fn()}
        onCancel={onCancel}
      />,
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <MantineProvider env="test">{children}</MantineProvider>
        ),
      },
    );
    const textarea = screen.getByRole("textbox");

    fireEvent.change(textarea, { target: { value: "what is love" } });
    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(onCommit).toHaveBeenCalledWith("what is love");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("autosaves after a 1 s typing pause", () => {
    vi.useFakeTimers();
    const onValueChange = vi.fn();
    render(
      <CellLongText
        value=""
        property={property}
        rowId="r1"
        isEditing
        onCommit={vi.fn()}
        onValueChange={onValueChange}
        onCancel={vi.fn()}
      />,
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <MantineProvider env="test">{children}</MantineProvider>
        ),
      },
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "what is love" },
    });
    act(() => vi.advanceTimersByTime(1000));

    expect(onValueChange).toHaveBeenCalledWith("what is love");
    vi.useRealTimers();
  });
});
