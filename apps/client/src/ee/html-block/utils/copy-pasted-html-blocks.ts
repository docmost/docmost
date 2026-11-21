import type { Editor } from "@tiptap/core";
import type { UploadTarget } from "@docmost/editor-ext";
import { queryClient } from "@/main.tsx";
import {
  copyHtmlBlock,
  getHtmlBlock,
} from "@/ee/html-block/services/html-block-service";
import { htmlBlockQueryKey } from "@/ee/html-block/queries/html-block-query";
import { isOwnedByTarget } from "@/ee/html-block/utils/html-block-owner";
import {
  HtmlBlockOwner,
  IHtmlBlock,
  PastedHtmlBlock,
} from "@/ee/html-block/types/html-block.types";

export function selectForeignHtmlBlocks(
  blocks: PastedHtmlBlock[],
  owners: Map<string, HtmlBlockOwner>,
  target: UploadTarget,
): PastedHtmlBlock[] {
  return blocks.filter(({ htmlBlockId }) => {
    const owner = owners.get(htmlBlockId);
    return !!owner && !isOwnedByTarget(owner, target);
  });
}

export async function copyPastedHtmlBlocks(
  editor: Editor,
  from: number,
  to: number,
  target: UploadTarget,
): Promise<void> {
  const blocks: PastedHtmlBlock[] = [];
  editor.state.doc.nodesBetween(
    from,
    Math.min(to, editor.state.doc.content.size),
    (node, pos) => {
      if (node.type.name === "htmlBlock" && node.attrs.htmlBlockId) {
        blocks.push({ pos, htmlBlockId: node.attrs.htmlBlockId });
      }
    },
  );
  if (blocks.length === 0) return;

  const versions = new Map<string, IHtmlBlock>();
  await Promise.all(
    [...new Set(blocks.map((block) => block.htmlBlockId))].map(async (id) => {
      try {
        // shares the request and cache entry with the block view rendering this version
        const version = await queryClient.fetchQuery({
          queryKey: htmlBlockQueryKey(id),
          queryFn: () => getHtmlBlock(id),
          staleTime: Infinity,
        });
        versions.set(id, version);
      } catch {
        // an unreadable owner keeps the original reference
      }
    }),
  );

  const foreignBlocks = selectForeignHtmlBlocks(blocks, versions, target);
  if (foreignBlocks.length === 0) return;

  const copyIds = new Map<string, string>();
  await Promise.all(
    [...new Set(foreignBlocks.map((block) => block.htmlBlockId))].map(
      async (id) => {
        try {
          const copy = await copyHtmlBlock({ htmlBlockId: id, target });
          queryClient.setQueryData<IHtmlBlock>(htmlBlockQueryKey(copy.id), {
            ...versions.get(id),
            id: copy.id,
            pageId: "pageId" in target ? target.pageId : null,
            templateId: "templateId" in target ? target.templateId : null,
            createdAt: new Date().toISOString(),
          });
          copyIds.set(id, copy.id);
        } catch {
          // keep the original reference on failure
        }
      },
    ),
  );

  if (copyIds.size === 0 || editor.isDestroyed) return;

  editor
    .chain()
    .command(({ tr }) => {
      // an undo after the swap must not bring back the foreign id
      tr.setMeta("addToHistory", false);
      const newestFirst = [...foreignBlocks].sort((a, b) => b.pos - a.pos);
      for (const block of newestFirst) {
        const copyId = copyIds.get(block.htmlBlockId);
        if (!copyId || block.pos >= tr.doc.content.size) continue;
        const node = tr.doc.nodeAt(block.pos);
        if (
          node?.type.name !== "htmlBlock" ||
          node.attrs.htmlBlockId !== block.htmlBlockId
        ) {
          continue;
        }
        tr.setNodeMarkup(block.pos, undefined, {
          ...node.attrs,
          htmlBlockId: copyId,
        });
      }
      return true;
    })
    .run();
}
