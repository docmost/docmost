import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/ee/base/hooks/use-viewer-date-context", () => ({
  useViewerDateContext: () => ({ timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" }),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("@/ee/base/services/base-service", () => ({
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
  reorderProperty: vi.fn(),
}));

import { queryClient } from "@/main.tsx";
import { updateProperty } from "@/ee/base/services/base-service";
import { PropertyMenuContent } from "./property-menu";

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

const notes = {
  id: "p1",
  pageId: "base-1",
  name: "Notes",
  type: "text",
  position: "a",
  typeOptions: {},
  isPrimary: false,
} as IBaseProperty;

function chooseType(label: string) {
  render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider env="test">
        <PropertyMenuContent property={notes} opened onClose={vi.fn()} pageId="base-1" />
      </MantineProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("Text"));
  fireEvent.click(screen.getByText(label));
}
const apply = () => fireEvent.click(screen.getByRole("button", { name: "Apply" }));

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
  queryClient.clear();
  queryClient.setQueryData(["bases", "base-1"], { id: "base-1", properties: [notes], views: [] });
  vi.mocked(updateProperty).mockReset();
  vi.mocked(updateProperty).mockResolvedValue({ property: { ...notes, type: "date" }, jobId: null });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("changing a property to a date", () => {
  it("offers the date format and sends the one chosen", async () => {
    chooseType("Date");
    fireEvent.click(screen.getByRole("combobox", { name: "Date format" }));
    fireEvent.click(screen.getByRole("option", { name: "Day/Month/Year" }));
    apply();
    await waitFor(() =>
      expect(updateProperty).toHaveBeenCalledWith({
        propertyId: "p1",
        pageId: "base-1",
        type: "date",
        typeOptions: { dateFormat: "dayMonthYear" },
      }),
    );
  });

  it("sends no date format when none was chosen", async () => {
    chooseType("Date");
    apply();
    await waitFor(() =>
      expect(updateProperty).toHaveBeenCalledWith({ propertyId: "p1", pageId: "base-1", type: "date", typeOptions: {} }),
    );
  });

  it("does not offer a date format for another type", () => {
    chooseType("Number");
    expect(screen.queryByRole("combobox", { name: "Date format" })).toBeNull();
  });
});
