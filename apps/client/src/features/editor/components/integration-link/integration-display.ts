import { getMarkRange, type Editor } from "@tiptap/core";
import type { Fragment } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import { getBlockPlacement } from "@/features/editor/utils/block-placement";

export type IntegrationDisplay = "card" | "mention" | "url";

export type IntegrationCardAvailability = { canUseCard: boolean };

export type IntegrationDisplaySource =
  | {
      kind: "node";
      pos: number;
      // Set when a paste split a paragraph around the node.
      joinBefore?: boolean;
      joinAfter?: boolean;
    }
  | {
      kind: "link";
      from: number;
      to: number;
      url: string;
      provider: string;
    };

export type SelectedIntegrationDisplay = {
  current: Exclude<IntegrationDisplay, "url">;
  source: Extract<IntegrationDisplaySource, { kind: "node" }>;
  url: string;
};

export function getSelectedIntegrationDisplay(
  editor: Editor,
): SelectedIntegrationDisplay | null {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) return null;

  const current =
    selection.node.type.name === "integrationCard"
      ? "card"
      : selection.node.type.name === "integrationMention"
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
  const cardType = editor.state.schema.nodes.integrationCard;
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

export function getIntegrationCardAvailability(
  editor: Editor,
  source: IntegrationDisplaySource,
): IntegrationCardAvailability {
  if (source.kind === "link") {
    const placement = getCardPlacement(editor, source.from, source.to, {
      url: source.url,
      provider: source.provider,
    });
    return { canUseCard: placement.canPlace };
  }

  const node = editor.state.doc.nodeAt(source.pos);
  if (node?.type.name === "integrationCard") {
    return { canUseCard: true };
  }
  if (node?.type.name !== "integrationMention") {
    return { canUseCard: false };
  }

  const placement = getCardPlacement(
    editor,
    source.pos,
    source.pos + node.nodeSize,
    { ...node.attrs },
  );
  return { canUseCard: placement.canPlace };
}

export function canPlaceIntegrationCard(editor: Editor, pos: number): boolean {
  return getCardPlacement(editor, pos, pos, {}).canPlace;
}

export function convertIntegrationDisplay(
  editor: Editor,
  source: IntegrationDisplaySource,
  target: IntegrationDisplay,
): boolean {
  if (source.kind === "link") {
    const linkType = editor.state.schema.marks.link;
    const sourceRange = linkType
      ? getMarkRange(editor.state.doc.resolve(source.from), linkType, {
          href: source.url,
        })
      : null;
    if (
      !sourceRange ||
      sourceRange.from !== source.from ||
      sourceRange.to !== source.to
    ) {
      return false;
    }

    if (target === "card") {
      const paragraphRange = getCardPlacement(editor, source.from, source.to, {
        url: source.url,
        provider: source.provider,
      });
      if (!paragraphRange.canPlace) return false;
      return replaceWithCard(editor, paragraphRange);
    }

    if (target !== "mention") return false;
    return editor.commands.insertContentAt(
      { from: source.from, to: source.to },
      {
        type: "integrationMention",
        attrs: { url: source.url, provider: source.provider },
      },
    );
  }

  const node = editor.state.doc.nodeAt(source.pos);
  if (!node) return false;

  if (node.type.name === "integrationMention" && target === "card") {
    const paragraphRange = getCardPlacement(
      editor,
      source.pos,
      source.pos + node.nodeSize,
      { ...node.attrs },
    );
    if (!paragraphRange.canPlace) return false;
    return replaceWithCard(editor, paragraphRange);
  }

  if (node.type.name === "integrationMention" && target === "url") {
    return editor.commands.insertContentAt(
      { from: source.pos, to: source.pos + node.nodeSize },
      {
        type: "text",
        text: node.attrs.url,
        marks: [
          {
            type: "link",
            attrs: {
              href: node.attrs.url,
              integrationProvider: node.attrs.provider,
            },
          },
        ],
      },
    );
  }

  if (node.type.name !== "integrationCard") return false;

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
          { type: "integrationMention", attrs: { ...node.attrs } },
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
                  attrs: {
                    href: node.attrs.url,
                    integrationProvider: node.attrs.provider,
                  },
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
