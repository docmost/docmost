import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { Editor, getSchema, type JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Collaboration } from "@tiptap/extension-collaboration";
import { undoDepth } from "@tiptap/pm/history";
import { DOMSerializer } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import { prosemirrorJSONToYDoc } from "@tiptap/y-tiptap";
import {
  Tab,
  TabLabel,
  TabPanel,
  Tabs,
  getActiveTabIndex,
} from "@docmost/editor-ext";
import { showTabAtElement } from "@/features/editor/utils";

const paragraph = (text = ""): JSONContent =>
  text
    ? { type: "paragraph", content: [{ type: "text", text }] }
    : { type: "paragraph" };

const tab = (id: string, label: string, ...blocks: JSONContent[]) => ({
  type: "tab",
  attrs: { id },
  content: [
    { type: "tabLabel", content: [{ type: "text", text: label }] },
    { type: "tabPanel", content: blocks.length ? blocks : [paragraph()] },
  ],
});

const tabsBlock = (...tabs: JSONContent[]): JSONContent => ({
  type: "tabs",
  content: tabs,
});

let editor: Editor | null = null;

beforeAll(() => {
  // jsdom has no layout, and scrolling the selection into view measures ranges
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
  Range.prototype.getClientRects = () =>
    ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    }) as unknown as DOMRectList;
});

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function createEditor(...content: JSONContent[]) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({
    element,
    extensions: [StarterKit, Tabs, Tab, TabLabel, TabPanel],
    content: { type: "doc", content },
  });
  return editor;
}

function textPos(target: Editor, text: string, from = 0) {
  let found = -1;
  target.state.doc.descendants((node, pos) => {
    if (found !== -1) return false;
    if (node.isTextblock && node.textContent === text && pos >= from) {
      found = pos + 1;
    }
    return true;
  });
  return found;
}

function tabIds(target: Editor) {
  const ids: string[] = [];
  target.state.doc.descendants((node) => {
    if (node.type.name === "tab") ids.push(node.attrs.id);
    return true;
  });
  return ids;
}

function blockHTML(target: Editor, pos: number) {
  const wrapper = document.createElement("div");
  wrapper.appendChild(
    DOMSerializer.fromSchema(target.schema).serializeNode(
      target.state.doc.nodeAt(pos)!,
    ),
  );
  return wrapper.innerHTML;
}

// pastes into the empty paragraph that ends the document
function pasteAtEnd(target: Editor, html: string) {
  target.commands.setTextSelection(target.state.doc.content.size - 1);
  // jsdom has no ClipboardEvent, which pasteHTML would create without one
  target.view.pasteHTML(html, new Event("paste") as ClipboardEvent);
}

function tabsPositions(target: Editor) {
  const positions: number[] = [];
  target.state.doc.descendants((node, pos) => {
    if (node.type.name === "tabs") positions.push(pos);
    return true;
  });
  return positions;
}

function labels(target: Editor, tabsPos = tabsPositions(target)[0]) {
  const tabs = target.state.doc.nodeAt(tabsPos)!;
  return Array.from(
    { length: tabs.childCount },
    (_, index) => tabs.child(index).firstChild!.textContent,
  );
}

function hiddenTabIds(target: Editor) {
  return Array.from(
    target.view.dom.querySelectorAll('[data-type="tab"].dm-tab-hidden'),
  ).map((element) => element.getAttribute("data-tab-id"));
}

function selectionAncestors(target: Editor) {
  const { $head } = target.state.selection;
  return Array.from(
    { length: $head.depth + 1 },
    (_, depth) => $head.node(depth).type.name,
  );
}

