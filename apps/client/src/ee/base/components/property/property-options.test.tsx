import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

import { PropertyOptions } from "./property-options";

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

const due = (typeOptions: Record<string, unknown>) =>
  ({ id: "p1", pageId: "base-1", name: "Due", type: "date", position: "a", typeOptions, isPrimary: false }) as IBaseProperty;

function renderOptions(typeOptions: Record<string, unknown>, hideButtons = false) {
  const onUpdate = vi.fn();
  const onClose = vi.fn();
  const tree = (options: Record<string, unknown>) => (
    <MantineProvider env="test">
      <PropertyOptions property={due(options)} onUpdate={onUpdate} onClose={onClose} hideButtons={hideButtons} />
    </MantineProvider>
  );
  const { rerender } = render(tree(typeOptions));
  return { onUpdate, onClose, rerenderWith: (options: Record<string, unknown>) => rerender(tree(options)) };
}

const includeTime = () => screen.getByRole("switch", { name: "Include time" });
const button = (name: string) => screen.getByRole("button", { name });

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

describe("date property options", () => {
  it("asks before a property loses its time and sends only the known keys", () => {
    const { onUpdate, onClose } = renderOptions({ includeTime: true, timeFormat: "24h", defaultValue: "2026-01-01" });
    fireEvent.click(includeTime());
    fireEvent.click(button("Save"));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText("Remove time from Due?")).toBeTruthy();
    expect(screen.getByText("Cells keep their day and lose the time.")).toBeTruthy();
    fireEvent.click(button("Remove time"));
    expect(onUpdate).toHaveBeenCalledWith({ includeTime: false, timeFormat: "24h" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("goes back to the options when the confirmation is cancelled", () => {
    const { onUpdate, onClose } = renderOptions({ includeTime: true });
    fireEvent.click(includeTime());
    fireEvent.click(button("Save"));
    fireEvent.click(button("Cancel"));
    expect(includeTime()).toHaveProperty("checked", false);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes the confirmation when the stored options are replaced, and sends nothing", () => {
    const { onUpdate, onClose, rerenderWith } = renderOptions({ includeTime: true });
    fireEvent.click(includeTime());
    fireEvent.click(button("Save"));
    expect(screen.getByText("Remove time from Due?")).toBeTruthy();
    rerenderWith({ includeTime: true });
    expect(screen.queryByText("Remove time from Due?")).toBeNull();
    expect(includeTime()).toHaveProperty("checked", true);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("puts focus on Cancel when the confirmation opens", () => {
    renderOptions({ includeTime: true });
    fireEvent.click(includeTime());
    fireEvent.click(button("Save"));
    expect(document.activeElement).toBe(button("Cancel"));
  });

  it("names the confirmation by its question", () => {
    renderOptions({ includeTime: true });
    fireEvent.click(includeTime());
    fireEvent.click(button("Save"));
    expect(screen.getByRole("group", { name: "Remove time from Due?" })).toBeTruthy();
  });

  it("puts focus back on Include time when the confirmation is cancelled", () => {
    renderOptions({ includeTime: true });
    fireEvent.click(includeTime());
    fireEvent.click(button("Save"));
    fireEvent.click(button("Cancel"));
    expect(document.activeElement).toBe(includeTime());
  });

  it("saves a property that gains a time without asking", () => {
    const { onUpdate } = renderOptions({});
    fireEvent.click(includeTime());
    fireEvent.click(button("Save"));
    expect(onUpdate).toHaveBeenCalledWith({ includeTime: true });
  });

  it("offers the time format only when dates have a time", () => {
    renderOptions({});
    expect(screen.queryByRole("combobox", { name: "Time format" })).toBeNull();
    fireEvent.click(includeTime());
    expect(screen.getByRole("combobox", { name: "Time format" })).toBeTruthy();
  });

  it("applies each change at once while a property is being created, with no confirmation", () => {
    const { onUpdate } = renderOptions({ includeTime: true }, true);
    fireEvent.click(includeTime());
    expect(onUpdate).toHaveBeenLastCalledWith({ includeTime: false });
    expect(screen.queryByText(/Remove time from/)).toBeNull();
  });
});
