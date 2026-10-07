import {
  IntegrationCard,
  IntegrationMention,
  isHttpUrl,
} from "@docmost/editor-ext";
import { Editor, generateText } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";

const PR_URL = "https://github.com/o/r/pull/1";
const UNSAFE_URLS = ["file:///etc/passwd", "ms-msdt:foo", "javascript:alert(1)"];
const SCRIPT_URLS = [
  "javascript:alert(1)",
  " JaVaScRiPt:alert(1)",
  "java\tscript:alert(1)",
  "&#106;avascript:alert(1)",
];
const ENCODED_URLS = [
  "https://github.com/o/r/issues?q=label%3A%22a%2520b%22",
  "https://acme.atlassian.net/issues/?jql=project%3DAB%26status%3DOpen",
  "https://github.com/o/r%2F..%2F..%2Fevil/pull/1",
];

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

describe("isHttpUrl", () => {
  it.each(["http://example.com", PR_URL, "HTTPS://GITHUB.COM/o/r"])(
    "accepts %s",
    (url) => {
      expect(isHttpUrl(url)).toBe(true);
    },
  );

  it.each([
    ...UNSAFE_URLS,
    "data:text/html,hi",
    "mailto:a@b.c",
    "slack://open",
    "/relative/path",
    "github.com/o/r",
    "",
    null,
    undefined,
  ])("rejects %s", (url) => {
    expect(isHttpUrl(url)).toBe(false);
  });
});

describe.each([
  { typeName: "integrationCard", tag: "div", command: "setIntegrationCard" },
  {
    typeName: "integrationMention",
    tag: "span",
    command: "setIntegrationMention",
  },
] as const)("$typeName url attr", ({ typeName, tag, command }) => {
  it("keeps an https url through the insert command", () => {
    createEditor();
    editor.commands[command]({ url: PR_URL, provider: "github" });

    expect(findAttrs(typeName)).toMatchObject({ url: PR_URL });
  });

  it.each(UNSAFE_URLS)("stores an empty url when inserting %s", (url) => {
    createEditor();
    editor.commands[command]({ url, provider: "github" });

    expect(findAttrs(typeName)).toMatchObject({ url: "" });
  });

  it.each(SCRIPT_URLS)("stores an empty url when inserting %j", (url) => {
    createEditor();
    editor.commands[command]({ url, provider: "github" });

    expect(findAttrs(typeName)).toMatchObject({ url: "" });
  });

  it.each(ENCODED_URLS)("keeps the encoding of %s when inserting", (url) => {
    createEditor();
    editor.commands[command]({ url, provider: "github" });

    expect(findAttrs(typeName)).toMatchObject({ url });
  });

  it("trims whitespace around an inserted url", () => {
    createEditor();
    editor.commands[command]({ url: `  ${PR_URL}\n`, provider: "github" });

    expect(findAttrs(typeName)).toMatchObject({ url: PR_URL });
  });

  it.each(ENCODED_URLS)("keeps the encoding of %s through HTML", (url) => {
    createEditor(
      `<p>x</p><${tag} data-type="${typeName}" data-url="${url}"></${tag}>`,
    );

    expect(findAttrs(typeName)).toMatchObject({ url });
    expect(editor.getHTML()).toContain(`href="${url}"`);
  });

  it("drops a non-http data-url when parsing HTML", () => {
    createEditor(
      `<p>x</p><${tag} data-type="${typeName}" data-url="file:///x" data-provider="github"></${tag}>`,
    );

    expect(findAttrs(typeName)).toMatchObject({ url: "", provider: "github" });
  });

  it("parses an https data-url unchanged", () => {
    createEditor(
      `<p>x</p><${tag} data-type="${typeName}" data-url="${PR_URL}"></${tag}>`,
    );

    expect(findAttrs(typeName)).toMatchObject({ url: PR_URL });
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