describe("tabs: per-viewer active tab", () => {
  it("opens on the first tab and hides the others", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
    );
    expect(getActiveTabIndex(ed.state, 0)).toBe(0);
    expect(hiddenTabIds(ed)).toEqual(["b"]);
  });

  it("switches tabs without changing the document or the undo history", () => {
    // ends in a paragraph so the trailing-node extension has nothing to append
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
      paragraph(),
    );
    const before = ed.state.doc;
    ed.commands.setActiveTab(1, 0);
    expect(ed.state.doc).toBe(before);
    expect(undoDepth(ed.state)).toBe(0);
    expect(getActiveTabIndex(ed.state, 0)).toBe(1);
    expect(hiddenTabIds(ed)).toEqual(["a"]);
  });

  it("keeps the tab elements in place when switching", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
    );
    const firstTab = ed.view.dom.querySelector('[data-tab-id="a"]');
    ed.commands.setActiveTab(1, 0);
    expect(ed.view.dom.querySelector('[data-tab-id="a"]')).toBe(firstTab);
  });

  it("keeps the active tab when content is added above the block", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
    );
    ed.commands.setActiveTab(1, 0);
    ed.commands.insertContentAt(0, paragraph("above"));
    const [tabsPos] = tabsPositions(ed);
    expect(tabsPos).toBeGreaterThan(0);
    expect(getActiveTabIndex(ed.state, tabsPos)).toBe(1);
    expect(hiddenTabIds(ed)).toEqual(["a"]);
  });

  it("keeps nested blocks' hidden tabs when the outer block switches", () => {
    const inner = tabsBlock(tab("c", "Gamma"), tab("d", "Delta"));
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha", inner), tab("b", "Beta")),
    );
    const [outerPos, innerPos] = tabsPositions(ed);
    ed.commands.setActiveTab(1, innerPos);
    expect(hiddenTabIds(ed).sort()).toEqual(["b", "c"]);
    ed.commands.setActiveTab(1, outerPos);
    expect(hiddenTabIds(ed).sort()).toEqual(["a", "c"]);
    ed.commands.setActiveTab(0, outerPos);
    expect(hiddenTabIds(ed).sort()).toEqual(["b", "c"]);
  });

  it("hides the other tabs of a pasted block", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
      paragraph(),
    );
    pasteAtEnd(ed, blockHTML(ed, 0));
    const [, copyPos] = tabsPositions(ed);
    const copyIds = [0, 1].map(
      (index) => ed.state.doc.nodeAt(copyPos)!.child(index).attrs.id,
    );
    expect(hiddenTabIds(ed).sort()).toEqual(["b", copyIds[1]].sort());
  });

  it("hides the right tabs after a tab is moved or deleted", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta"), tab("c", "Gamma")),
    );
    ed.commands.setActiveTab(1, 0);
    ed.commands.moveTab(1, 2, 0);
    expect(hiddenTabIds(ed)).toEqual(["a", "c"]);
    ed.commands.deleteTab(0, 0);
    expect(hiddenTabIds(ed)).toEqual(["c"]);
  });

  it("keeps a tab opened by a command that later steps in the chain move", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
      paragraph(),
    );
    ed.chain().setActiveTab(1, 0).insertContentAt(0, paragraph("above")).run();
    const [tabsPos] = tabsPositions(ed);
    expect(tabsPos).toBeGreaterThan(0);
    expect(getActiveTabIndex(ed.state, tabsPos)).toBe(1);
    expect(hiddenTabIds(ed)).toEqual(["a"]);
  });

  it("keeps the active tab when the block is wrapped and lifted", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
      paragraph("tail"),
    );
    ed.commands.setActiveTab(1, 0);
    selectNode(ed, "tabs");
    ed.commands.wrapIn("blockquote");
    let [tabsPos] = tabsPositions(ed);
    expect(ed.state.doc.firstChild!.type.name).toBe("blockquote");
    expect(getActiveTabIndex(ed.state, tabsPos)).toBe(1);
    expect(hiddenTabIds(ed)).toEqual(["a"]);

    selectNode(ed, "tabs");
    ed.commands.lift("blockquote");
    [tabsPos] = tabsPositions(ed);
    expect(tabsPos).toBe(0);
    expect(getActiveTabIndex(ed.state, tabsPos)).toBe(1);
    expect(hiddenTabIds(ed)).toEqual(["a"]);
  });

  it("showTabAt opens every tab that contains the position", () => {
    const inner = tabsBlock(
      tab("c", "Gamma"),
      tab("d", "Delta", paragraph("deep")),
    );
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta", inner)),
    );
    ed.commands.showTabAt(textPos(ed, "deep"));
    const [outerPos, innerPos] = tabsPositions(ed);
    expect(getActiveTabIndex(ed.state, outerPos)).toBe(1);
    expect(getActiveTabIndex(ed.state, innerPos)).toBe(1);
  });
});

describe("tabs: revealing hidden content", () => {
  it("leaves hidden tabs findable so find in page can reach them", () => {
    const ed = createEditor(tabsBlock(tab("a", "Alpha"), tab("b", "Beta")));
    const hidden = ed.view.dom.querySelector('[data-tab-id="b"]')!;
    expect(hidden.getAttribute("hidden")).toBe("until-found");
    expect(
      ed.view.dom.querySelector('[data-tab-id="a"]')!.hasAttribute("hidden"),
    ).toBe(false);
  });

  it("opens a hidden tab when the browser reveals a match in it", () => {
    const ed = createEditor(tabsBlock(tab("a", "Alpha"), tab("b", "Beta")));
    ed.view.dom
      .querySelector('[data-tab-id="b"]')!
      .dispatchEvent(new Event("beforematch", { bubbles: true }));
    expect(getActiveTabIndex(ed.state, 0)).toBe(1);
    expect(hiddenTabIds(ed)).toEqual(["a"]);
  });

  it("showTabAtElement opens every hidden tab around an element", () => {
    const inner = tabsBlock(
      tab("c", "Gamma"),
      tab("d", "Delta", paragraph("deep")),
    );
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta", inner)),
    );
    showTabAtElement(ed.view.domAtPos(textPos(ed, "deep")).node as Element);
    const [outerPos, innerPos] = tabsPositions(ed);
    expect(getActiveTabIndex(ed.state, outerPos)).toBe(1);
    expect(getActiveTabIndex(ed.state, innerPos)).toBe(1);
    expect(hiddenTabIds(ed).sort()).toEqual(["a", "c"]);
  });

  it("showTabAtElement leaves visible content alone", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha", paragraph("shown")), tab("b", "Beta")),
    );
    const before = ed.state;
    showTabAtElement(ed.view.domAtPos(textPos(ed, "shown")).node as Element);
    expect(ed.state).toBe(before);
  });
});

