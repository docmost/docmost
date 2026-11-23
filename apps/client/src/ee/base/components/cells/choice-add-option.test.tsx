import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Choice, IBaseProperty } from "@/ee/base/types/base.types";
import { ChoicePicker } from "./choice-picker";
import { CellSelect } from "./cell-select";
import { CellMultiSelect } from "./cell-multi-select";

const propertySave = vi.hoisted(() => {
  let finish = () => {};
  const mutateAsync = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  return { mutateAsync, finish: () => finish() };
});

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

vi.mock("@/ee/base/queries/base-property-query", () => ({
  useUpdatePropertyMutation: () => ({
    mutate: propertySave.mutateAsync,
    mutateAsync: propertySave.mutateAsync,
    isPending: false,
  }),
}));

const property = {
  id: "p1",
  pageId: "base-1",
  name: "Select",
  type: "select",
  position: "a",
  typeOptions: { choices: [], choiceOrder: [] },
  isPrimary: false,
} as unknown as IBaseProperty;

function renderInMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function addOption(name: string) {
  const input = screen.getByPlaceholderText("Search...");
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: "Enter" });
}

function savedChoice(): Choice {
  const [variables] = propertySave.mutateAsync.mock.calls[0] as unknown as [
    { typeOptions: { choices: Choice[] } },
  ];
  return variables.typeOptions.choices.at(-1)!;
}

beforeEach(() => {
  propertySave.mutateAsync.mockClear();
  // jsdom has no ResizeObserver; the multi-select dropdown measures with it.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
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

// The server rejects a cell that points at a choice it hasn't stored yet.
describe("adding an option from the search box", () => {
  it("selects it in the row modal only after the property is saved", async () => {
    const onToggle = vi.fn();
    renderInMantine(
      <ChoicePicker
        property={property}
        selectedIds={[]}
        allowCreate
        onToggle={onToggle}
        onEscape={() => {}}
      />,
    );

    addOption("Flow");
    expect(savedChoice().name).toBe("Flow");
    expect(onToggle).not.toHaveBeenCalled();

    await act(async () => propertySave.finish());
    expect(onToggle).toHaveBeenCalledWith(savedChoice());
  });

  it("commits it in a grid select cell only after the property is saved", async () => {
    const onCommit = vi.fn();
    renderInMantine(
      <CellSelect
        value={null}
        property={property}
        rowId="r1"
        isEditing
        onCommit={onCommit}
        onCancel={() => {}}
      />,
    );

    addOption("Flow");
    expect(onCommit).not.toHaveBeenCalled();

    await act(async () => propertySave.finish());
    expect(onCommit).toHaveBeenCalledWith(savedChoice().id);
  });

  it("adds it in a grid multi-select cell only after the property is saved", async () => {
    const onValueChange = vi.fn();
    renderInMantine(
      <CellMultiSelect
        value={[]}
        property={{ ...property, type: "multiSelect" }}
        rowId="r1"
        isEditing
        onCommit={() => {}}
        onValueChange={onValueChange}
        onCancel={() => {}}
      />,
    );

    addOption("Flow");
    expect(onValueChange).not.toHaveBeenCalled();

    await act(async () => propertySave.finish());
    expect(onValueChange).toHaveBeenCalledWith([savedChoice().id]);
  });
});
