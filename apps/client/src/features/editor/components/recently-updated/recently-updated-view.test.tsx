import { MantineProvider } from "@mantine/core";
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Editor, EditorContent } from "@tiptap/react";
import { Document } from "@tiptap/extension-document";
import { Text } from "@tiptap/extension-text";
import {
  RecentlyUpdated,
  type RecentlyUpdatedAttributes,
} from "@docmost/editor-ext";
import { createStore, Provider } from "jotai";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import api from "@/lib/api-client";
import { pageEditorBindingAtom } from "@/features/editor/atoms/editor-atoms";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { EditorSpaceContext } from "./editor-space-context";
import RecentlyUpdatedView from "./recently-updated-view";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));
vi.mock("@/features/space/queries/space-query", () => ({
  useGetSpaceBySlugQuery: vi.fn((key?: string) => ({
    data: [teamSpace, otherSpace].find(
      (space) => space.id === key || space.slug === key,
    ),
  })),
  useUnlistedSpaceQuery: () => ({ data: undefined }),
  useGetSpacesQuery: () => ({
    data: { items: [teamSpace, otherSpace] },
  }),
}));
vi.mock("@/features/label/queries/label-query", () => ({
  useWorkspaceLabelsQuery: () => ({
    data: {
      items: [
        { name: "review" },
        { name: "-draft" },
        { name: "draft" },
        { name: oversizedLabel },
        { name: boundaryLabel },
      ],
    },
  }),
}));
vi.mock("@/features/user/atoms/current-user-atom", async () => ({
  userAtom: (await import("jotai")).atom({ id: "viewer" }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/\{\{(\w+)\}\}/g, (match, name) =>
        options && name in options ? String(options[name]) : match,
      ),
  }),
}));
vi.mock("@/lib/time", () => ({
  formatFullDateTime: () => "Aug 01, 2026, 8:30AM",
  shortTimeAgo: () => "",
}));

const spaceId = "de44053e-d614-453b-9706-1737faf19b87";
const teamSpace = {
  id: spaceId,
  name: "Product design",
  slug: "team",
  logo: "design.png",
};
const otherId = "dcb7b4d5-a068-448d-9f18-e8b0684ee57e";
const oversizedLabel = "x".repeat(257);
const boundaryLabel = "x".repeat(254) + "📌☀️";
const otherSpace = { id: otherId, name: "Engineering", slug: "eng" };
const editors: Editor[] = [];

function show(
  path: string,
  attrs: Partial<RecentlyUpdatedAttributes> = {},
  sourceId?: string,
  {
    editable = true,
    templateSpaceId,
  }: { editable?: boolean; templateSpaceId?: string } = {},
) {
  const editor = new Editor({
    extensions: [
      Document,
      Text,
      RecentlyUpdated.configure({ view: RecentlyUpdatedView }),
    ],
    editable,
    content: { type: "doc", content: [{ type: "recentlyUpdated", attrs }] },
  });
  editors.push(editor);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = createStore();
  const content = templateSpaceId ? (
    <EditorSpaceContext.Provider value={templateSpaceId}>
      <EditorContent editor={editor} />
    </EditorSpaceContext.Provider>
  ) : (
    <EditorContent editor={editor} />
  );
  render(
    <MemoryRouter initialEntries={[path]}>
      <MantineProvider env="test">
        <QueryClientProvider client={queryClient}>
          <EditorSpaceContext.Provider value={sourceId}>
            <Routes>
              {[
                "/docs/:spaceSlug",
                "/share/:shareId/p/:pageSlug",
                "/share/p/:pageSlug",
                "/s/:spaceSlug",
                "/templates",
                "/templates/:templateId",
              ].map((path) => (
                <Route key={path} path={path} element={content} />
              ))}
            </Routes>
          </EditorSpaceContext.Provider>
        </QueryClientProvider>
      </MantineProvider>
    </MemoryRouter>,
    {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    },
  );
  return { editor, queryClient, store };
}

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView ??= vi.fn();
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= (media) => ({
    media,
    matches: false,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
});

