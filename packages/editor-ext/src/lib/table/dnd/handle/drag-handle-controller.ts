import { Editor } from "@tiptap/core";
import { HoveringCellInfo } from "../utils";
import { computePosition, offset } from "@floating-ui/dom";

export class DragHandleController {
    private _colDragHandle: HTMLElement;
    private _rowDragHandle: HTMLElement;

    constructor() {
        this._colDragHandle = this._createDragHandleDom('col');
        this._rowDragHandle = this._createDragHandleDom('row');
    }

    get colDragHandle() {
        return this._colDragHandle;
    }

    get rowDragHandle() {
        return this._rowDragHandle;
    }

    show = (editor: Editor, hoveringCell: HoveringCellInfo) => {
        this._showColDragHandle(editor, hoveringCell);
        this._showRowDragHandle(editor, hoveringCell);
    }

    hide = () => {
        Object.assign(this._colDragHandle.style, {
            display: 'none',
            left: '-999px',
            top: '-999px',
        });
        Object.assign(this._rowDragHandle.style, {
            display: 'none',
            left: '-999px',
            top: '-999px',
        });
    }

    destroy = () => {
        this._colDragHandle.remove()
        this._rowDragHandle.remove()
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

    private _showColDragHandle(editor: Editor, hoveringCell: HoveringCellInfo) {
        const referenceCell = editor.view.nodeDOM(hoveringCell.colFirstCellPos);
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
                Object.assign(this._colDragHandle.style, {
                    display: 'block',
                    top: `${y}px`,
                    left: `${x}px`,
                });
            })
    }

    private _showRowDragHandle(editor: Editor, hoveringCell: HoveringCellInfo) {
        const referenceCell = editor.view.nodeDOM(hoveringCell.rowFirstCellPos);
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
}