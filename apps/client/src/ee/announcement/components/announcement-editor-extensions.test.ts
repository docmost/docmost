import { Editor, type JSONContent } from "@tiptap/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAnnouncementEditorExtensions } from "./announcement-editor-extensions";

// jsdom has no ClipboardEvent, which pasteHTML and pasteText create when given no event
beforeAll(() => vi.stubGlobal("ClipboardEvent", class extends Event {}));
afterAll(() => vi.unstubAllGlobals());

describe("createAnnouncementEditorExtensions", () => {
  it("flattens pasted blocks into one paragraph", () => {
    const editor = new Editor({ extensions: createAnnouncementEditorExtensions("Message") });
    editor.view.pasteHTML("<p>One <strong>two</strong></p><h1>Three</h1><ul><li>Four</li></ul>");
    const json: JSONContent = editor.getJSON();
    expect(json.content).toHaveLength(1);
    expect(json.content?.[0].type).toBe("paragraph");
    expect(editor.getText()).toBe("One two Three Four");
    expect(json.content?.[0].content?.find((n) => n.text === "two")?.marks).toEqual([{ type: "bold" }]);
    editor.destroy();
  });

  it("does not create a second paragraph on Enter", () => {
    const editor = new Editor({ extensions: createAnnouncementEditorExtensions("Message"), content: "<p>Hello</p>" });
    editor.commands.focus("end");
    editor.commands.enter();
    expect(editor.getJSON().content).toHaveLength(1);
    editor.destroy();
  });

  it("joins pasted plain-text lines with a single space", () => {
    const editor = new Editor({ extensions: createAnnouncementEditorExtensions("Message") });
    editor.view.pasteText("Planned maintenance\n\nTonight at 22:00");
    expect(editor.getJSON().content).toHaveLength(1);
    expect(editor.getText()).toBe("Planned maintenance Tonight at 22:00");
    editor.destroy();
  });

  it("keeps safe links and drops unsafe ones from pasted HTML", () => {
    const editor = new Editor({ extensions: createAnnouncementEditorExtensions("Message") });
    editor.view.pasteHTML(
      '<p><a href="/s/general/p/policy">Policy</a> <a href="javascript:alert(1)">Click</a></p>',
    );
    const nodes: JSONContent[] = editor.getJSON().content?.[0].content ?? [];
    const policy = nodes.find((n) => n.text === "Policy");
    expect(policy?.marks?.[0]).toMatchObject({ type: "link", attrs: { href: "/s/general/p/policy" } });
    expect(nodes.find((n) => n.text?.includes("Click"))?.marks).toBeUndefined();
    editor.destroy();
  });
});
