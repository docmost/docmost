import { IntegrationCard, IntegrationMention } from "@docmost/editor-ext";
import { Editor, Node } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/main.tsx";
import { TiptapDocument } from "@/features/editor/extensions/document";
import {
  IntegrationPasteMenuExtension,
  integrationPasteMenuKey,
} from "@/features/editor/extensions/integration-paste-menu";
import {
  convertIntegrationDisplay,
  type IntegrationDisplay,
} from "@/features/editor/components/integration-link/integration-display";
import { handlePaste } from "./editor-paste-handler";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

const PR_URL = "https://github.com/org/repo/pull/12";

// The real footnote nodes bring plugins that clash with editor-ext's CJS build in vitest.
const Footnotes = Node.create({
  name: "footnotes",
  group: "",
  content: "footnote*",
  isolating: true,
  renderHTML() {
    return ["ol", { class: "footnotes" }, 0];
  },
});

const Footnote = Node.create({
  name: "footnote",
  content: "paragraph+",
  isolating: true,
  renderHTML() {
    return ["li", 0];
  },
});

let editor: Editor;

function createEditor(content: object[], cursor: number) {
  editor = new Editor({
    extensions: [
      TiptapDocument,
      StarterKit.configure({ document: false }),
      Footnotes,
      Footnote,
      IntegrationCard,
      IntegrationMention,
      IntegrationPasteMenuExtension,
    ],
    content: { type: "doc", content },
  });
  editor.commands.setTextSelection(cursor);
  return editor;
}

function paste(text: string) {
  const event = {
    clipboardData: {
      getData: (type: string) => (type === "text/plain" ? text : ""),
      files: [],
    },
    preventDefault: vi.fn(),
  };
  const handled = handlePaste(
    editor,
    event as unknown as ClipboardEvent,
    "page-id",
  );
  return { handled, preventDefault: event.preventDefault };
}

function choosePasteOption(display: IntegrationDisplay) {
  const { pos, joinBefore, joinAfter } = integrationPasteMenuKey.getState(
    editor.state,
  );
  return convertIntegrationDisplay(
    editor,
    { kind: "node", pos, joinBefore, joinAfter },
    display,
  );
}

function hasIntegrationCard() {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "integrationCard") found = true;
  });
  return found;
}

function expectPassThrough(text = PR_URL) {
  const before = editor.getJSON();
  const { handled, preventDefault } = paste(text);

  expect(handled).toBe(false);
  expect(preventDefault).not.toHaveBeenCalled();
  expect(hasIntegrationCard()).toBe(false);
  expect(editor.getJSON()).toEqual(before);
}

