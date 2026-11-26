import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_m, name) => String(values?.[name] ?? "")),
  }),
}));

import { RelationReadList } from "./relation-read-list";

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(cleanup);

const renderList = (preview: Parameters<typeof RelationReadList>[0]["preview"]) =>
  render(
    <MantineProvider>
      <RelationReadList preview={preview} targetBaseId="b2" />
    </MantineProvider>,
  );

describe("RelationReadList", () => {
  it("shows chips, falls back to Untitled and counts unloaded rows", () => {
    renderList({
      count: 14,
      rows: [
        { id: "a", title: "Alpha" },
        { id: "b", title: "" },
      ],
    });
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Untitled").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+12").length).toBeGreaterThan(0);
  });

  it("shows No access when restricted and nothing when missing", () => {
    renderList({ count: 0, rows: [], restricted: true });
    expect(screen.getByText("No access")).toBeTruthy();
    cleanup();
    renderList(undefined);
    expect(screen.queryByText("No access")).toBeNull();
    expect(screen.queryByText(/^\+/)).toBeNull();
  });
});
