import {
  activeTemplatePlaceholder as activeHint,
  type HintSide,
  hintMarks,
  TemplatePlaceholder as PlaceholderNode,
  withoutTemplatePlaceholders,
} from "@docmost/editor-ext";
import { isChangeOrigin } from "@tiptap/extension-collaboration";
import { closeHistory, isHistoryTransaction } from "@tiptap/pm/history";
import { type NodeType, type ResolvedPos, Slice } from "@tiptap/pm/model";
import {
  AllSelection,
  NodeSelection,
  Plugin,
  type Selection,
  TextSelection,
} from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    templatePlaceholder: {
      editTemplatePlaceholder: () => ReturnType;
    };
  }
}

type PlaceholderRange = { from: number; to: number; hint: string };

function lineHintSide($pos: ResolvedPos, type: NodeType): HintSide | null {
  const { nodeBefore, nodeAfter } = $pos;
  if (
    nodeAfter?.type === type &&
    (!nodeBefore || nodeBefore.type.name === "hardBreak")
  )
    return "nodeAfter";
  if (
    nodeBefore?.type === type &&
    (!nodeAfter || nodeAfter.type.name === "hardBreak")
  )
    return "nodeBefore";
  return null;
}

function getPlaceholderTextRanges(selection: Selection, type: NodeType) {
  const runs: PlaceholderRange[] = [];
  const { from, to, $from } = selection;
  $from.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) {
      return (
        node.type.name !== "tabLabel" &&
        !node.isAtom &&
        (!node.inlineContent || !!node.type.contentMatch.matchType(type))
      );
    }
    const start = Math.max(pos, from);
    const text = node.text.slice(
      start - pos,
      Math.min(to - pos, node.nodeSize),
    );
    for (const match of text.matchAll(/[^\r\n]+/g)) {
      const from = start + match.index;
      const hint = match[0];
      const previous = runs.at(-1);
      // Adjacent text nodes can have different marks. A hard break, inline
      // atom, or block boundary leaves a gap between their positions.
      if (previous?.to === from) {
        previous.hint += hint;
        previous.to += hint.length;
      } else {
        runs.push({ from, to: from + hint.length, hint });
      }
    }
  });

  // Leave whitespace around the words in the document, including the space
  // some browsers add to a double-click selection.
  const ranges: PlaceholderRange[] = [];
  for (const run of runs) {
    const hint = run.hint.trim();
    if (!hint) continue;
    const from = run.from + run.hint.indexOf(hint);
    ranges.push({ from, to: from + hint.length, hint });
  }
  return ranges;
}

