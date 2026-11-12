import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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

import { ViewFilterConfigPopover } from "./view-filter-config";

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
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("gives a formula that returns a date the date input", () => {
  const formula = {
    id: "f1",
    pageId: "base-1",
    name: "Next review",
    type: "formula",
    position: "a",
    typeOptions: { resultType: "date" },
    isPrimary: false,
  } as unknown as IBaseProperty;
  render(
    <MantineProvider env="test">
      <ViewFilterConfigPopover
        opened
        onClose={vi.fn()}
        onChange={vi.fn()}
        properties={[formula]}
        conditions={[{ propertyId: "f1", op: "eq", value: { mode: "exact", date: "2026-11-12" } }]}
      >
        <button type="button">Filter</button>
      </ViewFilterConfigPopover>
    </MantineProvider>,
  );
  expect(screen.getByRole("button", { name: "Nov 12, 2026" })).toBeTruthy();
});

const textProperty = (type: string, typeOptions: Record<string, unknown> = {}) =>
  ({ id: "t1", pageId: "base-1", name: "Notes", type, position: "a", typeOptions, isPrimary: false }) as unknown as IBaseProperty;

function renderConditions(property: IBaseProperty, condition: Record<string, unknown>) {
  const onChange = vi.fn();
  render(
    <MantineProvider env="test">
      <ViewFilterConfigPopover
        opened
        onClose={vi.fn()}
        onChange={onChange}
        properties={[property]}
        conditions={[{ propertyId: property.id, ...condition } as never]}
      >
        <button type="button">Filter</button>
      </ViewFilterConfigPopover>
    </MantineProvider>,
  );
  return onChange;
}

it("shows a date operand left under a text property as an empty value and leaves it alone", () => {
  const onChange = renderConditions(textProperty("text"), { op: "contains", value: { mode: "exact", date: "2026-11-12" } });
  expect(screen.getByPlaceholderText("Value")).toHaveProperty("value", "");
  expect(screen.queryByDisplayValue("[object Object]")).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

it("shows a released formula condition, eq with a text value, as it was saved", () => {
  const onChange = renderConditions(textProperty("formula", { resultType: "string" }), { op: "eq", value: "abc" });
  expect(screen.getByPlaceholderText("Value")).toHaveProperty("value", "abc");
  expect(onChange).not.toHaveBeenCalled();
});

