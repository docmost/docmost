import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { DateValuePicker } from "./date-value-picker";

type PickerProps = Omit<ComponentProps<typeof DateValuePicker>, "onChange">;

function renderPicker(props: PickerProps) {
  const onChange = vi.fn();
  render(
    <MantineProvider env="test">
      <DatesProvider settings={{ firstDayOfWeek: 0 }}>
        <DateValuePicker {...props} onChange={onChange} />
      </DatesProvider>
    </MantineProvider>,
  );
  return onChange;
}

const day = (label: string) => screen.getByLabelText(label);
const inZone = (timeZone: string) => {
  viewer.current = { ...viewer.current, timeZone };
};

beforeEach(() => {
  stubMatchMedia();
  viewer.current = { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" };
});
afterEach(cleanup);

describe("DateValuePicker", () => {
  it("has no per-cell time switch", () => {
    renderPicker({ value: null, kind: "date" });
    expect(screen.queryByRole("switch", { name: "Include time" })).toBeNull();
    expect(screen.getByRole("switch", { name: "End date" })).toBeTruthy();
  });

  it.each(["Pacific/Kiritimati", "Pacific/Honolulu"])("writes a calendar day for a date property in %s", (timeZone) => {
    inZone(timeZone);
    const onChange = renderPicker({ value: null, kind: "date" });
    fireEvent.click(day("15 November 2026"));
    expect(onChange).toHaveBeenCalledWith({ start: "2026-11-15" });
  });

  it.each([
    ["America/New_York", "2026-11-15T14:00:00.000Z"],
    ["Europe/Berlin", "2026-11-15T08:00:00.000Z"],
  ])("writes 09:00 in %s for a date-time property", (timeZone, start) => {
    inZone(timeZone);
    const onChange = renderPicker({ value: null, kind: "datetime" });
    fireEvent.click(day("15 November 2026"));
    expect(onChange).toHaveBeenCalledWith({ start });
  });

  it.each([
    ["Europe/Berlin", "2026-03-29", "29 March 2026", "2026-03-29T07:00:00.000Z"],
    ["America/New_York", "2026-03-08", "8 March 2026", "2026-03-08T13:00:00.000Z"],
  ])("writes 09:00 on the daylight-saving day for a viewer in %s", (timeZone, today, dayLabel, start) => {
    viewer.current = { ...viewer.current, timeZone, today };
    const onDateTime = renderPicker({ value: null, kind: "datetime" });
    fireEvent.click(day(dayLabel));
    expect(onDateTime).toHaveBeenCalledWith({ start });
    cleanup();
    const onDate = renderPicker({ value: null, kind: "date" });
    fireEvent.click(day(dayLabel));
    expect(onDate).toHaveBeenCalledWith({ start: today });
  });

  it("leaves the second 01:30 alone when its own day is clicked", () => {
    const onChange = renderPicker({ value: { start: "2026-11-01T06:30:00.000Z" }, kind: "datetime" });
    fireEvent.click(day("1 November 2026"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    ["2026-11-01T05:30:00.000Z", "Start time, EDT"],
    ["2026-11-01T06:30:00.000Z", "Start time, EST"],
  ])("shows the zone beside the time of %s", (start, name) => {
    renderPicker({ value: { start }, kind: "datetime" });
    expect(screen.getByLabelText(name)).toBeTruthy();
    expect(screen.getByText(name.slice(-3))).toBeTruthy();
  });

  it("adds an end to a date only once a later day is picked", () => {
    const onChange = renderPicker({ value: { start: "2026-11-12" }, kind: "date" });
    fireEvent.click(screen.getByRole("switch", { name: "End date" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(day("15 November 2026"));
    expect(onChange).toHaveBeenCalledWith({ start: "2026-11-12", end: "2026-11-15" });
  });

  it("gives a date-time one hour when End date is switched on", () => {
    const onChange = renderPicker({ value: { start: "2026-11-12T14:00:00.000Z" }, kind: "datetime" });
    fireEvent.click(screen.getByRole("switch", { name: "End date" }));
    expect(onChange).toHaveBeenCalledWith({ start: "2026-11-12T14:00:00.000Z", end: "2026-11-12T15:00:00.000Z" });
  });

  it("opens empty on a value that has no day in the viewer's zone", () => {
    inZone("Pacific/Auckland");
    renderPicker({ value: { start: "9999-12-31T23:59:59.999Z" }, kind: "datetime" });
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });

  describe("at the upper bound", () => {
    const edge = { start: "9999-12-31T04:30:00.000Z" };
    const onLastDay = { start: "9999-12-31T17:00:00.000Z" };

    function collectErrors() {
      const errors: unknown[] = [];
      const listener = (event: ErrorEvent) => {
        errors.push(event.error);
        event.preventDefault();
      };
      window.addEventListener("error", listener);
      return { errors, stop: () => window.removeEventListener("error", listener) };
    }

    function typeTime(hours: string, minutes: string) {
      const hoursInput = screen.getByLabelText("Hours");
      fireEvent.change(hoursInput, { target: { value: hours } });
      fireEvent.change(screen.getByLabelText("Minutes"), { target: { value: minutes } });
    }

    it("does not write a day whose wall clock would pass year 9999", () => {
      const onChange = renderPicker({ value: edge, kind: "datetime" });
      const { errors, stop } = collectErrors();
      fireEvent.click(day("31 December 9999"));
      stop();
      expect(errors).toEqual([]);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("does not write a time that would pass year 9999", () => {
      const onChange = renderPicker({ value: onLastDay, kind: "datetime" });
      typeTime("11", "30");
      const { errors, stop } = collectErrors();
      fireEvent.blur(screen.getByLabelText("Minutes"));
      stop();
      expect(errors).toEqual([]);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("does not throw when it unmounts with such a time pending", () => {
      const onChange = renderPicker({ value: onLastDay, kind: "datetime" });
      typeTime("11", "30");
      expect(() => cleanup()).not.toThrow();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Clear", () => {
    const clearButton = () => screen.queryByRole("button", { name: "Clear" });

    it("removes a stored value that opens as empty", () => {
      inZone("Europe/Berlin");
      const onChange = renderPicker({ value: { start: "9999-12-31T23:30:00.000Z" }, kind: "datetime" });
      fireEvent.click(clearButton()!);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(null);
    });

    it("does nothing when the value is already empty", () => {
      const onChange = renderPicker({ value: null, kind: "datetime" });
      expect(clearButton()).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("clears an ordinary value once", () => {
      const onChange = renderPicker({ value: { start: "2026-11-12T14:00:00.000Z" }, kind: "datetime" });
      fireEvent.click(clearButton()!);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  describe("a value of the other kind", () => {
    it.each([
      [{ start: "2026-11-12" }, "datetime"],
      [{ start: "2026-11-12T14:00:00.000Z" }, "date"],
    ] as const)("opens %j empty under kind %s and writes nothing", (value, kind) => {
      const onChange = renderPicker({ value, kind });
      expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("follows the viewer's zone while open", () => {
      const props = { value: { start: "9999-12-31T23:30:00.000Z" }, kind: "datetime" as const, onChange: vi.fn() };
      inZone("Europe/Berlin");
      const ui = () => (
        <MantineProvider env="test">
          <DatesProvider settings={{ firstDayOfWeek: 0 }}>
            <DateValuePicker {...props} />
          </DatesProvider>
        </MantineProvider>
      );
      const { rerender } = render(ui());
      expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
      inZone("America/New_York");
      rerender(ui());
      expect(screen.getByRole("button", { name: /^Start: / })).toBeTruthy();
      expect(props.onChange).not.toHaveBeenCalled();
    });
  });

  it("never calls onChange on mount or when a new value arrives", () => {
    const onChange = vi.fn();
    const ui = (value: ComponentProps<typeof DateValuePicker>["value"]) => (
      <MantineProvider env="test">
        <DatesProvider settings={{ firstDayOfWeek: 0 }}>
          <DateValuePicker value={value} kind="datetime" onChange={onChange} />
        </DatesProvider>
      </MantineProvider>
    );
    const { rerender } = render(ui({ start: "2026-11-12T14:00:00.000Z" }));
    rerender(ui({ start: "2026-11-13T14:00:00.000Z", end: "2026-11-13T15:00:00.000Z" }));
    rerender(ui(null));
    expect(onChange).not.toHaveBeenCalled();
  });
});
