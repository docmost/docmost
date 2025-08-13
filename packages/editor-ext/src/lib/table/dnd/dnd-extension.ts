import { Editor, Extension } from "@tiptap/core";
import { PluginKey, Plugin, PluginSpec } from "@tiptap/pm/state";
import { EditorProps, EditorView } from "@tiptap/pm/view";
import { computePosition, offset } from '@floating-ui/dom';
import { DraggingDOMs, getDndRelatedDOMs, getHoveringCell, HoveringCellInfo } from "./utils";
import { getDragOverColumn, getDragOverRow } from "./calc-drag-over";
import { moveColumn, moveRow } from "../utils";
import { PreviewController } from "./preview/preview-controller";
import { DropIndicatorController } from "./preview/drop-indicator-controller";

export const TableDndKey = new PluginKey('table-drag-and-drop')

class TableDragHandlePluginSpec implements PluginSpec<void> {
    key = TableDndKey
    props: EditorProps<Plugin<void>>

    private _colDragHandle: HTMLElement;
    private _rowDragHandle: HTMLElement;
    private _hoveringCell?: HoveringCellInfo;
    private _emptyImage: HTMLElement;
    private _disposables: (() => void)[] = [];
    private _draggingCoords: { x: number; y: number } = { x: 0, y: 0 };
    private _dragging = false;
    private _draggingDirection: 'col' | 'row' = 'col';
    private _draggingIndex = -1;
    private _droppingIndex = -1;
    private _draggingDOMs?: DraggingDOMs | undefined
    private _startCoords: { x: number; y: number } = { x: 0, y: 0 };
    private _previewController: PreviewController;
    private _dropIndicatorController: DropIndicatorController;

    constructor(public editor: Editor) {
        this.props = {
            handleDOMEvents: {
                pointerover: this._pointerOver,
            }
        }

        this._colDragHandle = this._createDragHandleDom('col');
        this._rowDragHandle = this._createDragHandleDom('row');

        this._previewController = new PreviewController();
        this._dropIndicatorController = new DropIndicatorController();

        this._bindDragEvents();

        const emptyImage = new Image(1, 1);
        emptyImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        this._emptyImage = emptyImage;
    }

    view = () => {
        const wrapper = this.editor.options.element;
        wrapper.appendChild(this._colDragHandle)
        wrapper.appendChild(this._rowDragHandle)
        wrapper.appendChild(this._previewController.previewRoot)
        wrapper.appendChild(this._dropIndicatorController.dropIndicatorRoot)

        return {
            update: this.update,
            destroy: this.destroy,
        }
    }

    update = () => {}

    destroy = () => {
        if (!this.editor.isDestroyed) return;
        this._colDragHandle?.remove()
        this._rowDragHandle?.remove()
        this._emptyImage.remove();
        this._previewController.destroy();
        this._dropIndicatorController.destroy();

        this._disposables.forEach(disposable => disposable());
    }

    private _pointerOver = (view: EditorView, event: PointerEvent) => {
        if (this._dragging) return;

        const hoveringCell = getHoveringCell(view, event)
        this._hoveringCell = hoveringCell;
        if (!hoveringCell) {
            this._hideDragHandle();
            return;
        }

        this._showDragHandle()
    }

    private _showDragHandle = () => {
        this._showColDragHandle();
        this._showRowDragHandle();
    }

    private _showColDragHandle = () => {
        if (!this._colDragHandle) return;
        const hoveringCell = this._hoveringCell;
        if (!hoveringCell) return;

        const referenceCell = this.editor.view.nodeDOM(hoveringCell.colFirstCellPos);
        if (!referenceCell) return;

        const yOffset = -1 * parseInt(getComputedStyle(this._colDragHandle).height) / 2;

        computePosition(
            referenceCell as HTMLElement,
            this._colDragHandle,
            {
                placement: 'top',
                middleware: [offset(yOffset)]
            }
        )
            .then(({ x, y }) => {
                console.log('xy', yOffset, x, y)
                Object.assign(this._colDragHandle.style, {
                    display: 'block',
                    top: `${y}px`,
                    left: `${x}px`,
                });
            })
    }

