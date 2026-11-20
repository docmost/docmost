import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DateKind } from "@docmost/base-formula/client";
import type { CalendarEventDisplay } from "@/ee/base/components/calendar/calendar-event";

const weekView = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@mantine/schedule", () => ({
  WeekView: (props: Record<string, unknown>) => {
    weekView.props.push(props);
    return null;
  },
}));

import { CalendarWeek } from "./calendar-week";

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

function renderWeek(kind: DateKind) {
  render(
    <CalendarWeek
      date="2026-11-12"
      events={[]}
      height={600}
      firstDayOfWeek={1}
      showWeekends
      labels={{}}
      display={display}
      kind={kind}
      onEventClick={vi.fn()}
    />,
  );
  return weekView.props.at(-1);
}

beforeEach(() => {
  weekView.props = [];
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CalendarWeek", () => {
  it("opens the week of a date-only property at its top", () => {
    expect(renderWeek("date")?.startScrollTime).toBeUndefined();
  });

  it("opens the week of a date-and-time property at 08:00", () => {
    expect(renderWeek("datetime")?.startScrollTime).toBe("08:00:00");
  });
});
