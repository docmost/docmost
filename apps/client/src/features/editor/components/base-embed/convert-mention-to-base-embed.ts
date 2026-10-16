import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { getBlockPlacement } from "@/features/editor/utils/block-placement";

function getEmbedPlacement(doc: ProseMirrorNode, pos: number) {
  const mention = doc.nodeAt(pos);
  const baseType = doc.type.schema.nodes.base;
  if (mention?.type.name !== "mention" || !baseType) return null;

  return getBlockPlacement(
    doc,
    pos,
    pos + mention.nodeSize,
    baseType.create({ pageId: mention.attrs.entityId }),
  );
}

export function canConvertMentionToBaseEmbed(
  doc: ProseMirrorNode,
  pos: number,
): boolean {
  return getEmbedPlacement(doc, pos) !== null;
}

export function convertMentionToBaseEmbed(editor: Editor, pos: number): boolean {
  const placement = getEmbedPlacement(editor.state.doc, pos);
  if (!placement) return false;

  return editor.commands.command(({ tr }) => {
    tr.replaceWith(placement.range.from, placement.range.to, placement.content);
    return true;
  });
}
