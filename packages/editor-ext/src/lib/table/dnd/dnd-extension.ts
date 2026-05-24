import { Editor, Extension } from "@tiptap/core";
import { PluginKey, Plugin, PluginSpec, TextSelection, Transaction } from "@tiptap/pm/state";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { EditorProps, EditorView } from "@tiptap/pm/view";
import { columnResizingPluginKey } from "@tiptap/pm/tables";
import { cellAround } from "@tiptap/pm/tables";
import {
  cellInfoFromResolvedCell,
  DraggingDOMs,
  getDndRelatedDOMs,
  getHoveringCell,
  HoveringCellInfo,
} from "./utils";
import { getDragOverColumn, getDragOverRow } from "./calc-drag-over";
import { findTable } from "../utils/query";
import { moveColumn, moveRow } from "../utils";
import { PreviewController } from "./preview/preview-controller";
import { DropIndicatorController } from "./preview/drop-indicator-controller";

export interface TableHandleState {
  hoveringCell: HoveringCellInfo | null;
  tableNode: ProseMirrorNode | null;
  tablePos: number | null;
  dragging: { orientation: "col" | "row"; index: number } | null;
  frozen: boolean;
}

const INITIAL_STATE: TableHandleState = {
  hoveringCell: null,
  tableNode: null,
  tablePos: null,
  dragging: null,
  frozen: false,
};

export const TableDndKey = new PluginKey<TableHandleState>("table-handles");

class TableHandlePluginSpec implements PluginSpec<TableHandleState> {
  key = TableDndKey;
  props: EditorProps<Plugin<TableHandleState>>;

  private _previewController: PreviewController;
  private _dropIndicatorController: DropIndicatorController;

  private _hoveringCell?: HoveringCellInfo;
  private _disposables: (() => void)[] = [];
  private _draggingDirection: "col" | "row" = "col";
  private _draggingIndex = -1;
  private _droppingIndex = -1;
  private _draggingDOMs?: DraggingDOMs;
  private _startCoords = { x: 0, y: 0 };
  private _dragging = false;

  state = {
    init: (): TableHandleState => INITIAL_STATE,
    apply: (tr: Transaction, prev: TableHandleState): TableHandleState => {
      const meta = tr.getMeta(TableDndKey) as Partial<TableHandleState> | null;
      if (!meta) return prev;
      let changed = false;
      for (const key in meta) {
        if (!Object.is(prev[key as keyof TableHandleState], meta[key as keyof TableHandleState])) {
          changed = true;
          break;
        }
      }
      return changed ? { ...prev, ...meta } : prev;
    },
  };

  constructor(public editor: Editor) {
    this.props = {
      handleDOMEvents: {
        pointermove: this._pointerMove,
        // Force-unfreeze on any pointerdown that lands on the editor.
        // Mantine's `Menu.onClose` doesn't always fire on outside click
        // (the dropdown vanishes visually but the callback is skipped),
        // which would otherwise leave `frozen=true` permanently.
        pointerdown: this._pointerDown,
      },
    };

    this._previewController = new PreviewController();
    this._dropIndicatorController = new DropIndicatorController();
  }

  view = () => {
    const wrapper = this.editor.options.element;
    // @ts-ignore
    wrapper.appendChild(this._previewController.previewRoot);
    // @ts-ignore
    wrapper.appendChild(this._dropIndicatorController.dropIndicatorRoot);

    // Track the cursor cell so handles follow keyboard nav and clicks too.
    this.editor.on("selectionUpdate", this._onSelectionUpdate);
    this._disposables.push(() =>
      this.editor.off("selectionUpdate", this._onSelectionUpdate),
    );

    return {
      destroy: this.destroy,
    };
  };

  destroy = () => {
    this._previewController.destroy();
    this._dropIndicatorController.destroy();
    this._disposables.forEach((d) => d());
  };

  private _pointerDown = (view: EditorView, _event: PointerEvent): boolean => {
    const current = TableDndKey.getState(view.state);
    if (current?.frozen) this.editor.commands.unfreezeHandles();
    return false;
  };

