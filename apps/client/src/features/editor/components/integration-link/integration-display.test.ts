import { IntegrationCard, IntegrationMention } from "@docmost/editor-ext";
import { Editor, type JSONContent } from "@tiptap/core";
import TiptapLink from "@tiptap/extension-link";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import {
  convertIntegrationDisplay,
  getIntegrationCardAvailability,
  getSelectedIntegrationDisplay,
} from "./integration-display";

const url = "https://github.com/docmost/docmost/pull/2475";
const text = (value: string, marks?: JSONContent["marks"]): JSONContent => ({
  type: "text",
  text: value,
  ...(marks && { marks }),
});
const paragraph = (...content: JSONContent[]): JSONContent => ({
  type: "paragraph",
  ...(content.length && { content }),
});
const card = (): JSONContent => ({
  type: "integrationCard",
  attrs: { url, provider: "github" },
});
const mention = (): JSONContent => ({
  type: "integrationMention",
  attrs: { url, provider: "github" },
});

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
      IntegrationCard,
      IntegrationMention,
    ],
    content: { type: "doc", content },
  });
  return activeEditor;
}

describe("convertIntegrationDisplay", () => {
  it("turns a card into an inline mention without losing its source", () => {
    const editor = createEditor(card());

    expect(
      convertIntegrationDisplay(editor, { kind: "node", pos: 0 }, "mention"),
    ).toBe(true);
    expect(editor.getJSON()).toEqual({
      type: "doc",
      content: [paragraph(mention(), text(" "))],
    });
  });

  it("turns a card into a normal linked URL", () => {
    const editor = createEditor(card());

    expect(
      convertIntegrationDisplay(editor, { kind: "node", pos: 0 }, "url"),
    ).toBe(true);
    expect(editor.getJSON().content?.[0]).toMatchObject(
      paragraph(
        text(url, [
          {
            type: "link",
            attrs: { href: url, integrationProvider: "github" },
          },
        ]),
      ),
    );
  });

  it("keeps the paragraphs around a card apart when it becomes a mention", () => {
    const editor = createEditor(
      paragraph(text("Intro")),
      card(),
      paragraph(text("Outro")),
    );

    expect(
      convertIntegrationDisplay(editor, { kind: "node", pos: 7 }, "mention"),
    ).toBe(true);
    expect(editor.getJSON().content).toEqual([
      paragraph(text("Intro")),
      paragraph(mention(), text(" ")),
      paragraph(text("Outro")),
    ]);
  });

  it("turns a standalone mention back into a card and ignores surrounding whitespace", () => {
    const editor = createEditor(paragraph(text(" "), mention(), text("  ")));

    expect(
      convertIntegrationDisplay(editor, { kind: "node", pos: 2 }, "card"),
    ).toBe(true);
    expect(editor.getJSON().content?.[0]).toEqual(card());
  });

  it("splits inline prose around a mention converted to a card", () => {
    const editor = createEditor(
      paragraph(text("Review "), mention(), text(" before release.")),
    );

    expect(
      convertIntegrationDisplay(editor, { kind: "node", pos: 8 }, "card"),
    ).toBe(true);
    expect(editor.getJSON()).toEqual({
      type: "doc",
      content: [
        paragraph(text("Review")),
        card(),
        paragraph(text("before release.")),
      ],
    });
  });

  it("turns a mention inside prose into a URL without disturbing the sentence", () => {
    const editor = createEditor(
      paragraph(text("Review "), mention(), text(" before release.")),
    );

    expect(
      convertIntegrationDisplay(editor, { kind: "node", pos: 8 }, "url"),
    ).toBe(true);
    expect(editor.getText()).toBe(`Review ${url} before release.`);
    expect(editor.getJSON().content?.[0]?.content?.[1]).toMatchObject(
      text(url, [
        {
          type: "link",
          attrs: { href: url, integrationProvider: "github" },
        },
      ]),
    );
  });

  it("turns an existing linked URL into a mention in place", () => {
    const from = 8;
    const editor = createEditor(
      paragraph(
        text("Review "),
        text(url, [{ type: "link", attrs: { href: url } }]),
        text(" before release."),
      ),
    );

    expect(
      convertIntegrationDisplay(
        editor,
        { kind: "link", from, to: from + url.length, url, provider: "github" },
        "mention",
      ),
    ).toBe(true);
    expect(editor.getJSON().content?.[0]?.content?.[1]).toEqual(mention());
    expect(editor.getText()).toBe(`Review ${url} before release.`);
  });

  it("converts an entire link when inline formatting splits it into text nodes", () => {
    const splitAt = 19;
    const editor = createEditor(
      paragraph(
        text(url.slice(0, splitAt), [{ type: "link", attrs: { href: url } }]),
        text(url.slice(splitAt), [
          { type: "link", attrs: { href: url } },
          { type: "bold" },
        ]),
      ),
    );

    expect(
      convertIntegrationDisplay(
        editor,
        {
          kind: "link",
          from: 1,
          to: 1 + url.length,
          url,
          provider: "github",
        },
        "mention",
      ),
    ).toBe(true);
    expect(editor.getJSON().content?.[0]?.content).toEqual([mention()]);
  });

  it("turns a standalone linked URL into a card", () => {
    const editor = createEditor(
      paragraph(text(url, [{ type: "link", attrs: { href: url } }]), text(" ")),
    );

    expect(
      convertIntegrationDisplay(
        editor,
        { kind: "link", from: 1, to: 1 + url.length, url, provider: "github" },
        "card",
      ),
    ).toBe(true);
    expect(editor.getJSON().content?.[0]).toEqual(card());
  });

  it("splits a paragraph around a linked URL converted to a card", () => {
    const before = "Review ";
    const after = " before release.";
    const editor = createEditor(
      paragraph(
        text(before),
        text(url, [{ type: "link", attrs: { href: url } }]),
        text(after),
      ),
    );
    const from = 1 + before.length;

    expect(
      convertIntegrationDisplay(
        editor,
        { kind: "link", from, to: from + url.length, url, provider: "github" },
        "card",
      ),
    ).toBe(true);
    expect(editor.getJSON()).toEqual({
      type: "doc",
      content: [
        paragraph(text("Review")),
        card(),
        paragraph(text("before release.")),
      ],
    });
  });

  it("reports whether an inline source can safely become a card", () => {
    const editor = createEditor(
      paragraph(text("Review "), mention()),
      paragraph(mention()),
    );

    expect(
      getIntegrationCardAvailability(editor, { kind: "node", pos: 8 }),
    ).toEqual({ canUseCard: true });
    expect(
      getIntegrationCardAvailability(editor, { kind: "node", pos: 11 }),
    ).toEqual({ canUseCard: true });
  });

  it("distinguishes unsupported containers from inline prose", () => {
    const editor = createEditor({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [paragraph(mention())],
        },
      ],
    });

    expect(
      getIntegrationCardAvailability(editor, { kind: "node", pos: 3 }),
    ).toEqual({ canUseCard: false });
  });

  it("resolves the selected rich integration to its current display", () => {
    const editor = createEditor(card(), paragraph(mention()));

    editor.commands.setNodeSelection(0);
    expect(getSelectedIntegrationDisplay(editor)).toEqual({
      current: "card",
      source: { kind: "node", pos: 0 },
      url,
    });

    editor.commands.setNodeSelection(2);
    expect(getSelectedIntegrationDisplay(editor)).toEqual({
      current: "mention",
      source: { kind: "node", pos: 2 },
      url,
    });
  });
});
