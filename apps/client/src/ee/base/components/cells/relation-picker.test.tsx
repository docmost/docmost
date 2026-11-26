import { useState, type ReactElement } from "react";
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IBaseProperty,
  RelationPreview,
  RelationPreviewRow,
} from "@/ee/base/types/base.types";

const relationQueries = vi.hoisted(() => ({
  linked: vi.fn(),
  suggestions: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("react-i18next", async () => {
  const { Fragment, createElement } = await import("react");
  return {
    useTranslation: () => ({
      t: (key: string, values?: Record<string, unknown>) =>
        key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
    }),
    Trans: ({ i18nKey, components }: { i18nKey: string; components: Record<string, ReactElement> }) =>
      createElement(
        Fragment,
        null,
        ...i18nKey
          .split(/<(\w+)\/>/)
          .map((part, i) => (i % 2 ? createElement(Fragment, { key: i }, components[part]) : part)),
      ),
  };
});
vi.mock("@/ee/base/queries/base-relation-query", () => ({
  useRelationRowsInfiniteQuery: (args: unknown) => relationQueries.linked(args),
  useRelationSuggestionsInfiniteQuery: (args: unknown) => relationQueries.suggestions(args),
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

const settled = <T,>(data: T, more: Record<string, unknown> = {}) => ({
  data,
  error: null,
  isPending: false,
  isFetching: false,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  ...more,
});

const matching = (rows: RelationPreviewRow[], query: string) =>
  rows.filter((row) => row.title.toLowerCase().includes(query.toLowerCase()));

// a server whose lists follow the link changes the picker sends
function answerRows(start: { linked: RelationPreviewRow[]; suggestions: RelationPreviewRow[] }) {
  const server = { linked: [...start.linked], suggestions: [...start.suggestions] };
  relationQueries.linked.mockImplementation(({ query }: { query: string }) =>
    settled({ pages: [{ items: matching(server.linked, query), meta: {} }] }),
  );
  relationQueries.suggestions.mockImplementation(({ query }: { query: string }) =>
    settled(matching(server.suggestions, query)),
  );
  return server;
}

const alpha = { id: "a", title: "Alpha" };
const beta = { id: "b", title: "Beta" };
const untitled = { id: "c", title: "" };

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

const titled = (from: number, to: number): RelationPreviewRow[] =>
  Array.from({ length: to - from + 1 }, (_, i) => {
    const n = String(from + i).padStart(2, "0");
    return { id: `r${n}`, title: `Row ${n}` };
  });

// an infinite query that shows one more page each time fetchNextPage is called
function pagedQuery(pages: RelationPreviewRow[][], shape: (rows: RelationPreviewRow[]) => unknown) {
  const fetchNextPage = vi.fn();
  const useFakeQuery = () => {
    const [loaded, setLoaded] = useState(1);
    fetchNextPage.mockImplementation(() => setLoaded((n) => n + 1));
    return settled(shape(pages.slice(0, loaded).flat()), {
      hasNextPage: loaded < pages.length,
      fetchNextPage,
    });
  };
  return { useFakeQuery, fetchNextPage };
}

const linkedPages = (rows: RelationPreviewRow[]) => ({ pages: [{ items: rows, meta: {} }] });

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

const option = (name: string) => screen.getByRole("option", { name });
const linkedGroup = () => screen.queryByRole("group", { name: /^Linked/ });
const addGroup = () => screen.queryByRole("group", { name: "Add from Projects" });
// option texts in order, a linked one marked with *
const optionNames = (group: HTMLElement | null) =>
  group
    ? within(group)
        .queryAllByRole("option")
        .map((el) => `${el.textContent}${el.getAttribute("aria-selected") === "true" ? "*" : ""}`)
    : [];

beforeEach(() => {
  relationQueries.linked.mockReset();
  relationQueries.suggestions.mockReset();
  relationQueries.mutateAsync.mockReset();
  relationQueries.mutateAsync.mockResolvedValue({ preview: { count: 0, rows: [] } });
  answerRows({ linked: [alpha], suggestions: [beta, untitled] });
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
  it("lists the linked rows above the rows to add from the other base", () => {
    renderPicker();

    expect(linkedGroup()?.getAttribute("aria-labelledby")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Linked 1" })).toBeTruthy();
    expect(optionNames(linkedGroup())).toEqual(["Alpha*"]);
    expect(optionNames(addGroup())).toEqual(["Beta", "Untitled"]);
    expect(relationQueries.linked).toHaveBeenLastCalledWith({
      pageId: "base-1",
      rowId: "r1",
      propertyId: "rel",
      query: "",
      enabled: true,
    });
    expect(relationQueries.suggestions).toHaveBeenLastCalledWith({
      pageId: "base-1",
      propertyId: "rel",
      rowId: "r1",
      query: "",
      enabled: true,
    });
  });

  it("typing searches the linked rows and the other base after the debounce", () => {
    vi.useFakeTimers();
    const { input } = renderPicker();

    fireEvent.change(input, { target: { value: " Bet" } });
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(relationQueries.suggestions.mock.calls.at(-1)?.[0].query).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(relationQueries.linked.mock.calls.at(-1)?.[0].query).toBe("Bet");
    expect(relationQueries.suggestions.mock.calls.at(-1)?.[0].query).toBe("Bet");
    expect(linkedGroup()).toBeNull();
    expect(optionNames(addGroup())).toEqual(["Beta"]);
  });

  it("clicking a row to add links it and moves it under Linked", async () => {
    const server = answerRows({ linked: [alpha], suggestions: [beta, untitled] });
    let finish!: () => void;
    relationQueries.mutateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => {
            server.linked.push(beta);
            server.suggestions = server.suggestions.filter((row) => row.id !== "b");
            resolve({ preview: { count: 2, rows: [alpha, beta] } });
          };
        }),
    );
    const { onClose } = renderPicker();

    fireEvent.click(option("Beta"));

    expect(relationQueries.mutateAsync).toHaveBeenCalledWith({
      rowId: "r1",
      propertyId: "rel",
      add: ["b"],
    });
    expect(optionNames(linkedGroup())).toEqual(["Alpha*", "Beta*"]);
    expect(screen.getByRole("group", { name: "Linked 2" })).toBeTruthy();
    expect(optionNames(addGroup())).toEqual(["Untitled"]);

    await act(async () => finish());

    expect(optionNames(linkedGroup())).toEqual(["Alpha*", "Beta*"]);
    expect(optionNames(addGroup())).toEqual(["Untitled"]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clicking a linked row unlinks it", () => {
    relationQueries.mutateAsync.mockReturnValue(new Promise(() => {}));
    renderPicker();

    fireEvent.click(option("Alpha"));

    expect(relationQueries.mutateAsync).toHaveBeenCalledWith({
      rowId: "r1",
      propertyId: "rel",
      remove: ["a"],
    });
    expect(linkedGroup()).toBeNull();
    expect(optionNames(addGroup())).toEqual(["Beta", "Untitled"]);
  });

  it("puts a row back when its change fails", async () => {
    relationQueries.mutateAsync.mockRejectedValue(new Error("Forbidden"));
    renderPicker();

    await act(async () => {
      fireEvent.click(option("Beta"));
    });

    expect(optionNames(linkedGroup())).toEqual(["Alpha*"]);
    expect(optionNames(addGroup())).toEqual(["Beta", "Untitled"]);
  });

  it("on a single-row side picking replaces and closes", () => {
    const { onClose } = renderPicker({
      allowMultiple: false,
      preview: { count: 1, rows: [alpha] },
    });
    expect(screen.getByRole("listbox").getAttribute("aria-multiselectable")).toBeNull();

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

  it("arrow keys move through both sections and Enter toggles the highlighted row", () => {
    const { input } = renderPicker();
    const highlighted = () => input.getAttribute("aria-activedescendant");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(highlighted()).toBe(option("Alpha").id);
    fireEvent.keyDown(input, { key: "End" });
    expect(highlighted()).toBe(option("Untitled").id);
    fireEvent.keyDown(input, { key: "Home" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(highlighted()).toBe(option("Beta").id);
    expect(option("Beta").textContent).toContain("Link");
    expect(option("Untitled").textContent).not.toContain("Link");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(relationQueries.mutateAsync).toHaveBeenCalledWith({
      rowId: "r1",
      propertyId: "rel",
      add: ["b"],
    });
  });

  it("loads the next page of rows to add when scrolled to the end", () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    const suggestions = pagedQuery([titled(1, 25), titled(26, 30)], (rows) => rows);
    relationQueries.suggestions.mockImplementation(suggestions.useFakeQuery);
    relationQueries.linked.mockReturnValue(settled(linkedPages([])));
    renderPicker();
    expect(screen.getAllByRole("option")).toHaveLength(25);
    expect(suggestions.fetchNextPage).not.toHaveBeenCalled();

    const observer = watchingObserver();
    expect(observer?.options?.root).toBe(screen.getByRole("listbox"));
    act(() => observer!.intersect());

    expect(suggestions.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("option")).toHaveLength(30);
    expect(watchingObserver()).toBeUndefined();
  });

  it("finishes the linked rows before listing rows to add", () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    const linked = pagedQuery([titled(1, 3), titled(4, 5)], linkedPages);
    relationQueries.linked.mockImplementation(linked.useFakeQuery);
    renderPicker({ preview: { count: 5, rows: titled(1, 3) } });

    expect(screen.getByRole("group", { name: "Linked 5" })).toBeTruthy();
    expect(addGroup()).toBeNull();
    act(() => watchingObserver()!.intersect());

    expect(linked.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(optionNames(linkedGroup())).toHaveLength(5);
    expect(optionNames(addGroup())).toEqual(["Beta", "Untitled"]);
  });

  it("arrow keys continue into the next page of rows to add", () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    const suggestions = pagedQuery([titled(1, 25), titled(26, 30)], (rows) => rows);
    relationQueries.suggestions.mockImplementation(suggestions.useFakeQuery);
    relationQueries.linked.mockReturnValue(settled(linkedPages([])));
    const { input } = renderPicker();
    const highlighted = () => input.getAttribute("aria-activedescendant");

    fireEvent.keyDown(input, { key: "End" });
    expect(highlighted()).toBe(option("Row 25").id);
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(suggestions.fetchNextPage).toHaveBeenCalledTimes(1);
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

  it("shows placeholder rows while the lists load", () => {
    relationQueries.linked.mockReturnValue(settled(undefined, { isPending: true, isFetching: true }));
    renderPicker();

    expect(screen.getByRole("listbox").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.queryByText("No rows yet")).toBeNull();
  });

  it("says when the other base has no rows or the search finds nothing", () => {
    vi.useFakeTimers();
    answerRows({ linked: [], suggestions: [] });
    const { input } = renderPicker();
    expect(screen.getByText("No rows yet")).toBeTruthy();

    fireEvent.change(input, { target: { value: "zz" } });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText("No matching rows")).toBeTruthy();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("says the rows failed to load instead of calling the base empty", () => {
    relationQueries.linked.mockReturnValue(
      settled(undefined, { error: new Error("offline"), isError: true }),
    );
    renderPicker();

    expect(screen.getByText("Failed to load rows")).toBeTruthy();
    expect(screen.queryByText("No rows yet")).toBeNull();
  });

  it("shows No access when the other base can't be opened", () => {
    relationQueries.suggestions.mockReturnValue(
      settled(undefined, {
        error: new AxiosError("Not found", "ERR_BAD_REQUEST", undefined, undefined, {
          status: 404,
          statusText: "Not Found",
          headers: {},
          config: { headers: new AxiosHeaders() },
          data: { message: "Space permissions not found" },
        }),
      }),
    );
    renderPicker();

    expect(screen.getByText("No access")).toBeTruthy();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});
