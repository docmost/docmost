import { BaseEmbed, Mention } from "@docmost/editor-ext";
import { Editor, type JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BasePasteMenuExtension,
  basePasteMenuKey,
} from "@/features/editor/extensions/base-paste-menu";
import { handlePaste } from "@/features/editor/components/common/editor-paste-handler";
import { convertMentionToBaseEmbed } from "./convert-mention-to-base-embed";

const mocks = vi.hoisted(() => ({ getPageById: vi.fn() }));

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

vi.mock("@/features/page/services/page-service.ts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPageById: mocks.getPageById,
}));

const PAGE_ID = "019a2b3c-0000-7000-8000-000000000001";
const LINK = `${window.location.origin}/s/general/p/roadmap-x1y2z3`;

let editor: Editor;

function createEditor(content: JSONContent[], cursor: number) {
  editor = new Editor({
    extensions: [StarterKit, Mention, BaseEmbed, BasePasteMenuExtension],
    content: { type: "doc", content },
  });
  editor.commands.setTextSelection(cursor);
}

function mentionPos(): number | null {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "mention") found = pos;
  });
  return found;
}

async function pasteLink({
  isBase,
  url = LINK,
}: {
  isBase: boolean;
  url?: string;
}) {
  mocks.getPageById.mockResolvedValue({
    id: PAGE_ID,
    slugId: "x1y2z3",
    title: "Roadmap",
    isBase,
  });
  const event = {
    clipboardData: {
      getData: (type: string) => (type === "text/plain" ? url : ""),
      files: [],
    },
    preventDefault: vi.fn(),
  };
  handlePaste(editor, event as unknown as ClipboardEvent, "page-id");
  await vi.waitFor(() => expect(mentionPos()).not.toBeNull());
}

afterEach(() => editor?.destroy());

describe("pasting a link to a base", () => {
  it("offers to embed it", async () => {
    createEditor([{ type: "paragraph" }], 1);

    await pasteLink({ isBase: true });

    expect(basePasteMenuKey.getState(editor.state)).toEqual({
      pos: mentionPos(),
    });
  });

  it("offers to embed a link to one of its views", async () => {
    createEditor([{ type: "paragraph" }], 1);

    await pasteLink({
      isBase: true,
      url: `${LINK}?view=0195f3c2-1111-7000-8000-000000000abc`,
    });

    expect(mocks.getPageById).toHaveBeenCalledWith({ pageId: "x1y2z3" });
    expect(basePasteMenuKey.getState(editor.state)).toEqual({
      pos: mentionPos(),
    });
  });

  it("does not offer it for a document", async () => {
    createEditor([{ type: "paragraph" }], 1);

    await pasteLink({ isBase: false });

    expect(basePasteMenuKey.getState(editor.state)).toBeNull();
  });

  it("does not offer it where a block cannot go", async () => {
    createEditor(
      [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Plan " }],
        },
      ],
      6,
    );

    await pasteLink({ isBase: true });

    expect(basePasteMenuKey.getState(editor.state)).toBeNull();
  });
});

describe("embedding a pasted base", () => {
  it("replaces a mention on its own line with the base", async () => {
    createEditor([{ type: "paragraph" }], 1);
    await pasteLink({ isBase: true });

    expect(convertMentionToBaseEmbed(editor, mentionPos()!)).toBe(true);

    // The trailing paragraph comes from the trailing node, as in the page editor.
    expect(editor.getJSON().content).toMatchObject([
      { type: "base", attrs: { pageId: PAGE_ID } },
      { type: "paragraph" },
    ]);
  });

  it("splits the paragraph around a mention pasted mid-sentence", async () => {
    createEditor(
      [{ type: "paragraph", content: [{ type: "text", text: "See  for dates" }] }],
      5,
    );
    await pasteLink({ isBase: true });

    expect(convertMentionToBaseEmbed(editor, mentionPos()!)).toBe(true);

    expect(editor.getJSON().content).toMatchObject([
      { type: "paragraph", content: [{ type: "text", text: "See" }] },
      { type: "base", attrs: { pageId: PAGE_ID } },
      { type: "paragraph", content: [{ type: "text", text: "for dates" }] },
    ]);
  });
});