function panelOutline(target: Editor, tabsPos: number, index = 0) {
  const out: string[] = [];
  target.state.doc
    .nodeAt(tabsPos)!
    .child(index)
    .lastChild!.forEach((node) => {
      const level = node.type.name === "heading" ? node.attrs.level : "";
      out.push(`${node.type.name}${level}: ${node.textContent}`);
    });
  return out;
}

describe("tabs: no tabs inside tabs", () => {
  it("insertTabs refuses inside a tab, including inside a block in it", () => {
    const ed = createEditor(
      tabsBlock(
        tab(
          "a",
          "Alpha",
          paragraph("inside"),
          { type: "blockquote", content: [paragraph("quoted")] },
        ),
      ),
      paragraph("outside"),
    );
    ed.commands.setTextSelection(textPos(ed, "inside"));
    expect(ed.commands.insertTabs()).toBe(false);
    ed.commands.setTextSelection(textPos(ed, "quoted"));
    expect(ed.can().insertTabs()).toBe(false);
    ed.commands.setTextSelection(textPos(ed, "outside"));
    expect(ed.can().insertTabs()).toBe(true);
    expect(tabsPositions(ed)).toHaveLength(1);
  });

  it("flattens a tabs block pasted into a tab into headings and content", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha", paragraph("inside"), paragraph())),
      tabsBlock(
        tab("x", "X", paragraph("x body")),
        tab("y", "Y", paragraph("y body")),
      ),
      paragraph(),
    );
    const [targetPos, copyPos] = tabsPositions(ed);
    ed.commands.setTextSelection(emptyPanelLinePos(ed));
    ed.view.pasteHTML(
      blockHTML(ed, copyPos),
      new Event("paste") as ClipboardEvent,
    );
    expect(tabsPositions(ed)).toEqual([targetPos, expect.any(Number)]);
    expect(panelOutline(ed, targetPos)).toEqual([
      "paragraph: inside",
      "heading4: X",
      "paragraph: x body",
      "heading4: Y",
      "paragraph: y body",
    ]);
  });

  it("pastes text copied from one tab into another without flattening anything", () => {
    const ed = createEditor(
      tabsBlock(
        tab("a", "Alpha", paragraph("alpha one"), paragraph("alpha two")),
        tab("b", "Beta", paragraph("beta")),
      ),
      paragraph(),
    );
    ed.commands.setTextSelection({
      from: textPos(ed, "alpha one") + 6,
      to: textPos(ed, "alpha two") + 5,
    });
    const { dom } = ed.view.serializeForClipboard(ed.state.selection.content());
    ed.commands.setActiveTab(1, 0);
    ed.commands.setTextSelection(textPos(ed, "beta") + "beta".length);
    ed.view.pasteHTML(dom.innerHTML, new Event("paste") as ClipboardEvent);
    expect(tabsPositions(ed)).toEqual([0]);
    expect(labels(ed)).toEqual(["Alpha", "Beta"]);
    expect(panelOutline(ed, 0, 1)).toEqual([
      "paragraph: betaone",
      "paragraph: alpha",
    ]);
  });

  function dropTabsBlock(target: Editor, sourcePos: number, dropPos: number) {
    const dragged = NodeSelection.create(target.state.doc, sourcePos);
    target.view.dispatch(target.state.tr.setSelection(dragged));
    target.view.dragging = {
      slice: dragged.content(),
      move: true,
      node: dragged,
    } as typeof target.view.dragging;
    target.view.posAtCoords = () => ({ pos: dropPos, inside: -1 });
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.assign(drop, {
      clientX: 10,
      clientY: 10,
      dataTransfer: { files: [], types: [], getData: () => "" },
    });
    target.view.dom.dispatchEvent(drop);
    return drop;
  }

  it("refuses to drop a tabs block into a tab", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha", paragraph("inside"))),
      tabsBlock(tab("x", "X", paragraph("x body"))),
      paragraph("tail"),
    );
    const before = ed.state.doc;
    const [, sourcePos] = tabsPositions(ed);
    const drop = dropTabsBlock(ed, sourcePos, textPos(ed, "inside") + 2);
    expect(ed.state.doc).toBe(before);
    expect(drop.defaultPrevented).toBe(true);
  });

  it("still drops a tabs block outside tabs", () => {
    const ed = createEditor(
      paragraph("lead"),
      tabsBlock(tab("x", "X", paragraph("x body"))),
      paragraph("tail"),
    );
    const [sourcePos] = tabsPositions(ed);
    dropTabsBlock(ed, sourcePos, ed.state.doc.content.size);
    expect(ed.state.doc.firstChild!.textContent).toBe("lead");
    expect(ed.state.doc.child(1).textContent).toBe("tail");
    expect(tabsPositions(ed)).toHaveLength(1);
  });
});