export const TemplatePlaceholder = PlaceholderNode.extend<{
  onEdit: (() => void) | null;
}>({
  addOptions() {
    return { onEdit: null };
  },

  selectable() {
    return Boolean(this.options.onEdit);
  },

  parseHTML() {
    if (!this.options.onEdit) return [];
    return [
      {
        tag: "span[data-template-placeholder]",
        getAttrs: (el) => {
          const hint = el.getAttribute("data-template-placeholder");
          return hint?.trim() ? { hint } : false;
        },
      },
    ];
  },

  renderHTML({ node }) {
    if (this.options.onEdit) {
      return ["span", { "data-template-placeholder": node.attrs.hint }];
    }
    return ["span"];
  },

  addNodeView() {
    const { onEdit } = this.options;
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("span");
      dom.className = "template-placeholder";
      dom.setAttribute("role", "note");
      dom.setAttribute("aria-label", node.attrs.hint);
      if (onEdit) {
        dom.onclick = () => {
          const pos = getPos();
          if (pos === undefined || !editor.isEditable) return;
          editor.commands.setNodeSelection(pos);
          onEdit();
        };
      }
      return { dom };
    };
  },

  addCommands() {
    return {
      editTemplatePlaceholder:
        () =>
        ({ editor, tr, dispatch }) => {
          const { onEdit } = this.options;
          if (!onEdit || !editor.isEditable) return false;
          const { selection } = tr;
          if (
            !selection.empty &&
            (selection instanceof TextSelection ||
              selection instanceof AllSelection)
          ) {
            const ranges = getPlaceholderTextRanges(selection, this.type);
            if (!ranges.length) return false;
            if (!dispatch) return true;

            // Replace only the selected text, working backwards so list
            // items, paragraphs, breaks, and unselected text stay in place.
            closeHistory(tr);
            const firstStep = tr.steps.length;
            const end = ranges[ranges.length - 1].to;
            for (const { from, to, hint } of ranges.reverse()) {
              const marks = tr.doc.resolve(from).nodeAfter.marks;
              tr.replaceWith(from, to, this.type.create({ hint }, null, marks));
            }
            const caret = tr.mapping.slice(firstStep).map(end);
            tr.setSelection(TextSelection.create(tr.doc, caret));
            return true;
          }

          const { $from } = selection;
          if (
            (selection instanceof NodeSelection &&
              selection.node.type !== this.type) ||
            $from.parent.type.name === "tabLabel" ||
            !$from.parent.canReplaceWith(
              $from.index(),
              $from.index(),
              this.type,
            )
          ) {
            return false;
          }
          if (dispatch) onEdit();
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    if (!this.options.onEdit) return {};
    return {
      Enter: () => {
        const selection = this.editor.state.selection;
        return (
          selection instanceof NodeSelection &&
          selection.node.type === this.type &&
          this.editor.commands.editTemplatePlaceholder()
        );
      },
    };
  },

  addProseMirrorPlugins() {
    if (this.options.onEdit) return [];
    const { editor, type } = this;
    return [
      new Plugin<HintSide | null>({
        key: activeHint,
        state: {
          init: () => null,
          apply(tr, side, oldState) {
            const target = tr.getMeta(activeHint);
            if (target) return target;
            if (!side || !tr.selection.empty || tr.getMeta("pointer"))
              return null;
            return tr.selection.$from[side] === oldState.selection.$from[side]
              ? side
              : null;
          },
        },
        props: {
          handleTextInput(view, from, to, text, insert) {
            // Chrome can type on the next visual line before its native
            // selectionchange reaches ProseMirror. The input range is current.
            const { selection } = view.state;
            if (
              !editor.isEditable ||
              !text ||
              from !== to ||
              (selection.empty && from === selection.from)
            )
              return false;
            const $pos = view.state.doc.resolve(from);
            const side = lineHintSide($pos, type);
            if (!side) return false;
            const hint = $pos[side];
            const tr = insert();
            const start = side === "nodeAfter" ? from : from - hint.nodeSize;
            tr.replaceWith(
              start,
              start + text.length + hint.nodeSize,
              type.schema.text(text, hintMarks(view.state.doc, start)),
            );
            tr.setSelection(TextSelection.create(tr.doc, start + text.length));
            view.dispatch(tr);
            return true;
          },
          transformCopied(slice) {
            const content = withoutTemplatePlaceholders(slice.content);
            return content === slice.content
              ? slice
              : new Slice(content, slice.openStart, slice.openEnd);
          },
          handleClickOn(view, _pos, node, nodePos, event, direct) {
            if (
              !direct ||
              node.type !== type ||
              !editor.isEditable ||
              event.shiftKey ||
              event.metaKey ||
              event.ctrlKey ||
              event.altKey
            ) {
              return false;
            }
            const tr = view.state.tr
              .setSelection(TextSelection.create(view.state.doc, nodePos))
              .setStoredMarks(hintMarks(view.state.doc, nodePos))
              .setMeta(activeHint, "nodeAfter")
              .setMeta("pointer", true);
            view.dispatch(tr);
            view.focus();
            return true;
          },
        },
        appendTransaction(transactions, oldState, newState) {
          const selection = oldState.selection;
          if (
            !editor.isEditable ||
            !(selection instanceof TextSelection) ||
            !selection.$cursor
          ) {
            return null;
          }
          const { $cursor } = selection;
          if (!transactions.some((tr) => tr.docChanged)) {
            // Moving the caret across a hint targets it for typing from
            // either side, without selecting the node or hiding the caret.
            const next = newState.selection;
            const distance = next.from - $cursor.pos;
            if (
              !next.empty ||
              !distance ||
              transactions.some((tr) => tr.getMeta("pointer"))
            ) {
              return null;
            }
            const crossed: HintSide = distance > 0 ? "nodeBefore" : "nodeAfter";
            const side =
              Math.abs(distance) === 1 && next.$from[crossed]?.type === type
                ? crossed
                : lineHintSide(next.$from, type);
            if (!side) return null;
            const hintPos =
              side === "nodeAfter"
                ? next.from
                : next.from - next.$from.nodeBefore.nodeSize;
            return newState.tr
              .setStoredMarks(hintMarks(newState.doc, hintPos))
              .setMeta(activeHint, side);
          }

          const side =
            activeHint.getState(oldState) ?? lineHintSide($cursor, type);
          if (!side) return null;
          const hint = $cursor[side];
          if (hint?.type !== type) return null;
          if (
            transactions.some(
              (tr) => isChangeOrigin(tr) || isHistoryTransaction(tr),
            )
          ) {
            return null;
          }

          // Map both sides of the original caret to isolate what was inserted.
          let from = $cursor.pos;
          let to = $cursor.pos;
          for (const tr of transactions) {
            from = tr.mapping.map(from, -1);
            to = tr.mapping.map(to, 1);
          }
          const pos = side === "nodeAfter" ? to : from - hint.nodeSize;
          if (
            from >= to ||
            pos < 0 ||
            newState.doc.nodeAt(pos) !== hint ||
            !newState.doc.textBetween(from, to, "", (node) =>
              node.type === type || node.type.name === "hardBreak" ? "" : " ",
            )
          ) {
            return null;
          }
          return newState.tr.delete(pos, pos + hint.nodeSize);
        },
      }),
    ];
  },
});
