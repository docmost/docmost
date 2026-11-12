import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBase } from "@/ee/base/types/base.types";

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
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("@/ee/base/services/base-service", () => ({
  createBase: vi.fn(),
  getBaseInfo: vi.fn(),
  updateBase: vi.fn(),
  deleteBase: vi.fn(),
  convertPageToBase: vi.fn(),
}));

import { queryClient } from "@/main.tsx";
import { updateBase } from "@/ee/base/services/base-service";
import { BaseSettingsButton } from "./base-settings";

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

const base = (baseTimeZone: string | null) =>
  ({ id: "base-1", name: "Plan", baseTimeZone, properties: [], views: [] }) as unknown as IBase;

function openSettings(baseTimeZone: string | null) {
  render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider env="test">
        <BaseSettingsButton base={base(baseTimeZone)} />
      </MantineProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Base settings" }));
  return screen.getByRole("combobox", { name: "Time zone" }) as HTMLInputElement;
}
const save = () => screen.getByRole("button", { name: "Save" });

beforeEach(() => {
  stubMatchMedia();
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(Intl as unknown as { supportedValuesOf: (key: string) => string[] }, "supportedValuesOf").mockReturnValue([
    "America/New_York",
    "Asia/Calcutta",
    "Europe/Berlin",
  ]);
  vi.mocked(updateBase).mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("base settings", () => {
  it("opens a dialog named Base settings with the base's zone selected", () => {
    const select = openSettings("Europe/Berlin");
    expect(screen.getByRole("dialog", { name: "Base settings" })).toBeTruthy();
    expect(select.value).toBe("Europe/Berlin");
    expect(save()).toHaveProperty("disabled", true);
  });

  it("shows UTC for a base that has no zone", () => {
    expect(openSettings(null).value).toBe("UTC");
    expect(save()).toHaveProperty("disabled", true);
  });

  it("shows a stored zone the browser lists under another name", () => {
    expect(openSettings("Asia/Kolkata").value).toBe("Asia/Kolkata");
  });

  it("finds a zone typed with a space, saves it and closes", async () => {
    vi.mocked(updateBase).mockResolvedValue({ id: "base-1", baseTimeZone: "America/New_York" } as never);
    const select = openSettings("Europe/Berlin");
    fireEvent.click(select);
    fireEvent.change(select, { target: { value: "new york" } });
    fireEvent.click(screen.getByRole("option", { name: "America/New York" }));
    fireEvent.click(save());
    await waitFor(() => expect(updateBase).toHaveBeenCalledWith({ pageId: "base-1", timeZone: "America/New_York" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