    private _showRowDragHandle = () => {
        if (!this._rowDragHandle) return;
        const hoveringCell = this._hoveringCell;
        if (!hoveringCell) return;

        const referenceCell = this.editor.view.nodeDOM(hoveringCell.rowFirstCellPos);
        if (!referenceCell) return;

        const xOffset = -1 * parseInt(getComputedStyle(this._rowDragHandle).width) / 2;

        computePosition(
            referenceCell as HTMLElement,
            this._rowDragHandle,
            {
                middleware: [offset(xOffset)],
                placement: 'left'
            }
        )
            .then(({ x, y}) => {
                Object.assign(this._rowDragHandle.style, {
                    display: 'block',
                    top: `${y}px`,
                    left: `${x}px`,
                });
            })
    }

    private _hideDragHandle = () => {
        if (this._colDragHandle) {
            Object.assign(this._colDragHandle.style, {
                display: 'none',
                left: '-999px',
                top: '-999px',
            });
        }
        if (this._rowDragHandle) {
            Object.assign(this._rowDragHandle.style, {
                display: 'none',
                left: '-999px',
                top: '-999px',
            });
        }
    }

    private _createDragHandleDom = (type: 'col' | 'row') => {
        const dragHandle = document.createElement('div')
        dragHandle.classList.add('drag-handle')
        dragHandle.setAttribute('draggable', 'true')
        dragHandle.setAttribute('data-direction', type === 'col' ? 'horizontal' : 'vertical')
        dragHandle.setAttribute('data-drag-handle', '')
        Object.assign(dragHandle.style, {
            position: 'absolute',
            top: '-999px',
            left: '-999px',
            display: 'none',
        })
        return dragHandle;
    }

    private _onDragColStart = (event: DragEvent) => {
        const dataTransfer = event.dataTransfer;
        if (dataTransfer) {
            dataTransfer.effectAllowed = 'move';
            dataTransfer.setDragImage(this._emptyImage, 0, 0);
        }
        this._dragging = true;
        this._draggingDirection = 'col';
        this._startCoords = { x: event.clientX, y: event.clientY };
        const draggingIndex = this._hoveringCell?.colIndex ?? -1;

        this._draggingIndex = draggingIndex;

        const relatedDoms = getDndRelatedDOMs(
            this.editor.view,
            this._hoveringCell?.cellPos,
            draggingIndex,
            'col'
        )
        this._draggingDOMs = relatedDoms;

        this._previewController.onDragStart(relatedDoms, this._hoveringCell?.colIndex, 'col');
        this._dropIndicatorController.onDragStart(relatedDoms, 'col');
    }

    private _onDraggingCol = (event: DragEvent) => {
        const draggingDOMs = this._draggingDOMs;
        if (!draggingDOMs) return;

        this._draggingCoords = { x: event.clientX, y: event.clientY };
        this._previewController.onDragging(draggingDOMs, this._draggingCoords.x, this._draggingCoords.y, 'col');

        const direction = this._startCoords.x > this._draggingCoords.x ? 'left' : 'right';
        const dragOverColumn = getDragOverColumn(draggingDOMs.table, this._draggingCoords.x);
        if (!dragOverColumn) return;

        const [col, index] = dragOverColumn;
        this._droppingIndex = index;
        this._dropIndicatorController.onDragging(col, direction, 'col');
    }

    private _onDragRowStart = (event: DragEvent) => {
        const dataTransfer = event.dataTransfer;
        if (dataTransfer) {
            dataTransfer.effectAllowed = 'move';
            dataTransfer.setDragImage(this._emptyImage, 0, 0);
        }
        this._dragging = true;
        this._draggingDirection = 'row';
        this._startCoords = { x: event.clientX, y: event.clientY };
        const draggingIndex = this._hoveringCell?.rowIndex ?? -1;

        this._draggingIndex = draggingIndex;
        const relatedDoms = getDndRelatedDOMs(
            this.editor.view,
            this._hoveringCell?.cellPos,
            draggingIndex,
            'row'
        )
        this._draggingDOMs = relatedDoms;

        this._previewController.onDragStart(relatedDoms, this._hoveringCell?.rowIndex, 'row');
        this._dropIndicatorController.onDragStart(relatedDoms, 'row');
    }

