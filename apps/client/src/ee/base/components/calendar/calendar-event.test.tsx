import { MantineProvider } from "@mantine/core";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DateCell, DateKind } from "@docmost/base-formula/client";
import type { IBaseProperty, IBaseRow } from "@/ee/base/types/base.types";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
    i18n: { language: "en-US" },
  }),
}));

import { toCalendarEvents } from "@/ee/base/services/calendar-adapter";
import type { CalendarEventDisplay } from "./calendar-event";
import { CalendarMonthEventBody, CalendarWeekEvent, CalendarWeekEventBody } from "./calendar-event";

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

const NY = "America/New_York";
const BERLIN = "Europe/Berlin";

const display = (timeZone: string): CalendarEventDisplay => ({
  pageId: "base-1",
  locale: "en-US",
  dateFormat: undefined,
  timeFormat: "24h",
  timeZone,
  today: "2026-11-12",
  cardProperties: [],
  rowsById: new Map(),
});

function eventOf(value: DateCell, kind: DateKind, timeZone: string) {
  const property = {
    id: "due",
    pageId: "base-1",
    name: "Due",
    type: "date",
    position: "a",
    typeOptions: { includeTime: kind === "datetime" },
    isPrimary: false,
  } as IBaseProperty;
  const row = { id: "r1", pageId: "base-1", cells: { due: value, title: "Plan review" }, position: "a" } as unknown as IBaseRow;
  return toCalendarEvents([row], {
    property,
    primaryPropertyId: "title",
    window: { from: "0100-01-01", to: "9999-12-31" },
    timeZone,
    untitledLabel: "Untitled",
  })[0];
}

function textOf(ui: ReactElement) {
  const { getByTestId, unmount } = render(
    <MantineProvider env="test">
      <div data-testid="event">{ui}</div>
    </MantineProvider>,
  );
  const text = getByTestId("event").textContent ?? "";
  unmount();
  return text;
}

beforeEach(stubMatchMedia);
afterEach(cleanup);

describe("calendar event text", () => {
  const hour = { start: "2026-11-12T15:00:00.000Z", end: "2026-11-12T16:30:00.000Z" };
  const evening = { start: "2026-11-12T22:30:00.000Z", end: "2026-11-12T23:30:00.000Z" };

  it.each([
    ["one day", { start: "2026-11-12" }, "date", "Pacific/Honolulu", "Plan reviewAll day"],
    ["several days", { start: "2026-11-12", end: "2026-11-14" }, "date", "Pacific/Kiritimati", "Plan reviewNov 12, 2026 → Nov 14, 2026"],
    ["a time with no end", { start: hour.start }, "datetime", NY, "Plan review10:00"],
    ["a time range on the viewer's wall clock", hour, "datetime", NY, "Plan review10:00 – 11:30"],
    ["the same range for a viewer in Berlin", hour, "datetime", BERLIN, "Plan review16:00 – 17:30"],
    ["a range inside one day in New York", evening, "datetime", NY, "Plan review17:30 – 18:30"],
    ["the same range, which crosses midnight in Berlin", evening, "datetime", BERLIN, "Plan reviewNov 12, 2026 23:30 → Nov 13, 2026 00:30"],
  ])("the week body shows %s", (_name, value, kind, timeZone, text) => {
    expect(
      textOf(<CalendarWeekEventBody event={eventOf(value, kind as DateKind, timeZone)} display={display(timeZone)} />),
    ).toBe(text);
  });

  it("the month body puts a time before the title only for a date-time value", () => {
    const body = (value: DateCell, kind: DateKind, timeZone: string) =>
      textOf(<CalendarMonthEventBody event={eventOf(value, kind, timeZone)} display={display(timeZone)} />);
    expect(body({ start: "2026-11-12" }, "date", NY)).toBe("Plan review");
    expect(body({ start: hour.start }, "datetime", NY)).toBe("10:00Plan review");
    expect(body({ start: hour.start }, "datetime", BERLIN)).toBe("16:00Plan review");
  });

  it("names an event by its title and full date", () => {
    const { getByRole } = render(
      <MantineProvider env="test">
        <CalendarWeekEvent event={eventOf(hour, "datetime", NY)} rootProps={{ children: null }} display={display(NY)} />
      </MantineProvider>,
    );
    expect(getByRole("button").getAttribute("aria-label")).toBe("Plan review, November 12, 2026 10:00 → 11:30");
  });
});
