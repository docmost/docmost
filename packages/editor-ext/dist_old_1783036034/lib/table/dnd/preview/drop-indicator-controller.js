"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropIndicatorController = void 0;
const dom_1 = require("@floating-ui/dom");
const DROP_INDICATOR_WIDTH = 2;
class DropIndicatorController {
    _dropIndicator;
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
    onDragStart = (relatedDoms, type) => {
        this._initDropIndicatorStyle(relatedDoms.table, type);
        this._initDropIndicatorPosition(relatedDoms.cell, type);
        this._dropIndicator.dataset.dragging = 'true';
    };
    onDragEnd = () => {
        Object.assign(this._dropIndicator.style, { display: 'none' });
        this._dropIndicator.dataset.dragging = 'false';
    };
    onDragging = (target, direction, type) => {
        if (type === 'col') {
            void (0, dom_1.computePosition)(target, this._dropIndicator, {
                placement: direction === 'left' ? 'left' : 'right',
                middleware: [(0, dom_1.offset)((direction === 'left' ? -1 * DROP_INDICATOR_WIDTH : 0))],
            }).then(({ x }) => {
                Object.assign(this._dropIndicator.style, { left: `${x}px` });
            });
            return;
        }
        if (type === 'row') {
            void (0, dom_1.computePosition)(target, this._dropIndicator, {
                placement: direction === 'up' ? 'top' : 'bottom',
                middleware: [(0, dom_1.offset)((direction === 'up' ? -1 * DROP_INDICATOR_WIDTH : 0))],
            }).then(({ y }) => {
                Object.assign(this._dropIndicator.style, { top: `${y}px` });
            });
            return;
        }
    };
    destroy = () => {
        this._dropIndicator.remove();
    };
    _initDropIndicatorStyle = (table, type) => {
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
    };
    _initDropIndicatorPosition = (cell, type) => {
        void (0, dom_1.computePosition)(cell, this._dropIndicator, {
            placement: type === 'row' ? 'right' : 'bottom',
            middleware: [
                (0, dom_1.offset)(({ rects }) => {
                    if (type === 'col') {
                        return -rects.reference.height;
                    }
                    return -rects.reference.width;
                }),
            ],
        }).then(({ x, y }) => {
            Object.assign(this._dropIndicator.style, {
                left: `${x}px`,
                top: `${y}px`,
            });
        });
    };
}
exports.DropIndicatorController = DropIndicatorController;
//# sourceMappingURL=drop-indicator-controller.js.map