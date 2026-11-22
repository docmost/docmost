import { MantineProvider } from "@mantine/core";
import { PagesByLabel, type PagesByLabelAttributes } from "@docmost/editor-ext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Editor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { MemoryRouter } from "react-router-dom";
import { createStore, Provider } from "jotai";
import { pageEditorBindingAtom } from "@/features/editor/atoms/editor-atoms";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import api from "@/lib/api-client";
import { PagesByLabelContext } from "./pages-by-label-context";
import { PagesByLabelView } from "./pages-by-label-view";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));
vi.mock("@/features/label/queries/label-query", () => ({
  useWorkspaceLabelsQuery: () => ({ data: { items: [{ name: "guide" }] } }),
}));
vi.mock("@/features/space/queries/space-query", () => ({
  useGetSpacesQuery: () => ({
    data: {
      items: [
        {
          id: "a1d0dfc0-1000-4000-8000-000000000001",
          name: "Design",
          slug: "design",
        },
      ],
    },
  }),
  useUnlistedSpaceQuery: () => ({ data: undefined }),
}));
vi.mock("@/features/user/atoms/current-user-atom", async () => ({
  userAtom: (await import("jotai")).atom({
    id: "viewer",
    workspaceId: "workspace",
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name: string }) =>
      key.replace("{{name}}", values?.name ?? ""),
  }),
}));

const editors: Editor[] = [];
function show(
  attrs?: Partial<PagesByLabelAttributes>,
  path = "/s/team/p/host-abc",
  editable = true,
) {
  const editor = new Editor({
    extensions: [
      StarterKit,
      PagesByLabel.configure({
        view: PagesByLabelView,
      }),
    ],
    editable,
    content: {
      type: "doc",
      content: [
        attrs ? { type: "pagesByLabel", attrs } : { type: "paragraph" },
      ],
    },
  });
  editors.push(editor);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = createStore();
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <MantineProvider env="test">
          <QueryClientProvider client={client}>
            <PagesByLabelContext.Provider
              value={{ pageId: "host", spaceId: "team" }}
            >
              <EditorContent editor={editor} />
            </PagesByLabelContext.Provider>
          </QueryClientProvider>
        </MantineProvider>
      </MemoryRouter>
    </Provider>,
  );
  return { editor, client, store };
}

function applyRemoteEdit(
  editor: Editor,
  changes: Partial<PagesByLabelAttributes>,
) {
  act(() => {
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(0, undefined, {
        ...editor.state.doc.firstChild.attrs,
        ...changes,
      }),
    );
  });
}

beforeAll(() => {
  window.matchMedia ??= (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })) as any;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => {
  cleanup();
  editors.splice(0).forEach((editor) => editor.destroy());
  vi.clearAllMocks();
});

it("opens settings on local insertion and leaves a previously stored empty block closed", async () => {
  const { editor } = show({});
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
  act(() => {
    editor.commands.insertPagesByLabel();
  });
  await screen.findByRole("dialog", { name: "Pages by label" });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});

it.each(["/share/abc/p/host", "/docs/team/p/host"])(
  "never looks up private results on %s",
  (path) => {
    show({ labels: ["private"], heading: "Sensitive heading" }, path);
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.queryByText("Sensitive heading")).toBeNull();
  },
);

it("lets an editor repair a malformed saved filter before making a lookup", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { items: [] } });
  const { editor } = show({
    labels: ["guide"],
    excludeLabels: "draft" as unknown as string[],
  });
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Choose labels" }));
  const input = screen.getByRole("combobox", { name: "Labels" });
  fireEvent.click(input);
  fireEvent.click(await screen.findByRole("option", { name: "guide" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(editor.state.doc.firstChild.attrs.excludeLabels).toEqual([]),
  );
  expect(editor.state.doc.firstChild.attrs.labels).toEqual(["guide"]);
  expect(await screen.findByText("No matching pages")).toBeTruthy();
});

it.each([true, false])(
  "uses each result's space for its in-app link and refreshes after label edits (editable=%s)",
  async (editable) => {
    const page = {
      id: "target",
      title: "Release handoff",
      slugId: "a42",
      space: { id: "other-id", slug: "other", name: "Other" },
      labels: ["guide", "review/100%"],
    };
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { items: [page] } })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              ...page,
              title: null,
              isBase: true,
              space: { ...page.space, archivedAt: "2026-06-01" },
            },
          ],
        },
      })
      .mockResolvedValueOnce({ data: { items: [] } });
    const { client } = show(
      {
        labels: ["guide"],
        heading: "Team guides",
        showLabels: true,
        showSpace: true,
      },
      undefined,
      editable,
    );
    expect(screen.getByRole("heading", { name: "Team guides" })).toBeTruthy();
    const link = await screen.findByRole("link", { name: "Release handoff" });
    expect(link.getAttribute("href")).toBe("/s/other/p/release-handoff-a42");
    const guide = screen.getByRole("link", { name: "guide" });
    expect(guide.getAttribute("href")).toBe("/labels/guide");
    expect(link.contains(guide)).toBe(false);
    expect(
      screen.getByRole("link", { name: "review/100%" }).getAttribute("href"),
    ).toBe("/labels/review%2F100%25");
    expect(api.post).toHaveBeenCalledWith(
      "/labels/query-pages",
      expect.objectContaining({
        pageId: "host",
        contextSpaceId: "team",
        labels: ["guide"],
        scope: "current",
      }),
    );
    expect(
      !!screen.queryByRole("button", { name: "Pages by label settings" }),
    ).toBe(editable);
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh matching pages" }),
    );
    const base = await screen.findByRole("link", { name: /Untitled base/ });
    expect(
      base.closest('[role="listitem"]')?.querySelector(".tabler-icon-table"),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "guide" }).getAttribute("href"),
    ).toBe("/labels/guide?spaceId=other-id");
    await act(() => client.invalidateQueries({ queryKey: ["label-pages"] }));
    expect(await screen.findByText("No matching pages")).toBeTruthy();
  },
);

