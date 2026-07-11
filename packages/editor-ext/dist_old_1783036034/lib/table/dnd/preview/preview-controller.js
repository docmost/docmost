"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreviewController = void 0;
const dom_1 = require("@floating-ui/dom");
const render_preview_1 = require("./render-preview");
class PreviewController {
    _preview;
    constructor() {
        this._preview = document.createElement('div');
        this._preview.classList.add('table-dnd-preview');
        this._preview.classList.add('ProseMirror');
        Object.assign(this._preview.style, {
            position: 'absolute',
            pointerEvents: 'none',
            display: 'none',
        });
    }
    get previewRoot() {
        return this._preview;
    }
    onDragStart = (relatedDoms, index, type) => {
        this._initPreviewStyle(relatedDoms.table, relatedDoms.cell, type);
        (0, render_preview_1.createPreviewDOM)(relatedDoms.table, this._preview, index, type);
        this._initPreviewPosition(relatedDoms.table, relatedDoms.cell, type);
    };
    onDragEnd = () => {
        (0, render_preview_1.clearPreviewDOM)(this._preview);
        Object.assign(this._preview.style, { display: 'none' });
    };
    onDragging = (relatedDoms, x, y, type) => {
        this._updatePreviewPosition(x, y, relatedDoms.table, relatedDoms.cell, type);
    };
    destroy = () => {
        this._preview.remove();
    };
    _initPreviewStyle(table, cell, type) {
        const tableRect = table.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        if (type === 'col') {
            Object.assign(this._preview.style, {
                display: 'block',
                width: `${cellRect.width}px`,
                height: `${tableRect.height}px`,
            });
        }
        if (type === 'row') {
            Object.assign(this._preview.style, {
                display: 'block',
                width: `${tableRect.width}px`,
                height: `${cellRect.height}px`,
            });
        }
    }
    _initPreviewPosition(table, cell, type) {
        void (0, dom_1.computePosition)(cell, this._preview, {
            placement: type === 'row' ? 'right' : 'bottom',
            middleware: [
                (0, dom_1.offset)(({ rects }) => {
                    if (type === 'col') {
                        return -rects.reference.height;
                    }
                    return -rects.reference.width;
                }),
                (0, dom_1.shift)({ boundary: table, padding: 0 }),
            ],
        }).then(({ x, y }) => {
            Object.assign(this._preview.style, {
                left: `${x}px`,
                top: `${y}px`,
            });
        });
    }
    _updatePreviewPosition(x, y, table, cell, type) {
        (0, dom_1.computePosition)(getVirtualElement(cell, x, y), this._preview, {
            placement: type === 'row' ? 'right' : 'bottom',
            middleware: [(0, dom_1.shift)({ boundary: table, padding: 0 })],
        }).then(({ x, y }) => {
            if (type === 'row') {
                Object.assign(this._preview.style, {
                    top: `${y}px`,
                });
                return;
            }
            if (type === 'col') {
                Object.assign(this._preview.style, {
                    left: `${x}px`,
                });
                return;
            }
        });
    }
}
exports.PreviewController = PreviewController;
function getVirtualElement(cell, x, y) {
    return {
        contextElement: cell,
        getBoundingClientRect: () => {
            const rect = cell.getBoundingClientRect();
            return {
                width: rect.width,
                height: rect.height,
                right: x + rect.width / 2,
                bottom: y + rect.height / 2,
                top: y - rect.height / 2,
                left: x - rect.width / 2,
                x: x - rect.width / 2,
                y: y - rect.height / 2,
            };
        },
    };
}
//# sourceMappingURL=preview-controller.js.map