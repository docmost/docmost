import { Editor, Extension } from "@tiptap/core";
import { PluginKey, Plugin, PluginSpec } from "@tiptap/pm/state";
import { EditorProps, EditorView } from "@tiptap/pm/view";
import { computePosition, offset } from '@floating-ui/dom';
import { getHoveringCell, HoveringCellInfo, isHoveringCellInfoEqual } from "./utils";

export const TableDndKey = new PluginKey('table-drag-and-drop')

class TableDragHandlePluginSpec implements PluginSpec<void> {
    key = TableDndKey
    props: EditorProps<Plugin<void>>

    private _colDragHandle: HTMLElement;
    private _rowDragHandle: HTMLElement;
    private _hoveringCell?: HoveringCellInfo;
    private _emptyImage: HTMLElement;
    private _disposables: (() => void)[] = [];

    constructor(public editor: Editor) {
        this.props = {
            handleDOMEvents: {
                pointerover: this._pointerOver,
            }
        }

        this._colDragHandle = this._createDragHandleDom('col');
        this._rowDragHandle = this._createDragHandleDom('row');

        this._bindDragEvents();

        const emptyImage = new Image(1, 1);
        emptyImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        this._emptyImage = emptyImage;
    }

    view = () => {
        const wrapper = this.editor.options.element;
        wrapper.appendChild(this._colDragHandle)
        wrapper.appendChild(this._rowDragHandle)

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

        this._disposables.forEach(disposable => disposable());
    }

    private _pointerOver = (view: EditorView, event: PointerEvent) => {
        const hoveringCell = getHoveringCell(view, event)
        if (isHoveringCellInfoEqual(this._hoveringCell, hoveringCell)) {
            return;
        }
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
    }

    private _onDragRowStart = (event: DragEvent) => {
        const dataTransfer = event.dataTransfer;
        if (dataTransfer) {
            dataTransfer.effectAllowed = 'move';
            dataTransfer.setDragImage(this._emptyImage, 0, 0);
        }
    }

    private _bindDragEvents = () => {
        this._colDragHandle.addEventListener('dragstart', this._onDragColStart);
        this._disposables.push(() => {
            this._colDragHandle.removeEventListener('dragstart', this._onDragColStart);
        })

        this._rowDragHandle.addEventListener('dragstart', this._onDragRowStart);
        this._disposables.push(() => {
            this._rowDragHandle.removeEventListener('dragstart', this._onDragRowStart);
        })
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
