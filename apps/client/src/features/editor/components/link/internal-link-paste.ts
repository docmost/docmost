import { EditorView } from "@tiptap/pm/view";
import { getPageById } from "@/features/page/services/page-service.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import { v7 } from "uuid";
import { extractPageSlugId } from "@/lib";

export type LinkFn = (
  url: string,
  view: EditorView,
  pos: number,
  creatorId: string,
  anchorId?: string,
) => void;

export interface InternalLinkOptions {
  validateFn: (url: string, view: EditorView) => boolean;
  onResolveLink: (linkedPageId: string, creatorId: string) => Promise<any>;
}

// Resolves an anchor id (e.g. a heading id copied via the heading link
// button) against the currently open document and returns the referenced
// node's text, if found. Used to label pasted anchor links with the heading
// text instead of the page title.
function findAnchorText(
  view: EditorView,
  anchorId: string,
): string | undefined {
  let text: string | undefined;
  view.state.doc.descendants((node) => {
    if (text === undefined && node.attrs?.id === anchorId) {
      const candidate = node.textContent?.trim();
      if (candidate) text = candidate;
    }
  });
  return text;
}

export const handleInternalLink =
  ({ validateFn, onResolveLink }: InternalLinkOptions): LinkFn =>
  async (url: string, view, pos, creatorId, anchorId) => {
    const validated = validateFn(url, view);
    if (!validated) return;

    const linkedPageId = extractPageSlugId(url);

    await onResolveLink(linkedPageId, creatorId).then(
      (page: IPage) => {
        const { schema } = view.state;

        // Anchor links pasted within the same page reference a heading in
        // the open document: show the heading text, not the page title.
        // Anchors from other pages keep the page title fallback.
        const anchorText = anchorId
          ? findAnchorText(view, anchorId)
          : undefined;

        const node = schema.nodes.mention.create({
          id: v7(),
          label: anchorText || page.title || "Untitled",
          entityType: "page",
          entityId: page.id,
          slugId: page.slugId,
          creatorId: creatorId,
          anchorId: anchorId,
        });

        if (!node) return;

        const transaction = view.state.tr.replaceWith(pos, pos, node);
        view.dispatch(transaction);
      },
      () => {
        // on failure, insert as normal link
        const { schema } = view.state;

        const transaction = view.state.tr.insertText(url, pos);
        transaction.addMark(
          pos,
          pos + url.length,
          schema.marks.link.create({ href: url }),
        );

        view.dispatch(transaction);
      },
    );
  };

export const createMentionAction = handleInternalLink({
  onResolveLink: async (linkedPageId: string): Promise<any> => {
    // eslint-disable-next-line no-useless-catch
    try {
      return await getPageById({ pageId: linkedPageId });
    } catch (err) {
      throw err;
    }
  },
  validateFn: (url: string, view: EditorView) => {
    // validation is already done on the paste handler
    return true;
  },
});
