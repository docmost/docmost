import { getMarkRange, type Editor } from "@tiptap/core";
import type { Fragment } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import { getBlockPlacement } from "@/features/editor/utils/block-placement";

export type LinkDisplay = "card" | "mention" | "url";

export type LinkDisplayNodes = {
  card: string;
  mention: string;
  toLinkAttrs: (attrs: Record<string, unknown>) => Record<string, unknown>;
};

export type LinkDisplayNodeSource = {
  kind: "node";
  pos: number;
  // Set when a paste split a paragraph around the node.
  joinBefore?: boolean;
  joinAfter?: boolean;
};

export type LinkDisplayLinkSource = {
  kind: "link";
  from: number;
  to: number;
  url: string;
  // The new node's attrs.
  attrs: Record<string, unknown>;
};

export type LinkDisplaySource = LinkDisplayNodeSource | LinkDisplayLinkSource;

export function getSelectedLinkDisplay(
  editor: Editor,
  nodes: LinkDisplayNodes,
): {
  current: Exclude<LinkDisplay, "url">;
  source: LinkDisplayNodeSource;
  url: string;
} | null {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) return null;

  const current =
    selection.node.type.name === nodes.card
      ? "card"
      : selection.node.type.name === nodes.mention
        ? "mention"
        : null;

  if (!current || typeof selection.node.attrs.url !== "string") return null;

  return {
    current,
    source: { kind: "node", pos: selection.from },
    url: selection.node.attrs.url,
  };
}

function getCardPlacement(
  editor: Editor,
  nodes: LinkDisplayNodes,
  from: number,
  to: number,
  attrs: Record<string, unknown>,
):
  | {
      canPlace: true;
      range: { from: number; to: number };
      content: Fragment;
    }
  | {
      canPlace: false;
      range: null;
      content: null;
    } {
  const cardType = editor.state.schema.nodes[nodes.card];
  const placement = cardType
    ? getBlockPlacement(editor.state.doc, from, to, cardType.create(attrs))
    : null;
  return placement
    ? { canPlace: true, ...placement }
    : { canPlace: false, range: null, content: null };
}

function replaceWithCard(
  editor: Editor,
  placement: Extract<ReturnType<typeof getCardPlacement>, { canPlace: true }>,
): boolean {
  return editor.commands.command(({ tr }) => {
    tr.replaceWith(placement.range.from, placement.range.to, placement.content);
    return true;
  });
}

export function getLinkDisplayCardAvailability(
  editor: Editor,
  source: LinkDisplaySource,
  nodes: LinkDisplayNodes,
): { canUseCard: boolean } {
  if (source.kind === "link") {
    const placement = getCardPlacement(
      editor,
      nodes,
      source.from,
      source.to,
      source.attrs,
    );
    return { canUseCard: placement.canPlace };
  }

  const node = editor.state.doc.nodeAt(source.pos);
  if (node?.type.name === nodes.card) {
    return { canUseCard: true };
  }
  if (node?.type.name !== nodes.mention) {
    return { canUseCard: false };
  }

  const placement = getCardPlacement(
    editor,
    nodes,
    source.pos,
    source.pos + node.nodeSize,
    { ...node.attrs },
  );
  return { canUseCard: placement.canPlace };
}

export function canPlaceLinkDisplayCard(
  editor: Editor,
  pos: number,
  nodes: LinkDisplayNodes,
): boolean {
  return getCardPlacement(editor, nodes, pos, pos, {}).canPlace;
}

// The link mark with the source's href still spans exactly from..to.
export function isCurrentLinkSource(
  editor: Editor,
  source: LinkDisplayLinkSource,
): boolean {
  const linkType = editor.state.schema.marks.link;
  const range = linkType
    ? getMarkRange(editor.state.doc.resolve(source.from), linkType, {
        href: source.url,
      })
    : null;
  return Boolean(range && range.from === source.from && range.to === source.to);
}

export function convertLinkDisplay(
  editor: Editor,
  source: LinkDisplaySource,
  target: LinkDisplay,
  nodes: LinkDisplayNodes,
): boolean {
  if (source.kind === "link") {
    if (!isCurrentLinkSource(editor, source)) return false;

    if (target === "card") {
      const paragraphRange = getCardPlacement(
        editor,
        nodes,
        source.from,
        source.to,
        source.attrs,
      );
      if (!paragraphRange.canPlace) return false;
      return replaceWithCard(editor, paragraphRange);
    }

    if (target !== "mention") return false;
    return editor.commands.insertContentAt(
      { from: source.from, to: source.to },
      {
        type: nodes.mention,
        attrs: source.attrs,
      },
    );
  }

  const node = editor.state.doc.nodeAt(source.pos);
  if (!node) return false;

  if (node.type.name === nodes.mention && target === "card") {
    const paragraphRange = getCardPlacement(
      editor,
      nodes,
      source.pos,
      source.pos + node.nodeSize,
      { ...node.attrs },
    );
    if (!paragraphRange.canPlace) return false;
    return replaceWithCard(editor, paragraphRange);
  }

  if (node.type.name === nodes.mention && target === "url") {
    return editor.commands.insertContentAt(
      { from: source.pos, to: source.pos + node.nodeSize },
      {
        type: "text",
        text: node.attrs.url,
        marks: [
          {
            type: "link",
            attrs: nodes.toLinkAttrs(node.attrs),
          },
        ],
      },
    );
  }

  if (node.type.name !== nodes.card) return false;

  const $card = editor.state.doc.resolve(source.pos);
  const before = source.joinBefore ? $card.nodeBefore : null;
  const after = source.joinAfter
    ? $card.parent.maybeChild($card.index() + 1)
    : null;
  const joinBefore = before?.type.name === "paragraph";
  const joinAfter = after?.type.name === "paragraph";
  const spaceFollows = joinAfter && /^\s/.test(after?.textContent ?? "");

  const content =
    target === "mention"
      ? [
          { type: nodes.mention, attrs: { ...node.attrs } },
          ...(spaceFollows ? [] : [{ type: "text", text: " " }]),
        ]
      : target === "url"
        ? [
            {
              type: "text",
              text: node.attrs.url,
              marks: [
                {
                  type: "link",
                  attrs: nodes.toLinkAttrs(node.attrs),
                },
              ],
            },
          ]
        : null;

  if (!content) return false;

  return editor
    .chain()
    .insertContentAt(
      { from: source.pos, to: source.pos + node.nodeSize },
      {
        type: "paragraph",
        attrs: (joinBefore ? before : joinAfter ? after : null)?.attrs,
        content,
      },
    )
    .command(({ tr }) => {
      const paragraph = tr.doc.nodeAt(source.pos);
      if (paragraph?.type.name !== "paragraph") return false;
      if (joinAfter) tr.join(source.pos + paragraph.nodeSize);
      if (joinBefore) tr.join(source.pos);
      return true;
    })
    .run();
}
