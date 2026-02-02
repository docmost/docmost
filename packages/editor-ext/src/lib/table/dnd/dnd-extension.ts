import { Editor, Extension } from "@tiptap/core";
import { PluginKey, Plugin, PluginSpec } from "@tiptap/pm/state";
import { EditorProps, EditorView } from "@tiptap/pm/view";
import {
  DraggingDOMs,
  getDndRelatedDOMs,
  getHoveringCell,
  HoveringCellInfo,
} from "./utils";
import { getDragOverColumn, getDragOverRow } from "./calc-drag-over";
import { moveColumn, moveRow } from "../utils";
import { PreviewController } from "./preview/preview-controller";
import { DropIndicatorController } from "./preview/drop-indicator-controller";
import { DragHandleController } from "./handle/drag-handle-controller";
import { EmptyImageController } from "./handle/empty-image-controller";
import { AutoScrollController } from "./auto-scroll-controller";

export const TableDndKey = new PluginKey("table-drag-and-drop");

class TableDragHandlePluginSpec implements PluginSpec<void> {
  key = TableDndKey;
  props: EditorProps<Plugin<void>>;

  private _colDragHandle: HTMLElement;
  private _rowDragHandle: HTMLElement;
  private _hoveringCell?: HoveringCellInfo;
  private _disposables: (() => void)[] = [];
  private _draggingCoords: { x: number; y: number } = { x: 0, y: 0 };
  private _dragging = false;
  private _draggingDirection: "col" | "row" = "col";
  private _draggingIndex = -1;
  private _droppingIndex = -1;
  private _draggingDOMs?: DraggingDOMs | undefined;
  private _startCoords: { x: number; y: number } = { x: 0, y: 0 };
  private _previewController: PreviewController;
  private _dropIndicatorController: DropIndicatorController;
  private _dragHandleController: DragHandleController;
  private _emptyImageController: EmptyImageController;
  private _autoScrollController: AutoScrollController;

  constructor(public editor: Editor) {
    this.props = {
      handleDOMEvents: {
        pointerover: this._pointerOver,
      },
    };

    this._dragHandleController = new DragHandleController();
    this._colDragHandle = this._dragHandleController.colDragHandle;
    this._rowDragHandle = this._dragHandleController.rowDragHandle;

    this._previewController = new PreviewController();
    this._dropIndicatorController = new DropIndicatorController();
    this._emptyImageController = new EmptyImageController();

    this._autoScrollController = new AutoScrollController();

    this._bindDragEvents();
  }

  view = () => {
    const wrapper = this.editor.options.element;
    //@ts-ignore
    wrapper.appendChild(this._colDragHandle);
    //@ts-ignore
    wrapper.appendChild(this._rowDragHandle);
    //@ts-ignore
    wrapper.appendChild(this._previewController.previewRoot);
    //@ts-ignore
    wrapper.appendChild(this._dropIndicatorController.dropIndicatorRoot);

    return {
      update: this.update,
      destroy: this.destroy,
    };
  };

  update = () => {};

  destroy = () => {
    if (!this.editor.isDestroyed) return;
    this._dragHandleController.destroy();
    this._emptyImageController.destroy();
    this._previewController.destroy();
    this._dropIndicatorController.destroy();
    this._autoScrollController.stop();

    this._disposables.forEach((disposable) => disposable());
  };

  private _pointerOver = (view: EditorView, event: PointerEvent) => {
    if (this._dragging) return;

    // Don't show drag handles in readonly mode
    if (!this.editor.isEditable) {
      this._dragHandleController.hide();
      return;
    }

    const hoveringCell = getHoveringCell(view, event);
    this._hoveringCell = hoveringCell;
    if (!hoveringCell) {
      this._dragHandleController.hide();
    } else {
      this._dragHandleController.show(this.editor, hoveringCell);
    }
  };

  private _onDragColStart = (event: DragEvent) => {
    this._onDragStart(event, "col");
  };

  private _onDraggingCol = (event: DragEvent) => {
    const draggingDOMs = this._draggingDOMs;
    if (!draggingDOMs) return;

    this._draggingCoords = { x: event.clientX, y: event.clientY };
    this._previewController.onDragging(
      draggingDOMs,
      this._draggingCoords.x,
      this._draggingCoords.y,
      "col",
    );

    this._autoScrollController.checkXAutoScroll(event.clientX, draggingDOMs);

    const direction =
      this._startCoords.x > this._draggingCoords.x ? "left" : "right";
    const dragOverColumn = getDragOverColumn(
      draggingDOMs.table,
      this._draggingCoords.x,
    );
    if (!dragOverColumn) return;

    const [col, index] = dragOverColumn;
    this._droppingIndex = index;
    this._dropIndicatorController.onDragging(col, direction, "col");
  };

  private _onDragRowStart = (event: DragEvent) => {
    this._onDragStart(event, "row");
  };

