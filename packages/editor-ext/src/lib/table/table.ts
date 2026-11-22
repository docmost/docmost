import { Table } from "@tiptap/extension-table";
import type { Command, Editor } from "@tiptap/core";
import { DOMOutputSpec } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { cellAround, columnResizing, goToNextCell } from "@tiptap/pm/tables";
import { closestListItem } from "../list-item";
import { handleCellEdgeArrow } from "./utils/cell-edge-arrow";
import {
  getPreferredTableWidth,
  getTableColumnWidths,
} from "./utils/column-widths";
import { activeTemplatePlaceholder, hintMarks } from "../template-placeholder";

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
    const moved = goToNextCell(direction)(state, dispatch);
    const type = state.schema.nodes.templatePlaceholder;
    if (!moved || !dispatch || type?.spec.selectable !== false) return moved;

    // Tab targets the first remaining instruction. A cell can also contain
    // labels, answers, or other paragraphs that must survive the first keystroke.
    const { from, to } = tr.selection;
    let firstHint: number | undefined;
    tr.doc.nodesBetween(from, to, (node, pos) => {
      if (firstHint !== undefined) return false;
      if (node.type === type) firstHint = pos;
      return !node.isAtom;
    });
    if (firstHint !== undefined) {
      const $hint = tr.doc.resolve(firstHint);
      tr.setSelection(new TextSelection($hint))
        .setStoredMarks(hintMarks(tr.doc, firstHint))
        .setMeta(activeTemplatePlaceholder, "nodeAfter");
    }
    return true;
  };
}

export const CustomTable = Table.extend({

  addProseMirrorPlugins() {
    const plugins = this.parent?.() ?? [];
    // Collaborative editors can mount read-only until the document has synced.
    if (this.options.resizable && !this.editor.isEditable) {
      plugins.unshift(
        columnResizing({
          handleWidth: this.options.handleWidth,
          cellMinWidth: this.options.cellMinWidth,
          defaultCellMinWidth: this.options.cellMinWidth,
          lastColumnResizable: this.options.lastColumnResizable,
          View: null,
        }),
      );
    }
    return plugins;
  },

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
    const preferredWidth = getPreferredTableWidth(getTableColumnWidths(node));
    const wrapper: DOMOutputSpec = [
      "div",
      {
        class: "tableWrapper",
        ...(preferredWidth && { style: `--table-preferred-width: ${preferredWidth}` }),
      },
      originalRender,
    ];
    return wrapper;
  },
});
