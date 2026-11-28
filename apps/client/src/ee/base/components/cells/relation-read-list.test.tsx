import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedPage } from "@/ee/base/queries/base-page-resolver-query";

const resolved = vi.hoisted(() => ({ pages: new Map<string, ResolvedPage | null>() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_m, name) => String(values?.[name] ?? "")),
  }),
}));
vi.mock("@/ee/base/queries/base-page-resolver-query", () => ({
  useResolvedPages: () => ({ pages: resolved.pages, isLoading: false }),
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
beforeEach(() => {
  resolved.pages = new Map();
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

  it("says Base deleted when the related base is in the trash or gone", () => {
    renderList({ count: 0, rows: [], restricted: true, deleted: true });
    expect(screen.getByText("Base deleted")).toBeTruthy();
    expect(screen.queryByText("No access")).toBeNull();
  });

  it("chips link to the other base's row without starting an edit", () => {
    resolved.pages = new Map([
      [
        "b2",
        {
          id: "b2",
          slugId: "s2",
          title: "Projects",
          icon: null,
          spaceId: "sp",
          space: { id: "sp", slug: "eng", name: "Engineering" },
        },
      ],
    ]);
    const onClick = vi.fn();
    const onDoubleClick = vi.fn();
    render(
      <MemoryRouter>
        <MantineProvider>
          <div onClick={onClick} onDoubleClick={onDoubleClick}>
            <RelationReadList
              preview={{ count: 1, rows: [{ id: "a", title: "Alpha" }] }}
              targetBaseId="b2"
            />
          </div>
        </MantineProvider>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Open Alpha" });
    expect(link.getAttribute("href")).toBe("/s/eng/p/projects-s2?row=a&rowBase=b2");

    fireEvent.click(link);
    fireEvent.doubleClick(link);

    expect(onClick).not.toHaveBeenCalled();
    expect(onDoubleClick).not.toHaveBeenCalled();
  });
});