it("saves edited settings without overwriting another collaborator's changes", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { items: [] } });
  const { editor } = show({ labels: ["guide"], heading: "Old list" });
  fireEvent.click(
    screen.getByRole("button", { name: "Pages by label settings" }),
  );
  const field = await screen.findByRole("textbox", { name: "Heading" });
  fireEvent.change(field, { target: { value: "New list" } });
  applyRemoteEdit(editor, { excludeLabels: ["draft"] });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(editor.state.doc.firstChild.attrs.heading).toBe("New list"),
  );
  expect(editor.state.doc.firstChild.attrs.excludeLabels).toEqual(["draft"]);
});

it("replaces scope choices with named spaces and keeps imported ordering and display settings", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { items: [] } });
  const original = {
    labels: ["guide"],
    excludeLabels: ["draft"],
    sortBy: "createdAt" as const,
    sortDirection: "asc" as const,
    heading: "Guides",
    limit: 8,
    showLabels: true,
    showSpace: true,
    excludeCurrentPage: true,
  };
  const { editor } = show(original);
  fireEvent.click(
    screen.getByRole("button", { name: "Pages by label settings" }),
  );
  expect(screen.getByRole("heading", { name: "Find pages" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Display" })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Sort by" })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Exclude labels" })).toBeTruthy();
  const spaces = screen.getByRole("combobox", { name: "Spaces" });
  fireEvent.click(spaces);
  fireEvent.click(await screen.findByRole("option", { name: "Design" }));
  expect(
    screen.queryByRole("button", { name: "Remove Current space" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Remove Design" }));
  expect(
    (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(spaces);
  fireEvent.click(await screen.findByRole("option", { name: "Design" }));
  fireEvent.click(spaces);
  fireEvent.click(
    await screen.findByRole("option", { name: "All accessible spaces" }),
  );
  expect(screen.queryByRole("button", { name: "Remove Design" })).toBeNull();
  applyRemoteEdit(editor, {
    scope: "spaces",
    spaceIds: ["a1d0dfc0-1000-4000-8000-000000000001"],
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(editor.state.doc.firstChild.attrs).toMatchObject({
    ...original,
    scope: "workspace",
    spaceIds: [],
  });
});

it("offers three sorts and uses newest first when switching from a saved reverse title sort to a date", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { items: [] } });
  const { editor } = show({
    labels: ["guide"],
    sortBy: "title",
    sortDirection: "desc",
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Pages by label settings" }),
  );
  const sort = await screen.findByRole("combobox", { name: "Sort by" });
  fireEvent.click(sort);
  expect(
    screen.getAllByRole("option").map((option) => option.textContent),
  ).toEqual(["Title", "Last updated", "Date created"]);
  expect(screen.getByText("Reverse alphabetical order")).toBeTruthy();
  fireEvent.click(screen.getByRole("option", { name: "Last updated" }));
  applyRemoteEdit(editor, { sortDirection: "asc" });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(editor.state.doc.firstChild.attrs).toMatchObject({
    sortBy: "updatedAt",
    sortDirection: "desc",
  });
});

it("switches match mode and reveals exclusions without losing the included labels", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { items: [] } });
  const { editor } = show({ labels: ["guide", "handbook"] });
  fireEvent.click(
    screen.getByRole("button", { name: "Pages by label settings" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Pages by label" });
  await waitFor(() =>
    expect(dialog.contains(document.activeElement)).toBe(true),
  );
  expect(
    screen.getByRole("combobox", {
      name: "Labels",
      description: /Pages need at least one of these labels\./,
    }),
  ).toBeTruthy();
  expect(
    screen.getByRole("textbox", { name: "Show up to", description: "pages" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "All" }));
  expect(screen.getByText("Pages need all of these labels.")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Exclude labels" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Exclude labels" }));
  const excluded = screen.getByRole("combobox", { name: "Exclude labels" });
  expect(document.activeElement).toBe(excluded);
  fireEvent.change(excluded, { target: { value: "draft" } });
  fireEvent.click(await screen.findByRole("option", { name: "draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(editor.state.doc.firstChild.attrs).toMatchObject({
    labels: ["guide", "handbook"],
    match: "all",
    excludeLabels: ["draft"],
  });

  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/labels/query-pages",
      expect.objectContaining({ match: "all", excludeLabels: ["draft"] }),
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Pages by label settings" }),
  );
  expect(
    await screen.findByRole("combobox", { name: "Exclude labels" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Any" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(editor.state.doc.firstChild.attrs.match).toBe("all");
});

it("closes settings immediately on switching to read mode and restores controls on edit", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { items: [] } });
  const { editor, store } = show({ labels: ["guide"] });
  const updateBinding = (editable: boolean) => {
    editor.setEditable(editable, false);
    store.set(pageEditorBindingAtom, { editor, pageId: "host", editable });
  };
  act(() => updateBinding(true));
  fireEvent.click(
    screen.getByRole("button", { name: "Pages by label settings" }),
  );
  expect(await screen.findByRole("dialog")).toBeTruthy();
  act(() => updateBinding(false));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Pages by label settings" }),
  ).toBeNull();
  act(() => updateBinding(true));
  expect(
    screen.getByRole("button", { name: "Pages by label settings" }),
  ).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
});
