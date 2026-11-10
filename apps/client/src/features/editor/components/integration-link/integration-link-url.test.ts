import { IntegrationCard, IntegrationMention } from "@docmost/editor-ext";
import { Editor, generateText } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";

const PR_URL = "https://github.com/o/r/pull/1";
const SCRIPT_URLS = [" JaVaScRiPt:alert(1)", "java\tscript:alert(1)"];
const ENCODED_URL = "https://github.com/o/r/issues?q=label%3A%22a%2520b%22";

let editor: Editor;

function createEditor(content: string | Record<string, unknown> = "") {
  editor = new Editor({
    extensions: [StarterKit, IntegrationCard, IntegrationMention],
    content,
  });
  return editor;
}

function findAttrs(typeName: string) {
  const found: Record<string, unknown>[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === typeName) found.push(node.attrs);
  });
  return found[0];
}

afterEach(() => editor?.destroy());

describe.each([
  { typeName: "integrationCard", tag: "div", command: "setIntegrationCard" },
  {
    typeName: "integrationMention",
    tag: "span",
    command: "setIntegrationMention",
  },
] as const)("$typeName url attr", ({ typeName, tag, command }) => {
  it.each(SCRIPT_URLS)("stores an empty url when inserting %j", (url) => {
    createEditor();
    editor.commands[command]({ url, provider: "github" });

    expect(findAttrs(typeName)).toMatchObject({ url: "" });
  });

  it("preserves percent encoding when inserting", () => {
    createEditor();
    editor.commands[command]({ url: ENCODED_URL, provider: "github" });

    expect(findAttrs(typeName)).toMatchObject({ url: ENCODED_URL });
  });

  it("trims whitespace around an inserted url", () => {
    createEditor();
    editor.commands[command]({ url: `  ${PR_URL}\n`, provider: "github" });

    expect(findAttrs(typeName)).toMatchObject({ url: PR_URL });
  });

  it("preserves percent encoding through HTML", () => {
    createEditor(
      `<p>x</p><${tag} data-type="${typeName}" data-url="${ENCODED_URL}"></${tag}>`,
    );

    expect(findAttrs(typeName)).toMatchObject({ url: ENCODED_URL });
    expect(editor.getHTML()).toContain(`href="${ENCODED_URL}"`);
  });

  it("drops a non-http data-url when parsing HTML", () => {
    createEditor(
      `<p>x</p><${tag} data-type="${typeName}" data-url="file:///x" data-provider="github"></${tag}>`,
    );

    expect(findAttrs(typeName)).toMatchObject({ url: "", provider: "github" });
  });

  it("renders no unsafe href for JSON content that bypassed parsing", () => {
    const node = { type: typeName, attrs: { url: "file:///etc/passwd" } };
    createEditor({
      type: "doc",
      content: [
        typeName === "integrationCard"
          ? node
          : { type: "paragraph", content: [node] },
      ],
    });

    const html = editor.getHTML();
    expect(html).not.toContain("file:");
    expect(html).toContain('href=""');
  });
});

describe("integration node plain text", () => {
  it("renders each node as its url", () => {
    const issueUrl = "https://github.com/o/r/issues/2";
    const text = generateText(
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "See " },
              {
                type: "integrationMention",
                attrs: { url: PR_URL, provider: "github" },
              },
              { type: "text", text: " today" },
            ],
          },
          {
            type: "integrationCard",
            attrs: { url: issueUrl, provider: "github" },
          },
        ],
      },
      [StarterKit, IntegrationCard, IntegrationMention],
    );

    expect(text).toBe(`See ${PR_URL} today\n\n${issueUrl}`);
  });
});
