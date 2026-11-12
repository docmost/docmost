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
});
