import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { StepMap } from "@tiptap/pm/transform";
import { LinkExtension, UniqueID } from "@docmost/editor-ext";
import { afterEach, describe, expect, it, vi } from "vitest";

let editor: Editor | null = null;

function createEditor() {
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ link: false }),
      LinkExtension,
      UniqueID.configure({ types: ["heading", "paragraph"] }),
    ],
  });
  return editor;
}

function paste(e: Editor, html: string) {
  e.view.pasteHTML(html, new Event("paste") as ClipboardEvent);
}

function linkHrefs(e: Editor) {
  const hrefs: string[] = [];
  e.state.doc.descendants((node) => {
    node.marks.forEach((mark) => {
      if (mark.type.name === "link") hrefs.push(mark.attrs.href);
    });
  });
  return hrefs;
}

function blockIds(e: Editor) {
  const ids: (string | null)[] = [];
  e.state.doc.forEach((node) => ids.push(node.attrs.id));
  return ids;
}

afterEach(() => {
  vi.restoreAllMocks();
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

describe("link autolink", () => {
  it("links a URL once it is followed by a space", () => {
    const e = createEditor();

    e.commands.insertContent("see https://example.com ");

    expect(linkHrefs(e)).toEqual(["https://example.com"]);
  });

  it("links a URL that ends the first pasted block", () => {
    const e = createEditor();

    paste(e, "<p>see https://example.com</p><p>second block</p>");

    expect(linkHrefs(e)).toEqual(["https://example.com"]);
    expect(e.state.doc.childCount).toBe(2);
  });

  it("gives every pasted block its own id", () => {
    const e = createEditor();

    paste(e, "<p>one</p><p>two</p><p>three</p>");

    const ids = blockIds(e);
    expect(ids).toHaveLength(3);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(
      true,
    );
    expect(new Set(ids).size).toBe(3);
  });

  it("does not map ranges through every id step of a large paste", () => {
    const e = createEditor();
    const blocks = 300;
    const html = Array.from(
      { length: blocks },
      (_, i) => `<p>paragraph ${i}</p>`,
    ).join("");
    const map = vi.spyOn(StepMap.prototype, "map");

    paste(e, html);

    expect(e.state.doc.childCount).toBe(blocks);
    // one id step per block: mapping each range through all of them is ~blocks² calls
    expect(map.mock.calls.length).toBeLessThan(blocks * 40);
  });
});
