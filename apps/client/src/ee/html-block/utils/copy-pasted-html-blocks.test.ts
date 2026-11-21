import { Editor, type JSONContent } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";
import { HtmlBlock } from "@docmost/editor-ext";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/main.tsx";
import {
  copyHtmlBlock,
  getHtmlBlock,
} from "@/ee/html-block/services/html-block-service";
import { htmlBlockQueryKey } from "@/ee/html-block/queries/html-block-query";
import type { IHtmlBlock } from "@/ee/html-block/types/html-block.types";
import {
  copyPastedHtmlBlocks,
  selectForeignHtmlBlocks,
} from "./copy-pasted-html-blocks";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

vi.mock("@/ee/html-block/services/html-block-service", () => ({
  getHtmlBlock: vi.fn(),
  copyHtmlBlock: vi.fn(),
}));

const PlainHtmlBlock = HtmlBlock.extend({
  addNodeView() {
    return null;
  },
});

let editor: Editor;

function createEditor(content: JSONContent[]) {
  editor = new Editor({
    extensions: [StarterKit, PlainHtmlBlock],
    content: { type: "doc", content },
  });
  return editor;
}

const block = (htmlBlockId: string): JSONContent => ({
  type: "htmlBlock",
  attrs: { htmlBlockId },
});

const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const version = (id: string, pageId: string): IHtmlBlock => ({
  id,
  pageId,
  templateId: null,
  content: `<p>${id}</p>`,
  createdAt: "2026-11-21T09:00:00.000Z",
});

function htmlBlockIds() {
  const ids: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "htmlBlock") ids.push(node.attrs.htmlBlockId);
  });
  return ids;
}

const pasteAll = () =>
  copyPastedHtmlBlocks(editor, 0, editor.state.doc.content.size, {
    pageId: "page-1",
  });

afterEach(() => {
  editor?.destroy();
  queryClient.clear();
  vi.resetAllMocks();
});

describe("selectForeignHtmlBlocks", () => {
  it("selects only blocks owned by another target", () => {
    const blocks = [
      { pos: 0, htmlBlockId: "on-page-1" },
      { pos: 1, htmlBlockId: "on-page-2" },
      { pos: 2, htmlBlockId: "in-template-1" },
      { pos: 3, htmlBlockId: "unknown" },
    ];
    const owners = new Map([
      ["on-page-1", { pageId: "page-1", templateId: null }],
      ["on-page-2", { pageId: "page-2", templateId: null }],
      ["in-template-1", { pageId: null, templateId: "template-1" }],
    ]);

    expect(
      selectForeignHtmlBlocks(blocks, owners, { pageId: "page-1" }),
    ).toEqual([
      { pos: 1, htmlBlockId: "on-page-2" },
      { pos: 2, htmlBlockId: "in-template-1" },
    ]);
    expect(
      selectForeignHtmlBlocks(blocks, owners, { templateId: "template-1" }),
    ).toEqual([
      { pos: 0, htmlBlockId: "on-page-1" },
      { pos: 1, htmlBlockId: "on-page-2" },
    ]);
  });
});

describe("copyPastedHtmlBlocks", () => {
  it("points pasted blocks from another page at copies owned by this page", async () => {
    vi.mocked(getHtmlBlock).mockImplementation(async (id) =>
      version(id, id === "own" ? "page-1" : "page-2"),
    );
    vi.mocked(copyHtmlBlock).mockResolvedValue({ id: "copy" });
    createEditor([block("own"), block("foreign"), paragraph("x"), block("foreign")]);

    await pasteAll();

    expect(htmlBlockIds()).toEqual(["own", "copy", "copy"]);
    expect(copyHtmlBlock).toHaveBeenCalledTimes(1);
    expect(copyHtmlBlock).toHaveBeenCalledWith({
      htmlBlockId: "foreign",
      target: { pageId: "page-1" },
    });
    expect(
      queryClient.getQueryData<IHtmlBlock>(htmlBlockQueryKey("copy")),
    ).toMatchObject({ id: "copy", pageId: "page-1", content: "<p>foreign</p>" });
  });

  it("keeps a block that changed while its copy was being made", async () => {
    vi.mocked(getHtmlBlock).mockResolvedValue(version("foreign", "page-2"));
    vi.mocked(copyHtmlBlock).mockImplementation(async () => {
      editor.commands.command(({ tr }) => {
        tr.setNodeMarkup(0, undefined, { htmlBlockId: "saved-meanwhile" });
        return true;
      });
      return { id: "copy" };
    });
    createEditor([block("foreign")]);

    await pasteAll();

    expect(htmlBlockIds()).toEqual(["saved-meanwhile"]);
  });

  it("skips a block that is now past the end of the document", async () => {
    vi.mocked(getHtmlBlock).mockResolvedValue(version("foreign", "page-2"));
    vi.mocked(copyHtmlBlock).mockImplementation(async () => {
      // an undo removed everything after the first block while the copy ran
      editor.commands.command(({ tr }) => {
        tr.delete(1, tr.doc.content.size);
        return true;
      });
      return { id: "copy" };
    });
    createEditor([block("foreign"), paragraph("x"), block("foreign")]);

    await expect(pasteAll()).resolves.toBeUndefined();

    expect(htmlBlockIds()).toEqual(["copy"]);
  });

  it("keeps the id swap out of the undo history", async () => {
    vi.mocked(getHtmlBlock).mockResolvedValue(version("foreign", "page-2"));
    vi.mocked(copyHtmlBlock).mockResolvedValue({ id: "copy" });
    createEditor([block("foreign")]);
    const changes: Transaction[] = [];
    editor.on("transaction", ({ transaction }) => {
      if (transaction.docChanged) changes.push(transaction);
    });

    await pasteAll();

    expect(changes).toHaveLength(1);
    expect(changes[0].getMeta("addToHistory")).toBe(false);
    editor.commands.undo();
    expect(htmlBlockIds()).toEqual(["copy"]);
  });

  it("keeps the original reference when the owner or the copy fails", async () => {
    vi.mocked(getHtmlBlock).mockImplementation(async (id) => {
      if (id === "hidden") throw new Error("HTML block not found");
      return version(id, "page-2");
    });
    vi.mocked(copyHtmlBlock).mockRejectedValue(new Error("forbidden"));
    createEditor([block("hidden"), block("refused")]);

    await pasteAll();

    expect(htmlBlockIds()).toEqual(["hidden", "refused"]);
    expect(copyHtmlBlock).toHaveBeenCalledTimes(1);
  });
});
