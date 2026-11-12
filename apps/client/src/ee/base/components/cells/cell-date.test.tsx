import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBaseProperty } from "@/ee/base/types/base.types";

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

import { CellDate } from "./cell-date";
import { CellFormula } from "./cell-formula";
import { CardField } from "@/ee/base/components/kanban/card-field/card-field";
import { PROPERTY_TYPE_REGISTRY } from "@/ee/base/property-types/property-type.registry";

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

const property = (type: IBaseProperty["type"], typeOptions: Record<string, unknown> = {}) =>
  ({ id: "p1", pageId: "base-1", name: "When", type, position: "a", typeOptions, isPrimary: false }) as IBaseProperty;

const idle = { rowId: "r1", isEditing: false, onCommit: vi.fn(), onValueChange: vi.fn(), onCancel: vi.fn() };

function textOf(ui: ReactElement) {
  const { getByTestId, unmount } = render(
    <MantineProvider env="test">
      <div data-testid="cell">{ui}</div>
    </MantineProvider>,
  );
  const text = getByTestId("cell").textContent ?? "";
  unmount();
  return text;
}

beforeEach(() => {
  stubMatchMedia();
  viewer.current = { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" };
});
afterEach(cleanup);

describe("one renderer for every date", () => {
  it("uses the date cell for Created at and Last edited at", () => {
    expect(PROPERTY_TYPE_REGISTRY.createdAt.cellComponent).toBe(CellDate);
    expect(PROPERTY_TYPE_REGISTRY.lastEditedAt.cellComponent).toBe(CellDate);
  });

  it("shows one instant the same way in a date-time cell, both system columns, a formula and a card", () => {
    const instant = "2026-11-12T10:15:30.123Z";
    const texts = [
      textOf(<CellDate {...idle} property={property("date", { includeTime: true })} value={{ start: instant }} />),
      textOf(<CellDate {...idle} property={property("createdAt")} value={instant} />),
      textOf(<CellDate {...idle} property={property("lastEditedAt")} value={instant} />),
      textOf(<CellFormula {...idle} property={property("formula", { resultType: "datetime" })} value={{ start: instant }} />),
      textOf(<CardField property={property("createdAt")} value={instant} pageId="base-1" />),
      textOf(<CardField property={property("formula", { resultType: "datetime" })} value={{ start: instant }} pageId="base-1" />),
    ];
    expect(texts[0]).toMatch(/^Nov 12, 2026 5:15\sAM$/);
    expect(new Set(texts).size).toBe(1);
  });

  it.each(["Pacific/Kiritimati", "Pacific/Honolulu"])("keeps a date-only value on its day in %s", (timeZone) => {
    viewer.current = { ...viewer.current, timeZone };
    expect(textOf(<CellDate {...idle} property={property("date")} value={{ start: "2026-11-12" }} />)).toBe("Nov 12, 2026");
    expect(
      textOf(<CellFormula {...idle} property={property("formula", { resultType: "date" })} value={{ start: "2026-11-12" }} />),
    ).toBe("Nov 12, 2026");
  });

  it("applies the date property's own formats", () => {
    const options = { includeTime: true, dateFormat: "yearMonthDay", timeFormat: "24h" };
    expect(
      textOf(<CellDate {...idle} property={property("date", options)} value={{ start: "2026-11-12T10:15:30.123Z" }} />),
    ).toBe("2026/11/12 05:15");
  });

  it("shows a value of the other kind as empty", () => {
    expect(textOf(<CellDate {...idle} property={property("date")} value={{ start: "2026-11-12T10:15:30.123Z" }} />)).toBe("");
    expect(
      textOf(<CellDate {...idle} property={property("date", { includeTime: true })} value={{ start: "2026-11-12" }} />),
    ).toBe("");
  });

  it("reads what the released editor stored as the day that was clicked", () => {
    expect(textOf(<CellDate {...idle} property={property("date")} value="2026-11-11T00:00:00.000Z" />)).toBe("Nov 11, 2026");
  });

  it.each([
    ["Europe/Berlin", /^Mar 29, 2026 3:30\sAM$/],
    ["America/New_York", /^Mar 28, 2026 9:30\sPM$/],
  ])("shows a date-time cell on the daylight-saving day for a viewer in %s", (timeZone, expected) => {
    viewer.current = { ...viewer.current, timeZone };
    expect(
      textOf(<CellDate {...idle} property={property("date", { includeTime: true })} value={{ start: "2026-03-29T01:30:00.000Z" }} />),
    ).toMatch(expected);
  });
});

describe("which dates open the picker", () => {
  const instant = "2026-11-12T10:15:30.123Z";
  const editing = { ...idle, isEditing: true, onValueChange: vi.fn() };

  it.each([
    ["createdAt", property("createdAt"), instant],
    ["lastEditedAt", property("lastEditedAt"), instant],
    ["a datetime formula", property("formula", { resultType: "datetime" }), { start: instant }],
  ])("never opens the picker for %s", (_name, prop, value) => {
    editing.onValueChange.mockClear();
    const { getByTestId } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MantineProvider env="test">
          <div data-testid="cell">
            <CellDate {...editing} property={prop} value={value} />
          </div>
        </MantineProvider>
      </QueryClientProvider>,
    );
    expect(getByTestId("cell").textContent).toMatch(/^Nov 12, 2026 5:15\sAM$/);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("input")).toBeNull();
    expect(editing.onValueChange).not.toHaveBeenCalled();
  });

  it("opens the picker for a date property", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MantineProvider env="test">
          <CellDate {...editing} property={property("date", { includeTime: true })} value={{ start: instant }} />
        </MantineProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