afterEach(() => {
  cleanup();
  editors.splice(0).forEach((editor) => editor.destroy());
  vi.useRealTimers();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

it.each(["/docs/team", "/share/abc/p/home", "/share/p/home"])(
  "renders nothing and makes no block requests on %s even with a signed-in viewer",
  (path) => {
    show(path, { labels: ["private"], scope: "workspace" }, spaceId);
    expect(document.querySelector('[data-type="recently-updated"]')).toBeNull();
    expect(screen.queryByText("Recently updated")).toBeNull();
    expect(screen.queryByText("No matching pages")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(useGetSpaceBySlugQuery).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  },
);

it("waits for a source space before requesting authenticated rows", () => {
  show("/templates/sample");
  expect(api.post).not.toHaveBeenCalled();
});

it.each([
  { surface: "template editor", path: "/templates/sample", editable: true },
  {
    surface: "read-only template preview",
    path: "/templates",
    editable: false,
  },
  {
    surface: "template preview inside another space",
    path: "/s/other",
    editable: false,
    outerSpace: otherId,
  },
])(
  "loads the template's own space in the $surface",
  async ({ path, editable, outerSpace }) => {
    vi.mocked(api.post).mockResolvedValue({
      data: [
        {
          id: "result",
          slugId: "abc",
          title: "Design notes",
          spaceSlug: "team",
        },
      ],
    });
    show(path, { scope: "current" }, outerSpace, {
      editable,
      templateSpaceId: spaceId,
    });

    expect(
      await screen.findByRole("link", { name: "Design notes" }),
    ).toBeTruthy();
    expect(api.post).toHaveBeenCalledExactlyOnceWith(
      "/pages/recently-updated",
      { spaceId },
    );
    if (editable) {
      fireEvent.click(
        screen.getByRole("button", { name: "Recently updated settings" }),
      );
      expect(
        within(screen.getByRole("dialog")).getByPlaceholderText(
          "Product design",
        ),
      ).toBeTruthy();
    } else {
      expect(
        screen.queryByRole("button", { name: "Recently updated settings" }),
      ).toBeNull();
    }
  },
);

it("closes settings on a silent switch to Read and restores the button on Edit", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: [] });
  const { editor, store } = show("/s/team", {}, spaceId);
  const settings = { name: "Recently updated settings" };
  const switchMode = (editable: boolean) =>
    act(() => {
      editor.setEditable(editable, false);
      store.set(pageEditorBindingAtom, { pageId: "host", editor, editable });
    });

  await screen.findByText("No matching pages");
  switchMode(true);
  fireEvent.click(screen.getByRole("button", settings));
  expect(screen.getByRole("dialog")).toBeTruthy();
  switchMode(false);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("button", settings)).toBeNull();
  switchMode(true);
  expect(screen.getByRole("button", settings)).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("offers named spaces including the host and saves a multi-space selection", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: [] });
  const { editor } = show("/s/team", {});
  fireEvent.click(
    screen.getByRole("button", { name: "Recently updated settings" }),
  );
  const dialog = within(screen.getByRole("dialog"));
  const spaces = dialog.getByRole("combobox", { name: "Spaces" });
  expect(spaces.getAttribute("placeholder")).toBe("Product design");
  expect(
    dialog.getByRole("checkbox", {
      name: "All accessible spaces",
      checked: false,
    }),
  ).toBeTruthy();
  expect(
    spaces.closest(".mantine-MultiSelect-wrapper")?.querySelector("img")?.src,
  ).toContain("/space-icon/design.png");
  act(() => spaces.focus());
  expect(dialog.getAllByRole("option")).toEqual([
    dialog.getByRole("option", { name: "Product design" }),
    dialog.getByRole("option", { name: "Engineering" }),
  ]);
  fireEvent.click(dialog.getByRole("option", { name: "Engineering" }));
  fireEvent.click(dialog.getByRole("option", { name: "Product design" }));
  expect(dialog.queryByRole("radiogroup")).toBeNull();
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  const selection = { scope: "spaces", spaceIds: [otherId, spaceId] };
  expect(editor.getJSON().content[0].attrs).toMatchObject(selection);
  await waitFor(() =>
    expect(api.post).toHaveBeenLastCalledWith("/pages/recently-updated", {
      spaceId,
      ...selection,
    }),
  );
});

