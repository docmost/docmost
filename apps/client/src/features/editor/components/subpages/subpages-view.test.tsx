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
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { pageEditorBindingAtom } from "@/features/editor/atoms/editor-atoms";
import SubpagesView from "./subpages-view";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./use-subpages", () => ({
  useSubpages: () => ({
    subpages: [
      { id: "child", slugId: "child", title: "Checklist", hasChildren: false },
    ],
    isLoading: false,
  }),
}));

const editors: Editor[] = [];
const legacyBlock = '<div data-type="subpages" data-sort-by="recent"></div>';
const settingsButton = () =>
  screen.getByRole("button", { name: "Subpages settings" });

function show(
  content: string,
  { editable = true, rootSpaceId = "", path = "/" } = {},
) {
  const editor = new Editor({
    extensions: [
      StarterKit,
      Subpages.configure({ view: SubpagesView, rootSpaceId }),
    ],
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
afterEach(() => {
  cleanup();
  editors.splice(0).forEach((editor) => editor.destroy());
});

it("persists the block's name and heading visibility independently across editor and space home", async () => {
  const { editor, unmount } = show(legacyBlock);
  expect(screen.getByRole("heading", { name: "Subpages" })).toBeTruthy();
  fireEvent.click(settingsButton());
  fireEvent.change(screen.getByRole("textbox", { name: "Heading" }), {
    target: { value: "  Project guide  " },
  });
  fireEvent.click(screen.getByLabelText("Show heading"));
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
  expect((screen.getByLabelText("Heading") as HTMLInputElement).value).toBe(
    "Project guide",
  );
  fireEvent.click(screen.getByLabelText("Show heading"));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("heading", { name: "Project guide" });
  const visible = editor.getHTML();
  unmount();

  const home = show(visible, { editable: false, rootSpaceId: "team" });
  expect(screen.getByRole("heading", { name: "Project guide" })).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Subpages settings" }),
  ).toBeNull();
  await act(async () => {
    home.editor.commands.setContent(hidden);
  });
  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.getByRole("list", { name: "Project guide" })).toBeTruthy();
  await act(async () => {
    home.editor.commands.setContent(legacyBlock);
  });
  await screen.findByRole("heading", { name: "Pages" });
});

it("discards drafts on cancellation and on a switch to read mode", () => {
  const { editor, store } = show(legacyBlock);
  fireEvent.click(settingsButton());
  fireEvent.change(screen.getByLabelText("Heading"), {
    target: { value: "Draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(settingsButton());
  expect((screen.getByLabelText("Heading") as HTMLInputElement).value).toBe("");
  fireEvent.click(screen.getByLabelText("Show heading"));
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
