import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBaseProperty, RelationPreview } from "@/ee/base/types/base.types";
import type { RelationCandidate } from "@/ee/base/services/base-relation-service";

const relationQueries = vi.hoisted(() => ({
  candidates: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
  }),
}));
vi.mock("@/ee/base/queries/base-relation-query", () => ({
  useRelationCandidatesInfiniteQuery: (args: unknown) => relationQueries.candidates(args),
  useUpdateRelationLinksMutation: () => ({ mutateAsync: relationQueries.mutateAsync }),
}));
vi.mock("@/ee/base/queries/base-page-resolver-query", () => ({
  useResolvedPages: () => ({
    pages: new Map([
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
    ]),
    isLoading: false,
  }),
}));

import { RelationPicker } from "./relation-picker";

const relationProperty = (allowMultiple: boolean) =>
  ({
    id: "rel",
    pageId: "base-1",
    name: "Projects",
    type: "relation",
    isPrimary: false,
    typeOptions: {
      relationId: "relation-1",
      targetBaseId: "b2",
      direction: "source",
      inversePropertyId: null,
      allowMultiple,
    },
  }) as unknown as IBaseProperty;

const rows: RelationCandidate[] = [
  { id: "a", title: "Alpha", linked: true },
  { id: "b", title: "Beta", linked: false },
  { id: "c", title: "", linked: false },
];