  private _pointerMove = (view: EditorView, event: PointerEvent) => {
    const current = TableDndKey.getState(view.state);
    if (current?.frozen || current?.dragging) return;

    const resizeState = columnResizingPluginKey.getState(view.state);
    if (resizeState?.dragging) return;

    if (!this.editor.isEditable) {
      if (current?.hoveringCell == null && current?.tableNode == null && current?.tablePos == null) return;
      this._dispatchMeta({ hoveringCell: null, tableNode: null, tablePos: null });
      return;
    }

    const hoveringCell = getHoveringCell(view, event);
    if (hoveringCell) {
      if (current?.hoveringCell?.cellPos === hoveringCell.cellPos) return;
      this._hoveringCell = hoveringCell;
      const $cell = view.state.doc.resolve(hoveringCell.cellPos);
      const tableInfo = findTable($cell);
      this._dispatchMeta({
        hoveringCell,
        tableNode: tableInfo?.node ?? null,
        tablePos: tableInfo?.pos ?? null,
      });
      return;
    }

    // Pointer isn't over a cell but may be transiting toward a handle that
    // floats outside the cell — fall back to the selection's cell so the
    // handles stay visible.
    const $cellPos = cellAround(view.state.selection.$head);
    if ($cellPos) {
      const cellInfo = cellInfoFromResolvedCell($cellPos);
      if (current?.hoveringCell?.cellPos === cellInfo.cellPos) return;
      this._hoveringCell = cellInfo;
      const tableInfo = findTable($cellPos);
      this._dispatchMeta({
        hoveringCell: cellInfo,
        tableNode: tableInfo?.node ?? null,
        tablePos: tableInfo?.pos ?? null,
      });
      return;
    }

    this._hoveringCell = undefined;
    if (current?.hoveringCell == null && current?.tableNode == null && current?.tablePos == null) return;
    this._dispatchMeta({ hoveringCell: null, tableNode: null, tablePos: null });
  };

  private _onSelectionUpdate = () => {
    if (!this.editor.isEditable) return;

    const current = TableDndKey.getState(this.editor.state);
    if (current?.frozen || current?.dragging) return;

    const $cellPos = cellAround(this.editor.state.selection.$head);
    if (!$cellPos) return;

    const cellInfo = cellInfoFromResolvedCell($cellPos);
    if (current?.hoveringCell?.cellPos === cellInfo.cellPos) return;

    this._hoveringCell = cellInfo;
    const tableInfo = findTable($cellPos);
    this._dispatchMeta({
      hoveringCell: cellInfo,
      tableNode: tableInfo?.node ?? null,
      tablePos: tableInfo?.pos ?? null,
    });
  };

  private _dispatchMeta = (patch: Partial<TableHandleState>) => {
    const tr = this.editor.state.tr.setMeta(TableDndKey, patch);
    tr.setMeta("addToHistory", false);
    this.editor.view.dispatch(tr);
  };

  // ---- Public API for the React handle layer ----

  // Returns true if the drag was set up successfully.
  startDragFromHandle = (
    orientation: "col" | "row",
    clientX: number,
    clientY: number,
  ): boolean => {
    if (!this._hoveringCell) return false;
    this._dragging = true;
    this._draggingDirection = orientation;
    this._startCoords = { x: clientX, y: clientY };

    const draggingIndex =
      (orientation === "col"
        ? this._hoveringCell.colIndex
        : this._hoveringCell.rowIndex) ?? 0;
    this._draggingIndex = draggingIndex;

    const relatedDoms = getDndRelatedDOMs(
      this.editor.view,
      this._hoveringCell.cellPos,
      draggingIndex,
      orientation,
    );
    if (!relatedDoms) {
      this._dragging = false;
      return false;
    }
    this._draggingDOMs = relatedDoms;

    this._previewController.onDragStart(relatedDoms, draggingIndex, orientation);
    this._dropIndicatorController.onDragStart(relatedDoms, orientation);

    // Park the selection inside the dragged cell unless it's already in the
    // same table. PM auto-maps `selection.from` through concurrent remote
    // transactions, so commitDrop can resolve the table even if the doc
    // shifted mid-drag — same trick the pre-pragmatic-dnd implementation
    // relied on.
    const state = this.editor.state;
    const currentTable = findTable(state.selection.$from);
    const hoverTable = (() => {
      try {
        return findTable(state.doc.resolve(this._hoveringCell.cellPos));
      } catch {
        return undefined;
      }
    })();
    const tr = state.tr;
    if (
      hoverTable &&
      (!currentTable || currentTable.pos !== hoverTable.pos)
    ) {
      try {
        const $inside = state.doc.resolve(this._hoveringCell.cellPos + 1);
        tr.setSelection(TextSelection.near($inside, 1));
      } catch {}
    }
    tr.setMeta(TableDndKey, {
      dragging: { orientation, index: draggingIndex },
    });
    tr.setMeta("addToHistory", false);
    this.editor.view.dispatch(tr);
    return true;
  };

