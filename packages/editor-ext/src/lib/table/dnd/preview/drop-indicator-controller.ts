import { computePosition, offset } from "@floating-ui/dom";
import { DraggingDOMs } from "../utils";

const DROP_INDICATOR_WIDTH = 2;

export class DropIndicatorController {
    private _dropIndicator: HTMLElement;

    constructor() {
        this._dropIndicator = document.createElement('div');
        this._dropIndicator.classList.add('table-dnd-drop-indicator');
        Object.assign(this._dropIndicator.style, {
            position: 'absolute',
            pointerEvents: 'none'
        });
    }

    get dropIndicatorRoot() {
        return this._dropIndicator;
    }

    onDragStart = (relatedDoms: DraggingDOMs, type: 'col' | 'row') => {
        this._initDropIndicatorStyle(relatedDoms.table, type);
        this._initDropIndicatorPosition(relatedDoms.cell, type);
        this._dropIndicator.dataset.dragging = 'true';
    }

    onDragEnd = () => {
        Object.assign(this._dropIndicator.style, { display: 'none' });
        this._dropIndicator.dataset.dragging = 'false';
    }

    onDragging = (target: Element, direction: 'left' | 'right' | 'up' | 'down', type: 'col' | 'row') => {
        if (type === 'col') {
            void computePosition(target, this._dropIndicator, {
                placement: direction === 'left' ? 'left' : 'right',
                middleware: [offset((direction === 'left' ? -1 * DROP_INDICATOR_WIDTH : 0))],
            }).then(({ x }) => {
                Object.assign(this._dropIndicator.style, { left: `${x}px` });
            })

            return;
        }

        if (type === 'row') {
            void computePosition(target, this._dropIndicator, {
                placement: direction === 'up' ? 'top' : 'bottom',
                middleware: [offset((direction === 'up' ? -1 * DROP_INDICATOR_WIDTH : 0))],
            }).then(({ y }) => {
                Object.assign(this._dropIndicator.style, { top: `${y}px` });
            })

            return;
        }
    }

    destroy = () => {
        this._dropIndicator.remove();
    }

    private _initDropIndicatorStyle = (table: HTMLElement, type: 'col' | 'row') => {
        const tableRect = table.getBoundingClientRect();

        if (type === 'col') {
            Object.assign(this._dropIndicator.style, {
                display: 'block',
                width: `${DROP_INDICATOR_WIDTH}px`,
                height: `${tableRect.height}px`,
            });
            return;
        }

        if (type === 'row') {
            Object.assign(this._dropIndicator.style, {
                display: 'block',
                width: `${tableRect.width}px`,
                height: `${DROP_INDICATOR_WIDTH}px`,
            });
        }
    }


    private _initDropIndicatorPosition = (cell: HTMLElement, type: 'col' | 'row') => {
        void computePosition(cell, this._dropIndicator, {
            placement: type === 'row' ? 'right' : 'bottom',
            middleware: [
                offset(({ rects }) => {
                    if (type === 'col') {
                        return -rects.reference.height
                    }
                    return -rects.reference.width
                }),
            ],
        }).then(({ x, y }) => {
            Object.assign(this._dropIndicator.style, {
                left: `${x}px`,
                top: `${y}px`,
            })
        });
    }

}