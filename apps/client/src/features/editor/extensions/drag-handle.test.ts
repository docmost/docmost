import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Editor, Node, type JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { NodeSelection } from "@tiptap/pm/state";
import { Tab, TabLabel, TabPanel, Tabs } from "@docmost/editor-ext";
import GlobalDragHandle from "./drag-handle";

let editor: Editor | null = null;
let element: HTMLElement | null = null;

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
  element?.remove();
  element = null;
});

const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

// stand-ins for custom nodes the handle drags whole: an atom like a synced
// block reference, and a container like a synced block
const Card = Node.create({
  name: "card",
  group: "block",
  atom: true,
  parseHTML: () => [{ tag: 'div[data-type="card"]' }],
  renderHTML: () => ["div", { "data-type": "card" }],
});
const Box = Node.create({
  name: "box",
  group: "block",
  content: "block+",
  parseHTML: () => [{ tag: 'div[data-type="box"]' }],
  renderHTML: () => ["div", { "data-type": "box" }, 0],
});

// X at 0 and Y at 3, then a one-tab block and a tail paragraph
function setup(
  panel: JSONContent[] = [paragraph("panel")],
  after: JSONContent[] = [],
) {
  element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({
    element,
    extensions: [
      StarterKit,
      Tabs,
      Tab,
      TabLabel,
      TabPanel,
      Card,
      Box,
      GlobalDragHandle.configure({
        customNodes: ["box", "tabPanel"],
        atomNodes: ["card"],
      }),
    ],
    content: {
      type: "doc",
      content: [
        paragraph("X"),
        paragraph("Y"),
        {
          type: "tabs",
          content: [
            {
              type: "tab",
              attrs: { id: "a" },
              content: [
                { type: "tabLabel", content: [{ type: "text", text: "Alpha" }] },
                { type: "tabPanel", content: panel },
              ],
            },
          ],
        },
        paragraph("tail"),
        ...after,
      ],
    },
  });
  return editor;
}

function panelStart(ed: Editor) {
  let found = -1;
  ed.state.doc.descendants((node, pos) => {
    if (found === -1 && node.type.name === "tabPanel") found = pos + 1;
    return found === -1;
  });
  return found;
}

function panelChildren(ed: Editor) {
  const panel = ed.state.doc.nodeAt(panelStart(ed) - 1)!;
  const out: string[] = [];
  panel.forEach((node) => out.push(node.textContent || node.type.name));
  return out;
}

function childPos(ed: Editor, typeName: string) {
  let found = -1;
  ed.state.doc.descendants((node, pos) => {
    if (found === -1 && node.type.name === typeName) found = pos;
    return found === -1;
  });
  return found;
}

const texts = (ed: Editor) => {
  const out: string[] = [];
  ed.state.doc.descendants((node) => {
    if (node.isTextblock) out.push(node.textContent);
    return true;
  });
  return out;
};

const dragData = () => ({
  files: [],
  clearData() {},
  setData() {},
  setDragImage() {},
  effectAllowed: "",
});

function dragEvent(type: string, dataTransfer: unknown) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: 0, clientY: 0, ctrlKey: false, dataTransfer });
  return event;
}

function startHandleDrag(ed: Editor, blockPos: number) {
  const handle = element!.querySelector<HTMLElement>(".drag-handle")!;
  const blockDom = ed.view.nodeDOM(blockPos) as HTMLElement;
  const elementsFromPoint = document.elementsFromPoint;
  document.elementsFromPoint = () => [blockDom];
  ed.view.posAtCoords = () => ({ pos: blockPos + 1, inside: blockPos });
  handle.dispatchEvent(dragEvent("dragstart", dragData()));
  document.elementsFromPoint = elementsFromPoint;
  return handle;
}

function startNativeDrag(ed: Editor, blockPos: number) {
  ed.view.dispatch(
    ed.state.tr.setSelection(NodeSelection.create(ed.state.doc, blockPos)),
  );
  ed.view.posAtCoords = () => ({ pos: blockPos + 1, inside: blockPos });
  (ed.view.nodeDOM(blockPos) as HTMLElement).dispatchEvent(
    dragEvent("dragstart", dragData()),
  );
}

function dropAt(ed: Editor, pos: number, dataTransfer?: unknown) {
  ed.view.posAtCoords = () => ({ pos, inside: -1 });
  const drop = new Event("drop", { bubbles: true, cancelable: true });
  Object.assign(drop, { clientX: 10, clientY: 10, dataTransfer });
  ed.view.dom.dispatchEvent(drop);
  return drop;
}

const endDrag = (source: HTMLElement) =>
  source.dispatchEvent(new Event("dragend", { bubbles: true }));

