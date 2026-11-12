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

const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({ default: { post } }));

import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PublicForm } from "@/ee/base/types/base.types";
import { submitPublicForm } from "@/ee/base/services/base-form-service";
import { FormFill } from "./form-fill";

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

const form = {
  title: "Sign up",
  description: null,
  submitLabel: null,
  successTitle: null,
  successMessage: null,
  allowResubmit: false,
  access: "public",
  fields: [{ propertyId: "name", type: "text", label: "Name", description: null, required: false, defaultValue: null }],
} as PublicForm;

function fillAndSubmit() {
  render(
    <MantineProvider env="test">
      <FormFill form={form} mode="live" onSubmit={(answers, timeZone) => submitPublicForm({ key: "k1", answers, timeZone })} />
    </MantineProvider>,
  );
  expect(post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ada" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
}

beforeEach(() => {
  stubMatchMedia();
  Element.prototype.scrollIntoView = () => {};
  post.mockReset();
  post.mockResolvedValue({ data: undefined });
  viewer.current = { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" };
});
afterEach(cleanup);

describe("FormFill", () => {
  it("makes no request until it is submitted, then sends the respondent's zone with the answers", async () => {
    fillAndSubmit();
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith("/bases/forms/public/submit", {
      key: "k1",
      answers: { name: "Ada" },
      timeZone: "America/New_York",
    });
  });

  it("still submits, as UTC, when the browser reports no usable zone", async () => {
    viewer.current = { ...viewer.current, timeZone: "UTC" };
    fillAndSubmit();
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][1]).toMatchObject({ timeZone: "UTC" });
  });
});
