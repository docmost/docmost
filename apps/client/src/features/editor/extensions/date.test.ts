import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { DateNode } from "@docmost/editor-ext";
import { afterEach, describe, expect, it, vi } from "vitest";

let editor: Editor;

function createEditor(content: string) {
  editor = new Editor({ extensions: [StarterKit, DateNode], content });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  vi.useRealTimers();
});

describe("inline date", () => {
  it("replaces the slash query with one undoable atom for the local calendar day", () => {
    vi.setSystemTime(new Date(2026, 10, 23, 0, 15));
    const ed = createEditor("<p>Due /date.</p>");
    ed.commands.setTextSelection(10);
    ed.chain().deleteRange({ from: 5, to: 10 }).insertDate().run();

    const inserted = ed.state.doc.nodeAt(5);
    expect(inserted?.type.name).toBe("date");
    expect(inserted?.attrs.date).toBe("2026-11-23");
    expect(inserted?.nodeSize).toBe(1);
    expect(ed.state.selection.from).toBe(6);
    expect(ed.getText()).toBe("Due Nov 23, 2026.");

    ed.commands.undo();
    expect(ed.getText()).toBe("Due /date.");
  });

  it("inserts readable text when the toolbar is used in a code block", () => {
    vi.setSystemTime(new Date(2026, 10, 23, 23, 45));
    const ed = createEditor("<pre><code></code></pre>");
    ed.commands.insertDate();
    expect(ed.state.doc.firstChild?.type.name).toBe("codeBlock");
    expect(ed.state.doc.firstChild?.firstChild?.text).toBe("Nov 23, 2026");
  });
});
