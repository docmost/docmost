import {
  CustomTable,
  IntegrationCard,
  IntegrationMention,
  LinkCard,
  LinkMention,
  TableCell,
  TableHeader,
  TableRow,
} from "@docmost/editor-ext";
import { Editor, Node, type JSONContent } from "@tiptap/core";
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
import {
  LinkPasteMenuExtension,
  linkPasteMenuKey,
} from "@/features/editor/extensions/link-paste-menu";
import { handlePaste } from "./editor-paste-handler";
import { uploadImageAction } from "@/features/editor/components/image/upload-image-action.tsx";
import { uploadVideoAction } from "@/features/editor/components/video/upload-video-action.tsx";
import { uploadAttachmentAction } from "../attachment/upload-attachment-action";
import { uploadPdfAction } from "../pdf/upload-pdf-action";

vi.mock("@/features/editor/components/image/upload-image-action.tsx", () => ({
  uploadImageAction: vi.fn(),
}));
vi.mock("@/features/editor/components/video/upload-video-action.tsx", () => ({
  uploadVideoAction: vi.fn(),
}));
vi.mock("../attachment/upload-attachment-action", () => ({
  uploadAttachmentAction: vi.fn(),
}));
vi.mock("../pdf/upload-pdf-action", () => ({ uploadPdfAction: vi.fn() }));

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

const linkPreviewConfig = vi.hoisted(() => ({ disabled: false }));

vi.mock("@/lib/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config")>()),
  isLinkPreviewDisabled: () => linkPreviewConfig.disabled,
}));

const PR_URL = "https://github.com/org/repo/pull/12";
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
  attrs: { url: PR_URL, provider: "github" },
});
const mention = (): JSONContent => ({
  type: "integrationMention",
  attrs: { url: PR_URL, provider: "github" },
});

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
let pasteFiles: File[] = [];

function createEditor(content: object[], cursor: number, files: File[] = []) {
  pasteFiles = files;
  editor = new Editor({
    extensions: [
      TiptapDocument,
      StarterKit.configure({ document: false }),
      Footnotes,
      Footnote,
      IntegrationCard,
      IntegrationMention,
      IntegrationPasteMenuExtension,
      LinkCard,
      LinkMention,
      LinkPasteMenuExtension,
      CustomTable,
      TableRow,
      // The real cells list block nodes this harness doesn't register.
      TableCell.extend({ content: "paragraph+" }),
      TableHeader.extend({ content: "paragraph+" }),
    ],
    content: { type: "doc", content },
  });
  editor.commands.setTextSelection(cursor);
  return editor;
}