    private _onDraggingRow = (event: DragEvent) => {
        const draggingDOMs = this._draggingDOMs;
        if (!draggingDOMs) return;

        this._draggingCoords = { x: event.clientX, y: event.clientY };
        this._previewController.onDragging(draggingDOMs, this._draggingCoords.x, this._draggingCoords.y, 'row');

        const direction = this._startCoords.y > this._draggingCoords.y ? 'up' : 'down';
        const dragOverRow = getDragOverRow(draggingDOMs.table, this._draggingCoords.y);
        if (!dragOverRow) return;

        const [row, index] = dragOverRow;
        this._droppingIndex = index;
        this._dropIndicatorController.onDragging(row, direction, 'row');
    }

    private _onDragEnd = () => {
        this._dragging = false;
        this._draggingIndex = -1;
        this._droppingIndex = -1;
        this._startCoords = { x: 0, y: 0 };
        this._dropIndicatorController.onDragEnd();
        this._previewController.onDragEnd();
    }

    private _bindDragEvents = () => {
        this._colDragHandle.addEventListener('dragstart', this._onDragColStart);
        this._disposables.push(() => {
            this._colDragHandle.removeEventListener('dragstart', this._onDragColStart);
        })

        this._colDragHandle.addEventListener('drag', this._onDraggingCol);
        this._disposables.push(() => {
            this._colDragHandle.removeEventListener('drag', this._onDraggingCol);
        })

        this._colDragHandle.addEventListener('dragend', this._onDragEnd);
        this._disposables.push(() => {
            this._colDragHandle.removeEventListener('dragend', this._onDragEnd);
        })

        this._rowDragHandle.addEventListener('dragstart', this._onDragRowStart);
        this._disposables.push(() => {
            this._rowDragHandle.removeEventListener('dragstart', this._onDragRowStart);
        })

        this._rowDragHandle.addEventListener('drag', this._onDraggingRow);
        this._disposables.push(() => {
            this._rowDragHandle.removeEventListener('drag', this._onDraggingRow);
        })

        this._rowDragHandle.addEventListener('dragend', this._onDragEnd);
        this._disposables.push(() => {
            this._rowDragHandle.removeEventListener('dragend', this._onDragEnd);
        })

        const ownerDocument = this.editor.view.dom?.ownerDocument
        if (ownerDocument) {
            // To make `drop` event work, we need to prevent the default behavior of the
            // `dragover` event for drop zone. Here we set the whole document as the
            // drop zone so that even the mouse moves outside the editor, the `drop`
            // event will still be triggered.
            const handleDragOver = (event: DragEvent) => {
                event.preventDefault()
            }
            ownerDocument.addEventListener('drop', this._onDrop);
            ownerDocument.addEventListener('dragover', handleDragOver);
            this._disposables.push(() => {
                ownerDocument.removeEventListener('drop', this._onDrop);
                ownerDocument.removeEventListener('dragover', handleDragOver);
            });
        }
    }

    private _onDrop = () => {
        if (!this._dragging) return;
        const direction = this._draggingDirection;
        const from = this._draggingIndex;
        const to = this._droppingIndex;
        const tr = this.editor.state.tr;
        const pos = this.editor.state.selection.from;

        if (direction === 'col') {
            const canMove = moveColumn({
                tr,
                originIndex: from,
                targetIndex: to,
                select: true,
                pos,
            })
            if (canMove) {
                this.editor.view.dispatch(tr);
            }

            return;
        }

        if (direction === 'row') {
            const canMove = moveRow({
                tr,
                originIndex: from,
                targetIndex: to,
                select: true,
                pos,
            })
            if (canMove) {
                this.editor.view.dispatch(tr);
            }

            return;
        }
    }
}

export const TableDndExtension = Extension.create({
    name: 'table-drag-and-drop',
    addProseMirrorPlugins() {
        const editor = this.editor

        const dragHandlePluginSpec = new TableDragHandlePluginSpec(editor)
        const dragHandlePlugin = new Plugin(dragHandlePluginSpec)

        return [dragHandlePlugin]
    }
})
