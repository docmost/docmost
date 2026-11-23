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
import { PagesByLabelContext } from "../pages-by-label/pages-by-label-context";
import { EditorSpaceContext } from "./editor-space-context";
import RecentlyUpdatedView from "./recently-updated-view";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));
vi.mock("@/features/space/queries/space-query", () => ({
  useGetSpaceBySlugQuery: vi.fn((key?: string) => ({
    data: key === spaceId || key === "team" ? teamSpace : undefined,
  })),
  useGetSpacesQuery: () => ({
    data: { items: [teamSpace, { id: otherId, name: "Engineering" }] },
  }),
}));
vi.mock("@/features/label/queries/label-query", () => ({
  useWorkspaceLabelsQuery: () => ({
    data: {
      items: [{ name: "review" }, { name: "-draft" }, { name: "draft" }],
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
const teamSpace = { id: spaceId, name: "Product design", slug: "team" };
const otherId = "dcb7b4d5-a068-448d-9f18-e8b0684ee57e";
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
  const content = (
    <PagesByLabelContext.Provider
      value={templateSpaceId ? { spaceId: templateSpaceId } : null}
    >
      <EditorContent editor={editor} />
    </PagesByLabelContext.Provider>
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
    show(path, { labels: ["private"], spaces: ["@all"] }, spaceId);
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
    show(path, { spaces: ["@self"] }, outerSpace, {
      editable,
      templateSpaceId: spaceId,
    });

    expect(
      await screen.findByRole("link", { name: "Design notes" }),
    ).toBeTruthy();
    expect(api.post).toHaveBeenCalledExactlyOnceWith(
      "/pages/recently-updated",
      expect.objectContaining({ spaceId, spaces: ["@self"] }),
    );
    if (editable) {
      fireEvent.click(
        screen.getByRole("button", { name: "Recently updated settings" }),
      );
      expect(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Remove Product design",
        }),
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

it.each(["@self", spaceId])(
  "shows the containing space by name for %s and clears it to include all spaces",
  async (value) => {
    vi.mocked(api.post).mockResolvedValue({ data: [] });
    const { editor } = show("/s/team", { spaces: [value] }, spaceId);
    fireEvent.click(
      screen.getByRole("button", { name: "Recently updated settings" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    const spaces = dialog.getByRole("combobox", { name: "Spaces" });
    const remove = dialog.getByRole("button", {
      name: "Remove Product design",
    });
    fireEvent.click(spaces);
    expect(dialog.queryByRole("option", { name: "Product design" })).toBeNull();
    expect(dialog.queryByRole("option", { name: "Current space" })).toBeNull();
    fireEvent.click(remove);
    act(() => spaces.focus());
    const namedSpace = await dialog.findByRole("option", {
      name: "Product design",
    });
    fireEvent.click(namedSpace);
    fireEvent.click(
      dialog.getByRole("button", { name: "Remove Product design" }),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Save" }));

    expect(editor.getJSON().content[0].attrs.spaces).toEqual([]);
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith(
        "/pages/recently-updated",
        expect.objectContaining({ spaceId, spaces: [] }),
      ),
    );
  },
);

it.each([
  {
    field: "spaces",
    label: "Spaces",
    kept: Array.from({ length: 100 }, (_, i) => `?space-${i}`),
    extra: "?another-space",
  },
  {
    field: "excludeSpaces",
    label: "Exclude spaces",
    kept: ["@personal"],
    extra: "?" + "x".repeat(256),
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
      { [field]: values },
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
    expect(screen.getByText(extra)).toBeTruthy();
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
  const legacyOptions = { spaces: [otherId], authors: ["?former-user"] };
  const { editor, queryClient } = show("/s/team", legacyOptions, spaceId);
  const link = await screen.findByRole("link", { name: /First.*Alex Morgan/ });
  expect(link.getAttribute("href")).toBe("/s/destination/p/first-abc");
  expect(within(link).getByText("📘")).toBeTruthy();
  expect(link.querySelector("img")).toBeNull();
  expect(api.post).toHaveBeenCalledWith("/pages/recently-updated", {
    spaceId,
    limit: 15,
    spaces: [otherId],
    excludeSpaces: [],
    spaceMatch: "any",
    labels: [],
    excludeLabels: [],
    match: "any",
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
    labels: [],
    excludeLabels: [],
    match: "any",
    spaces: [otherId],
    excludeSpaces: [],
    spaceMatch: "any",
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
  const { editor } = show("/s/team", { spaces: ["@all"] }, spaceId);
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
    spaces: [otherId],
    excludeSpaces: [],
    spaceMatch: "any",
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
          .setNodeAttribute(0, "spaces", ["@favorite"]),
      );
    });
    const beforeSave = editor.state.doc;
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const expected = { limit, labels: ["release"], spaces: ["@favorite"] };
    expect(editor.state.doc.firstChild.attrs).toMatchObject(expected);
    if (limit === 15) expect(editor.state.doc).toBe(beforeSave);
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith(
        "/pages/recently-updated",
        expect.objectContaining(expected),
      ),
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
    dialog.getByText("Leave empty to include all accessible spaces."),
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

it("saves the space match and exclusions independently of label matching", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: [] });
  const { editor } = show(
    "/s/team",
    { spaces: ["@favorite", "@global"], labels: ["review"] },
    spaceId,
  );
  const open = screen.getByRole("button", {
    name: "Recently updated settings",
  });
  fireEvent.click(open);
  const dialog = within(
    screen.getByRole("dialog", { name: "Recently updated" }),
  );
  fireEvent.click(
    within(
      dialog.getByRole("radiogroup", { name: "Space matching" }),
    ).getByRole("radio", { name: "All" }),
  );
  fireEvent.click(dialog.getByRole("button", { name: "Exclude spaces" }));
  const excluded = dialog.getByRole("combobox", { name: "Exclude spaces" });
  fireEvent.change(excluded, { target: { value: "Eng" } });
  fireEvent.click(await dialog.findByRole("option", { name: "Engineering" }));
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  const filters = {
    spaces: ["@favorite", "@global"],
    excludeSpaces: [otherId],
    spaceMatch: "all",
    labels: ["review"],
    match: "any",
  };
  expect(editor.state.doc.firstChild.attrs).toMatchObject(filters);
  await waitFor(() =>
    expect(api.post).toHaveBeenLastCalledWith(
      "/pages/recently-updated",
      expect.objectContaining(filters),
    ),
  );
  fireEvent.click(open);
  expect(screen.getByRole("combobox", { name: "Exclude spaces" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Remove Engineering" }),
  ).toBeTruthy();
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
    spaces: [],
    excludeSpaces: [],
    spaceMatch: "any",
    limit: 15,
    labels: [],
    excludeLabels: ["?"],
    match: "all",
  });
});
