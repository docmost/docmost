import { MantineProvider } from "@mantine/core";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Tab, TabLabel, TabPanel, Tabs } from "@docmost/editor-ext";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { pageEditorBindingAtom } from "@/features/editor/atoms/editor-atoms";
import { PageFormattingToolbar } from "./fixed-toolbar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (label: string) => label }),
}));
vi.mock("@/i18n", () => ({ default: { t: (label: string) => label } }));
vi.mock("@/main.tsx", () => ({}));

const editors: Editor[] = [];

function makeEditor(text: string) {
  const editor = new Editor({
    extensions: [StarterKit, Tabs, Tab, TabLabel, TabPanel],
    content: `<p>${text}</p>`,
  });
  editor.commands.setTextSelection({ from: 1, to: text.length + 1 });
  editors.push(editor);
  return editor;
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  cleanup();
  editors.splice(0).forEach((editor) => editor.destroy());
  vi.unstubAllGlobals();
});

it("keeps every control visible and accepts commands only for the current editable page", () => {
  const store = createStore();
  const first = makeEditor("First"),
    second = makeEditor("Second");
  const view = (pageId: string) => (
    <MantineProvider env="test">
      <Provider store={store}>
        <PageFormattingToolbar pageId={pageId} />
      </Provider>
    </MantineProvider>
  );
  const bind = (pageId: string, editor: Editor, editable: boolean) =>
    act(() => {
      store.set(pageEditorBindingAtom, { pageId, editor, editable });
    });

  bind("first", first, true);
  const { rerender } = render(view("first"));
  const toolbar = screen.getByRole("toolbar");
  const labels = () =>
    [...toolbar.querySelectorAll("button")].map(
      (button) => button.getAttribute("aria-label") ?? button.textContent,
    );
  const initial = labels();
  expect(initial).toContain("Bold");
  fireEvent.click(within(toolbar).getByRole("button", { name: "Normal text" }));
  expect(screen.getByRole("menu")).toBeTruthy();

  rerender(view("second"));
  expect(screen.getByRole("toolbar")).toBe(toolbar);
  expect(labels()).toEqual(initial);
  expect(toolbar.getAttribute("aria-disabled")).toBe("true");
  expect(toolbar.querySelector("[inert]")).toBeTruthy();
  expect(screen.queryByRole("menu")).toBeNull();
  const clickBold = () =>
    fireEvent.click(toolbar.querySelector('[aria-label="Bold"]')!);
  clickBold();
  expect(first.getHTML()).toBe("<p>First</p>");

  bind("second", second, false);
  clickBold();
  expect(second.getHTML()).toBe("<p>Second</p>");
  bind("second", second, true);
  expect(toolbar.hasAttribute("aria-disabled")).toBe(false);
  clickBold();
  expect(second.getHTML()).toBe("<p><strong>Second</strong></p>");
  expect(first.getHTML()).toBe("<p>First</p>");
});