it("clears a named selection back to the containing space, including after a move", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: [] });
  const { editor } = show(
    "/s/team",
    { scope: "spaces", spaceIds: [spaceId] },
    spaceId,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Recently updated settings" }),
  );
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.click(
    dialog.getByRole("button", { name: "Remove Product design" }),
  );
  expect(dialog.getByPlaceholderText("Product design")).toBeTruthy();
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  const saved = editor.getJSON().content[0].attrs;
  expect(saved).toMatchObject({ scope: "current", spaceIds: [] });
  await waitFor(() =>
    expect(api.post).toHaveBeenLastCalledWith("/pages/recently-updated", {
      spaceId,
    }),
  );
  cleanup();
  show("/s/eng", saved, otherId);
  await waitFor(() =>
    expect(api.post).toHaveBeenLastCalledWith("/pages/recently-updated", {
      spaceId: otherId,
    }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Recently updated settings" }),
  );
  expect(screen.getByPlaceholderText("Engineering")).toBeTruthy();
});

it("keeps an empty named selection empty until an editor chooses a space", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: [] });
  const { editor } = show(
    "/s/team",
    { scope: "spaces", spaceIds: [], labels: ["review"] },
    spaceId,
  );
  const settings = { name: "Recently updated settings" };
  expect(screen.getByText("Choose a space to show pages.")).toBeTruthy();
  act(() => editor.setEditable(false));
  expect(screen.queryByRole("button", settings)).toBeNull();
  expect(screen.getByText("No matching pages")).toBeTruthy();
  act(() => editor.setEditable(true));
  fireEvent.click(screen.getByRole("button", settings));
  let dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("Choose a space to show pages.")).toBeTruthy();
  fireEvent.click(dialog.getByRole("button", { name: "More options" }));
  fireEvent.click(dialog.getByRole("checkbox", { name: "Show heading" }));
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  expect(editor.state.doc.firstChild.attrs).toMatchObject({
    scope: "spaces",
    spaceIds: [],
    hideHeading: true,
  });
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", settings));
  dialog = within(screen.getByRole("dialog"));
  act(() => dialog.getByRole("combobox", { name: "Spaces" }).focus());
  fireEvent.click(dialog.getByRole("option", { name: "Engineering" }));
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledExactlyOnceWith(
      "/pages/recently-updated",
      { spaceId, scope: "spaces", spaceIds: [otherId], labels: ["review"] },
    ),
  );
});

it("saves a heading change without rewriting the stored filters", () => {
  const { editor } = show(
    "/s/team",
    { scope: "workspace", excludeSpaceIds: ["missing-space"] },
    spaceId,
  );
  const stored = editor.state.doc.firstChild.attrs;
  fireEvent.click(
    screen.getByRole("button", { name: "Recently updated settings" }),
  );
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: "More options" }));
  fireEvent.click(dialog.getByRole("checkbox", { name: "Show heading" }));
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  expect(editor.state.doc.firstChild.attrs).toEqual({
    ...stored,
    hideHeading: true,
  });
  expect(api.post).not.toHaveBeenCalled();
});

const hundredSpaceIds = Array.from(
  { length: 100 },
  (_, i) => "00000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
);