describe("tabs: content taken out of a tab", () => {
  function copyFromTab(target: Editor) {
    target.commands.setTextSelection({
      from: textPos(target, "alpha one") + 6,
      to: textPos(target, "alpha two") + 5,
    });
    return target.view.serializeForClipboard(target.state.selection.content())
      .dom.innerHTML;
  }

  it.each([
    ["the end of a line", "outside", "outsideone"],
    ["an empty line", "", "one"],
  ])(
    "pastes text copied from a tab onto %s as plain content, not a new tabs block",
    (_, line, pasted) => {
      const ed = createEditor(
        tabsBlock(
          tab("a", "Alpha", paragraph("alpha one"), paragraph("alpha two")),
        ),
        paragraph(line),
        paragraph("tail"),
      );
      const html = copyFromTab(ed);
      const lineStart = ed.state.doc.firstChild!.nodeSize + 1;
      ed.commands.setTextSelection(lineStart + line.length);
      ed.view.pasteHTML(html, new Event("paste") as ClipboardEvent);
      expect(tabsPositions(ed)).toEqual([0]);
      expect(ed.state.doc.child(1).textContent).toBe(pasted);
      expect(ed.state.doc.child(2).textContent).toBe("alpha");
    },
  );

  it("keeps the tab when everything in it is replaced by a paste", () => {
    const ed = createEditor(
      tabsBlock(
        tab("a", "Alpha", paragraph("alpha one"), paragraph("alpha two")),
      ),
      paragraph("tail"),
    );
    ed.commands.setTextSelection({
      from: textPos(ed, "alpha one"),
      to: textPos(ed, "alpha two") + "alpha two".length,
    });
    ed.view.pasteHTML("<p>pasted</p>", new Event("paste") as ClipboardEvent);
    expect(tabsPositions(ed)).toEqual([0]);
    expect(labels(ed)).toEqual(["Alpha"]);
    expect(panelOutline(ed, 0)).toEqual(["paragraph: pasted"]);
  });

  it("drops a selection dragged out of a tab as plain content, not a new tabs block", () => {
    const ed = createEditor(
      tabsBlock(
        tab("a", "Alpha", paragraph("alpha one"), paragraph("alpha two")),
      ),
      paragraph("outside"),
      paragraph(),
    );
    ed.commands.setTextSelection({
      from: textPos(ed, "alpha one"),
      to: textPos(ed, "alpha two") + "alpha two".length,
    });
    ed.view.dragging = {
      slice: ed.state.selection.content(),
      move: true,
    } as typeof ed.view.dragging;
    const emptyLine = ed.state.doc.content.size - 1;
    ed.view.posAtCoords = () => ({ pos: emptyLine, inside: -1 });
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.assign(drop, {
      clientX: 10,
      clientY: 10,
      dataTransfer: { files: [], types: [], getData: () => "" },
    });
    ed.view.dom.dispatchEvent(drop);
    expect(tabsPositions(ed)).toEqual([0]);
    expect(ed.state.doc.child(2).textContent).toBe("alpha one");
    expect(ed.state.doc.child(3).textContent).toBe("alpha two");
  });
});

describe("tabs: commands", () => {
  it("insertTabs adds two tabs and puts the cursor in the first panel", () => {
    const ed = createEditor(paragraph());
    ed.commands.setTextSelection(1);
    ed.commands.insertTabs();
    expect(labels(ed)).toEqual(["Tab 1", "Tab 2"]);
    expect(selectionAncestors(ed)).toEqual([
      "doc",
      "tabs",
      "tab",
      "tabPanel",
      "paragraph",
    ]);
    expect(ed.state.selection.$head.index(1)).toBe(0);
  });

  it("addTab appends a numbered tab and switches to it", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
    );
    ed.commands.addTab(0);
    expect(labels(ed)).toEqual(["Alpha", "Beta", "Tab 3"]);
    expect(getActiveTabIndex(ed.state, 0)).toBe(2);
  });

  it("duplicateTab copies the tab next to it with a new id and switches to it", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha", paragraph("body")), tab("b", "Beta")),
    );
    ed.commands.duplicateTab(0, 0);
    const tabs = ed.state.doc.nodeAt(0)!;
    expect(labels(ed)).toEqual(["Alpha", "Alpha", "Beta"]);
    expect(tabs.child(1).lastChild!.textContent).toBe("body");
    expect(tabs.child(1).attrs.id).not.toBe("a");
    expect(getActiveTabIndex(ed.state, 0)).toBe(1);
  });

  it("moveTab keeps the active tab selected", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta"), tab("c", "Gamma")),
    );
    ed.commands.moveTab(0, 2, 0);
    expect(labels(ed)).toEqual(["Beta", "Gamma", "Alpha"]);
    expect(getActiveTabIndex(ed.state, 0)).toBe(2);
    ed.commands.moveTab(0, 1, 0);
    expect(labels(ed)).toEqual(["Gamma", "Beta", "Alpha"]);
    expect(getActiveTabIndex(ed.state, 0)).toBe(2);
  });

  it("renameTab replaces the label and clears it without inserting a space", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
    );
    ed.commands.renameTab(1, "Second", 0);
    expect(labels(ed)).toEqual(["Alpha", "Second"]);
    ed.commands.renameTab(1, "", 0);
    expect(labels(ed)).toEqual(["Alpha", ""]);
  });

  it("deleteTab on the active tab switches to its neighbour", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta"), tab("c", "Gamma")),
    );
    ed.commands.setActiveTab(1, 0);
    ed.commands.deleteTab(1, 0);
    expect(labels(ed)).toEqual(["Alpha", "Gamma"]);
    expect(getActiveTabIndex(ed.state, 0)).toBe(1);
  });

  it("deleteTab on another tab keeps the active tab", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta"), tab("c", "Gamma")),
    );
    ed.commands.setActiveTab(2, 0);
    ed.commands.deleteTab(0, 0);
    expect(labels(ed)).toEqual(["Beta", "Gamma"]);
    expect(getActiveTabIndex(ed.state, 0)).toBe(1);
  });

  it("deleteTab on the last tab removes the block without throwing", () => {
    const ed = createEditor(paragraph("before"), tabsBlock(tab("a", "Only")));
    const [tabsPos] = tabsPositions(ed);
    expect(() =>
      ed.chain().focus().deleteTab(0, tabsPos).run(),
    ).not.toThrow();
    expect(tabsPositions(ed)).toEqual([]);
  });
});

