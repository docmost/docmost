import { Embed, LinkCard, LinkMention } from "@docmost/editor-ext";
import { Editor, type JSONContent } from "@tiptap/core";
import TiptapLink from "@tiptap/extension-link";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import {
  convertLinkDisplay,
  getLinkDisplayCardAvailability,
  getSelectedLinkDisplay,
} from "@/features/editor/utils/link-display";
import {
  canEmbedLink,
  convertLinkToEmbed,
  LINK_PREVIEW_NODES,
} from "./link-preview-display";

const url = "https://example.com/a";
const preview = {
  url,
  title: "Example title",
  description: "Example description",
  image: "https://example.com/image.png",
  icon: "https://example.com/icon.png",
};
const text = (value: string, marks?: JSONContent["marks"]): JSONContent => ({
  type: "text",
  text: value,
  ...(marks && { marks }),
});
const paragraph = (...content: JSONContent[]): JSONContent => ({
  type: "paragraph",
  ...(content.length && { content }),
});
const linkMark = [{ type: "link", attrs: { href: url } }];

const IntegrationAwareLink = TiptapLink.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      integrationProvider: { default: null },
    };
  },
});

let activeEditor: Editor;
afterEach(() => activeEditor?.destroy());

function createEditor(...content: JSONContent[]) {
  activeEditor = new Editor({
    extensions: [
      StarterKit.configure({ link: false }),
      IntegrationAwareLink,
      LinkCard,
      LinkMention,
      Embed,
    ],
    content: { type: "doc", content },
  });
  return activeEditor;
}

function linkSource(editor: Editor, from: number) {
  return {
    kind: "link" as const,
    from,
    to: from + url.length,
    url,
    attrs: { url },
  };
}

describe("link preview display conversions", () => {
  it("turns a link into a mention", () => {
    const editor = createEditor(
      paragraph(text("Read "), text(url, linkMark), text(" today")),
    );

    expect(
      convertLinkDisplay(
        editor,
        linkSource(editor, 6),
        "mention",
        LINK_PREVIEW_NODES,
      ),
    ).toBe(true);
    expect(editor.getJSON().content).toEqual([
      paragraph(
        text("Read "),
        { type: "linkMention", attrs: expect.objectContaining({ url }) },
        text(" today"),
      ),
    ]);
  });

  it("turns a link into a card, splitting the paragraph", () => {
    const editor = createEditor(
      paragraph(text("Read "), text(url, linkMark), text(" today")),
    );

    expect(
      convertLinkDisplay(
        editor,
        linkSource(editor, 6),
        "card",
        LINK_PREVIEW_NODES,
      ),
    ).toBe(true);
    expect(editor.getJSON().content).toEqual([
      paragraph(text("Read")),
      { type: "linkCard", attrs: expect.objectContaining({ url }) },
      paragraph(text("today")),
    ]);
  });

  it("keeps the preview when switching between card and mention", () => {
    const editor = createEditor({ type: "linkCard", attrs: preview });

    expect(
      convertLinkDisplay(
        editor,
        { kind: "node", pos: 0 },
        "mention",
        LINK_PREVIEW_NODES,
      ),
    ).toBe(true);
    const mention = editor.getJSON().content?.[0].content?.[0];
    expect(mention).toMatchObject({ type: "linkMention", attrs: preview });

    expect(
      convertLinkDisplay(
        editor,
        { kind: "node", pos: 1 },
        "card",
        LINK_PREVIEW_NODES,
      ),
    ).toBe(true);
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: "linkCard",
      attrs: preview,
    });
  });

  it("turns a card back into a link without an integration provider", () => {
    const editor = createEditor({ type: "linkCard", attrs: preview });

    expect(
      convertLinkDisplay(
        editor,
        { kind: "node", pos: 0 },
        "url",
        LINK_PREVIEW_NODES,
      ),
    ).toBe(true);
    const node: JSONContent | undefined =
      editor.getJSON().content?.[0].content?.[0];
    expect(node?.text).toBe(url);
    expect(node?.marks?.[0].attrs?.href).toBe(url);
    expect(node?.marks?.[0].attrs?.integrationProvider ?? null).toBeNull();
  });

  it("refuses a card inside a heading", () => {
    const editor = createEditor({
      type: "heading",
      attrs: { level: 2 },
      content: [text(url, linkMark)],
    });
    const before = editor.getJSON();
    const source = linkSource(editor, 1);

    expect(
      getLinkDisplayCardAvailability(editor, source, LINK_PREVIEW_NODES),
    ).toEqual({ canUseCard: false });
    expect(convertLinkDisplay(editor, source, "card", LINK_PREVIEW_NODES)).toBe(
      false,
    );
    expect(editor.getJSON()).toEqual(before);
  });

  it("recognises selected link nodes only for their own pair", () => {
    const editor = createEditor({ type: "linkCard", attrs: preview });
    editor.commands.setNodeSelection(0);

    expect(getSelectedLinkDisplay(editor, LINK_PREVIEW_NODES)).toMatchObject({
      current: "card",
      url,
    });
    expect(
      getSelectedLinkDisplay(editor, {
        card: "integrationCard",
        mention: "integrationMention",
        toLinkAttrs: () => ({}),
      }),
    ).toBeNull();
  });
});

describe("embedding a pasted link", () => {
  const youtube = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const source = (from: number, href: string) => ({
    kind: "link" as const,
    from,
    to: from + href.length,
    url: href,
    attrs: { url: href },
  });

  it("embeds a link from a known provider, splitting the paragraph", () => {
    const editor = createEditor(
      paragraph(
        text("Watch "),
        text(youtube, [{ type: "link", attrs: { href: youtube } }]),
        text(" later"),
      ),
    );

    expect(convertLinkToEmbed(editor, source(7, youtube))).toBe(true);
    expect(editor.getJSON().content).toEqual([
      paragraph(text("Watch")),
      {
        type: "embed",
        attrs: expect.objectContaining({ src: youtube, provider: "youtube" }),
      },
      paragraph(text("later")),
    ]);
  });

  it("falls back to the generic iframe embed", () => {
    const editor = createEditor(paragraph(text(url, linkMark)));

    expect(convertLinkToEmbed(editor, source(1, url))).toBe(true);
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: "embed",
      attrs: { src: url, provider: "iframe" },
    });
  });

  it("refuses an embed inside a heading", () => {
    const heading = {
      type: "heading",
      attrs: { level: 2 },
      content: [text(url, linkMark)],
    };
    const editor = createEditor(heading);

    expect(canEmbedLink(editor, source(1, url))).toBe(false);
    expect(convertLinkToEmbed(editor, source(1, url))).toBe(false);
    expect(editor.getJSON().content?.[0]).toMatchObject(heading);
  });

  it("does nothing when the link no longer matches", () => {
    const editor = createEditor(paragraph(text(url, linkMark)));

    expect(
      convertLinkToEmbed(editor, {
        ...source(1, url),
        url: "https://example.com/other",
      }),
    ).toBe(false);
    expect(editor.getJSON().content?.[0].type).toBe("paragraph");
  });
});
