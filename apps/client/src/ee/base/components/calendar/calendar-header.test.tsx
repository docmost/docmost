import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { CalendarHeader } from "./calendar-header";

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

function renderHeader(props: Partial<ComponentProps<typeof CalendarHeader>> = {}) {
  render(
    <MantineProvider env="test">
      <CalendarHeader
        unit="month"
        date="2026-11-12"
        calendarWindow={{ from: "2026-11-01", to: "2026-12-12" }}
        layout="month"
        withLayoutSwitch={false}
        isTruncated={false}
        total={0}
        hasLoadError={false}
        onRetry={vi.fn()}
        onLayoutChange={vi.fn()}
        onNavigate={vi.fn()}
        onToday={vi.fn()}
        {...props}
      />
    </MantineProvider>,
  );
}

beforeEach(stubMatchMedia);
afterEach(cleanup);

describe("CalendarHeader", () => {
  it("says how many events match when the window was cut short", () => {
    renderHeader({ isTruncated: true, total: 5754 });
    expect(screen.getByText("Showing the first 1,000 of 5,754 events in this range")).toBeTruthy();
  });

  it("says nothing about a window that came back whole", () => {
    renderHeader({ total: 12 });
    expect(screen.queryByText(/Showing the first/)).toBeNull();
  });
});