  updateDragPosition = (clientX: number, clientY: number) => {
    const draggingDOMs = this._draggingDOMs;
    if (!draggingDOMs || !this._dragging) return;

    if (this._draggingDirection === "col") {
      this._previewController.onDragging(
        draggingDOMs,
        clientX,
        clientY,
        "col",
      );
      const direction = this._startCoords.x > clientX ? "left" : "right";
      const dragOverColumn = getDragOverColumn(draggingDOMs.table, clientX);
      if (!dragOverColumn) return;
      const [col, index] = dragOverColumn;
      this._droppingIndex = index;
      this._dropIndicatorController.onDragging(col, direction, "col");
      return;
    }

    this._previewController.onDragging(draggingDOMs, clientX, clientY, "row");
    const direction = this._startCoords.y > clientY ? "up" : "down";
    const dragOverRow = getDragOverRow(draggingDOMs.table, clientY);
    if (!dragOverRow) return;
    const [row, index] = dragOverRow;
    this._droppingIndex = index;
    this._dropIndicatorController.onDragging(row, direction, "row");
  };

  commitDrop = () => {
    if (!this._dragging) return;
    const direction = this._draggingDirection;
    const from = this._draggingIndex;
    const to = this._droppingIndex;

    if (from < 0 || to < 0 || from === to) return;

    // Use the live (auto-mapped) selection as the table anchor — PM has
    // already mapped it through any concurrent remote transactions, so
    // it's safe to resolve even if the doc shifted mid-drag.
    const tr = this.editor.state.tr;
    const pos = this.editor.state.selection.from;

    if (direction === "col") {
      if (moveColumn({ tr, originIndex: from, targetIndex: to, select: true, pos })) {
        this.editor.view.dispatch(tr);
      }
      return;
    }
    if (moveRow({ tr, originIndex: from, targetIndex: to, select: true, pos })) {
      this.editor.view.dispatch(tr);
    }
  };

  endDrag = () => {
    this._dragging = false;
    this._draggingIndex = -1;
    this._droppingIndex = -1;
    this._startCoords = { x: 0, y: 0 };
    this._draggingDOMs = undefined;
    this._dropIndicatorController.onDragEnd();
    this._previewController.onDragEnd();
    this._dispatchMeta({ dragging: null });
  };
}

export type { TableHandlePluginSpec };

// Resolve via plugin key, not a module singleton — survives StrictMode / HMR.
export function getTableHandlePluginSpec(
  editor: Editor,
): TableHandlePluginSpec | null {
  const plugin = TableDndKey.get(editor.state);
  if (!plugin) return null;
  return plugin.spec as unknown as TableHandlePluginSpec;
}

export const TableDndExtension = Extension.create({
  name: "table-drag-and-drop",
  addProseMirrorPlugins() {
    const editor = this.editor;
    const spec = new TableHandlePluginSpec(editor);
    return [new Plugin(spec)];
  },
});

export const TableHandleCommandsExtension = Extension.create({
  name: "table-handle-commands",
  addCommands() {
    return {
      freezeHandles:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(TableDndKey, { frozen: true });
            tr.setMeta("addToHistory", false);
          }
          return true;
        },
      unfreezeHandles:
        () =>
        ({ tr, state, dispatch }) => {
          if (dispatch) {
            // Re-sync `hoveringCell` to the cursor's cell as we unfreeze:
            // `selectionUpdate` was gated while frozen, so the stored
            // hoveringCell may be stale.
            const patch: Partial<TableHandleState> = { frozen: false };
            const $cellPos = cellAround(state.selection.$head);
            if ($cellPos) {
              const cellInfo = cellInfoFromResolvedCell($cellPos);
              const tableInfo = findTable($cellPos);
              patch.hoveringCell = cellInfo;
              patch.tableNode = tableInfo?.node ?? null;
              patch.tablePos = tableInfo?.pos ?? null;
            } else {
              patch.hoveringCell = null;
              patch.tableNode = null;
              patch.tablePos = null;
            }
            tr.setMeta(TableDndKey, patch);
            tr.setMeta("addToHistory", false);
          }
          return true;
        },
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tableHandleCommands: {
      freezeHandles: () => ReturnType;
      unfreezeHandles: () => ReturnType;
    };
  }
}
