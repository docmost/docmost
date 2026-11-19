import { Table } from "@tiptap/extension-table";
import type { Command, Editor } from "@tiptap/core";
import { DOMOutputSpec } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { cellAround, goToNextCell } from "@tiptap/pm/tables";
import { closestListItem } from "../list-item";
import { handleCellEdgeArrow } from "./utils/cell-edge-arrow";

function handleListIndent(editor: Editor): boolean {
  const listItem = closestListItem(editor.state);
  return Boolean(listItem) && editor.commands.sinkListItem(listItem);
}

function handleListOutdent(editor: Editor): boolean {
  const listItem = closestListItem(editor.state);
  return Boolean(listItem) && editor.commands.liftListItem(listItem);
}

function navigateToCell(direction: 1 | -1): Command {
  return ({ state, dispatch, tr }) => {
    if (!goToNextCell(direction)(state, dispatch)) return false;
    const { $from, from, to } = tr.selection;
    const hint = $from.nodeAfter;
    // Table navigation selects the destination's contents. A cell containing
    // just a page prompt should open with a caret ready for the answer.
    if (
      dispatch &&
      hint?.type.name === "templatePlaceholder" &&
      !NodeSelection.isSelectable(hint) &&
      to === from + hint.nodeSize
    ) {
      tr.setSelection(TextSelection.create(tr.doc, from)).setStoredMarks(
        hint.marks,
      );
    }
    return true;
  };
}

export const CustomTable = Table.extend({

  addCommands() {
    return {
      ...this.parent?.(),
      goToNextCell: () => navigateToCell(1),
      goToPreviousCell: () => navigateToCell(-1),
    };
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      "Mod-a": () => {
        const { state, view } = this.editor;
        const { selection, doc } = state;

        const $cellPos = cellAround(selection.$anchor);
        if (!$cellPos) return false;

        const cellNode = doc.nodeAt($cellPos.pos);
        // Empty cells have nothing useful to scope to — let the default
        // Mod-a fall through and select the whole doc.
        if (!cellNode || !cellNode.textContent) return false;

        const from = $cellPos.pos + 1;
        const to = $cellPos.pos + cellNode.nodeSize - 1;
        if (from >= to) return true;

        const nextSel = TextSelection.between(
          doc.resolve(from),
          doc.resolve(to),
          1,
        );
        if (!nextSel || selection.eq(nextSel)) return true;

        view.dispatch(state.tr.setSelection(nextSel));
        return true;
      },
      Tab: () => {
        // If we're in a list within a table, handle list indentation
        if (this.editor.isActive("table")) {
          if (handleListIndent(this.editor)) {
            return true;
          }
        }

        // Otherwise, use default table navigation
        if (this.editor.commands.goToNextCell()) {
          return true;
        }

        if (!this.editor.can().addRowAfter()) {
          return false;
        }

        return this.editor.chain().addRowAfter().goToNextCell().run();
      },
      "Shift-Tab": () => {
        // If we're in a list within a table, handle list outdentation
        if (this.editor.isActive("table")) {
          if (handleListOutdent(this.editor)) {
            return true;
          }
        }

        // Otherwise, use default table navigation
        return this.editor.commands.goToPreviousCell();
      },
      ArrowUp: () => handleCellEdgeArrow(this.editor, "vert", -1),
      ArrowDown: () => handleCellEdgeArrow(this.editor, "vert", 1),
      ArrowLeft: () => handleCellEdgeArrow(this.editor, "horiz", -1),
      ArrowRight: () => handleCellEdgeArrow(this.editor, "horiz", 1),
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    // https://github.com/ueberdosis/tiptap/issues/4872#issuecomment-2717554498
    const originalRender = this.parent?.({ node, HTMLAttributes });
    const wrapper: DOMOutputSpec = [
      "div",
      { class: "tableWrapper" },
      originalRender,
    ];
    return wrapper;
  },
});
