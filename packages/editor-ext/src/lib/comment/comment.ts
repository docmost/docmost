import { Mark, mergeAttributes } from "@tiptap/core";
import { commentDecoration } from "./comment-decoration";

export interface ICommentOptions {
  HTMLAttributes: Record<string, any>;
}

export interface ICommentStorage {
  activeCommentId: string | null;
}

export const commentMarkClass = "comment-mark";
export const commentDecorationMetaKey = "decorateComment";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      setCommentDecoration: () => ReturnType;
      unsetCommentDecoration: () => ReturnType;
      setComment: (commentId: string) => ReturnType;
      unsetComment: (commentId: string) => ReturnType;
    };
  }
}

export const Comment = Mark.create<ICommentOptions, ICommentStorage>({
  name: "comment",
  exitable: true,
  inclusive: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addStorage() {
    return {
      activeCommentId: null,
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-id"),
        renderHTML: (attributes) => {
          if (!attributes.commentId) return;

          return {
            "data-comment-id": attributes.commentId,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-comment-id]",
        getAttrs: (el) =>
          !!(el as HTMLSpanElement).getAttribute("data-comment-id")?.trim() &&
          null,
      },
    ];
  },

  addCommands() {
    return {
      setCommentDecoration:
        () =>
        ({ tr, dispatch }) => {
          tr.setMeta(commentDecorationMetaKey, true);
          if (dispatch) dispatch(tr);
          return true;
        },
      unsetCommentDecoration:
        () =>
        ({ tr, dispatch }) => {
          tr.setMeta(commentDecorationMetaKey, false);
          if (dispatch) dispatch(tr);
          return true;
        },
      setComment:
        (commentId) =>
        ({ commands }) => {
          if (!commentId) return false;
          return commands.setMark(this.name, { commentId });
        },
      unsetComment:
        (commentId) =>
        ({ tr, dispatch }) => {
          if (!commentId) return false;

          tr.doc.descendants((node, pos) => {
            const from = pos;
            const to = pos + node.nodeSize;

            const commentMark = node.marks.find(
              (mark) =>
                mark.type.name === this.name &&
                mark.attrs.commentId === commentId,
            );

            if (commentMark) {
              tr = tr.removeMark(from, to, commentMark);
            }
          });

          return dispatch?.(tr);
        },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const commentId = HTMLAttributes?.["data-comment-id"] || null;

    if (typeof window === "undefined" || typeof document === "undefined") {
      return [
        "span",
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          class: 'comment-mark',
          "data-comment-id": commentId,
        }),
        0,
      ];
    }

    const elem = document.createElement("span");

    Object.entries(
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
    ).forEach(([attr, val]) => elem.setAttribute(attr, val));

    elem.addEventListener("click", (e) => {
      const selection = document.getSelection();
      if (selection.type === "Range") return;

      this.storage.activeCommentId = commentId;
      const commentEventClick = new CustomEvent("ACTIVE_COMMENT_EVENT", {
        bubbles: true,
        detail: { commentId },
      });

      elem.dispatchEvent(commentEventClick);
    });

    return elem;
  },

  // @ts-ignore
  addProseMirrorPlugins(): Plugin[] {
    // @ts-ignore
    return [commentDecoration()];
  },
});
