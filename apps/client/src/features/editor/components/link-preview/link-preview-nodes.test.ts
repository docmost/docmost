import { LinkCard, LinkMention } from "@docmost/editor-ext";
import { Editor, type JSONContent } from "@tiptap/core";
import TiptapLink from "@tiptap/extension-link";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";

const url = "https://example.com/a";
let activeEditor: Editor;
afterEach(() => activeEditor?.destroy());

function createEditor(content: string | JSONContent) {
  activeEditor = new Editor({
    extensions: [
      StarterKit.configure({ link: false }),
      TiptapLink,
      LinkCard,
      LinkMention,
    ],
    content,
  });
  return activeEditor;
}

const firstNode = (editor: Editor) => editor.getJSON().content![0];

describe("linkCard", () => {
  it("parses a card's preview from its data attributes", () => {
    const editor = createEditor(
      `<div data-type="linkCard" data-url="${url}" data-title="Example &amp; Co" data-description="Desc" data-image="https://example.com/og.png" data-icon="https://example.com/favicon.ico"></div>`,
    );

    expect(firstNode(editor)).toEqual({
      type: "linkCard",
      attrs: {
        url,
        title: "Example & Co",
        description: "Desc",
        image: "https://example.com/og.png",
        icon: "https://example.com/favicon.ico",
      },
    });
  });

  it("drops unsafe url, image and icon values", () => {
    const editor = createEditor(
      `<div data-type="linkCard" data-url="javascript:alert(1)" data-image="javascript:alert(1)" data-icon="data:image/png;base64,AAA"></div>`,
    );

    expect(firstNode(editor).attrs).toMatchObject({
      url: "",
      image: null,
      icon: null,
    });
  });

  it("renders the title as the link text", () => {
    const editor = createEditor({
      type: "doc",
      content: [{ type: "linkCard", attrs: { url, title: "Example" } }],
    });

    const html = editor.getHTML();
    expect(html).toContain('data-type="linkCard"');
    expect(html).toContain('data-title="Example"');
    expect(html).toContain(
      `<a href="${url}" target="_blank" rel="noopener noreferrer">Example</a>`,
    );
  });

  it("uses the URL as link text without a title", () => {
    const editor = createEditor({
      type: "doc",
      content: [{ type: "linkCard", attrs: { url } }],
    });

    expect(editor.getHTML()).toContain(
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
    );
  });

  it("gives the URL as plain text", () => {
    const editor = createEditor({
      type: "doc",
      content: [{ type: "linkCard", attrs: { url, title: "Example" } }],
    });

    expect(editor.getText()).toBe(url);
  });

  it("setLinkCard sanitizes the url", () => {
    const editor = createEditor("<p></p>");

    editor.commands.setLinkCard({ url: "javascript:alert(1)" });

    const card = editor
      .getJSON()
      .content!.find((node) => node.type === "linkCard");
    expect(card?.attrs?.url).toBe("");
  });
});

describe("linkMention", () => {
  it("parses a mention from span[data-type=linkMention] with the same attrs", () => {
    const editor = createEditor(
      `<p><span data-type="linkMention" data-url="${url}" data-title="Example" data-description="Desc" data-image="https://example.com/og.png" data-icon="https://example.com/favicon.ico"></span></p>`,
    );

    expect(firstNode(editor).content![0]).toEqual({
      type: "linkMention",
      attrs: {
        url,
        title: "Example",
        description: "Desc",
        image: "https://example.com/og.png",
        icon: "https://example.com/favicon.ico",
      },
    });
    expect(editor.getHTML()).toMatch(/<span[^>]*data-type="linkMention"/);
  });
});
