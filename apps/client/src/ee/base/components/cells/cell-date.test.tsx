import { MantineProvider } from "@mantine/core";
import { cleanup, render } from "@testing-library/react";
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
});
