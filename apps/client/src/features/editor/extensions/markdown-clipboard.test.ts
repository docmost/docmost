import { Callout } from "@docmost/editor-ext";
import { Editor, type JSONContent } from "@tiptap/core";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { MarkdownClipboard } from "./markdown-clipboard";

let editor: Editor;

function createEditor(content: JSONContent[], cursor: number) {
  editor = new Editor({
    extensions: [
      StarterKit,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      Callout.extend({ addNodeView: null }),
      MarkdownClipboard.configure({ transformPastedText: true }),
    ],
    content: { type: "doc", content },
  });
  editor.commands.setTextSelection(cursor);
}

// Copies from text fields and terminals carry text/plain only.
function pastePlainText(text: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { getData: (type: string) => (type === "text/plain" ? text : "") },
  });
  editor.view.dom.dispatchEvent(event);
}

function textBeforeCursor() {
  const { $from } = editor.state.selection;
  return $from.parent.textBetween(0, $from.parentOffset);
}

function topLevelNodes() {
  const nodes: [string, string][] = [];
  editor.state.doc.forEach((node) =>
    nodes.push([node.type.name, node.textContent]),
  );
  return nodes;
}

afterEach(() => editor?.destroy());

describe("pasting plain text", () => {
  it("puts the cursor after the pasted text", () => {
    createEditor([{ type: "paragraph" }], 1);

    pastePlainText("22818482");

    expect(editor.getText()).toBe("22818482");
    expect(textBeforeCursor()).toBe("22818482");
  });

  it("puts the cursor after text pasted mid-paragraph", () => {
    createEditor(
      [{ type: "paragraph", content: [{ type: "text", text: "ab cd" }] }],
      4,
    );

    pastePlainText("123");

    expect(editor.getText()).toBe("ab 123cd");
    expect(textBeforeCursor()).toBe("ab 123");
  });

  it("puts the cursor at the end of the last pasted paragraph", () => {
    createEditor([{ type: "paragraph" }], 1);

    pastePlainText("first\n\nsecond");

    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.selection.$from.parent.textContent).toBe("second");
    expect(textBeforeCursor()).toBe("second");
  });

  it("puts the cursor at the end of a pasted list", () => {
    createEditor([{ type: "paragraph" }], 1);

    pastePlainText("- one\n- two");

    expect(editor.state.doc.firstChild?.type.name).toBe("bulletList");
    expect(textBeforeCursor()).toBe("two");
  });

  it("keeps the text after the cursor out of a pasted table", () => {
    createEditor(
      [{ type: "paragraph", content: [{ type: "text", text: "ab cd" }] }],
      4,
    );

    pastePlainText("| a | b |\n|---|---|\n| 1 | 2 |");

    expect(topLevelNodes()).toEqual([
      ["paragraph", "ab "],
      ["table", "ab12"],
      ["paragraph", "cd"],
    ]);
  });

  it("keeps the text after the cursor out of a pasted callout", () => {
    createEditor(
      [{ type: "paragraph", content: [{ type: "text", text: "ab cd" }] }],
      4,
    );

    pastePlainText(":::info\nnote\n:::");

    expect(topLevelNodes()).toEqual([
      ["paragraph", "ab "],
      ["callout", "note"],
      ["paragraph", "cd"],
    ]);
  });

  it("fills an empty list item at the end of a pasted callout", () => {
    createEditor(
      [{ type: "paragraph", content: [{ type: "text", text: "ab cd" }] }],
      4,
    );

    pastePlainText(":::info\n- a\n-\n:::");

    expect(() => editor.state.doc.check()).not.toThrow();
    expect(topLevelNodes()).toEqual([
      ["paragraph", "ab "],
      ["callout", "a"],
      ["paragraph", "cd"],
    ]);
  });
});
