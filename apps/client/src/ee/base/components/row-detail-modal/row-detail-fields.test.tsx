import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBaseProperty, IBaseRow } from "@/ee/base/types/base.types";
import { RowDetailTitle } from "./row-detail-title";
import { FieldProps } from "./fields/detail-field";
import { FieldText } from "./fields/field-text";
import { FieldNumber } from "./fields/field-number";
import { FieldLongText } from "./fields/field-long-text";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTranslation: () => ({ t: (value: string) => value }),
}));

const property = (type: IBaseProperty["type"]) =>
  ({
    id: "p1",
    pageId: "base-1",
    name: "Field",
    type,
    position: "a",
    typeOptions: {},
    isPrimary: false,
  }) as IBaseProperty;

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

// Real focus, so the blur that Esc triggers reaches onBlur as in the browser.
function typeThenEscape(value: string) {
  const input = screen.getByRole("textbox");
  act(() => input.focus());
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Escape" });
  return input;
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

describe("Esc in the row detail modal", () => {
  it("saves a typed title before leaving the field", () => {
    const onCommit = vi.fn();
    render(
      <RowDetailTitle
        row={{ id: "r1", cells: {} } as IBaseRow}
        primaryProperty={{ ...property("text"), isPrimary: true }}
        canEdit
        onCommit={onCommit}
      />,
    );

    const input = typeThenEscape("dddddd");

    expect(onCommit).toHaveBeenCalledWith("dddddd");
    expect(document.activeElement).not.toBe(input);
  });

  it.each([
    ["text", FieldText, "text", "hello", "hello"],
    ["number", FieldNumber, "number", "42", 42],
    ["long text", FieldLongText, "text", "notes", "notes"],
  ] as [string, ComponentType<FieldProps>, IBaseProperty["type"], string, unknown][])(
    "saves a typed %s field before leaving it",
    (_, Field, type, typed, saved) => {
      const onChange = vi.fn();
      render(
        <Field
          property={property(type)}
          value={null}
          rowId="r1"
          readOnly={false}
          onChange={onChange}
        />,
        { wrapper: MantineProvider },
      );

      const input = typeThenEscape(typed);

      expect(onChange).toHaveBeenCalledWith(saved);
      expect(document.activeElement).not.toBe(input);
    },
  );
});

describe("Typing in the row detail modal", () => {
  const titleRow = (title: string) =>
    ({ id: "r1", cells: { p1: title } }) as unknown as IBaseRow;
  const primary = { ...property("text"), isPrimary: true };

  function type(value: string) {
    const input = screen.getByRole("textbox");
    act(() => input.focus());
    fireEvent.change(input, { target: { value } });
    return input;
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves a typed title after a 1 s pause, without leaving the field", () => {
    const onCommit = vi.fn();
    render(
      <RowDetailTitle
        row={titleRow("")}
        primaryProperty={primary}
        canEdit
        onCommit={onCommit}
      />,
    );

    const input = type("dddddd");
    act(() => vi.advanceTimersByTime(999));
    expect(onCommit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(onCommit).toHaveBeenCalledWith("dddddd");
    expect(document.activeElement).toBe(input);
  });

  it("keeps a typed title when the row's title changes elsewhere", () => {
    const props = { primaryProperty: primary, canEdit: true, onCommit: vi.fn() };
    const { rerender } = render(
      <RowDetailTitle row={titleRow("Old")} {...props} />,
    );

    const input = type("My draft");
    rerender(<RowDetailTitle row={titleRow("Remote")} {...props} />);

    expect(input).toHaveProperty("value", "My draft");
  });

  it.each([
    ["text", FieldText, "hello"],
    ["long text", FieldLongText, "notes"],
  ] as [string, ComponentType<FieldProps>, string][])(
    "saves a typed %s field after a 1 s pause",
    (_, Field, typed) => {
      const onChange = vi.fn();
      render(
        <Field
          property={property("text")}
          value={null}
          rowId="r1"
          readOnly={false}
          onChange={onChange}
        />,
        { wrapper: MantineProvider },
      );

      const input = type(typed);
      act(() => vi.advanceTimersByTime(1000));

      expect(onChange).toHaveBeenCalledWith(typed);
      expect(document.activeElement).toBe(input);
    },
  );
});
