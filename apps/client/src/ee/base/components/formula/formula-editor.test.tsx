import { MantineProvider } from "@mantine/core";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBaseProperty } from "@/ee/base/types/base.types";

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

import { FormulaEditor } from "./formula-editor";

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

const prop = (id: string, name: string, type: IBaseProperty["type"], typeOptions: object = {}) =>
  ({ id, pageId: "base-1", name, type, position: id, typeOptions, isPrimary: false }) as IBaseProperty;
const properties = [
  prop("p1", "When", "date", { includeTime: true }),
  prop("p2", "Day", "date"),
  prop("p3", "Count", "number"),
  prop("p4", "Tag", "select", { choices: [], choiceOrder: [] }),
];

beforeEach(() => {
  stubMatchMedia();
  // Textarea autosize listens for font loads, which jsdom doesn't implement.
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("FormulaEditor", () => {
  it.each([
    ['prop("When")', "Returns Date and time"],
    ['prop("Day")', "Returns Date"],
    ['prop("Count") * 2', "Returns Number"],
    ['prop("Tag")', "Returns Unknown"],
  ])("says what %s returns", (source, text) => {
    render(
      <MantineProvider env="test">
        <FormulaEditor properties={properties} editingPropertyId={null} initialSource={source} onSave={vi.fn()} onCancel={vi.fn()} />
      </MantineProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText(text)).toBeTruthy();
  });
});