it.each([
  {
    field: "spaceIds",
    label: "Spaces",
    kept: hundredSpaceIds,
    extra: otherId,
  },
  {
    field: "excludeSpaceIds",
    label: "Exclude spaces",
    kept: hundredSpaceIds,
    extra: otherId,
  },
  {
    field: "labels",
    label: "Labels",
    kept: ["a".repeat(254) + "📌☀️"],
    extra: "x".repeat(257),
  },
  {
    field: "excludeLabels",
    label: "Exclude labels",
    kept: ["-literal"],
    extra: "x".repeat(257),
  },
])(
  "keeps oversized $field filters editable and fetches only after repair",
  async ({ field, label, kept, extra }) => {
    vi.mocked(api.post).mockResolvedValue({ data: [] });
    const values = [...kept, extra];
    const { editor, queryClient } = show(
      "/s/team",
      { ...(field === "spaceIds" && { scope: "spaces" }), [field]: values },
      spaceId,
    );
    expect(editor.getJSON().content[0].attrs[field]).toEqual(values);
    await act(() =>
      queryClient.invalidateQueries({ queryKey: ["recent-changes"] }),
    );
    expect(useGetSpaceBySlugQuery).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Use up to 100 values per filter and 256 characters per value.",
      ),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Recently updated settings" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    if (extra === otherId) {
      expect(
        screen.getByRole("button", { name: "Remove Engineering" }),
      ).toBeTruthy();
    } else {
      expect(screen.getByText(extra)).toBeTruthy();
    }
    fireEvent.keyDown(screen.getByRole("combobox", { name: label }), {
      key: "Backspace",
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(editor.getJSON().content[0].attrs[field]).toEqual(kept);
    expect(await screen.findByText("No matching pages")).toBeTruthy();
    expect(api.post).toHaveBeenCalledExactlyOnceWith(
      "/pages/recently-updated",
      expect.objectContaining({ [field]: kept }),
    );
  },
);

it("loads once across edits, polling intervals, focus, reconnect and recent-page events", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const page = {
    id: "p",
    slugId: "abc",
    title: "First",
    icon: "📘",
    spaceSlug: "destination",
    lastEditorName: "Alex Morgan",
    lastEditorAvatarUrl: "alex.png",
  };
  vi.mocked(api.post)
    .mockResolvedValueOnce({ data: [page] })
    .mockResolvedValueOnce({ data: [{ ...page, title: "Renamed" }] });
  const filters = { scope: "spaces" as const, spaceIds: [otherId] };
  const { editor, queryClient } = show("/s/team", filters, spaceId);
  const link = await screen.findByRole("link", { name: /First.*Alex Morgan/ });
  expect(link.getAttribute("href")).toBe("/s/destination/p/first-abc");
  expect(within(link).getByText("📘")).toBeTruthy();
  expect(link.querySelector("img")).toBeNull();
  expect(api.post).toHaveBeenCalledWith("/pages/recently-updated", {
    spaceId,
    ...filters,
  });
  expect(
    screen.getByRole("button", { name: "Recently updated settings" }),
  ).toBeTruthy();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(65_000);
    editor.setEditable(false);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await queryClient.invalidateQueries({
      queryKey: ["recent-changes", spaceId],
    });
    await vi.advanceTimersByTimeAsync(65_000);
  });
  expect(
    screen.queryByRole("button", { name: "Recently updated settings" }),
  ).toBeNull();
  expect(
    screen.getByRole("button", { name: "Refresh recently updated pages" }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: /First.*Alex Morgan/ })).toBeTruthy();
  expect(api.post).toHaveBeenCalledTimes(1);

  act(() => {
    editor.setEditable(true);
    editor.view.dispatch(editor.state.tr.setNodeAttribute(0, "limit", 4));
  });
  expect(
    await screen.findByRole("link", { name: /Renamed.*Alex Morgan/ }),
  ).toBeTruthy();
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenLastCalledWith("/pages/recently-updated", {
    spaceId,
    ...filters,
    limit: 4,
  });
});

