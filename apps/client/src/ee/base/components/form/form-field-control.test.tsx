import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import type {} from "@testing-library/jest-dom/vitest";
import { createRequire } from "node:module";
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import type { PublicFormField } from "@/ee/base/types/base.types";
import { FormFieldControl } from "./form-field-control";

// jest-dom's ESM build cannot load lodash in Node, so its CommonJS matchers are used
expect.extend(createRequire(import.meta.url)("@testing-library/jest-dom/matchers"));

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

const question = (over: Partial<PublicFormField> = {}) =>
  ({ propertyId: "when", type: "date", label: "When", description: null, required: false, defaultValue: null, includeTime: true, ...over }) as PublicFormField;

function renderControl(field: PublicFormField, value: unknown) {
  return render(
    <MantineProvider env="test">
      <FormFieldControl field={field} value={value} onChange={vi.fn()} controlId="q" ariaLabelledBy="q-label" />
    </MantineProvider>,
  );
}

beforeEach(() => {
  stubMatchMedia();
  viewer.current = { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" };
});
afterEach(cleanup);

describe("a date question", () => {
  it("puts the respondent's zone in the time input's description", () => {
    const { container } = renderControl(question(), null);
    const caption = screen.getByText("Time zone: America/New York (EST)");
    expect(caption.id).not.toBe("");
    expect(container.querySelector(`[aria-describedby~="${caption.id}"]`)).not.toBeNull();
  });

  it("names the offset in force at the answer's own time", () => {
    renderControl(question(), { start: "2026-07-01T14:00:00.000Z" });
    expect(screen.getByText("Time zone: America/New York (EDT)")).toBeTruthy();
  });

  it("says UTC when the browser reports no usable zone", () => {
    viewer.current = { ...viewer.current, timeZone: "UTC" };
    renderControl(question(), null);
    expect(screen.getByText("Time zone: UTC")).toBeTruthy();
  });

  it("shows no zone for a question without a time", () => {
    renderControl(question({ includeTime: false }), { start: "2026-11-12" });
    expect(screen.queryByText(/Time zone/)).toBeNull();
  });

  it.each([
    [question({ dateFormat: "yearMonthDay", timeFormat: "24h" }), { start: "2026-11-12T15:00:00.000Z" }, "2026/11/12 10:00"],
    [question({ includeTime: false, dateFormat: "dayMonthYear" }), { start: "2026-11-12" }, "12/11/2026"],
    [question({ includeTime: false, dateFormat: "relative" }), { start: "2026-11-12" }, "Nov 12, 2026"],
    [question({ includeTime: false }), { start: "2026-11-12" }, "Nov 12, 2026"],
  ])("shows the answer in the question's own format", (field, value, text) => {
    renderControl(field, value);
    expect(screen.getByText(text)).toBeTruthy();
  });

  it("shows an answer of the other kind as no answer", () => {
    renderControl(question({ includeTime: false }), { start: "2026-11-12T15:00:00.000Z" });
    expect(screen.getByText("Pick a date")).toBeTruthy();
  });
});

describe("a question's description and error", () => {
  it.each([
    ["text", question({ type: "text", includeTime: undefined }), "Ada", []],
    ["date", question(), { start: "2026-11-12T15:00:00.000Z" }, [/Time zone: America\/New York \(EST\)/]],
  ])("describe the input of a %s question", (_type, field, value, captions) => {
    const { container } = render(
      <MantineProvider env="test">
        <FormFieldControl
          field={field}
          value={value}
          onChange={vi.fn()}
          controlId="q"
          ariaLabelledBy="q-label"
          description="Use your work address"
          error="Enter a valid answer"
        />
      </MantineProvider>,
    );
    const input = container.querySelector("#q");
    expect(input).not.toBeNull();
    expect(input).toHaveAccessibleDescription(/Use your work address/);
    expect(input).toHaveAccessibleDescription(/Enter a valid answer/);
    for (const caption of captions) expect(input).toHaveAccessibleDescription(caption);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Use your work address")).toBeVisible();
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid answer");
  });
});
