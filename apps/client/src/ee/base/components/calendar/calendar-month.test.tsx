import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
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
import { CalendarMonth } from "./calendar-month";

function stubBrowser() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
}

const calendarWindow = { from: "2026-10-25", to: "2026-12-05" };
const property = {
  id: "due",
  pageId: "base-1",
  name: "Due",
  type: "date",
  position: "a",
  typeOptions: {},
  isPrimary: false,
} as IBaseProperty;
const display: CalendarEventDisplay = {
  pageId: "base-1",
  locale: "en-US",
  dateFormat: undefined,
  timeFormat: "24h",
  timeZone: "UTC",
  today: "2026-11-12",
  cardProperties: [],
  rowsById: new Map(),
};

function renderMonth(height: number, cells: Record<string, DateCell>, kind: DateKind = "date") {
  const rows = Object.entries(cells).map(([title, due], index) => ({
    id: `row-${index}`,
    pageId: "base-1",
    cells: { due, title },
    position: String(index).padStart(3, "0"),
  })) as unknown as IBaseRow[];
  const events = toCalendarEvents(rows, {
    property: { ...property, typeOptions: { includeTime: kind === "datetime" } },
    primaryPropertyId: "title",
    window: calendarWindow,
    timeZone: "UTC",
    untitledLabel: "Untitled",
  });
  render(
    <MantineProvider env="test">
      <CalendarMonth
        date="2026-11-12"
        events={events}
        calendarWindow={calendarWindow}
        height={height}
        firstDayOfWeek={0}
        showWeekends
        overlaysDisabled={false}
        labels={{ moreLabel: (count: number) => `+${count} more` }}
        display={display}
        kind={kind}
        onEventClick={() => undefined}
      />
    </MantineProvider>,
  );
  return document.querySelector<HTMLElement>(".mantine-MonthView-monthView")!;
}

const shownEvents = () =>
  screen
    .queryAllByRole("button", { name: /^Task / })
    .map((chip) => chip.getAttribute("aria-label")!.split(",")[0])
    .sort();
const moreLinks = () => screen.queryAllByRole("button", { name: /more$/ });

const on = (day: string, titles: string[]) =>
  Object.fromEntries(titles.map((title) => [title, { start: day }]));

beforeEach(stubBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("month day lines", () => {
  it.each([
    [300, "72px", "2"],
    [601, "94px", "3"],
    [640, "100px", "3"],
    [900, "143px", "5"],
    [2400, "393px", "10"],
  ])("a %i px month makes a day %s tall with %s lines", (height, dayHeight, lines) => {
    const month = renderMonth(height, {});
    expect(month.style.getPropertyValue("--calendar-month-day-height")).toBe(dayHeight);
    expect(month.style.getPropertyValue("--month-view-max-events")).toBe(lines);
  });

  it("shows every event of a day that has a line for each", () => {
    renderMonth(601, on("2026-11-18", ["Task A1", "Task A2", "Task A3"]));
    expect(shownEvents()).toEqual(["Task A1", "Task A2", "Task A3"]);
    expect(moreLinks()).toEqual([]);
  });

  it("gives the last line of a day with too many events to the more link", () => {
    renderMonth(601, on("2026-11-11", ["Task A1", "Task A2", "Task A3", "Task A4"]));
    expect(shownEvents()).toEqual(["Task A1", "Task A2"]);
    const [more, ...others] = moreLinks();
    expect(others).toEqual([]);
    expect(more.textContent).toBe("+2 more");
    expect(more.getAttribute("style")).toMatch(/top: calc\(66\.6\d+% \+ 1px\)/);
  });

  it("keeps the other days full when one day has too many events", () => {
    renderMonth(601, {
      ...on("2026-11-11", ["Task A1", "Task A2", "Task A3", "Task A4"]),
      ...on("2026-11-12", ["Task B1", "Task B2", "Task B3"]),
    });
    expect(shownEvents()).toEqual(["Task A1", "Task A2", "Task B1", "Task B2", "Task B3"]);
    expect(moreLinks().map((more) => more.textContent)).toEqual(["+2 more"]);
  });

  it("counts every event it leaves out of a day that a range also covers", () => {
    renderMonth(601, {
      "Task Range": { start: "2026-11-10", end: "2026-11-11" },
      ...on("2026-11-11", ["Task A1", "Task A2", "Task A3"]),
    });
    expect(shownEvents()).toEqual(["Task A1", "Task Range"]);
    expect(moreLinks().map((more) => more.textContent)).toEqual(["+2 more"]);
  });
});

describe("the text of a month event", () => {
  const innerOf = (name: RegExp) =>
    screen
      .getByRole("button", { name })
      .querySelector<HTMLElement>(".mantine-ScheduleEvent-eventInner")!;

  it("keeps a timed event's time and title in one line element", () => {
    renderMonth(601, { "Task Timed": { start: "2026-11-17T09:30:00.000Z" } }, "datetime");
    const inner = innerOf(/^Task Timed/);
    expect(inner.children).toHaveLength(1);
    expect(inner.firstElementChild!.textContent).toBe("09:30Task Timed");
  });

  it("gives a date-only title the same line element", () => {
    renderMonth(601, { "Task Day": { start: "2026-11-17" } });
    const inner = innerOf(/^Task Day/);
    expect(inner.children).toHaveLength(1);
    expect(inner.firstElementChild!.textContent).toBe("Task Day");
  });
});