function paste(text: string, html = "") {
  const event = {
    clipboardData: {
      getData: (type: string) =>
        type === "text/plain" ? text : type === "text/html" ? html : "",
      files: pasteFiles,
    },
    preventDefault: vi.fn(),
  };
  const handled = handlePaste(
    editor,
    event as unknown as ClipboardEvent,
    { pageId: "page-id" },
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

function expectPassThrough(text = PR_URL, html = "") {
  const before = editor.getJSON();
  const { handled, preventDefault } = paste(text, html);

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
    createEditor([paragraph(text("Hello"))], 6);

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

  it("pastes a GitHub-like path on a host GitHub does not serve as a plain link", () => {
    createEditor([paragraph(text("Hello"))], 6);

    const { handled } = paste("https://gitea.example.com/team/app/pulls/7");

    expect(handled).toBe(true);
    expect(hasIntegrationCard()).toBe(false);
    expect(linkPasteMenuKey.getState(editor.state)?.url).toBe(
      "https://gitea.example.com/team/app/pulls/7",
    );
  });

  it.each(["integrationCard", "integrationMention"])(
    "leaves a copied %s to ProseMirror instead of pasting its URL as a card",
    (type) => {
      createEditor([paragraph(text("Hello world"))], 7);

      expectPassThrough(
        PR_URL,
        `<p data-pm-slice="1 1 []"><span data-type="${type}" data-url="${PR_URL}" data-provider="github"></span></p>`,
      );
    },
  );

  it("inserts a card for a repo root on a GitHub Enterprise host", () => {
    queryClient.setQueryData(
      ["installed-integrations"],
      [{ type: "github", unfurlHosts: ["github.acme.com"] }],
    );
    createEditor([paragraph(text("Hello"))], 6);

    const { handled } = paste("https://github.acme.com/org/repo");

    expect(handled).toBe(true);
    expect(hasIntegrationCard()).toBe(true);
  });

  it("splits the paragraph around a card pasted mid-sentence", () => {
    createEditor([paragraph(text("Hello world"))], 7);

    const { handled, preventDefault } = paste(PR_URL);

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(editor.getJSON().content).toEqual([
      paragraph(text("Hello ")),
      card(),
      paragraph(text("world")),
    ]);
  });

  it("rejoins the sentence when a mid-sentence paste becomes a mention", () => {
    createEditor([paragraph(text("Fix in today"))], 8);
    paste(PR_URL);

    expect(choosePasteOption("mention")).toBe(true);
    expect(editor.getJSON().content).toEqual([
      paragraph(text("Fix in "), mention(), text(" today")),
    ]);
    expect(editor.state.selection.from).toBe(10);
  });

  it("adds no second space when the rest of the sentence starts with one", () => {
    createEditor([paragraph(text("Fix in today"))], 7);
    paste(PR_URL);

    expect(choosePasteOption("mention")).toBe(true);
    expect(editor.getJSON().content).toEqual([
      paragraph(text("Fix in"), mention(), text(" today")),
    ]);
  });

  it("rejoins the sentence when a mid-sentence paste becomes a URL", () => {
    createEditor([paragraph(text("Fix in today"))], 8);
    paste(PR_URL);

    expect(choosePasteOption("url")).toBe(true);
    expect(editor.getJSON().content).toHaveLength(1);
    expect(editor.getJSON().content?.[0]).toMatchObject(
      paragraph(
        text("Fix in "),
        text(PR_URL, [{ type: "link", attrs: { href: PR_URL } }]),
        text("today"),
      ),
    );
  });

  it("keeps an end-of-paragraph paste turned into a mention in its paragraph", () => {
    createEditor([paragraph(text("Fix in ")), paragraph(text("Next"))], 8);
    paste(PR_URL);

    expect(choosePasteOption("mention")).toBe(true);
    expect(editor.getJSON().content).toEqual([
      paragraph(text("Fix in "), mention(), text(" ")),
      paragraph(text("Next")),
    ]);
  });

  it("joins a start-of-paragraph paste turned into a mention with the rest of the line", () => {
    createEditor([paragraph(text("today"))], 1);
    paste(PR_URL);

    expect(choosePasteOption("mention")).toBe(true);
    expect(editor.getJSON().content).toEqual([
      paragraph(mention(), text(" today")),
    ]);
  });

  it("keeps a paste on an empty line in its own paragraph when it becomes a mention", () => {
    createEditor(
      [paragraph(text("Before")), paragraph(), paragraph(text("After"))],
      9,
    );
    paste(PR_URL);

    expect(choosePasteOption("mention")).toBe(true);
    expect(editor.getJSON().content).toEqual([
      paragraph(text("Before")),
      paragraph(mention(), text(" ")),
      paragraph(text("After")),
    ]);
  });

  it("pastes a mention inside a footnote, which cannot hold a card", () => {
    createEditor(
      [
        paragraph(text("Body")),
        {
          type: "footnotes",
          content: [
            {
              type: "footnote",
              content: [paragraph(text("See "))],
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
          content: [paragraph(text("See "), mention())],
        },
      ],
    });
  });

  it("leaves a code block paste to the default handler", () => {
    createEditor(
      [
        {
          type: "codeBlock",
          content: [text("const a = 1;")],
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
          content: [text("Title")],
        },
      ],
      3,
    );

    expectPassThrough();
    expect(linkPasteMenuKey.getState(editor.state)).toBeNull();
  });

  it("leaves an inline code paste to the default handler", () => {
    createEditor([paragraph(text("run "), text("cmd", [{ type: "code" }]))], 6);

    expect(editor.isActive("code")).toBe(true);
    expectPassThrough();
  });
});

describe("handlePaste plain external links", () => {
  const URL_ = "https://example.com/some/page";
  const linked = (value: string) =>
    text(value, [{ type: "link", attrs: { href: value } }]);

  beforeEach(() => {
    queryClient.setQueryData(
      ["installed-integrations"],
      [{ type: "github", unfurlHosts: ["github.com"] }],
    );
  });

  afterEach(() => {
    editor?.destroy();
    queryClient.clear();
    linkPreviewConfig.disabled = false;
  });

  function expectLinkWithMenu(url = URL_, from = 7) {
    const { handled, preventDefault } = paste(url);
    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(linkPasteMenuKey.getState(editor.state)).toEqual({
      from,
      to: from + url.length,
      url,
    });
    expect(editor.state.selection.from).toBe(from + url.length);
  }

  it("a bare external URL pastes as a link and opens Paste as", () => {
    createEditor([paragraph(text("Hello "))], 7);

    expectLinkWithMenu();

    expect(editor.getJSON().content).toMatchObject([
      paragraph(text("Hello "), linked(URL_)),
    ]);
  });

  it("with link previews disabled, a bare URL pastes as a link without Paste as", () => {
    linkPreviewConfig.disabled = true;
    createEditor([paragraph(text("Hello "))], 7);

    const { handled, preventDefault } = paste(URL_);

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(linkPasteMenuKey.getState(editor.state)).toBeNull();
    expect(editor.state.selection.from).toBe(7 + URL_.length);
    expect(editor.getJSON().content).toMatchObject([
      paragraph(text("Hello "), linked(URL_)),
    ]);
  });

  it("a URL with other words pastes normally", () => {
    createEditor([paragraph(text("Hello "))], 7);
    const before = editor.getJSON();

    const { handled, preventDefault } = paste(`see ${URL_}`);

    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(editor.getJSON()).toEqual(before);
  });

  it("two URLs paste normally", () => {
    createEditor([paragraph(text("Hello "))], 7);

    const { handled } = paste(`${URL_} ${URL_}`);

    expect(handled).toBe(false);
    expect(linkPasteMenuKey.getState(editor.state)).toBeNull();
  });

  it.each([`${URL_}.`, `${URL_},`, `${URL_})`])(
    "%s, whose last character is not part of the link, pastes normally",
    (pasted) => {
      createEditor([paragraph(text("Hello "))], 7);
      const before = editor.getJSON();

      const { handled, preventDefault } = paste(pasted);

      expect(handled).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
      expect(editor.getJSON()).toEqual(before);
    },
  );

  it.each(["https://en.wikipedia.org/wiki/Foo_(bar)", "http://wiki/page"])(
    "%s pastes as a link and opens Paste as",
    (url) => {
      createEditor([paragraph(text("Hello "))], 7);

      expectLinkWithMenu(url);
    },
  );

  it("a URL with a trailing newline is trimmed and handled", () => {
    createEditor([paragraph(text("Hello "))], 7);

    const { handled } = paste(`${URL_}\n`);

    expect(handled).toBe(true);
    expect(linkPasteMenuKey.getState(editor.state)?.url).toBe(URL_);
    expect(editor.getJSON().content).toMatchObject([
      paragraph(text("Hello "), linked(URL_)),
    ]);
  });

  it("a URL over a selection links the selection without the menu", () => {
    createEditor([paragraph(text("Hello world"))], 1);
    editor.commands.setTextSelection({ from: 1, to: 6 });

    const { handled } = paste(URL_);

    expect(handled).toBe(false);
    expect(linkPasteMenuKey.getState(editor.state)).toBeNull();
  });

  it("an installed integration URL still pastes as a card", () => {
    createEditor([paragraph(text("Hello"))], 6);

    const { handled } = paste(PR_URL);

    expect(handled).toBe(true);
    expect(hasIntegrationCard()).toBe(true);
    expect(linkPasteMenuKey.getState(editor.state)).toBeNull();
  });

  it("with link previews disabled, an installed integration URL still pastes as a card", () => {
    linkPreviewConfig.disabled = true;
    createEditor([paragraph(text("Hello"))], 6);

    const { handled } = paste(PR_URL);

    expect(handled).toBe(true);
    expect(hasIntegrationCard()).toBe(true);
    expect(integrationPasteMenuKey.getState(editor.state)).not.toBeNull();
  });

  it("a page link copied from another Docmost host gets the menu", () => {
    createEditor([paragraph(text("Hello "))], 7);

    expectLinkWithMenu("https://other.example.com/s/general/p/page-slug123");
  });

  it("a same-host page link with a trailing newline is not offered Paste as", () => {
    createEditor([paragraph(text("Hello "))], 7);

    paste(`https://${window.location.host}/s/general/p/page-slug123\n`);

    expect(linkPasteMenuKey.getState(editor.state)).toBeNull();
  });

  it("a copied Microsoft folder node pastes back as the node", () => {
    createEditor([paragraph(text("Hello "))], 7);

    const { handled } = paste(
      "https://contoso.sharepoint.com/sites/team/Shared%20Documents/Folder",
      '<p data-pm-slice="1 1 []"><span data-type="sharepointFolder" data-url="x"></span></p>',
    );

    expect(handled).toBe(false);
    expect(linkPasteMenuKey.getState(editor.state)).toBeNull();
  });

  it("a URL in inline code pastes as text", () => {
    createEditor([paragraph(text("run "), text("cmd", [{ type: "code" }]))], 6);
    const before = editor.getJSON();

    const { handled, preventDefault } = paste(URL_);

    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(editor.getJSON()).toEqual(before);
  });

  it("a URL in a code block pastes as text", () => {
    createEditor([{ type: "codeBlock", content: [text("const a = 1;")] }], 4);

    const { handled } = paste(URL_);

    expect(handled).toBe(false);
    expect(linkPasteMenuKey.getState(editor.state)).toBeNull();
  });

  it.each(["linkCard", "linkMention"])(
    "a copied %s pastes back as the node",
    (type) => {
      createEditor([paragraph(text("Hello "))], 7);

      const { handled } = paste(
        URL_,
        `<p data-pm-slice="1 1 []"><span data-type="${type}" data-url="${URL_}"></span></p>`,
      );

      expect(handled).toBe(false);
      expect(linkPasteMenuKey.getState(editor.state)).toBeNull();
    },
  );

  it("files on the clipboard go to the upload path", () => {
    createEditor(
      [paragraph(text("Hello "))],
      7,
      [new File(["x"], "a.bin", { type: "application/octet-stream" })],
    );

    const { handled } = paste(URL_);

    expect(handled).toBe(true);
    expect(linkPasteMenuKey.getState(editor.state)).toBeNull();
    expect(uploadImageAction).toHaveBeenCalled();
    expect(uploadAttachmentAction).toHaveBeenCalled();
    expect(uploadVideoAction).toHaveBeenCalled();
    expect(uploadPdfAction).toHaveBeenCalled();
  });

  it("works in a heading", () => {
    createEditor(
      [{ type: "heading", attrs: { level: 2 }, content: [text("Title ")] }],
      7,
    );

    expectLinkWithMenu();
    expect(editor.getJSON().content?.[0].content).toMatchObject([
      text("Title "),
      linked(URL_),
    ]);
  });

  it("works in a table cell", () => {
    createEditor(
      [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [paragraph(text("Cell "))],
                },
              ],
            },
          ],
        },
      ],
      1,
    );
    editor.commands.setTextSelection(6);
    const from = editor.state.selection.from;
    expect(editor.state.selection.$from.parent.textContent).toBe("Cell ");

    expectLinkWithMenu(URL_, from);
  });
});
