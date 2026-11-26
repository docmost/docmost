import type { Editor } from "@tiptap/core";
import { getEmbedUrlAndProvider, sanitizeUrl } from "@docmost/editor-ext";
import { getBlockPlacement } from "@/features/editor/utils/block-placement";
import {
  isCurrentLinkSource,
  type LinkDisplayLinkSource,
  type LinkDisplayNodes,
} from "@/features/editor/utils/link-display";

export const LINK_PREVIEW_NODES: LinkDisplayNodes = {
  card: "linkCard",
  mention: "linkMention",
  toLinkAttrs: (attrs) => ({ href: attrs.url }),
};

// A matching embed provider, else the generic iframe embed.
function getLinkEmbedPlacement(editor: Editor, source: LinkDisplayLinkSource) {
  const embedType = editor.state.schema.nodes.embed;
  if (!embedType) return null;

  const embed = embedType.create({
    src: sanitizeUrl(source.url),
    provider: getEmbedUrlAndProvider(source.url).providerId,
  });
  return getBlockPlacement(editor.state.doc, source.from, source.to, embed);
}

export function canEmbedLink(
  editor: Editor,
  source: LinkDisplayLinkSource,
): boolean {
  return getLinkEmbedPlacement(editor, source) !== null;
}

export function convertLinkToEmbed(
  editor: Editor,
  source: LinkDisplayLinkSource,
): boolean {
  if (!isCurrentLinkSource(editor, source)) return false;

  const placement = getLinkEmbedPlacement(editor, source);
  if (!placement) return false;

  return editor.commands.command(({ tr }) => {
    tr.replaceWith(placement.range.from, placement.range.to, placement.content);
    return true;
  });
}