  private _onDraggingRow = (event: DragEvent) => {
    const draggingDOMs = this._draggingDOMs;
    if (!draggingDOMs) return;

    this._draggingCoords = { x: event.clientX, y: event.clientY };
    this._previewController.onDragging(
      draggingDOMs,
      this._draggingCoords.x,
      this._draggingCoords.y,
      "row",
    );

    this._autoScrollController.checkYAutoScroll(event.clientY);

    const direction =
      this._startCoords.y > this._draggingCoords.y ? "up" : "down";
    const dragOverRow = getDragOverRow(
      draggingDOMs.table,
      this._draggingCoords.y,
    );
    if (!dragOverRow) return;

    const [row, index] = dragOverRow;
    this._droppingIndex = index;
    this._dropIndicatorController.onDragging(row, direction, "row");
  };

  private _onDragEnd = () => {
    this._dragging = false;
    this._draggingIndex = -1;
    this._droppingIndex = -1;
    this._startCoords = { x: 0, y: 0 };
    this._autoScrollController.stop();
    this._dropIndicatorController.onDragEnd();
    this._previewController.onDragEnd();
  };

  private _bindDragEvents = () => {
    this._colDragHandle.addEventListener("dragstart", this._onDragColStart);
    this._disposables.push(() => {
      this._colDragHandle.removeEventListener(
        "dragstart",
        this._onDragColStart,
      );
    });

    this._colDragHandle.addEventListener("dragend", this._onDragEnd);
    this._disposables.push(() => {
      this._colDragHandle.removeEventListener("dragend", this._onDragEnd);
    });

    this._rowDragHandle.addEventListener("dragstart", this._onDragRowStart);
    this._disposables.push(() => {
      this._rowDragHandle.removeEventListener(
        "dragstart",
        this._onDragRowStart,
      );
    });

    this._rowDragHandle.addEventListener("dragend", this._onDragEnd);
    this._disposables.push(() => {
      this._rowDragHandle.removeEventListener("dragend", this._onDragEnd);
    });

    const ownerDocument = this.editor.view.dom?.ownerDocument;
    if (ownerDocument) {
      // To make `drop` event work, we need to prevent the default behavior of the
      // `dragover` event for drop zone. Here we set the whole document as the
      // drop zone so that even the mouse moves outside the editor, the `drop`
      // event will still be triggered.
      ownerDocument.addEventListener("drop", this._onDrop);
      ownerDocument.addEventListener("dragover", this._onDrag);
      this._disposables.push(() => {
        ownerDocument.removeEventListener("drop", this._onDrop);
        ownerDocument.removeEventListener("dragover", this._onDrag);
      });
    }
  };

  private _onDragStart = (event: DragEvent, type: "col" | "row") => {
    const dataTransfer = event.dataTransfer;
    if (dataTransfer) {
      dataTransfer.effectAllowed = "move";
      this._emptyImageController.hideDragImage(dataTransfer);
    }
    this._dragging = true;
    this._draggingDirection = type;
    this._startCoords = { x: event.clientX, y: event.clientY };
    const draggingIndex =
      (type === "col"
        ? this._hoveringCell?.colIndex
        : this._hoveringCell?.rowIndex) ?? 0;

    this._draggingIndex = draggingIndex;

    const relatedDoms = getDndRelatedDOMs(
      this.editor.view,
      this._hoveringCell?.cellPos,
      draggingIndex,
      type,
    );
    this._draggingDOMs = relatedDoms;

    const index =
      type === "col"
        ? this._hoveringCell?.colIndex
        : this._hoveringCell?.rowIndex;

    this._previewController.onDragStart(relatedDoms, index, type);
    this._dropIndicatorController.onDragStart(relatedDoms, type);
  };

  private _onDrag = (event: DragEvent) => {
    event.preventDefault();
    if (!this._dragging) return;
    if (this._draggingDirection === "col") {
      this._onDraggingCol(event);
    } else {
      this._onDraggingRow(event);
    }
  };

  private _onDrop = () => {
    if (!this._dragging) return;
    const direction = this._draggingDirection;
    const from = this._draggingIndex;
    const to = this._droppingIndex;
    const tr = this.editor.state.tr;
    const pos = this.editor.state.selection.from;

    if (direction === "col") {
      const canMove = moveColumn({
        tr,
        originIndex: from,
        targetIndex: to,
        select: true,
        pos,
      });
      if (canMove) {
        this.editor.view.dispatch(tr);
      }

      return;
    }

    if (direction === "row") {
      const canMove = moveRow({
        tr,
        originIndex: from,
        targetIndex: to,
        select: true,
        pos,
      });
      if (canMove) {
        this.editor.view.dispatch(tr);
      }

      return;
    }
  };
}

export const TableDndExtension = Extension.create({
  name: "table-drag-and-drop",
  addProseMirrorPlugins() {
    const editor = this.editor;

    const dragHandlePluginSpec = new TableDragHandlePluginSpec(editor);
    const dragHandlePlugin = new Plugin(dragHandlePluginSpec);

    return [dragHandlePlugin];
  },
});