function answerCandidates(items: RelationCandidate[]) {
  relationQueries.candidates.mockImplementation(({ query }: { query: string }) => ({
    data: items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())),
    error: null,
  }));
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed: Element[] = [];
  constructor(
    private callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.observed.push(target);
  }
  unobserve() {}
  disconnect() {
    this.observed = [];
  }
  takeRecords() {
    return [];
  }
  intersect() {
    const entries = this.observed.map((target) => ({ target, isIntersecting: true }));
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

const watchingObserver = () =>
  FakeIntersectionObserver.instances.find((observer) => observer.observed.length > 0);

const titled = (from: number, to: number): RelationCandidate[] =>
  Array.from({ length: to - from + 1 }, (_, i) => {
    const n = String(from + i).padStart(2, "0");
    return { id: `r${n}`, title: `Row ${n}`, linked: false };
  });

// an infinite query that shows one more page each time fetchNextPage is called
function answerPagedCandidates(pages: RelationCandidate[][]) {
  const fetchNextPage = vi.fn();
  relationQueries.candidates.mockImplementation(function useFakeCandidates() {
    const [loaded, setLoaded] = useState(1);
    fetchNextPage.mockImplementation(() => setLoaded((n) => n + 1));
    return {
      data: pages.slice(0, loaded).flat(),
      error: null,
      hasNextPage: loaded < pages.length,
      isFetching: false,
      fetchNextPage,
    };
  });
  return fetchNextPage;
}

const lastSearch = () =>
  (relationQueries.candidates.mock.calls.at(-1)?.[0] as { query: string }).query;

function renderPicker({
  allowMultiple = true,
  preview,
  onClose = vi.fn(),
}: {
  allowMultiple?: boolean;
  preview?: RelationPreview;
  onClose?: () => void;
} = {}) {
  render(
    <MantineProvider env="test">
      <RelationPicker
        pageId="base-1"
        rowId="r1"
        property={relationProperty(allowMultiple)}
        preview={preview}
        onClose={onClose}
        autoFocus
      />
    </MantineProvider>,
  );
  return { onClose, input: screen.getByRole("combobox", { name: "Search Projects" }) };
}

const option = (name: string) => screen.getByRole("option", { name: new RegExp(`^${name}`) });

beforeEach(() => {
  relationQueries.candidates.mockReset();
  relationQueries.mutateAsync.mockReset();
  relationQueries.mutateAsync.mockResolvedValue({ preview: { count: 0, rows: [] } });
  answerCandidates(rows);
  Element.prototype.scrollIntoView = () => {};
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
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeIntersectionObserver.instances = [];
});

describe("RelationPicker", () => {
  it("typing searches the other base after the debounce", () => {
    vi.useFakeTimers();
    const { input } = renderPicker();
    expect(relationQueries.candidates).toHaveBeenLastCalledWith({
      pageId: "base-1",
      propertyId: "rel",
      rowId: "r1",
      query: "",
      enabled: true,
    });
    expect(screen.getAllByRole("option")).toHaveLength(3);

    fireEvent.change(input, { target: { value: " Alp" } });
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(lastSearch()).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(lastSearch()).toBe("Alp");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(option("Alpha").textContent).toContain("Linked");
  });

  it("clicking an unlinked row adds it and a linked row removes it", () => {
    const { onClose } = renderPicker();
    expect(option("Alpha").getAttribute("aria-selected")).toBe("true");
    expect(option("Beta").getAttribute("aria-selected")).toBe("false");
    expect(option("Untitled")).toBeTruthy();

    fireEvent.click(option("Beta"));
    expect(relationQueries.mutateAsync).toHaveBeenLastCalledWith({
      rowId: "r1",
      propertyId: "rel",
      add: ["b"],
    });
    expect(option("Beta").getAttribute("aria-selected")).toBe("true");

    fireEvent.click(option("Alpha"));
    expect(relationQueries.mutateAsync).toHaveBeenLastCalledWith({
      rowId: "r1",
      propertyId: "rel",
      remove: ["a"],
    });
    expect(option("Alpha").getAttribute("aria-selected")).toBe("false");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("on a single-row side picking replaces and closes", () => {
    const { onClose } = renderPicker({
      allowMultiple: false,
      preview: { count: 1, rows: [{ id: "a", title: "Alpha" }] },
    });

    fireEvent.click(option("Beta"));

    expect(relationQueries.mutateAsync).toHaveBeenCalledTimes(1);
    expect(relationQueries.mutateAsync).toHaveBeenCalledWith({
      rowId: "r1",
      propertyId: "rel",
      add: ["b"],
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape closes without saving", () => {
    const { input, onClose } = renderPicker();
    fireEvent.keyDown(input, { key: "ArrowDown" });

    fireEvent.keyDown(input, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(relationQueries.mutateAsync).not.toHaveBeenCalled();
  });

  it("Backspace on empty search removes the last link", () => {
    const { input, onClose } = renderPicker({
      preview: {
        count: 2,
        rows: [
          { id: "a", title: "Alpha" },
          { id: "b", title: "Beta" },
        ],
      },
    });
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(relationQueries.mutateAsync).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Backspace" });

    expect(relationQueries.mutateAsync).toHaveBeenCalledWith({
      rowId: "r1",
      propertyId: "rel",
      remove: ["b"],
    });
    expect(screen.queryByRole("button", { name: "Remove Beta" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove Alpha" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("arrow keys, Home and End move the highlight and Enter toggles it", () => {
    const { input } = renderPicker();
    const highlighted = () => input.getAttribute("aria-activedescendant");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(highlighted()).toBe(option("Alpha").id);
    fireEvent.keyDown(input, { key: "End" });
    expect(highlighted()).toBe(option("Untitled").id);
    fireEvent.keyDown(input, { key: "Home" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(highlighted()).toBe(option("Beta").id);

    fireEvent.keyDown(input, { key: "Enter" });

    expect(relationQueries.mutateAsync).toHaveBeenCalledWith({
      rowId: "r1",
      propertyId: "rel",
      add: ["b"],
    });
  });

  it("a chip's remove button unlinks that row", () => {
    renderPicker({ preview: { count: 12, rows: [{ id: "a", title: "Alpha" }] } });
    expect(screen.getByText("+11")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove Alpha" }));

    expect(relationQueries.mutateAsync).toHaveBeenCalledWith({
      rowId: "r1",
      propertyId: "rel",
      remove: ["a"],
    });
  });

  it("puts a row back when its change fails", async () => {
    relationQueries.mutateAsync.mockRejectedValue(new Error("Forbidden"));
    renderPicker();

    await act(async () => {
      fireEvent.click(option("Beta"));
    });

    expect(option("Beta").getAttribute("aria-selected")).toBe("false");
  });

  it("the picker loads more candidates when scrolled to the end", () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    const fetchNextPage = answerPagedCandidates([titled(1, 25), titled(26, 30)]);
    renderPicker();
    expect(screen.getAllByRole("option")).toHaveLength(25);
    expect(fetchNextPage).not.toHaveBeenCalled();

    const observer = watchingObserver();
    expect(observer?.options?.root).toBe(screen.getByRole("listbox"));
    act(() => observer!.intersect());

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("option")).toHaveLength(30);
    expect(watchingObserver()).toBeUndefined();
  });

  it("arrow keys continue into the next page of candidates", () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    const fetchNextPage = answerPagedCandidates([titled(1, 25), titled(26, 30)]);
    const { input } = renderPicker();
    const highlighted = () => input.getAttribute("aria-activedescendant");

    fireEvent.keyDown(input, { key: "End" });
    expect(highlighted()).toBe(option("Row 25").id);
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(highlighted()).toBe(option("Row 25").id);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(highlighted()).toBe(option("Row 26").id);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(relationQueries.mutateAsync).toHaveBeenCalledWith({
      rowId: "r1",
      propertyId: "rel",
      add: ["r26"],
    });
  });

  it("shows No matching rows when the search finds nothing", () => {
    answerCandidates([]);
    renderPicker();
    expect(screen.getByText("No matching rows")).toBeTruthy();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("shows No access when the other base can't be opened", () => {
    relationQueries.candidates.mockReturnValue({
      data: undefined,
      error: new AxiosError("Not found", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 404,
        statusText: "Not Found",
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { message: "Space permissions not found" },
      }),
    });
    renderPicker();
    expect(screen.getByText("No access")).toBeTruthy();
    expect(screen.queryByText("No matching rows")).toBeNull();
  });
});