describe("tabs: unique tab ids", () => {
  it("gives pasted tabs, nested ones included, new ids", () => {
    const inner = tabsBlock(tab("c", "Gamma"), tab("d", "Delta"));
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha", inner), tab("b", "Beta")),
      paragraph(),
    );
    pasteAtEnd(ed, blockHTML(ed, 0));
    expect(tabsPositions(ed)).toHaveLength(4);
    const ids = tabIds(ed);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    expect(ids.every(Boolean)).toBe(true);
  });

  it("duplicateTab gives the copy's nested tabs new ids", () => {
    const inner = tabsBlock(tab("c", "Gamma"), tab("d", "Delta"));
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha", inner), tab("b", "Beta")),
    );
    ed.commands.duplicateTab(0, 0);
    const ids = tabIds(ed);
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
  });

  it("generates an id for a tab whose HTML id is empty", () => {
    const ed = createEditor(paragraph());
    ed.commands.setContent(
      '<div data-type="tabs"><div data-type="tab" data-tab-id=""><div data-type="tabLabel">L</div><div data-type="tabPanel"><p>p</p></div></div></div>',
    );
    expect(ed.state.doc.firstChild!.firstChild!.attrs.id).toBeTruthy();
  });
});

describe("tabs: unique tab ids repair", () => {
  it("renames repeated and empty ids on load so every tab can be opened", async () => {
    const ed = createEditor(
      tabsBlock(
        tab("x", "First", paragraph("first")),
        tab("x", "Second", paragraph("second")),
        tab("", "Third"),
      ),
      paragraph(),
    );
    // tiptap runs onCreate a task after mounting
    await new Promise((resolve) => setTimeout(resolve, 0));
    const ids = tabIds(ed);
    expect(ids[0]).toBe("x");
    expect(new Set(ids).size).toBe(3);
    expect(ids.every(Boolean)).toBe(true);
    expect(undoDepth(ed.state)).toBe(0);

    ed.commands.setActiveTab(1, 0);
    expect(getActiveTabIndex(ed.state, 0)).toBe(1);
    expect(hiddenTabIds(ed)).not.toContain(ids[1]);
  });

  it("renames the ids of an inserted block that repeat existing ones", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
      paragraph(),
    );
    ed.commands.insertContentAt(
      ed.state.doc.content.size - 1,
      tabsBlock(tab("a", "Copy A"), tab("b", "Copy B")),
    );
    const ids = tabIds(ed);
    expect(ids.slice(0, 2)).toEqual(["a", "b"]);
    expect(new Set(ids).size).toBe(4);
  });
});

