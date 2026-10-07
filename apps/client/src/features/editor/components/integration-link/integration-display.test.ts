import { Editor, Node } from "@tiptap/core";
import TiptapLink from "@tiptap/extension-link";
import { StarterKit } from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import {
  convertIntegrationDisplay,
  getIntegrationCardAvailability,
  getSelectedIntegrationDisplay,
} from "./integration-display";

const IntegrationCard = Node.create({
  name: "integrationCard",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      url: { default: "" },
      provider: { default: "" },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", HTMLAttributes];
  },
});

const IntegrationMention = Node.create({
  name: "integrationMention",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      url: { default: "" },
      provider: { default: "" },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes];
  },
});

const IntegrationAwareLink = TiptapLink.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      integrationProvider: { default: null },
    };
  },
});

function createEditor(content: Record<string, unknown>) {
  return new Editor({
    extensions: [
      StarterKit.configure({ link: false }),
      IntegrationAwareLink,
      IntegrationCard,
      IntegrationMention,
    ],
    content,
  });
}

describe("convertIntegrationDisplay", () => {
  it("turns a card into an inline mention without losing its source", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "integrationCard",
          attrs: {
            url: "https://github.com/docmost/docmost/pull/2475",
            provider: "github",
          },
        },
      ],
    });

    expect(
      convertIntegrationDisplay(editor, { kind: "node", pos: 0 }, "mention"),
    ).toBe(true);
    expect(editor.getJSON()).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "integrationMention",
              attrs: {
                url: "https://github.com/docmost/docmost/pull/2475",
                provider: "github",
              },
            },
            { type: "text", text: " " },
          ],
        },
      ],
    });

    editor.destroy();
  });

  it("turns a card into a normal linked URL", () => {
    const url = "https://github.com/docmost/docmost/pull/2475";
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "integrationCard",
          attrs: { url, provider: "github" },
        },
      ],
    });

    expect(
      convertIntegrationDisplay(editor, { kind: "node", pos: 0 }, "url"),
    ).toBe(true);
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: url,
          marks: [
            {
              type: "link",
              attrs: { href: url, integrationProvider: "github" },
            },
          ],
        },
      ],
    });

    editor.destroy();
  });

  it("keeps the paragraphs around a card apart when it becomes a mention", () => {
    const url = "https://github.com/docmost/docmost/pull/2475";
    const editor = createEditor({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Intro" }] },
        {
          type: "integrationCard",
          attrs: { url, provider: "github" },
        },
        { type: "paragraph", content: [{ type: "text", text: "Outro" }] },
      ],
    });

    expect(
      convertIntegrationDisplay(editor, { kind: "node", pos: 7 }, "mention"),
    ).toBe(true);
    expect(editor.getJSON().content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Intro" }] },
      {
        type: "paragraph",
        content: [
          {
            type: "integrationMention",
            attrs: { url, provider: "github" },
          },
          { type: "text", text: " " },
        ],
      },
      { type: "paragraph", content: [{ type: "text", text: "Outro" }] },
    ]);

    editor.destroy();
  });

  it("turns a standalone mention back into a card and ignores surrounding whitespace", () => {
    const url = "https://github.com/docmost/docmost/pull/2475";
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: " " },
            {
              type: "integrationMention",
              attrs: { url, provider: "github" },
            },
            { type: "text", text: "  " },
          ],
        },
      ],
    });

    expect(
      convertIntegrationDisplay(editor, { kind: "node", pos: 2 }, "card"),
    ).toBe(true);
    expect(editor.getJSON().content?.[0]).toEqual({
      type: "integrationCard",
      attrs: { url, provider: "github" },
    });

    editor.destroy();
  });

  it("splits inline prose around a mention converted to a card", () => {
    const url = "https://github.com/docmost/docmost/pull/2475";
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Review " },
            {
              type: "integrationMention",
              attrs: { url, provider: "github" },
            },
            { type: "text", text: " before release." },
          ],
        },
      ],
    });

    expect(
      convertIntegrationDisplay(editor, { kind: "node", pos: 8 }, "card"),
    ).toBe(true);
    expect(editor.getJSON()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Review" }] },
        {
          type: "integrationCard",
          attrs: { url, provider: "github" },
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "before release." }],
        },
      ],
    });

    editor.destroy();
  });

  it("turns a mention inside prose into a URL without disturbing the sentence", () => {
    const url = "https://github.com/docmost/docmost/pull/2475";
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Review " },
            {
              type: "integrationMention",
              attrs: { url, provider: "github" },
            },
            { type: "text", text: " before release." },
          ],
        },
      ],
    });

    expect(
      convertIntegrationDisplay(editor, { kind: "node", pos: 8 }, "url"),
    ).toBe(true);
    expect(editor.getText()).toBe(`Review ${url} before release.`);
    expect(editor.getJSON().content?.[0]?.content?.[1]).toMatchObject({
      type: "text",
      text: url,
      marks: [
        {
          type: "link",
          attrs: { href: url, integrationProvider: "github" },
        },
      ],
    });

    editor.destroy();
  });

  it("turns an existing linked URL into a mention in place", () => {
    const url = "https://github.com/docmost/docmost/pull/2475";
    const from = 8;
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Review " },
            {
              type: "text",
              text: url,
              marks: [{ type: "link", attrs: { href: url } }],
            },
            { type: "text", text: " before release." },
          ],
        },
      ],
    });

    expect(
      convertIntegrationDisplay(
        editor,
        { kind: "link", from, to: from + url.length, url, provider: "github" },
        "mention",
      ),
    ).toBe(true);
    expect(editor.getJSON().content?.[0]?.content?.[1]).toEqual({
      type: "integrationMention",
      attrs: { url, provider: "github" },
    });
    expect(editor.getText()).toBe("Review  before release.");

    editor.destroy();
  });

  it("converts an entire link when inline formatting splits it into text nodes", () => {
    const url = "https://github.com/docmost/docmost/pull/2475";
    const splitAt = 19;
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: url.slice(0, splitAt),
              marks: [{ type: "link", attrs: { href: url } }],
            },
            {
              type: "text",
              text: url.slice(splitAt),
              marks: [{ type: "link", attrs: { href: url } }, { type: "bold" }],
            },
          ],
        },
      ],
    });

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
    expect(editor.getJSON().content?.[0]?.content).toEqual([
      {
        type: "integrationMention",
        attrs: { url, provider: "github" },
      },
    ]);

    editor.destroy();
  });

  it("turns a standalone linked URL into a card", () => {
    const url = "https://github.com/docmost/docmost/pull/2475";
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: url,
              marks: [{ type: "link", attrs: { href: url } }],
            },
            { type: "text", text: " " },
          ],
        },
      ],
    });

    expect(
      convertIntegrationDisplay(
        editor,
        { kind: "link", from: 1, to: 1 + url.length, url, provider: "github" },
        "card",
      ),
    ).toBe(true);
    expect(editor.getJSON().content?.[0]).toEqual({
      type: "integrationCard",
      attrs: { url, provider: "github" },
    });

    editor.destroy();
  });

  it("splits a paragraph around a linked URL converted to a card", () => {
    const url = "https://github.com/docmost/docmost/pull/2475";
    const before = "dddddmdm dmdmdd ";
    const after = " dddjdjdjdjjdj";
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: before },
            {
              type: "text",
              text: url,
              marks: [{ type: "link", attrs: { href: url } }],
            },
            { type: "text", text: after },
          ],
        },
      ],
    });
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
        {
          type: "paragraph",
          content: [{ type: "text", text: "dddddmdm dmdmdd" }],
        },
        {
          type: "integrationCard",
          attrs: { url, provider: "github" },
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "dddjdjdjdjjdj" }],
        },
      ],
    });

    editor.destroy();
  });

  it("reports whether an inline source can safely become a card", () => {
    const url = "https://github.com/docmost/docmost/pull/2475";
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Review " },
            {
              type: "integrationMention",
              attrs: { url, provider: "github" },
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "integrationMention",
              attrs: { url, provider: "github" },
            },
          ],
        },
      ],
    });

    expect(
      getIntegrationCardAvailability(editor, { kind: "node", pos: 8 }),
    ).toEqual({ canUseCard: true });
    expect(
      getIntegrationCardAvailability(editor, { kind: "node", pos: 11 }),
    ).toEqual({ canUseCard: true });

    editor.destroy();
  });

  it("distinguishes unsupported containers from inline prose", () => {
    const url = "https://github.com/docmost/docmost/pull/2475";
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "integrationMention",
                      attrs: { url, provider: "github" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(
      getIntegrationCardAvailability(editor, { kind: "node", pos: 3 }),
    ).toEqual({ canUseCard: false });

    editor.destroy();
  });

  it("resolves the selected rich integration to its current display", () => {
    const url = "https://github.com/docmost/docmost/pull/2475";
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "integrationCard",
          attrs: { url, provider: "github" },
        },
        {
          type: "paragraph",
          content: [
            {
              type: "integrationMention",
              attrs: { url, provider: "github" },
            },
          ],
        },
      ],
    });

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

    editor.destroy();
  });
});
