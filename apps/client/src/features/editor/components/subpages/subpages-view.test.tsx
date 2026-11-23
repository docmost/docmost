import { Subpages } from "@docmost/editor-ext";
import { MantineProvider } from "@mantine/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Editor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { createStore, Provider } from "jotai";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { pageEditorBindingAtom } from "@/features/editor/atoms/editor-atoms";
import SubpagesView from "./subpages-view";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
const querySubpages = vi.hoisted(() => vi.fn());
vi.mock("./use-subpages", () => ({ useSubpages: querySubpages }));

const editors: Editor[] = [];
const child = {
  id: "child",
  slugId: "child",
  title: "Checklist",
  hasChildren: false,
};
const legacyBlock = '<div data-type="subpages" data-sort-by="recent"></div>';
const settingsButton = () =>
  screen.getByRole("button", { name: "Subpages settings" });

function show(content: string, { editable = true, path = "/" } = {}) {
  const editor = new Editor({
    extensions: [StarterKit, Subpages.configure({ view: SubpagesView })],
    content,
    editable,
  });
  editors.push(editor);
  const store = createStore();
  const { unmount } = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <MantineProvider env="test">
          <EditorContent editor={editor} />
        </MantineProvider>
      </MemoryRouter>
    </Provider>,
  );
  return { editor, store, unmount };
}

beforeAll(() => {
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
beforeEach(() => {
  querySubpages
    .mockReset()
    .mockReturnValue({ subpages: [child], isLoading: false });
});
afterEach(() => {
  cleanup();
  editors.splice(0).forEach((editor) => editor.destroy());
});

it("refreshes the current page and only its expanded branches", async () => {
  const refreshRoot = vi.fn();
  const refreshChild = vi.fn();
  querySubpages.mockImplementation((pageId, _sortBy, enabled = true) => {
    if (pageId === child.id) {
      return { subpages: [], refetch: enabled ? refreshChild : undefined };
    }
    return {
      subpages: [{ ...child, hasChildren: true }],
      refetch: refreshRoot,
    };
  });
  show(legacyBlock);
  const refresh = screen.getByRole("button", { name: "Refresh subpages" });
  async function refreshList() {
    await act(async () => {
      fireEvent.click(refresh);
    });
  }

  await refreshList();
  expect(refreshRoot).toHaveBeenCalledTimes(1);
  expect(refreshChild).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /^Expand/ }));
  await refreshList();
  expect(refreshRoot).toHaveBeenCalledTimes(2);
  expect(refreshChild).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: /^Collapse/ }));
  await refreshList();
  expect(refreshRoot).toHaveBeenCalledTimes(3);
  expect(refreshChild).toHaveBeenCalledTimes(1);
});

it("nests report headings under the current section and follows heading edits", async () => {
  const { editor } = show(
    legacyBlock +
      "<h2>Section</h2><blockquote><h4>Aside</h4>" +
      '<div data-type="subpages" data-heading="Inside"></div></blockquote>' +
      '<div data-type="subpages" data-heading="Following"></div>',
  );
  expect(
    screen.getByRole("heading", { name: "Subpages", level: 2 }),
  ).toBeTruthy();
  await screen.findByRole("heading", { name: "Inside", level: 5 });
  await screen.findByRole("heading", { name: "Following", level: 3 });
  await act(async () => {
    const pos = editor.state.doc.firstChild.nodeSize;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, { level: 3 }),
    );
  });
  await screen.findByRole("heading", { name: "Following", level: 4 });
});

it("preserves the block's name and heading visibility in read mode", async () => {
  const { editor, unmount } = show(legacyBlock);
  expect(screen.getByRole("heading", { name: "Subpages" })).toBeTruthy();
  fireEvent.click(settingsButton());
  fireEvent.change(screen.getByRole("textbox", { name: "Heading text" }), {
    target: { value: "  Project guide  " },
  });
  fireEvent.click(screen.getByLabelText("Show block heading"));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("list", { name: "Project guide" });
  expect(screen.queryByRole("heading")).toBeNull();
  expect(editor.state.doc.firstChild.attrs).toMatchObject({
    heading: "Project guide",
    hideHeading: true,
    sortBy: "recent",
  });
  const hidden = editor.getHTML();

  fireEvent.click(settingsButton());
  expect(
    (screen.getByLabelText("Heading text") as HTMLInputElement).value,
  ).toBe("Project guide");
  fireEvent.click(screen.getByLabelText("Show block heading"));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("heading", { name: "Project guide" });
  const visible = editor.getHTML();
  unmount();

  const readOnly = show(visible, { editable: false });
  expect(screen.getByRole("heading", { name: "Project guide" })).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Subpages settings" }),
  ).toBeNull();
  await act(async () => {
    readOnly.editor.commands.setContent(hidden);
  });
  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.getByRole("list", { name: "Project guide" })).toBeTruthy();
  await act(async () => {
    readOnly.editor.commands.setContent(legacyBlock);
  });
  await screen.findByRole("heading", { name: "Subpages" });
});

it("discards drafts on cancellation and on a switch to read mode", () => {
  const { editor, store } = show(legacyBlock);
  fireEvent.click(settingsButton());
  fireEvent.change(screen.getByLabelText("Heading text"), {
    target: { value: "Draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(settingsButton());
  expect(
    (screen.getByLabelText("Heading text") as HTMLInputElement).value,
  ).toBe("");
  fireEvent.click(screen.getByLabelText("Show block heading"));
  function setEditable(editable: boolean) {
    editor.setEditable(editable, false);
    store.set(pageEditorBindingAtom, { editor, pageId: "host", editable });
  }
  act(() => setEditable(false));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Subpages settings" }),
  ).toBeNull();
  act(() => setEditable(true));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(settingsButton()).toBeTruthy();
  expect(editor.state.doc.firstChild.attrs).toMatchObject({
    heading: "",
    hideHeading: false,
  });
});

it.each(["/share/link/p/host", "/docs/team/host"])(
  "honors a hidden heading without exposing settings on %s",
  (path) => {
    show(
      '<div data-type="subpages" data-heading="Guide" data-hide-heading="true"></div>',
      { path },
    );
    expect(screen.getByRole("list", { name: "Guide" })).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Subpages settings" }),
    ).toBeNull();
  },
);