describe("tabs: collaboration", () => {
  const extensions = [
    StarterKit.configure({ undoRedo: false }),
    Tabs,
    Tab,
    TabLabel,
    TabPanel,
  ];
  const mounted: Editor[] = [];

  afterEach(() => {
    mounted.splice(0).forEach((instance) => instance.destroy());
  });

  function startSession(...content: JSONContent[]) {
    const mount = (ydoc: Y.Doc) => {
      const element = document.createElement("div");
      document.body.appendChild(element);
      const instance = new Editor({
        element,
        extensions: [...extensions, Collaboration.configure({ document: ydoc })],
      });
      mounted.push(instance);
      return instance;
    };

    const viewerDoc = prosemirrorJSONToYDoc(
      getSchema(extensions),
      { type: "doc", content },
      "default",
    );
    const viewer = mount(viewerDoc);

    const typeRemotely = (pos: number, content: string | JSONContent) => {
      const remoteDoc = new Y.Doc();
      Y.applyUpdate(remoteDoc, Y.encodeStateAsUpdate(viewerDoc));
      mount(remoteDoc).commands.insertContentAt(pos, content);
      Y.applyUpdate(
        viewerDoc,
        Y.encodeStateAsUpdate(remoteDoc, Y.encodeStateVector(viewerDoc)),
        "remote",
      );
    };

    return { viewer, typeRemotely };
  }

  it("keeps the active tab when a remote update replaces the document", () => {
    const { viewer, typeRemotely } = startSession(
      paragraph("lead"),
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
      paragraph("tail"),
    );
    const [tabsPos] = tabsPositions(viewer);
    viewer.commands.setActiveTab(1, tabsPos);

    typeRemotely(1, "!");

    expect(viewer.state.doc.firstChild!.textContent).toBe("!lead");
    const [movedPos] = tabsPositions(viewer);
    expect(movedPos).toBe(tabsPos + 1);
    expect(getActiveTabIndex(viewer.state, movedPos)).toBe(1);
  });

  it("keeps the active tab of a pasted copy when a remote update replaces the document", () => {
    const { viewer, typeRemotely } = startSession(
      paragraph("lead"),
      tabsBlock(
        tab("a", "Alpha", paragraph("a1")),
        tab("b", "Beta", paragraph("b1")),
      ),
      paragraph(),
    );
    pasteAtEnd(viewer, blockHTML(viewer, tabsPositions(viewer)[0]));
    const [, copyPos] = tabsPositions(viewer);
    viewer.commands.setActiveTab(1, copyPos);
    viewer.commands.setTextSelection(textPos(viewer, "b1", copyPos));

    typeRemotely(1, "!");

    const [, movedCopyPos] = tabsPositions(viewer);
    expect(movedCopyPos).toBe(copyPos + 1);
    expect(getActiveTabIndex(viewer.state, movedCopyPos)).toBe(1);
    expect(viewer.state.selection.from).toBeGreaterThan(movedCopyPos);
    expect(viewer.state.selection.$head.parent.textContent).toBe("b1");
  });

  it("keeps the active tab when a remote edit repeats the text next to it", () => {
    const { viewer, typeRemotely } = startSession(
      paragraph("aa"),
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
      paragraph("tail"),
    );
    const [tabsPos] = tabsPositions(viewer);
    viewer.commands.setActiveTab(1, tabsPos);

    typeRemotely(2, "a");

    expect(viewer.state.doc.firstChild!.textContent).toBe("aaa");
    expect(getActiveTabIndex(viewer.state, tabsPos + 1)).toBe(1);
    expect(hiddenTabIds(viewer)).toEqual(["a"]);
  });

  it("keeps the active tab when a collaborator types inside it", () => {
    const { viewer, typeRemotely } = startSession(
      tabsBlock(
        tab("a", "Alpha", paragraph("a1")),
        tab("b", "Beta", paragraph("b1")),
      ),
      paragraph("tail"),
    );
    viewer.commands.setActiveTab(1, 0);

    typeRemotely(textPos(viewer, "b1"), "!");

    expect(textPos(viewer, "!b1")).toBeGreaterThan(0);
    expect(getActiveTabIndex(viewer.state, 0)).toBe(1);
    expect(hiddenTabIds(viewer)).toEqual(["a"]);
  });

  it("keeps the active tab of tabs without ids when a remote update replaces the document", () => {
    const { viewer, typeRemotely } = startSession(
      paragraph("lead"),
      tabsBlock(tab("", "Alpha"), tab("", "Beta")),
      paragraph("tail"),
    );
    const [tabsPos] = tabsPositions(viewer);
    viewer.commands.setActiveTab(1, tabsPos);

    typeRemotely(1, "!");

    expect(getActiveTabIndex(viewer.state, tabsPos + 1)).toBe(1);
  });

  it("hides all but the first tab of a block a collaborator adds", () => {
    const { viewer, typeRemotely } = startSession(
      paragraph("lead"),
      paragraph("tail"),
    );

    typeRemotely(
      viewer.state.doc.firstChild!.nodeSize,
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
    );

    expect(tabsPositions(viewer)).toHaveLength(1);
    expect(hiddenTabIds(viewer)).toEqual(["b"]);
  });

  it("repairs repeated ids in a block a collaborator adds", () => {
    const { viewer, typeRemotely } = startSession(
      paragraph("lead"),
      paragraph("tail"),
    );

    typeRemotely(
      viewer.state.doc.firstChild!.nodeSize,
      tabsBlock(tab("x", "First"), tab("x", "Second")),
    );

    const ids = tabIds(viewer);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("keeps each block's active tab when blocks share tab ids", () => {
    const { viewer, typeRemotely } = startSession(
      paragraph("lead"),
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
      paragraph("between"),
      tabsBlock(tab("a", "Alpha"), tab("b", "Beta")),
      paragraph("tail"),
    );
    const [firstPos] = tabsPositions(viewer);
    viewer.commands.setActiveTab(1, firstPos);

    typeRemotely(1, "!");

    const indexes = tabsPositions(viewer).map((pos) =>
      getActiveTabIndex(viewer.state, pos),
    );
    expect(indexes).toEqual([1, 0]);
  });
});

function emptyPanelLinePos(target: Editor) {
  let found = -1;
  target.state.doc.descendants((node, pos, parent) => {
    if (found !== -1) return false;
    if (
      node.type.name === "paragraph" &&
      node.content.size === 0 &&
      parent?.type.name === "tabPanel"
    ) {
      found = pos + 1;
    }
    return true;
  });
  return found;
}

function pressKey(target: Editor, key: string, keyCode: number) {
  target.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      keyCode,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function selectNode(target: Editor, typeName: string) {
  let found = -1;
  target.state.doc.descendants((node, pos) => {
    if (found !== -1) return false;
    if (node.type.name === typeName) found = pos;
    return true;
  });
  target.view.dispatch(
    target.state.tr.setSelection(NodeSelection.create(target.state.doc, found)),
  );
}

describe("tabs: cursor placement", () => {
  it("focus at the start of a page that begins with tabs lands in the first panel", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha", paragraph("first panel")), tab("b", "Beta")),
    );
    ed.commands.focus("start");
    expect(selectionAncestors(ed)).toEqual([
      "doc",
      "tabs",
      "tab",
      "tabPanel",
      "paragraph",
    ]);
    expect(ed.state.selection.$head.parent.textContent).toBe("first panel");
  });

  it("focus at the start lands in the first panel when the page ends in a paragraph", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha", paragraph("first panel")), tab("b", "Beta")),
      paragraph("tail"),
    );
    ed.commands.focus("start");
    expect(selectionAncestors(ed)).toEqual([
      "doc",
      "tabs",
      "tab",
      "tabPanel",
      "paragraph",
    ]);
    expect(ed.state.selection.$head.parent.textContent).toBe("first panel");
  });

  it("moves the cursor into the new tab when its tab gets hidden", () => {
    const ed = createEditor(
      tabsBlock(
        tab("a", "Alpha", paragraph("first panel")),
        tab("b", "Beta", paragraph("second panel")),
      ),
    );
    ed.commands.setTextSelection(textPos(ed, "first panel"));
    ed.commands.setActiveTab(1, 0);
    expect(ed.state.selection.$head.parent.textContent).toBe("second panel");
  });

  it("keeps a cursor placed in a hidden tab inside the visible one", () => {
    const ed = createEditor(
      tabsBlock(
        tab("a", "Alpha", paragraph("first panel")),
        tab("b", "Beta", paragraph("second panel")),
      ),
    );
    ed.commands.setTextSelection(textPos(ed, "second panel"));
    expect(getActiveTabIndex(ed.state, 0)).toBe(0);
    expect(ed.state.selection.$head.parent.textContent).toBe("first panel");
  });

  it("moves a selection resting directly in the tabs block into the visible tab", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha", paragraph("first panel")), tab("b", "Beta")),
      paragraph("after"),
    );
    const secondTabPos = 1 + ed.state.doc.firstChild!.firstChild!.nodeSize;
    ed.view.dispatch(
      ed.state.tr.setSelection(NodeSelection.create(ed.state.doc, secondTabPos)),
    );
    expect(ed.state.selection.$head.parent.textContent).toBe("first panel");
  });

  it("does not switch back when find and replace resets the selection", () => {
    const ed = createEditor(
      tabsBlock(
        tab("a", "Alpha", paragraph("first panel")),
        tab("b", "Beta", paragraph("second panel")),
      ),
    );
    const match = textPos(ed, "second panel");
    ed.commands.showTabAt(match);
    ed.commands.setTextSelection(match);
    ed.commands.setTextSelection(0);
    expect(getActiveTabIndex(ed.state, 0)).toBe(1);
    expect(ed.state.selection.$head.parent.textContent).toBe("second panel");
  });

  it("drops a selection inside a tab that gets hidden instead of stretching it into the new tab", () => {
    const ed = createEditor(
      tabsBlock(
        tab("a", "Alpha", paragraph("alpha text")),
        tab("b", "Beta", paragraph("beta text")),
      ),
      paragraph("tail"),
    );
    ed.commands.setTextSelection({
      from: textPos(ed, "alpha text"),
      to: textPos(ed, "alpha text") + 5,
    });
    ed.commands.setActiveTab(1, 0);
    expect(ed.state.selection.empty).toBe(true);
    expect(ed.state.selection.$head.parent.textContent).toBe("beta text");
  });

  it("settles inside the inner visible tab when an outer panel opens with nested tabs", () => {
    const inner = tabsBlock(
      tab("c", "Gamma", paragraph("inner one")),
      tab("d", "Delta", paragraph("inner two")),
    );
    const ed = createEditor(
      tabsBlock(
        tab("a", "Alpha", inner),
        tab("b", "Beta", paragraph("outer two")),
      ),
      paragraph("tail"),
    );
    ed.commands.setActiveTab(1, 0);
    ed.commands.setTextSelection(textPos(ed, "outer two"));
    ed.commands.setActiveTab(0, 0);
    expect(ed.state.selection.$head.parent.textContent).toBe("inner one");
    expect(selectionAncestors(ed)).not.toContain("tabLabel");
  });
});

