import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FilterOperator } from "@/ee/base/types/base.types";

const viewer = vi.hoisted(() => ({
  current: { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" },
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

import { FilterDateInput } from "./filter-date-input";

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

function renderInput(op: string, value: unknown) {
  const onChange = vi.fn();
  render(
    <MantineProvider env="test">
      <DatesProvider settings={{ firstDayOfWeek: 0 }}>
        <FilterDateInput op={op as FilterOperator} value={value} onChange={onChange} />
      </DatesProvider>
    </MantineProvider>,
  );
  return onChange;
}

const trigger = (name: string) => screen.getByRole("button", { name });

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
  viewer.current = { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FilterDateInput", () => {
  it.each([
    ["an exact day", "eq", { mode: "exact", date: "2026-11-12" }, "Nov 12, 2026"],
    ["an exact operand that holds an instant, as its UTC day", "eq", { mode: "exact", date: "2026-11-12T00:00:00.000Z" }, "Nov 12, 2026"],
    ["a relative day", "before", { mode: "relative", preset: "today" }, "Today"],
    ["a period", "isWithin", { mode: "range", preset: "thisWeek" }, "This week"],
  ])("shows %s", (_name, op, value, label) => {
    renderInput(op, value);
    expect(trigger(label)).toBeTruthy();
  });

  it.each([
    ["a bare string", "2026-11-12"],
    ["text left from another property type", "abc"],
    ["a number", 5],
    ["an unknown preset", { mode: "relative", preset: "nope" }],
    ["a day that does not exist", { mode: "exact", date: "2026-02-30" }],
    ["the calendar's old window shape", { mode: "exactRange", from: "2026-11-01", to: "2026-11-30" }],
  ])("shows %s as no value and leaves it alone", (_name, value) => {
    const onChange = renderInput("eq", value);
    expect(trigger("Select")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("writes a picked day as a calendar day, whatever the viewer's zone", () => {
    viewer.current = { ...viewer.current, timeZone: "Pacific/Kiritimati" };
    const onChange = renderInput("eq", undefined);
    fireEvent.click(trigger("Select"));
    fireEvent.click(screen.getByLabelText("15 November 2026"));
    expect(onChange).toHaveBeenCalledWith({ mode: "exact", date: "2026-11-15" });
  });

  it("writes a period for is within", () => {
    const onChange = renderInput("isWithin", undefined);
    fireEvent.click(trigger("Select"));
    fireEvent.click(screen.getByText("Past month"));
    expect(onChange).toHaveBeenCalledWith({ mode: "range", preset: "pastMonth" });
  });
});