it("refreshes on demand in read mode and shows space names only when results span spaces", async () => {
  const page = {
    id: "p1",
    slugId: "abc",
    title: "Decision record",
    spaceSlug: "eng",
    spaceName: "Engineering",
    lastEditorName: "Alex Morgan",
    updatedAt: "2026-08-01T08:30:00Z",
  };
  const other = {
    ...page,
    id: "p2",
    slugId: "xyz",
    title: "Release notes",
    spaceSlug: "docs",
    spaceName: "Documentation",
    lastEditorName: null,
  };
  vi.mocked(api.post)
    .mockResolvedValueOnce({ data: [page, other] })
    .mockResolvedValueOnce({ data: [page] });
  const { editor } = show("/s/team", { scope: "workspace" }, spaceId);
  act(() => editor.setEditable(false));
  expect(
    screen.getByRole("heading", { name: "Recently updated" }),
  ).toBeTruthy();
  const first = await screen.findByRole("link", {
    name: /Decision record.*Updated by Alex Morgan.*Engineering/,
  });
  expect(first.querySelector("time")?.dateTime).toBe(page.updatedAt);
  expect(first.querySelector("time")?.title).toBe(
    "Updated at Aug 01, 2026, 8:30AM",
  );
  const second = screen.getByRole("link", {
    name: /Release notes.*Documentation/,
  });
  expect(second.textContent).not.toContain("Updated by");
  expect(api.post).toHaveBeenCalledWith("/pages/recently-updated", {
    spaceId,
    scope: "workspace",
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh recently updated pages" }),
  );
  await waitFor(() => expect(screen.queryByText("Release notes")).toBeNull());
  expect(first.textContent).not.toContain("Engineering");
  expect(first.textContent).toContain("Updated by Alex Morgan");
  expect(api.post).toHaveBeenCalledTimes(2);
});

it("edits the limit, heading and space choices while preserving literal labels", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: [] });
  const { editor } = show(
    "/s/team",
    { labels: ["?missing", "+review"] },
    spaceId,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Recently updated settings" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(
      true,
    ),
  );
  const space = screen.getByRole("combobox", { name: "Spaces" });
  act(() => space.focus());
  fireEvent.input(space, {
    inputType: "insertText",
    data: "Eng",
    target: { value: "Eng" },
  });
  fireEvent.click(await screen.findByRole("option", { name: "Engineering" }));
  expect(screen.getByText("Engineering")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Last edited by" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "More options" }));
  fireEvent.change(screen.getByLabelText("Show up to"), {
    target: { value: "3" },
  });
  fireEvent.click(screen.getByLabelText("Show heading"));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(editor.getJSON().content[0].attrs).toEqual({
    limit: 3,
    hideHeading: true,
    scope: "spaces",
    spaceIds: [otherId],
    excludeSpaceIds: [],
    labels: ["?missing", "+review"],
    excludeLabels: [],
    match: "any",
  });
  await waitFor(() => {
    const settings = screen.getByRole("button", {
      name: "Recently updated settings",
    });
    expect(screen.queryByText("Recently updated", { exact: true })).toBeNull();
    const block = within(
      settings.closest<HTMLElement>('[data-type="recently-updated"]')!,
    );
    expect(block.getByText("No matching pages")).toBeTruthy();
    expect(
      block.getByRole("button", { name: "Refresh recently updated pages" }),
    ).toBeTruthy();
  });
});

