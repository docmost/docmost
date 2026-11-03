import { IntegrationCard, IntegrationMention } from "@docmost/editor-ext";
import { Editor, Node, type JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/main.tsx";
import { TiptapDocument } from "@/features/editor/extensions/document";
import { Fragment, Slice, type Node as PMNode } from "@tiptap/pm/model";
import {
  IntegrationPasteMenuExtension,
  integrationPasteMenuKey,
} from "@/features/editor/extensions/integration-paste-menu";
import {
  convertIntegrationDisplay,
  type IntegrationDisplay,
} from "@/features/editor/components/integration-link/integration-display";
import { handlePaste } from "./editor-paste-handler";

const { copyFilesMock, getAttachmentInfoMock, uploadFileMock } = vi.hoisted(
  () => ({
    copyFilesMock: vi.fn(),
    getAttachmentInfoMock: vi.fn(),
    uploadFileMock: vi.fn(),
  }),
);

vi.mock("@/features/page/services/page-service.ts", () => ({
  copyFiles: copyFilesMock,
  getAttachmentInfo: getAttachmentInfoMock,
  uploadFile: uploadFileMock,
}));

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

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

const Attachment = Node.create({
  name: "attachment",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({
    attachmentId: { default: null },
    url: { default: null },
    name: { default: null },
    mime: { default: null },
    size: { default: null },
  }),
  renderHTML: ({ HTMLAttributes }) => ["span", HTMLAttributes],
});

const Drawio = Node.create({
  name: "drawio",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({
    attachmentId: { default: null },
    src: { default: null },
    title: { default: null },
    size: { default: null },
  }),
  renderHTML: ({ HTMLAttributes }) => ["span", HTMLAttributes],
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
      Attachment,
      Drawio,
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

  it("pastes a GitHub-like path on a host GitHub does not serve as a link", () => {
    createEditor([paragraph(text("Hello"))], 6);

    expectPassThrough("https://gitea.example.com/team/app/pulls/7");
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
  });

  it("leaves an inline code paste to the default handler", () => {
    createEditor([paragraph(text("run "), text("cmd", [{ type: "code" }]))], 6);

    expect(editor.isActive("code")).toBe(true);
    expectPassThrough();
  });
});

describe("cross-page attachment paste", () => {
  const SOURCE_FILE = "11111111-1111-4111-8111-111111111111";
  const SOURCE_DIAGRAM = "22222222-2222-4222-8222-222222222222";
  const COPY_A = "33333333-3333-4333-8333-333333333333";
  const COPY_B = "44444444-4444-4444-8444-444444444444";

  const fileNode = (id: string) =>
    editor.schema.nodes.attachment.create({
      attachmentId: id,
      url: `/api/files/${id}/file.png`,
      name: "file.png",
    });
  const diagramNode = (id: string) =>
    editor.schema.nodes.drawio.create({
      attachmentId: id,
      src: `/api/files/${id}/diagram.drawio`,
    });
  const copyResult = (sourceId: string, id: string) => ({
    sourceId,
    attachment: {
      id,
      fileName: "diagram.drawio",
      fileSize: 12,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  });

  function pasteNodes(nodes: PMNode[]) {
    const event = {
      clipboardData: {
        getData: (type: string) =>
          type === "text/html" ? `<span src="/api/files/${SOURCE_FILE}/"></span>` : "",
        files: [],
      },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent;
    const slice = new Slice(Fragment.fromArray(nodes), 0, 0);
    return handlePaste(editor, event, "target-page", undefined, slice);
  }

  function attachmentIds(type: string) {
    const ids: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === type) ids.push(node.attrs.attachmentId);
    });
    return ids;
  }

  beforeEach(() => createEditor([paragraph()], 1));

  afterEach(() => {
    editor?.destroy();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("reuploads regular attachments after async diagram insertion", async () => {
    let finishDiagramCopy!: (results: unknown) => void;
    copyFilesMock.mockReturnValue(
      new Promise((resolve) => (finishDiagramCopy = resolve)),
    );
    getAttachmentInfoMock.mockResolvedValue({ pageId: "source-page" });
    uploadFileMock.mockResolvedValue({
      id: COPY_A,
      fileName: "file.png",
      fileSize: 4,
      mimeType: "image/png",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["data"]) }),
    );

    expect(pasteNodes([fileNode(SOURCE_FILE), diagramNode(SOURCE_DIAGRAM)])).toBe(true);
    // Let a zero-delay scan run first, as it did before the race fix.
    await new Promise((resolve) => setTimeout(resolve, 0));
    finishDiagramCopy([copyResult(SOURCE_DIAGRAM, COPY_B)]);

    await vi.waitFor(() => expect(attachmentIds("attachment")).toEqual([COPY_A]));
    expect(getAttachmentInfoMock).toHaveBeenCalledWith(SOURCE_FILE);
    expect(uploadFileMock).toHaveBeenCalledOnce();
  });

  it("creates a distinct copy for each diagram occurrence sharing a source attachment", async () => {
    copyFilesMock.mockResolvedValue([
      copyResult(SOURCE_DIAGRAM, COPY_A),
      copyResult(SOURCE_DIAGRAM, COPY_B),
    ]);

    expect(pasteNodes([diagramNode(SOURCE_DIAGRAM), diagramNode(SOURCE_DIAGRAM)])).toBe(true);

    await vi.waitFor(() => expect(attachmentIds("drawio")).toEqual([COPY_A, COPY_B]));
    expect(copyFilesMock).toHaveBeenCalledWith(
      [SOURCE_DIAGRAM, SOURCE_DIAGRAM],
      "target-page",
    );
  });
});
