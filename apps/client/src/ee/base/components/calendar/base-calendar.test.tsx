import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBase, IBaseView } from "@/ee/base/types/base.types";

const viewer = vi.hoisted(() => ({
  current: { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" },
}));

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
vi.mock("@/ee/base/hooks/use-viewer-date-context", () => ({
  useViewerDateContext: () => viewer.current,
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("@/ee/base/services/base-service", () => ({
  listCalendarRows: vi.fn(),
  listRows: vi.fn(),
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
  deleteRows: vi.fn(),
  getRowInfo: vi.fn(),
  reorderRow: vi.fn(),
  createView: vi.fn(),
  updateView: vi.fn(),
  deleteView: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
  reorderProperty: vi.fn(),
}));
vi.mock("@/ee/base/components/row-detail-modal/row-detail-modal", () => ({
  RowDetailModal: () => null,
}));

import { queryClient } from "@/main.tsx";
import { listCalendarRows } from "@/ee/base/services/base-service";
import { BaseCalendar } from "./base-calendar";

const base = {
  id: "base-1",
  properties: [
    { id: "title", pageId: "base-1", name: "Title", type: "text", position: "a0", typeOptions: {}, isPrimary: true },
    { id: "due", pageId: "base-1", name: "Due", type: "date", position: "a1", typeOptions: {}, isPrimary: false },
  ],
  views: [],
} as unknown as IBase;
const view = {
  id: "v1",
  pageId: "base-1",
  name: "Calendar",
  type: "calendar",
  config: { calendar: { datePropertyId: "due", layout: "month" } },
} as unknown as IBaseView;
const emptyPage = { items: [], meta: { total: 0, truncated: false, timeZone: "America/New_York" } };

function renderCalendar(calendarView: IBaseView = view) {
  render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider env="test">
        <MemoryRouter>
          <BaseCalendar base={base} view={calendarView} pageId="base-1" viewFilter={undefined} />
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}
const asked = () => vi.mocked(listCalendarRows).mock.calls.map(([params]) => [params.from, params.to]);

beforeEach(() => {
  queryClient.clear();
  localStorage.clear();
  viewer.current = { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" };
  vi.mocked(listCalendarRows).mockReset();
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
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BaseCalendar", () => {
  it("asks once for the visible window and holds its shape until the answer", async () => {
    let answer!: (page: unknown) => void;
    vi.mocked(listCalendarRows).mockReturnValue(new Promise((resolve) => (answer = resolve)) as never);
    renderCalendar();

    await waitFor(() => expect(listCalendarRows).toHaveBeenCalledTimes(1));
    expect(vi.mocked(listCalendarRows).mock.calls[0][0]).toEqual({
      pageId: "base-1",
      propertyId: "due",
      from: "2026-11-01",
      to: "2026-12-12",
      filter: undefined,
      limit: 1000,
      timeZone: "America/New_York",
      weekStart: 0,
      today: "2026-11-12",
    });
    expect(document.querySelector('[data-calendar-skeleton="month"]')).not.toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();

    await act(async () => answer(emptyPage));
    await waitFor(() => expect(document.querySelector("[data-calendar-skeleton]")).toBeNull());
    expect(listCalendarRows).toHaveBeenCalledTimes(1);
  });

  it("draws the weeks the viewer's week start gives", async () => {
    viewer.current = { ...viewer.current, weekStart: 1 };
    vi.mocked(listCalendarRows).mockResolvedValue(emptyPage);
    renderCalendar();
    await waitFor(() => expect(asked()).toEqual([["2026-10-26", "2026-12-06"]]));
  });

  it.each([
    ["the stored day", "2026-03-15", "2026-03-01", "2026-04-11"],
    ["today when the stored day cannot be shown", "9999-12-20", "2026-11-01", "2026-12-12"],
    ["today when what is stored is no day", "soon", "2026-11-01", "2026-12-12"],
  ])("opens on %s", async (_name, stored, from, to) => {
    localStorage.setItem("base-calendar-date:v1", stored);
    vi.mocked(listCalendarRows).mockResolvedValue(emptyPage);
    renderCalendar();
    await waitFor(() => expect(asked()).toEqual([[from, to]]));
  });

  it("shows the empty state and asks for nothing when the view names no date property", async () => {
    renderCalendar({ ...view, config: {} } as IBaseView);
    await act(async () => {});
    expect(screen.getByText("This calendar has no date property yet.")).toBeTruthy();
    expect(listCalendarRows).not.toHaveBeenCalled();
    expect(document.querySelector("[data-calendar-skeleton]")).toBeNull();
  });
});
