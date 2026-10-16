import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { MantineProvider } from "@mantine/core";
import {
  EditorContent,
  useEditor,
  type Editor,
  type NodeViewProps,
} from "@tiptap/react";
import type { AnyExtension } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Tab,
  TabLabel,
  TabPanel,
  Tabs,
  getActiveTabIndex,
} from "@docmost/editor-ext";
import TabsView from "./tabs-view";
import GlobalDragHandle from "@/features/editor/extensions/drag-handle";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/\{\{(\w+)\}\}/g, (match, name) =>
        options && name in options ? String(options[name]) : match,
      ),
  }),
}));

const tab = (id: string, label: string, text: string) => ({
  type: "tab",
  attrs: { id },
  content: [
    { type: "tabLabel", content: [{ type: "text", text: label }] },
    {
      type: "tabPanel",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
  ],
});

const content = {
  type: "doc",
  content: [
    {
      type: "tabs",
      content: [tab("a", "Alpha", "first panel"), tab("b", "Beta", "second panel")],
    },
    { type: "paragraph", content: [{ type: "text", text: "after" }] },
  ],
};

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
  Range.prototype.getClientRects = () =>
    ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
  Element.prototype.scrollIntoView = () => {};
  // jsdom's Blob has no text()
  Blob.prototype.text ??= function (this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
  // jsdom loads no Mantine CSS, and the autoscroll dev check reads this overflow
  const style = document.createElement("style");
  style.textContent = ".dm-tabs__scroller { overflow-x: auto; }";
  document.head.appendChild(style);
});

afterEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

function Harness({
  editable,
  onEditor,
  extensions = [],
  view = TabsView,
}: {
  editable: boolean;
  onEditor: (editor: Editor) => void;
  extensions?: AnyExtension[];
  view?: typeof TabsView;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Tabs.configure({ view }),
      Tab,
      TabLabel,
      TabPanel,
      ...extensions,
    ],
    content,
    editable,
    immediatelyRender: true,
  });
  useEffect(() => {
    if (editor) onEditor(editor);
  }, [editor, onEditor]);
  return <EditorContent editor={editor} />;
}

