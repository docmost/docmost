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
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import api from "@/lib/api-client";
import { PagesByLabelContext } from "./pages-by-label-context";
import { PagesByLabelView } from "./pages-by-label-view";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));
vi.mock("@/features/label/queries/label-query", () => ({
  useWorkspaceLabelsQuery: () => ({ data: { items: [{ name: "guide" }] } }),
}));
vi.mock("@/features/space/queries/space-query", () => ({
  useGetSpacesQuery: () => ({ data: { items: [] } }),
}));
vi.mock("@/features/user/atoms/current-user-atom", async () => ({
  userAtom: (await import("jotai")).atom({
    id: "viewer",
    workspaceId: "workspace",
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
  render(
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
    </MemoryRouter>,
  );
  return { editor, client };
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
  await screen.findByRole("dialog", { name: "Pages by label settings" });
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
  const input = screen.getByRole("combobox", { name: /Include labels/ });
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
      space: { slug: "other", name: "Other" },
      labels: ["guide"],
    };
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { items: [page] } })
      .mockResolvedValueOnce({ data: { items: [] } });
    const { client } = show(
      { labels: ["guide"], showLabels: true, showSpace: true },
      undefined,
      editable,
    );
    const link = await screen.findByRole("link", { name: /Release handoff/ });
    expect(link.getAttribute("href")).toBe("/s/other/p/release-handoff-a42");
    expect(link.textContent).toContain("guide");
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
  act(() => {
    const attrs = editor.state.doc.firstChild.attrs;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(0, undefined, {
        ...attrs,
        excludeLabels: ["draft"],
      }),
    );
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(editor.state.doc.firstChild.attrs.heading).toBe("New list"),
  );
  expect(editor.state.doc.firstChild.attrs.excludeLabels).toEqual(["draft"]);
});
