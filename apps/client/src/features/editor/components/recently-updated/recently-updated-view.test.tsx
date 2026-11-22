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
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import api from "@/lib/api-client";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { EditorSpaceContext } from "./editor-space-context";
import RecentlyUpdatedView from "./recently-updated-view";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));
vi.mock("@/features/space/queries/space-query", () => ({
  useGetSpaceBySlugQuery: vi.fn(() => ({})),
  useGetSpacesQuery: () => ({
    data: { items: [{ id: otherId, name: "Engineering" }] },
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
  formattedDate: () => "",
  shortTimeAgo: () => "",
}));

const spaceId = "de44053e-d614-453b-9706-1737faf19b87";
const otherId = "dcb7b4d5-a068-448d-9f18-e8b0684ee57e";
const editors: Editor[] = [];

function show(
  path: string,
  attrs: Partial<RecentlyUpdatedAttributes> = {},
  sourceId?: string,
) {
  const editor = new Editor({
    extensions: [
      Document,
      Text,
      RecentlyUpdated.configure({ view: RecentlyUpdatedView }),
    ],
    editable: true,
    content: { type: "doc", content: [{ type: "recentlyUpdated", attrs }] },
  });
  editors.push(editor);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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
                "/templates/:templateId",
              ].map((path) => (
                <Route
                  key={path}
                  path={path}
                  element={<EditorContent editor={editor} />}
                />
              ))}
            </Routes>
          </EditorSpaceContext.Provider>
        </QueryClientProvider>
      </MantineProvider>
    </MemoryRouter>,
  );
  return { editor, queryClient };
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
  {
    field: "spaces",
    label: "Spaces",
    kept: Array.from({ length: 100 }, (_, i) => `?space-${i}`),
    extra: "?another-space",
  },
  {
    field: "labels",
    label: "Include labels",
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
  expect(link.querySelector("img")?.getAttribute("src")).toContain(
    "/attachments/img/avatar/alex.png",
  );
  expect(api.post).toHaveBeenCalledWith("/pages/recently-updated", {
    spaceId,
    limit: 15,
    spaces: [otherId],
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
  expect(screen.queryByRole("button")).toBeNull();
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
    limit: 4,
  });
});

it("edits the limit, heading and signed space choices while preserving literal labels", async () => {
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
    data: "-Eng",
    target: { value: "-Eng" },
  });
  fireEvent.click(await screen.findByRole("option", { name: "-Engineering" }));
  expect(screen.getByText("-Engineering")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Last edited by" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Maximum results"), {
    target: { value: "3" },
  });
  fireEvent.click(screen.getByLabelText("Show heading"));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(editor.getJSON().content[0].attrs).toEqual({
    limit: 3,
    hideHeading: true,
    spaces: ["-" + otherId],
    labels: ["?missing", "+review"],
    excludeLabels: [],
    match: "any",
  });
  await waitFor(() => {
    const settings = screen.getByRole("button", {
      name: "Recently updated settings",
    });
    expect(screen.queryByText("Recently updated", { exact: true })).toBeNull();
    expect(
      settings.parentElement.contains(screen.getByText("No matching pages")),
    ).toBe(true);
  });
});

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
  expect(screen.queryByRole("combobox", { name: "Label matching" })).toBeNull();
  const labels = screen.getByRole("combobox", { name: "Include labels" });
  act(() => labels.focus());
  fireEvent.input(labels, {
    inputType: "insertText",
    data: "draft",
    target: { value: "draft" },
  });
  fireEvent.click(await screen.findByRole("option", { name: "-draft" }));
  const mode = screen.getByRole("combobox", { name: "Label matching" });
  fireEvent.click(mode);
  fireEvent.click(
    await screen.findByRole("option", { name: "Match all labels" }),
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Exclude labels" }));
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
  expect(screen.getByDisplayValue("Match all labels")).toBeTruthy();
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
    limit: 15,
    labels: [],
    excludeLabels: ["?"],
    match: "all",
  });
});
