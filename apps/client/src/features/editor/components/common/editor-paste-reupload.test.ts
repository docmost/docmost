import { Editor, Node, type JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Drawio, Excalidraw, type UploadTarget } from "@docmost/editor-ext";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TiptapDocument } from "@/features/editor/extensions/document";
import type { IAttachment } from "@/features/attachments/types/attachment.types";
import {
  getAttachmentInfo,
  uploadFile,
} from "@/features/page/services/page-service.ts";
import { handlePaste } from "./editor-paste-handler";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

vi.mock("@/features/page/services/page-service.ts", () => ({
  getAttachmentInfo: vi.fn(),
  uploadFile: vi.fn(),
}));

const SOURCE_ID = "019a1f00-0000-7000-8000-0000000000aa";
const COPY_ID = "019a1f00-0000-7000-8000-0000000000bb";
const imageHtml = (fileName = "photo.png") =>
  `<img src="/api/files/${SOURCE_ID}/${fileName}" data-attachment-id="${SOURCE_ID}">`;

const Image = Node.create({
  name: "image",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      attachmentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
      },
    };
  },
  parseHTML() {
    return [{ tag: "img[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", HTMLAttributes];
  },
});

const Footnotes = Node.create({
  name: "footnotes",
  group: "",
  content: "footnote*",
  renderHTML() {
    return ["ol", 0];
  },
});

const Footnote = Node.create({
  name: "footnote",
  content: "paragraph+",
  renderHTML() {
    return ["li", 0];
  },
});

let editor: Editor;

function createEditor(content: JSONContent[], target: UploadTarget) {
  editor = new Editor({
    extensions: [
      TiptapDocument,
      StarterKit.configure({ document: false }),
      Footnotes,
      Footnote,
      Image,
      Drawio,
      Excalidraw,
    ],
    content: { type: "doc", content },
    editorProps: {
      handlePaste: (_view, event) => handlePaste(editor, event, target),
    },
  });
  return editor;
}

function pasteHtml(html: string) {
  const event = {
    clipboardData: {
      getData: (type: string) => (type === "text/html" ? html : ""),
      files: [],
    },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent;
  editor.view.pasteHTML(html, event);
}

function imageAttachmentIds() {
  const ids: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "image") ids.push(node.attrs.attachmentId);
  });
  return ids;
}

const paragraph = (text?: string): JSONContent => ({
  type: "paragraph",
  ...(text && { content: [{ type: "text", text }] }),
});

describe("pasted file re-upload", () => {
  beforeEach(() => {
    vi.mocked(uploadFile).mockImplementation(
      async (file) =>
        ({
          id: COPY_ID,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }) as IAttachment,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(["png"], { type: "image/png" }),
      })),
    );
  });

  afterEach(() => {
    editor?.destroy();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it.each(["photo.png", "diagram.drawio.svg"])(
    "copies %s as an ordinary image at the end of a template",
    async (fileName) => {
      vi.mocked(getAttachmentInfo).mockResolvedValue({
        fileName,
        pageId: "page-1",
        templateId: null,
        diagramType: null,
      } as IAttachment);
      const target = { templateId: "tpl-1" };
      createEditor([paragraph("Intro"), paragraph()], target);
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);

      pasteHtml(imageHtml(fileName));

      await vi.waitFor(() => expect(imageAttachmentIds()).toEqual([COPY_ID]));
      expect(uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ name: fileName }),
        target,
      );
    },
  );

  it.each([
    ["drawio", "/api/files", "drawio"],
    ["excalidraw", "/api/files", "excalidraw"],
    ["drawio", "/files", null],
  ] as const)(
    "copies a %s diagram from %s with stored type %s",
    async (type, prefix, diagramType) => {
      const fileName = `Café #1.${type}.svg`;
      const encoded = encodeURIComponent(fileName);
      vi.mocked(getAttachmentInfo).mockResolvedValue({
        fileName,
        pageId: "page-1",
        diagramType,
      } as IAttachment);
      const target = { pageId: "page-2" };
      createEditor([paragraph()], target);
      pasteHtml(
        `<div data-type="${type}" data-attachment-id="${SOURCE_ID}" data-src="${prefix}/${SOURCE_ID}/${encoded}"></div>`,
      );

      await vi.waitFor(() =>
        expect(editor.state.doc.firstChild.attrs).toMatchObject({
          attachmentId: COPY_ID,
          src: `/api/files/${COPY_ID}/${encoded}`,
          title: fileName,
        }),
      );
      expect(uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ name: fileName }),
        target,
        { type },
      );
    },
  );

  it("keeps the copy untyped when an image and a diagram share its attachment", async () => {
    const fileName = "diagram.drawio.svg";
    vi.mocked(getAttachmentInfo).mockResolvedValue({
      fileName,
      pageId: "page-1",
    } as IAttachment);
    const target = { pageId: "page-2" };
    createEditor([paragraph()], target);
    pasteHtml(
      imageHtml(fileName) +
        `<div data-type="drawio" data-attachment-id="${SOURCE_ID}" data-src="/api/files/${SOURCE_ID}/${fileName}"></div>`,
    );
    await vi.waitFor(() => expect(imageAttachmentIds()).toEqual([COPY_ID]));
    expect(uploadFile).toHaveBeenCalledExactlyOnceWith(
      expect.any(File),
      target,
    );
  });

  it("copies a template image pasted between paragraphs of a page", async () => {
    vi.mocked(getAttachmentInfo).mockResolvedValue({
      fileName: "photo.png",
      pageId: null,
      templateId: "tpl-1",
    } as any);
    createEditor([paragraph("Intro"), paragraph(), paragraph("Outro")], {
      pageId: "page-2",
    });
    editor.commands.setTextSelection(8);

    pasteHtml(imageHtml());

    await vi.waitFor(() => expect(imageAttachmentIds()).toEqual([COPY_ID]));
    expect(uploadFile).toHaveBeenCalledWith(expect.any(File), {
      pageId: "page-2",
    });
  });

  it("keeps a file pasted back into the template that owns it", async () => {
    vi.mocked(getAttachmentInfo).mockResolvedValue({
      pageId: null,
      templateId: "tpl-1",
    } as any);
    createEditor([paragraph("Intro"), paragraph()], { templateId: "tpl-1" });
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    pasteHtml(imageHtml());

    await vi.waitFor(() => expect(getAttachmentInfo).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(uploadFile).not.toHaveBeenCalled();
    expect(imageAttachmentIds()).toEqual([SOURCE_ID]);
  });
});
