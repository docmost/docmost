import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { IBaseProperty } from "@/ee/base/types/base.types";

const viewer = vi.hoisted(() => ({
  current: { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" },
}));
const relationRows = vi.hoisted(() => [
  { id: "x1", title: "Apollo" },
  { id: "x2", title: "Gemini" },
]);

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
vi.mock("@/ee/base/queries/base-relation-query", () => ({
  useRelationSuggestionsInfiniteQuery: () => ({ data: relationRows, error: null }),
  useResolveRelationRows: ({ rowIds }: { rowIds: string[] }) => ({
    data: { items: relationRows.filter((row) => rowIds.includes(row.id)) },
    isLoading: false,
  }),
}));
vi.mock("@/ee/base/queries/base-page-resolver-query", () => ({
  useResolvedPages: (ids: string[]) => ({
    pages: new Map(
      ids.map((id) => [
        id,
        { id, slugId: id, title: id, icon: null, spaceId: "sp", space: { id: "sp", slug: "eng", name: "Eng" } },
      ]),
    ),
    isLoading: false,
  }),
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


const relation = (id: string, name: string, targetBaseId: string) =>
  ({
    id,
    pageId: "base-1",
    name,
    type: "relation",
    position: "a",
    isPrimary: false,
    typeOptions: { relationId: `relation-${id}`, targetBaseId, direction: "source", inversePropertyId: null, allowMultiple: true },
  }) as unknown as IBaseProperty;

it("filter keeps values when switching between relations to the same base and clears them otherwise", () => {
  const onChange = vi.fn();
  render(
    <MantineProvider env="test">
      <ViewFilterConfigPopover
        opened
        onClose={vi.fn()}
        onChange={onChange}
        properties={[
          relation("r1", "Project", "projects"),
          relation("r2", "Parent project", "projects"),
          relation("r3", "Client", "clients"),
        ]}
        conditions={[{ propertyId: "r1", op: "any", value: ["x1", "x2"] }]}
      >
        <button type="button">Filter</button>
      </ViewFilterConfigPopover>
    </MantineProvider>,
  );
  expect(screen.getByRole("button", { name: "Apollo Gemini" })).toBeTruthy();
  const switchTo = (from: string, to: string) => {
    fireEvent.click(screen.getByDisplayValue(from));
    fireEvent.click(screen.getByRole("option", { name: to }));
  };
  const save = () => fireEvent.click(screen.getByRole("button", { name: "Save" }));

  switchTo("Project", "Parent project");
  save();
  expect(onChange).toHaveBeenLastCalledWith([{ propertyId: "r2", op: "any", value: ["x1", "x2"] }]);
  expect(screen.getByRole("button", { name: "Apollo Gemini" })).toBeTruthy();

  switchTo("Parent project", "Client");
  save();
  expect(onChange).toHaveBeenLastCalledWith([{ propertyId: "r3", op: "any", value: undefined }]);
  expect(screen.getByRole("button", { name: "Select" })).toBeTruthy();
});
