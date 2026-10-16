import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider, createStore, type PrimitiveAtom } from "jotai";
import { Editor, type JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Tab,
  TabLabel,
  TabPanel,
  Tabs,
  getActiveTabIndex,
} from "@docmost/editor-ext";
import { readOnlyEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import DocsToc from "./docs-toc";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let editor: Editor | null = null;

beforeAll(() => {
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  vi.restoreAllMocks();
  editor?.destroy();
  editor = null;
});

const tab = (id: string, label: string, block: JSONContent) => ({
  type: "tab",
  attrs: { id },
  content: [
    { type: "tabLabel", content: [{ type: "text", text: label }] },
    { type: "tabPanel", content: [block] },
  ],
});

describe("DocsToc", () => {
  it("opens the tab holding a heading before scrolling to it", async () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    editor = new Editor({
      element,
      editable: false,
      extensions: [StarterKit, Tabs, Tab, TabLabel, TabPanel],
      content: {
        type: "doc",
        content: [
          {
            type: "tabs",
            content: [
              tab("a", "Alpha", {
                type: "paragraph",
                content: [{ type: "text", text: "first" }],
              }),
              tab("b", "Beta", {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "Hidden heading" }],
              }),
            ],
          },
        ],
      },
    });
    let activeWhenScrolled = -1;
    vi.spyOn(window, "scrollTo").mockImplementation(() => {
      activeWhenScrolled = getActiveTabIndex(editor!.state, 0);
    });
    const store = createStore();
    // without strictNullChecks the atom<Editor | null> type reads as read-only
    store.set(readOnlyEditorAtom as PrimitiveAtom<Editor | null>, editor);
    render(
      <Provider store={store}>
        <DocsToc />
      </Provider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hidden heading" }));
    });

    expect(activeWhenScrolled).toBe(1);
    expect(getActiveTabIndex(editor.state, 0)).toBe(1);
  });
});