async function mountTabs(
  editable: boolean,
  extensions?: AnyExtension[],
  view?: typeof TabsView,
) {
  let editor!: Editor;
  const utils = render(
    <MantineProvider env="test">
      <Harness
        editable={editable}
        extensions={extensions}
        view={view}
        onEditor={(instance) => (editor = instance)}
      />
    </MantineProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { editor, container: utils.container };
}

const tabTexts = () => screen.getAllByRole("tab").map((el) => el.textContent);

const selectedTab = () =>
  screen
    .getAllByRole("tab")
    .find((el) => el.getAttribute("aria-selected") === "true")?.textContent;

function docLabels(editor: Editor) {
  const tabs = editor.state.doc.firstChild!;
  return Array.from(
    { length: tabs.childCount },
    (_, index) => tabs.child(index).firstChild!.textContent,
  );
}

async function click(element: Element) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function chooseTabAction(name: string) {
  await click(screen.getByRole("button", { name: /^Tab actions for / }));
  await click(screen.getByRole("menuitem", { name }));
}

async function flushMicrotasks() {
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
}

describe("TabsView", () => {
  it("shows labels from the document and only navigation in read mode", async () => {
    const { container } = await mountTabs(false);
    expect(tabTexts()).toEqual(["Alpha", "Beta"]);
    expect(selectedTab()).toBe("Alpha");
    expect(
      screen.queryByRole("button", { name: /^Tab actions for / }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Add tab" })).toBeNull();
    expect(container.querySelector(".dm-tabs__actions")).toBeNull();
    for (const tabElement of screen.getAllByRole("tab")) {
      const controls = tabElement.getAttribute("aria-controls");
      expect(controls && document.getElementById(controls)).toBeTruthy();
    }
  });

  it("moves between tabs with the arrow keys and keeps focus on the tab", async () => {
    await mountTabs(false);
    await act(async () => {
      fireEvent.keyDown(screen.getByRole("tab", { name: "Alpha" }), {
        key: "ArrowRight",
      });
    });
    expect(selectedTab()).toBe("Beta");
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: "Beta" }),
    );
  });

  it("switches tabs locally when a tab is clicked", async () => {
    const { editor, container } = await mountTabs(true);
    const before = editor.state.doc;
    await click(screen.getByRole("tab", { name: "Beta" }));
    expect(selectedTab()).toBe("Beta");
    expect(editor.state.doc).toBe(before);
    const hidden = Array.from(
      container.querySelectorAll('[data-type="tab"].dm-tab-hidden'),
    ).map((el) => el.getAttribute("data-tab-id"));
    expect(hidden).toEqual(["a"]);
  });

  it("does no position lookups while the page is edited outside the block", async () => {
    let lookups = 0;
    const CountingView = (props: NodeViewProps) => (
      <TabsView
        {...props}
        getPos={() => {
          lookups += 1;
          return props.getPos();
        }}
      />
    );
    const { editor } = await mountTabs(true, [], CountingView);
    lookups = 0;
    await act(async () => {
      editor.commands.insertContentAt(textPos(editor, "after"), "x");
    });
    expect(editor.state.doc.lastChild!.textContent).toBe("xafter");
    expect(lookups).toBe(0);
  });

  it("updates the strip within the same task as the switch", async () => {
    const { editor } = await mountTabs(true);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      false;
    editor.commands.setActiveTab(1, 0);
    await flushMicrotasks();
    expect(tabTexts()).toEqual(["Alpha", "Beta"]);
    expect(selectedTab()).toBe("Beta");
  });

  it("shows edit controls as soon as the editor becomes editable", async () => {
    const { editor } = await mountTabs(false);
    await act(async () => {
      editor.setEditable(true);
    });
    expect(
      screen.getByRole("button", { name: "Tab actions for Alpha" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add tab" })).toBeTruthy();
  });

  it("scrolls the strip so the active tab clears the scroller's edge controls", async () => {
    const { container } = await mountTabs(false);
    const scroller = container.querySelector<HTMLElement>(".dm-tabs__scroller")!;
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy;
    const place = (element: Element, left: number, right: number) => {
      element.getBoundingClientRect = () =>
        new DOMRect(left, 0, right - left, 40);
    };
    place(scroller, 100, 400);
    scroller
      .parentElement!.querySelectorAll<HTMLElement>(":scope > [data-position]")
      .forEach((control) => {
        Object.defineProperty(control, "offsetWidth", { value: 50 });
      });
    const slot = (index: number) =>
      scroller.querySelector(`[data-tab-index="${index}"]`)!;

    place(slot(1), 330, 430);
    await click(screen.getByRole("tab", { name: "Beta" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 80, behavior: "smooth" });

    place(slot(0), 120, 220);
    await click(screen.getByRole("tab", { name: "Alpha" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -30, behavior: "smooth" });

    place(slot(1), 200, 300);
    await click(screen.getByRole("tab", { name: "Beta" }));
    expect(scrollBy).toHaveBeenCalledTimes(2);
  });

  it("renames the active tab from the tab actions menu", async () => {
    const { editor } = await mountTabs(true);
    await chooseTabAction("Rename");
    const input = screen.getByRole("textbox", {
      name: "Tab label",
    }) as HTMLInputElement;
    expect(input.value).toBe("Alpha");
    await act(async () => {
      fireEvent.change(input, { target: { value: "First" } });
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(docLabels(editor)).toEqual(["First", "Beta"]);
    expect(tabTexts()).toEqual(["First", "Beta"]);
  });

  it("ignores double-click in read mode", async () => {
    await mountTabs(false);
    await act(async () => {
      fireEvent.doubleClick(screen.getByRole("tab", { name: "Beta" }));
    });
    expect(screen.queryByRole("textbox", { name: "Tab label" })).toBeNull();
  });

  it("renames a tab on double-click", async () => {
    const { editor } = await mountTabs(true);
    await act(async () => {
      fireEvent.doubleClick(screen.getByRole("tab", { name: "Beta" }));
    });
    const input = screen.getByRole("textbox", {
      name: "Tab label",
    }) as HTMLInputElement;
    expect(input.value).toBe("Beta");
    await act(async () => {
      fireEvent.change(input, { target: { value: "Second" } });
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(docLabels(editor)).toEqual(["Alpha", "Second"]);
  });

  it("keeps the label when rename is cancelled or left empty", async () => {
    const { editor } = await mountTabs(true);

    await chooseTabAction("Rename");
    let input = screen.getByRole("textbox", { name: "Tab label" });
    await act(async () => {
      fireEvent.change(input, { target: { value: "Changed" } });
      fireEvent.keyDown(input, { key: "Escape" });
    });
    expect(docLabels(editor)).toEqual(["Alpha", "Beta"]);

    await chooseTabAction("Rename");
    input = screen.getByRole("textbox", { name: "Tab label" });
    await act(async () => {
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(docLabels(editor)).toEqual(["Alpha", "Beta"]);
  });

  it.each([
    ["the event reports a composition", { isComposing: true }],
    ["the key code is 229, as Safari reports it", { keyCode: 229 }],
  ])(
    "ignores Enter while an IME composition is in progress: %s",
    async (_, init) => {
      const { editor } = await mountTabs(true);
      await chooseTabAction("Rename");
      const input = screen.getByRole("textbox", { name: "Tab label" });
      await act(async () => {
        fireEvent.change(input, { target: { value: "Changed" } });
        fireEvent.keyDown(input, { key: "Enter", ...init });
      });
      expect(screen.getByRole("textbox", { name: "Tab label" })).toBe(input);
      expect(docLabels(editor)).toEqual(["Alpha", "Beta"]);
    },
  );

  it("duplicates the active tab next to it and switches to the copy", async () => {
    const { editor } = await mountTabs(true);
    await chooseTabAction("Duplicate");
    expect(docLabels(editor)).toEqual(["Alpha", "Alpha", "Beta"]);
    expect(getActiveTabIndex(editor.state, 0)).toBe(1);
  });

  it("moves the active tab and disables moves past the edges", async () => {
    const { editor } = await mountTabs(true);
    await click(screen.getByRole("button", { name: "Tab actions for Alpha" }));
    expect(
      (screen.getByRole("menuitem", { name: "Move left" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await click(screen.getByRole("menuitem", { name: "Move right" }));
    expect(docLabels(editor)).toEqual(["Beta", "Alpha"]);
    expect(selectedTab()).toBe("Alpha");
  });

  it("deletes tabs and removes the block with the last one", async () => {
    const { editor } = await mountTabs(true);
    await chooseTabAction("Delete tab");
    expect(docLabels(editor)).toEqual(["Beta"]);
    expect(selectedTab()).toBe("Beta");
    await chooseTabAction("Delete tab");
    expect(editor.state.doc.firstChild!.type.name).toBe("paragraph");
  });

  it("adds a numbered tab and opens rename with the label selected", async () => {
    const { editor } = await mountTabs(true);
    await click(screen.getByRole("button", { name: "Add tab" }));
    expect(docLabels(editor)).toEqual(["Alpha", "Beta", "Tab 3"]);
    expect(getActiveTabIndex(editor.state, 0)).toBe(2);
    const input = screen.getByRole("textbox", {
      name: "Tab label",
    }) as HTMLInputElement;
    expect(input.value).toBe("Tab 3");
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 5]);
  });
});

function textPos(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found !== -1) return false;
    if (node.isTextblock && node.textContent === text) found = pos + 1;
    return true;
  });
  return found;
}

async function focusEditorAt(editor: Editor, text: string) {
  // commands.focus() defers a frame and dom.focus() leaves the DOM selection displaced
  await act(async () => {
    editor.commands.setTextSelection(textPos(editor, text));
    editor.view.focus();
  });
  expect(editor.view.hasFocus()).toBe(true);
}

async function moveFocus(element: HTMLElement, action: "focus" | "blur") {
  await act(async () => {
    element[action]();
  });
}

describe("TabsView block drag", () => {
  it("drags the block by its handle with a preview of its tabs, not a snapshot of the page", async () => {
    const { editor } = await mountTabs(true, [GlobalDragHandle]);
    const blockDom = editor.view.nodeDOM(0) as HTMLElement;
    const elementsFromPoint = document.elementsFromPoint;
    document.elementsFromPoint = () => [blockDom];
    editor.view.posAtCoords = () => ({ pos: 1, inside: 0 });
    const setDragImage = vi.fn();
    const dragStart = new Event("dragstart", { bubbles: true, cancelable: true });
    Object.assign(dragStart, {
      clientX: 0,
      clientY: 0,
      ctrlKey: false,
      dataTransfer: {
        clearData() {},
        setData() {},
        setDragImage,
        effectAllowed: "",
      },
    });
    await act(async () => {
      document.querySelector(".drag-handle")!.dispatchEvent(dragStart);
    });
    document.elementsFromPoint = elementsFromPoint;

    expect(editor.state.selection.from).toBe(0);
    const [image] = setDragImage.mock.calls[0] as [HTMLElement];
    expect(image).not.toBe(blockDom);
    expect(image.hasAttribute("hidden")).toBe(false);
    expect(image.textContent).toBe("Alpha · Beta");
    image.dispatchEvent(new Event("dragend", { bubbles: true }));
  });
});

describe("TabsView tab reorder", () => {
  // inside is the node whose DOM holds the pointer, as ProseMirror reports it
  function dragOver(
    editor: Editor,
    target: Element,
    pos: number,
    inside: number,
  ) {
    editor.view.posAtCoords = () => ({ pos, inside });
    const event = new Event("dragover", { bubbles: true, cancelable: true });
    Object.assign(event, { clientX: 5, clientY: 5 });
    target.dispatchEvent(event);
  }
  const dropCursor = () =>
    document.querySelector(
      ".prosemirror-dropcursor-block, .prosemirror-dropcursor-inline",
    );

  it("shows no editor drop cursor while a tab is dragged over the strip", async () => {
    const { editor } = await mountTabs(true);
    Object.defineProperty(editor.view.dom, "offsetParent", {
      configurable: true,
      get: () => document.body,
    });
    const panelStart = textPos(editor, "first panel") - 1;

    dragOver(editor, screen.getByRole("tab", { name: "Beta" }), panelStart, 0);
    expect(dropCursor()).toBeNull();

    // the same drag over the content does get one, so the check above can fail
    dragOver(
      editor,
      editor.view.domAtPos(textPos(editor, "first panel")).node as Element,
      panelStart,
      panelStart,
    );
    expect(dropCursor()).not.toBeNull();
    dropCursor()!.remove();
  });
});

describe("TabsView strip events", () => {
  function fire(target: Element, type: string) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, {
      clientX: 0,
      clientY: 0,
      dataTransfer: {
        files: [],
        types: ["text/html"],
        getData: (kind: string) => (kind === "text/html" ? "<p>dropped</p>" : ""),
      },
    });
    target.dispatchEvent(event);
    return event;
  }

  it("leaves the strip's tab reorder drags to the strip", async () => {
    const { editor } = await mountTabs(true);
    editor.view.posAtCoords = () => null;
    const before = editor.state.doc;
    const tabElement = screen.getByRole("tab", { name: "Beta" });

    expect(fire(tabElement, "dragover").defaultPrevented).toBe(false);
    fire(tabElement, "drop");
    expect(editor.state.doc).toBe(before);

    // over the content the editor does accept the drag
    const content = editor.view.domAtPos(textPos(editor, "first panel"))
      .node as Element;
    expect(fire(content, "dragover").defaultPrevented).toBe(true);
  });
});

describe("TabsView toolbar", () => {
  it("shows Copy and Delete only while the cursor is in the block in edit mode", async () => {
    const { editor } = await mountTabs(true);
    await focusEditorAt(editor, "first panel");
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();

    await act(async () => {
      editor.commands.setTextSelection(textPos(editor, "after"));
    });
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();

    await act(async () => {
      editor.commands.setTextSelection(textPos(editor, "first panel"));
      editor.setEditable(false);
    });
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });

  it("shows no toolbar on load before the editor is focused", async () => {
    const { editor } = await mountTabs(true);
    expect(editor.state.selection.$head.node(1).type.name).toBe("tabs");
    expect(editor.isFocused).toBe(false);
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });

  it("keeps the toolbar when focus moves from the editor to a tab", async () => {
    const { editor } = await mountTabs(true);
    await focusEditorAt(editor, "first panel");
    const copyButton = screen.getByRole("button", { name: "Copy" });

    await moveFocus(screen.getByRole("tab", { name: "Alpha" }), "focus");
    expect(editor.view.hasFocus()).toBe(false);
    expect(screen.getByRole("button", { name: "Copy" })).toBe(copyButton);
  });

  it("keeps the toolbar while focus is in the tab actions menu", async () => {
    const { editor } = await mountTabs(true);
    await focusEditorAt(editor, "first panel");
    await click(screen.getByRole("button", { name: "Tab actions for Alpha" }));

    await moveFocus(screen.getByRole("menuitem", { name: "Rename" }), "focus");
    expect(editor.view.hasFocus()).toBe(false);
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  });

  it("hides the toolbar once focus leaves both the editor and the block", async () => {
    const { editor } = await mountTabs(true);
    await focusEditorAt(editor, "first panel");
    const tabButton = screen.getByRole("tab", { name: "Alpha" });
    await moveFocus(tabButton, "focus");
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();

    await moveFocus(tabButton, "blur");
    expect(document.activeElement).toBe(document.body);
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();

    await focusEditorAt(editor, "first panel");
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    await moveFocus(editor.view.dom as HTMLElement, "blur");
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });

  // a browser re-renders between the editor's blur and the button's focus, so
  // the toolbar must keep focus in the editor or it unmounts before the click
  it.each(["Copy", "Delete"])(
    "keeps focus in the editor when %s is pressed",
    async (name) => {
      const { editor } = await mountTabs(true);
      await focusEditorAt(editor, "first panel");
      const icon = screen
        .getByRole("button", { name })
        .querySelector("svg")!;
      expect(fireEvent.mouseDown(icon)).toBe(false);
      expect(editor.view.hasFocus()).toBe(true);
    },
  );

  it("deletes the whole block", async () => {
    const { editor } = await mountTabs(true);
    await focusEditorAt(editor, "first panel");
    await click(screen.getByRole("button", { name: "Delete" }));
    expect(editor.state.doc.firstChild!.type.name).toBe("paragraph");
  });

  it("copies the block as HTML", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { write },
      configurable: true,
    });
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = class {
      constructor(public items: Record<string, Blob>) {}
    };

    const { editor } = await mountTabs(true);
    await focusEditorAt(editor, "first panel");
    await click(screen.getByRole("button", { name: "Copy" }));

    const [item] = write.mock.calls[0][0] as { items: Record<string, Blob> }[];
    const html = await item.items["text/html"].text();
    expect(html).toContain('data-type="tabs"');
    expect(html).toContain("Alpha");
    expect(html).toContain("Beta");
    expect(await item.items["text/plain"].text()).toBe(
      "Alpha\n\nfirst panel\n\nBeta\n\nsecond panel",
    );
  });
});
