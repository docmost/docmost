import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Fragment, Node, Slice } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { DecorationSet } from "@tiptap/pm/view";
import { Heading } from "@docmost/editor-ext";
import { afterEach, describe, expect, it, vi } from "vitest";

let editor: Editor | null = null;

function createEditor(content: object[]) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({
    element,
    extensions: [StarterKit.configure({ heading: false }), Heading],
    content: { type: "doc", content },
  });
  return editor;
}

const heading = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const paragraph = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const linkButtons = (e: Editor) => [...e.view.dom.querySelectorAll(".link-btn")];

// the text in front of each link button: the whole heading when the button is in place
const linkedHeadings = (e: Editor) =>
  linkButtons(e).map((button) =>
    button.parentElement?.tagName === "H2"
      ? button.previousSibling?.textContent
      : null,
  );

function headingLinkPlugin(e: Editor) {
  return e.state.plugins.find((plugin) =>
    (plugin as any).key.startsWith("headingLink$"),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

describe("heading link button", () => {
  it("renders one button inside each heading longer than one character", () => {
    const e = createEditor([heading("Intro"), paragraph("text"), heading("A")]);

    const buttons = linkButtons(e);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].parentElement?.tagName).toBe("H2");
  });

  it("keeps the same button elements when only the selection changes", () => {
    const e = createEditor([heading("Intro"), paragraph("text"), heading("Usage")]);
    const before = linkButtons(e);

    e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, 10)));

    expect(linkButtons(e)).toEqual(before);
  });

  it("adds a button when a heading is inserted", () => {
    const e = createEditor([heading("Intro"), paragraph("text")]);

    e.commands.insertContentAt(e.state.doc.content.size, heading("Usage"));

    expect(linkButtons(e)).toHaveLength(2);
  });

  it("keeps each button in its heading when text is typed above", () => {
    const e = createEditor([paragraph("text"), heading("Intro"), heading("Usage")]);
    const before = linkButtons(e);

    e.commands.insertContentAt(1, "more ");

    expect(linkedHeadings(e)).toEqual(["Intro", "Usage"]);
    expect(linkButtons(e)).toEqual(before);
  });

  it("keeps the button at the end of a heading that is typed in", () => {
    const e = createEditor([heading("Intro"), paragraph("text")]);

    e.commands.insertContentAt(6, " to it");

    expect(e.state.doc.child(0).textContent).toBe("Intro to it");
    expect(linkedHeadings(e)).toEqual(["Intro to it"]);
  });

  it("removes the button of a deleted heading", () => {
    const e = createEditor([heading("Intro"), paragraph("text"), heading("Usage")]);

    e.commands.deleteRange({ from: 0, to: e.state.doc.child(0).nodeSize });

    expect(linkedHeadings(e)).toEqual(["Usage"]);
    expect(linkButtons(e)).toHaveLength(1);
  });

  it("gives a heading inside a quote its button", () => {
    const e = createEditor([
      paragraph("text"),
      { type: "blockquote", content: [heading("Quoted")] },
    ]);

    expect(linkedHeadings(e)).toEqual(["Quoted"]);
  });

  it("keeps the buttons when the whole document is replaced with the same blocks", () => {
    const e = createEditor([heading("Intro"), paragraph("text"), heading("Usage")]);
    const { doc } = e.state;
    const blocks: Node[] = [];
    doc.forEach((block) => blocks.push(block));

    // a remote change arrives as one step over the whole document
    e.view.dispatch(
      e.state.tr.replace(
        0,
        doc.content.size,
        new Slice(Fragment.from(blocks), 0, 0),
      ),
    );

    expect(linkedHeadings(e)).toEqual(["Intro", "Usage"]);
  });

  it("moves the buttons instead of building them again when text is typed elsewhere", () => {
    const e = createEditor([
      paragraph("text"),
      ...Array.from({ length: 50 }, (_, i) => heading(`Heading ${i}`)),
    ]);
    const plugin = headingLinkPlugin(e);
    const tr = e.state.tr.insertText("more ", 1);
    const create = vi.spyOn(DecorationSet, "create");
    const descendants = vi.spyOn(Node.prototype, "descendants");

    const next = plugin.spec.state.apply(
      tr,
      plugin.getState(e.state),
      e.state,
      e.state,
    );

    expect(create).not.toHaveBeenCalled();
    // only the paragraph that changed is looked at
    expect(descendants.mock.contexts).toEqual([tr.doc.child(0)]);
    expect(next.find().map((decoration) => decoration.from)).toEqual(
      plugin
        .getState(e.state)
        .find()
        .map((decoration) => decoration.from + 5),
    );
  });
});