describe("tabs: arrow keys at the edges of a tab", () => {
  const divider: JSONContent = { type: "horizontalRule" };

  it("leaves the block downward past a divider that ends the tab", () => {
    const ed = createEditor(
      tabsBlock(
        tab("a", "Alpha", paragraph("first line"), divider),
        tab("b", "Beta", paragraph("beta")),
      ),
      paragraph("after the block"),
    );
    selectNode(ed, "horizontalRule");
    pressKey(ed, "ArrowDown", 40);
    expect(ed.state.selection.$head.parent.type.name).toBe("tabPanel");
    pressKey(ed, "ArrowDown", 40);
    expect(ed.state.selection.$head.parent.textContent).toBe("after the block");
    expect(getActiveTabIndex(ed.state, 0)).toBe(0);
  });

  it("leaves the block upward past a divider that starts the tab", () => {
    const ed = createEditor(
      paragraph("before the block"),
      tabsBlock(
        tab("a", "Alpha", divider, paragraph("first line")),
        tab("b", "Beta", paragraph("beta")),
      ),
      paragraph("after"),
    );
    selectNode(ed, "horizontalRule");
    pressKey(ed, "ArrowUp", 38);
    expect(ed.state.selection.$head.parent.textContent).toBe("before the block");
  });

  // jsdom has no layout for vertical arrows, so these move the selection the way
  // ProseMirror resolves them: into the nearest text, hidden or not
  it("moving up into the block from below lands at the end of the visible tab", () => {
    const ed = createEditor(
      tabsBlock(
        tab("a", "Alpha", paragraph("a first"), paragraph("a last")),
        tab("b", "Beta", paragraph("b last")),
      ),
      paragraph("after"),
    );
    ed.commands.setTextSelection(textPos(ed, "after"));
    ed.commands.setTextSelection(textPos(ed, "b last") + "b last".length);
    expect(ed.state.selection.head).toBe(
      textPos(ed, "a last") + "a last".length,
    );
  });

  it("keeps the anchor when a selection is extended into the block", () => {
    const ed = createEditor(
      paragraph("before"),
      tabsBlock(
        tab("a", "Alpha", paragraph("a first")),
        tab("b", "Beta", paragraph("b first")),
      ),
      paragraph("after"),
    );
    const [tabsPos] = tabsPositions(ed);
    ed.commands.setActiveTab(1, tabsPos);
    const anchor = textPos(ed, "before") + 2;
    ed.commands.setTextSelection(anchor);
    ed.commands.setTextSelection({ from: anchor, to: textPos(ed, "Alpha") });
    expect(ed.state.selection.anchor).toBe(anchor);
    expect(ed.state.selection.head).toBe(textPos(ed, "b first"));
  });

  it("keeps the anchor when a selection is extended out of the block", () => {
    const ed = createEditor(
      paragraph("before"),
      tabsBlock(
        tab("a", "Alpha", paragraph("a first")),
        tab("b", "Beta", paragraph("b first")),
      ),
      paragraph("after"),
    );
    const anchor = textPos(ed, "a first") + 3;
    ed.commands.setTextSelection(anchor);
    ed.commands.setTextSelection({ from: anchor, to: textPos(ed, "Alpha") });
    expect(ed.state.selection.anchor).toBe(anchor);
    expect(ed.state.selection.head).toBe(
      textPos(ed, "before") + "before".length,
    );
  });

  it("stays in the visible tab when nothing comes before the block", () => {
    const ed = createEditor(
      tabsBlock(
        tab("a", "Alpha", divider, paragraph("first line")),
        tab("b", "Beta", paragraph("beta")),
      ),
      paragraph("after"),
    );
    selectNode(ed, "horizontalRule");
    pressKey(ed, "ArrowUp", 38);
    expect(selectionAncestors(ed)).toEqual(["doc", "tabs", "tab", "tabPanel"]);
    expect(ed.state.selection.$head.index(1)).toBe(0);
  });
});

describe("tabs: Enter", () => {
  it("adds a line on an empty line in the middle of a tab", () => {
    const ed = createEditor(
      tabsBlock(
        tab("a", "Alpha", paragraph("A"), paragraph(), paragraph("B")),
      ),
    );
    ed.commands.setTextSelection(emptyPanelLinePos(ed));
    pressKey(ed, "Enter", 13);
    const panel = ed.state.doc.firstChild!.firstChild!.lastChild!;
    expect(panel.childCount).toBe(4);
    expect(selectionAncestors(ed)).toContain("tabPanel");
  });

  it("adds a line on the empty last line of a tab instead of leaving it", () => {
    const ed = createEditor(
      tabsBlock(tab("a", "Alpha", paragraph("A"), paragraph())),
    );
    ed.commands.setTextSelection(emptyPanelLinePos(ed));
    pressKey(ed, "Enter", 13);
    const panel = ed.state.doc.firstChild!.firstChild!.lastChild!;
    expect(panel.childCount).toBe(3);
    expect(selectionAncestors(ed)).toContain("tabPanel");
  });
});