describe("drag handle drops into a tab panel", () => {
  it("leaves drops that did not start in the editor to ProseMirror", () => {
    const ed = setup();
    ed.view.dispatch(
      ed.state.tr.setSelection(NodeSelection.create(ed.state.doc, 0)),
    );
    const before = ed.state.doc;
    const drop = dropAt(ed, panelStart(ed));
    expect(ed.state.doc).toBe(before);
    expect(drop.defaultPrevented).toBe(false);
  });

  it("moves a block dragged by its handle into the panel", () => {
    const ed = setup();
    const handle = startHandleDrag(ed, 0);
    const drop = dropAt(ed, panelStart(ed), dragData());
    endDrag(handle);
    expect(texts(ed)).toEqual(["Y", "Alpha", "X", "panel", "tail"]);
    expect(drop.defaultPrevented).toBe(true);
  });

  it("leaves a file dropped in the panel alone after a cancelled handle drag", () => {
    const ed = setup();
    endDrag(startHandleDrag(ed, 0));
    const before = ed.state.doc;
    const drop = dropAt(ed, panelStart(ed), {
      files: [new File(["x"], "photo.png", { type: "image/png" })],
      types: ["Files"],
      getData: () => "",
    });
    expect(ed.state.doc).toBe(before);
    expect(drop.defaultPrevented).toBe(false);
  });

  it.each([
    ["after the handle drag ended", true],
    ["when the handle drag never reported its end", false],
  ])(
    "moves a natively dragged block, not the last handle-dragged one, %s",
    (_, handleDragEnded) => {
      const ed = setup();
      const handle = startHandleDrag(ed, 0);
      if (handleDragEnded) endDrag(handle);
      startNativeDrag(ed, 3);
      const drop = dropAt(ed, panelStart(ed), dragData());
      endDrag(ed.view.dom);
      expect(texts(ed)).toEqual(["X", "Alpha", "Y", "panel", "tail"]);
      expect(drop.defaultPrevented).toBe(true);
    },
  );

  it("moves the node ProseMirror reports as dragged over the selected one", () => {
    const ed = setup();
    endDrag(startHandleDrag(ed, 0));
    expect(ed.state.selection.from).toBe(0);
    const dragged = NodeSelection.create(ed.state.doc, 3);
    ed.view.dragging = {
      slice: dragged.content(),
      move: true,
      node: dragged,
    } as typeof ed.view.dragging;
    const drop = dropAt(ed, panelStart(ed), dragData());
    expect(texts(ed)).toEqual(["X", "Alpha", "Y", "panel", "tail"]);
    expect(drop.defaultPrevented).toBe(true);
  });

  it.each([
    ["an atom", "card", [paragraph("first"), { type: "card" }, paragraph("last")]],
    [
      "a container",
      "box",
      [paragraph("first"), { type: "box", content: [paragraph("boxed")] }, paragraph("last")],
    ],
  ])(
    "moves %s dragged by its handle within the panel, not the whole panel",
    (_, typeName, panel) => {
      const ed = setup(panel as JSONContent[]);
      const handle = startHandleDrag(ed, childPos(ed, typeName));
      expect((ed.state.selection as NodeSelection).node.type.name).toBe(typeName);
      const panelEnd = panelStart(ed) + ed.state.doc.nodeAt(panelStart(ed) - 1)!.content.size;
      const drop = dropAt(ed, panelEnd, dragData());
      endDrag(handle);
      const moved = typeName === "box" ? "boxed" : "card";
      expect(panelChildren(ed)).toEqual(["first", "last", moved]);
      expect(drop.defaultPrevented).toBe(true);
    },
  );

  it("refuses to move a tabs block into a tab", () => {
    const ed = setup(undefined, [
      {
        type: "tabs",
        content: [
          {
            type: "tab",
            attrs: { id: "x" },
            content: [
              { type: "tabLabel", content: [{ type: "text", text: "X" }] },
              { type: "tabPanel", content: [paragraph("x body")] },
            ],
          },
        ],
      },
      paragraph("end"),
    ]);
    const secondTabsPos =
      ed.state.doc.content.size -
      ed.state.doc.lastChild!.nodeSize -
      ed.state.doc.child(ed.state.doc.childCount - 2).nodeSize;
    const before = ed.state.doc;
    const handle = startHandleDrag(ed, secondTabsPos);
    expect((ed.state.selection as NodeSelection).node.type.name).toBe("tabs");
    const drop = dropAt(ed, panelStart(ed), dragData());
    endDrag(handle);
    expect(ed.state.doc).toBe(before);
    expect(drop.defaultPrevented).toBe(true);
  });
});
