import { Editor } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recalculateLinks } from "./table-of-contents.utils";

let editor: Editor | null = null;

function createEditor(content: string) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({ element, extensions: [StarterKit], content });
  return editor;
}

afterEach(() => {
  vi.restoreAllMocks();
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

describe("recalculateLinks", () => {
  it("lists every heading that has text, in document order", () => {
    const e = createEditor(
      "<h1>One</h1><p>text</p><blockquote><h2>Two</h2></blockquote><h3></h3><h3>Three</h3>",
    );

    const { links, nodes } = recalculateLinks(e);

    expect(links.map((link) => [link.label, link.level])).toEqual([
      ["One", 1],
      ["Two", 2],
      ["Three", 3],
    ]);
    expect(links.map((link) => link.element.tagName)).toEqual([
      "H1",
      "H2",
      "H3",
    ]);
    expect(links.map((link) => link.element.textContent)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
    expect(nodes).toEqual(links.map((link) => link.element));
  });

  it("gives each heading a position inside its own text", () => {
    const e = createEditor("<p>intro</p><h2>Alpha</h2><p>body</p><h2>Beta</h2>");

    const { links } = recalculateLinks(e);

    expect(
      links.map((link) => e.state.doc.resolve(link.position).parent.textContent),
    ).toEqual(["Alpha", "Beta"]);
  });

  it("does not resolve a position for every block of the document", () => {
    const paragraphs = Array.from(
      { length: 300 },
      (_, i) => `<p>paragraph ${i}</p>`,
    ).join("");
    const e = createEditor(`<h1>Top</h1>${paragraphs}<h2>Bottom</h2>`);
    const resolve = vi.spyOn(ProseMirrorNode.prototype, "resolve");

    const { links } = recalculateLinks(e);

    expect(links.map((link) => link.label)).toEqual(["Top", "Bottom"]);
    expect(resolve.mock.calls.length).toBeLessThan(10);
  });
});