it.each([5, 15])(
  "preserves concurrent filter edits when saving a limit of %i",
  async (limit) => {
    vi.mocked(api.post).mockResolvedValue({ data: [] });
    const { editor } = show(
      "/s/team",
      { labels: ["review"], limit: 15 },
      spaceId,
    );
    await screen.findByText("No matching pages");
    fireEvent.click(
      screen.getByRole("button", { name: "Recently updated settings" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    const field = screen.getByLabelText("Show up to");
    fireEvent.change(field, { target: { value: "8" } });
    fireEvent.change(field, { target: { value: String(limit) } });
    act(() => {
      editor.view.dispatch(
        editor.state.tr
          .setNodeAttribute(0, "labels", ["release"])
          .setNodeAttribute(0, "scope", "spaces")
          .setNodeAttribute(0, "spaceIds", [otherId]),
      );
    });
    const beforeSave = editor.state.doc;
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const expected = {
      labels: ["release"],
      scope: "spaces",
      spaceIds: [otherId],
    };
    expect(editor.state.doc.firstChild.attrs).toMatchObject({
      ...expected,
      limit,
    });
    if (limit === 15) expect(editor.state.doc).toBe(beforeSave);
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith("/pages/recently-updated", {
        spaceId,
        ...expected,
        ...(limit !== 15 && { limit }),
      }),
    );
  },
);

it("saves literal names, exclusions and the match mode, then requests the new filter", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: [] });
  const { editor } = show("/s/team", { labels: ["review"] }, spaceId);
  fireEvent.click(
    screen.getByRole("button", { name: "Recently updated settings" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(
      true,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "More options" }));
  expect(
    screen.queryByRole("radiogroup", { name: "Label matching" }),
  ).toBeNull();
  const labels = screen.getByRole("combobox", { name: "Labels" });
  act(() => labels.focus());
  fireEvent.input(labels, {
    inputType: "insertText",
    data: "draft",
    target: { value: "draft" },
  });
  fireEvent.click(await screen.findByRole("option", { name: "-draft" }));
  expect(
    within(
      screen.getByRole("radiogroup", { name: "Label matching" }),
    ).getByRole("radio", { name: "Any", checked: true }),
  ).toBeTruthy();
  fireEvent.click(
    within(
      screen.getByRole("radiogroup", { name: "Label matching" }),
    ).getByRole("radio", { name: "All" }),
  );
  expect(screen.getByText("Pages need all of these labels.")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Exclude labels" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Exclude labels" }));
  const excluded = screen.getByRole("combobox", { name: "Exclude labels" });
  expect(document.activeElement).toBe(excluded);
  fireEvent.change(excluded, { target: { value: "draft" } });
  fireEvent.click(
    within(screen.getByRole("listbox", { name: "Exclude labels" })).getByRole(
      "option",
      { name: "draft" },
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  const filters = {
    labels: ["review", "-draft"],
    excludeLabels: ["draft"],
    match: "all",
  };
  expect(editor.getJSON().content[0].attrs).toMatchObject(filters);
  await waitFor(() =>
    expect(api.post).toHaveBeenLastCalledWith(
      "/pages/recently-updated",
      expect.objectContaining(filters),
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Recently updated settings" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "More options" }));
  expect(
    within(
      screen.getByRole("radiogroup", { name: "Label matching" }),
    ).getByRole("radio", { name: "All", checked: true }),
  ).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Exclude labels" })).toBeTruthy();
});

it.each(["Labels", "Exclude labels"])(
  "offers only valid catalog labels in %s and preserves other settings",
  async (field) => {
    vi.mocked(api.post).mockResolvedValue({ data: [] });
    const { editor } = show(
      "/s/team",
      { labels: ["review"], excludeLabels: ["draft"], limit: 7 },
      spaceId,
    );
    const original = editor.state.doc.firstChild.attrs;
    fireEvent.click(
      screen.getByRole("button", { name: "Recently updated settings" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    const picker = screen.getByRole("combobox", { name: field });
    fireEvent.click(picker);
    fireEvent.change(picker, { target: { value: oversizedLabel } });
    expect(screen.queryByRole("option", { name: oversizedLabel })).toBeNull();
    fireEvent.change(picker, { target: { value: boundaryLabel } });
    fireEvent.click(await screen.findByRole("option", { name: boundaryLabel }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const key = field === "Labels" ? "labels" : "excludeLabels";
    expect(editor.state.doc.firstChild.attrs).toEqual({
      ...original,
      [key]: [...original[key], boundaryLabel],
    });
  },
);

it("allows empty label filters and discards display changes on cancel", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: [] });
  const { editor } = show("/s/team", {}, spaceId);
  await screen.findByText("No matching pages");
  const open = screen.getByRole("button", {
    name: "Recently updated settings",
  });
  fireEvent.click(open);
  const dialog = within(
    screen.getByRole("dialog", { name: "Recently updated" }),
  );
  expect(dialog.getAllByRole("combobox")).toEqual([
    dialog.getByRole("combobox", { name: "Spaces" }),
  ]);
  expect(dialog.queryByRole("region", { name: "Display" })).toBeNull();
  expect(
    dialog.getByText("Leave empty to use the space containing this block."),
  ).toBeTruthy();
  fireEvent.click(
    dialog.getByRole("button", { name: "More options", expanded: false }),
  );
  expect(dialog.getByRole("region", { name: "Display" })).toBeTruthy();
  expect(dialog.getByRole("combobox", { name: "Labels" })).toBeTruthy();
  expect(dialog.getByText("Add labels to narrow the list.")).toBeTruthy();
  const save = dialog.getByRole<HTMLButtonElement>("button", { name: "Save" });
  expect(save.disabled).toBe(false);
  fireEvent.change(dialog.getByLabelText("Show up to"), {
    target: { value: "" },
  });
  expect(save.disabled).toBe(true);
  fireEvent.click(dialog.getByRole("checkbox", { name: "Show heading" }));
  fireEvent.click(
    dialog.getByRole("button", { name: "More options", expanded: true }),
  );
  fireEvent.click(
    dialog.getByRole("button", { name: "More options", expanded: false }),
  );
  expect(
    dialog.getByRole("checkbox", { name: "Show heading", checked: false }),
  ).toBeTruthy();
  expect(save.disabled).toBe(true);
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(editor.state.doc.firstChild.attrs).toMatchObject({
    limit: 15,
    hideHeading: false,
    labels: [],
  });
  expect(api.post).toHaveBeenCalledTimes(1);
});

it("applies named exclusions to all accessible spaces only when explicitly selected", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: [] });
  const { editor } = show("/s/team", { labels: ["review"] }, spaceId);
  const open = screen.getByRole("button", {
    name: "Recently updated settings",
  });
  fireEvent.click(open);
  const dialog = within(
    screen.getByRole("dialog", { name: "Recently updated" }),
  );
  fireEvent.click(
    dialog.getByRole("checkbox", { name: "All accessible spaces" }),
  );
  fireEvent.click(dialog.getByRole("button", { name: "Exclude spaces" }));
  const excluded = dialog.getByRole("combobox", { name: "Exclude spaces" });
  fireEvent.change(excluded, { target: { value: "Eng" } });
  fireEvent.click(await dialog.findByRole("option", { name: "Engineering" }));
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  const filters = {
    scope: "workspace",
    excludeSpaceIds: [otherId],
    labels: ["review"],
  };
  expect(editor.state.doc.firstChild.attrs).toMatchObject(filters);
  await waitFor(() =>
    expect(api.post).toHaveBeenLastCalledWith("/pages/recently-updated", {
      spaceId,
      ...filters,
    }),
  );
  fireEvent.click(open);
  expect(
    screen.getByRole("checkbox", {
      name: "All accessible spaces",
      checked: true,
    }),
  ).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Exclude spaces" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Remove Engineering" }),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "All accessible spaces" }),
  );
  act(() => {
    editor.view.dispatch(
      editor.state.tr
        .setNodeAttribute(0, "scope", "spaces")
        .setNodeAttribute(0, "spaceIds", [spaceId])
        .setNodeAttribute(0, "labels", ["release"]),
    );
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(editor.state.doc.firstChild.attrs).toMatchObject({
    scope: "current",
    spaceIds: [],
    excludeSpaceIds: [otherId],
    labels: ["release"],
  });
  await waitFor(() =>
    expect(api.post).toHaveBeenLastCalledWith("/pages/recently-updated", {
      spaceId,
      labels: ["release"],
      excludeSpaceIds: [otherId],
    }),
  );
});

it("refetches for changes to just the mode or just the exclusions and supports exclude-only settings", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: [] });
  const { editor } = show("/s/team", { labels: ["a", "b"] }, spaceId);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const change = (
    field: keyof RecentlyUpdatedAttributes,
    value: string | string[],
  ) =>
    act(() => {
      editor.view.dispatch(editor.state.tr.setNodeAttribute(0, field, value));
    });
  change("match", "all");
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  change("excludeLabels", ["?"]);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3));
  change("labels", []);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(4));
  expect(api.post).toHaveBeenLastCalledWith("/pages/recently-updated", {
    spaceId,
    excludeLabels: ["?"],
    match: "all",
  });
});