describe("handlePaste integration links", () => {
  beforeEach(() => {
    queryClient.setQueryData(
      ["installed-integrations"],
      [{ type: "github", unfurlHosts: ["github.com"] }],
    );
  });

  afterEach(() => {
    editor?.destroy();
    queryClient.clear();
  });

  it("inserts a card in a paragraph when the provider is installed", () => {
    createEditor(
      [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
      6,
    );

    const { handled, preventDefault } = paste(PR_URL);

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    const pasteMenu = integrationPasteMenuKey.getState(editor.state);
    expect(pasteMenu).not.toBeNull();
    expect(editor.state.doc.nodeAt(pasteMenu.pos)?.type.name).toBe(
      "integrationCard",
    );
    expect(editor.state.doc.nodeAt(pasteMenu.pos)?.attrs).toMatchObject({
      url: PR_URL,
      provider: "github",
    });
  });

  it("pastes a GitHub-like path on a host GitHub does not serve as a link", () => {
    createEditor(
      [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
      6,
    );

    expectPassThrough("https://gitea.example.com/team/app/pulls/7");
  });

  it("inserts a card for a repo root on a GitHub Enterprise host", () => {
    queryClient.setQueryData(
      ["installed-integrations"],
      [{ type: "github", unfurlHosts: ["github.acme.com"] }],
    );
    createEditor(
      [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
      6,
    );

    const { handled } = paste("https://github.acme.com/org/repo");

    expect(handled).toBe(true);
    expect(hasIntegrationCard()).toBe(true);
  });

  it("splits the paragraph around a card pasted mid-sentence", () => {
    createEditor(
      [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }],
      7,
    );

    const { handled, preventDefault } = paste(PR_URL);

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(editor.getJSON().content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Hello " }] },
      {
        type: "integrationCard",
        attrs: { url: PR_URL, provider: "github" },
      },
      { type: "paragraph", content: [{ type: "text", text: "world" }] },
    ]);
  });

  it("rejoins the sentence when a mid-sentence paste becomes a mention", () => {
    createEditor(
      [{ type: "paragraph", content: [{ type: "text", text: "Fix in today" }] }],
      8,
    );
    paste(PR_URL);

    expect(choosePasteOption("mention")).toBe(true);
    expect(editor.getJSON().content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Fix in " },
          {
            type: "integrationMention",
            attrs: { url: PR_URL, provider: "github" },
          },
          { type: "text", text: " today" },
        ],
      },
    ]);
    expect(editor.state.selection.from).toBe(10);
  });

  it("adds no second space when the rest of the sentence starts with one", () => {
    createEditor(
      [{ type: "paragraph", content: [{ type: "text", text: "Fix in today" }] }],
      7,
    );
    paste(PR_URL);

    expect(choosePasteOption("mention")).toBe(true);
    expect(editor.getJSON().content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Fix in" },
          {
            type: "integrationMention",
            attrs: { url: PR_URL, provider: "github" },
          },
          { type: "text", text: " today" },
        ],
      },
    ]);
  });

  it("rejoins the sentence when a mid-sentence paste becomes a URL", () => {
    createEditor(
      [{ type: "paragraph", content: [{ type: "text", text: "Fix in today" }] }],
      8,
    );
    paste(PR_URL);

    expect(choosePasteOption("url")).toBe(true);
    expect(editor.getJSON().content).toHaveLength(1);
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: "paragraph",
      content: [
        { type: "text", text: "Fix in " },
        {
          type: "text",
          text: PR_URL,
          marks: [{ type: "link", attrs: { href: PR_URL } }],
        },
        { type: "text", text: "today" },
      ],
    });
  });

  it("keeps an end-of-paragraph paste turned into a mention in its paragraph", () => {
    createEditor(
      [
        { type: "paragraph", content: [{ type: "text", text: "Fix in " }] },
        { type: "paragraph", content: [{ type: "text", text: "Next" }] },
      ],
      8,
    );
    paste(PR_URL);

    expect(choosePasteOption("mention")).toBe(true);
    expect(editor.getJSON().content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Fix in " },
          {
            type: "integrationMention",
            attrs: { url: PR_URL, provider: "github" },
          },
          { type: "text", text: " " },
        ],
      },
      { type: "paragraph", content: [{ type: "text", text: "Next" }] },
    ]);
  });

  it("joins a start-of-paragraph paste turned into a mention with the rest of the line", () => {
    createEditor(
      [{ type: "paragraph", content: [{ type: "text", text: "today" }] }],
      1,
    );
    paste(PR_URL);

    expect(choosePasteOption("mention")).toBe(true);
    expect(editor.getJSON().content).toEqual([
      {
        type: "paragraph",
        content: [
          {
            type: "integrationMention",
            attrs: { url: PR_URL, provider: "github" },
          },
          { type: "text", text: " today" },
        ],
      },
    ]);
  });

  it("keeps a paste on an empty line in its own paragraph when it becomes a mention", () => {
    createEditor(
      [
        { type: "paragraph", content: [{ type: "text", text: "Before" }] },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "After" }] },
      ],
      9,
    );
    paste(PR_URL);

    expect(choosePasteOption("mention")).toBe(true);
    expect(editor.getJSON().content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Before" }] },
      {
        type: "paragraph",
        content: [
          {
            type: "integrationMention",
            attrs: { url: PR_URL, provider: "github" },
          },
          { type: "text", text: " " },
        ],
      },
      { type: "paragraph", content: [{ type: "text", text: "After" }] },
    ]);
  });

  it("pastes a mention inside a footnote, which cannot hold a card", () => {
    createEditor(
      [
        { type: "paragraph", content: [{ type: "text", text: "Body" }] },
        {
          type: "footnotes",
          content: [
            {
              type: "footnote",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "See " }] },
              ],
            },
          ],
        },
      ],
      13,
    );

    const { handled, preventDefault } = paste(PR_URL);

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(hasIntegrationCard()).toBe(false);
    expect(editor.getJSON().content?.[1]).toMatchObject({
      type: "footnotes",
      content: [
        {
          type: "footnote",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "See " },
                {
                  type: "integrationMention",
                  attrs: { url: PR_URL, provider: "github" },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("leaves a code block paste to the default handler", () => {
    createEditor(
      [
        {
          type: "codeBlock",
          content: [{ type: "text", text: "const a = 1;" }],
        },
      ],
      4,
    );

    expectPassThrough();
  });

  it("leaves a heading paste to the default handler", () => {
    createEditor(
      [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Title" }],
        },
      ],
      3,
    );

    expectPassThrough();
  });

  it("leaves an inline code paste to the default handler", () => {
    createEditor(
      [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "run " },
            { type: "text", text: "cmd", marks: [{ type: "code" }] },
          ],
        },
      ],
      6,
    );

    expect(editor.isActive("code")).toBe(true);
    expectPassThrough();
  });
});
