"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableHandleCommandsExtension = exports.TableDndExtension = exports.TableDndKey = void 0;
exports.getTableHandlePluginSpec = getTableHandlePluginSpec;
const core_1 = require("@tiptap/core");
const state_1 = require("@tiptap/pm/state");
const tables_1 = require("@tiptap/pm/tables");
const tables_2 = require("@tiptap/pm/tables");
const utils_1 = require("./utils");
const calc_drag_over_1 = require("./calc-drag-over");
const query_1 = require("../utils/query");
const utils_2 = require("../utils");
const preview_controller_1 = require("./preview/preview-controller");
const drop_indicator_controller_1 = require("./preview/drop-indicator-controller");
const INITIAL_STATE = {
    hoveringCell: null,
    tableNode: null,
    tablePos: null,
    dragging: null,
    frozen: false,
};
exports.TableDndKey = new state_1.PluginKey("table-handles");
class TableHandlePluginSpec {
    editor;
    key = exports.TableDndKey;
    props;
    _previewController;
    _dropIndicatorController;
    _hoveringCell;
    _disposables = [];
    _draggingDirection = "col";
    _draggingIndex = -1;
    _droppingIndex = -1;
    _draggingDOMs;
    _startCoords = { x: 0, y: 0 };
    _dragging = false;
    state = {
        init: () => INITIAL_STATE,
        apply: (tr, prev) => {
            const meta = tr.getMeta(exports.TableDndKey);
            if (!meta)
                return prev;
            let changed = false;
            for (const key in meta) {
                if (!Object.is(prev[key], meta[key])) {
                    changed = true;
                    break;
                }
            }
            return changed ? { ...prev, ...meta } : prev;
        },
    };
    constructor(editor) {
        this.editor = editor;
        this.props = {
            handleDOMEvents: {
                pointermove: this._pointerMove,
                pointerdown: this._pointerDown,
            },
        };
        this._previewController = new preview_controller_1.PreviewController();
        this._dropIndicatorController = new drop_indicator_controller_1.DropIndicatorController();
    }
    view = () => {
        const wrapper = this.editor.options.element;
        wrapper.appendChild(this._previewController.previewRoot);
        wrapper.appendChild(this._dropIndicatorController.dropIndicatorRoot);
        this.editor.on("selectionUpdate", this._onSelectionUpdate);
        this._disposables.push(() => this.editor.off("selectionUpdate", this._onSelectionUpdate));
        return {
            destroy: this.destroy,
        };
    };
    destroy = () => {
        this._previewController.destroy();
        this._dropIndicatorController.destroy();
        this._disposables.forEach((d) => d());
    };
    _pointerDown = (view, _event) => {
        const current = exports.TableDndKey.getState(view.state);
        if (current?.frozen)
            this.editor.commands.unfreezeHandles();
        return false;
    };
    _pointerMove = (view, event) => {
        const current = exports.TableDndKey.getState(view.state);
        if (current?.frozen || current?.dragging)
            return;
        const resizeState = tables_1.columnResizingPluginKey.getState(view.state);
        if (resizeState?.dragging)
            return;
        if (!this.editor.isEditable) {
            if (current?.hoveringCell == null && current?.tableNode == null && current?.tablePos == null)
                return;
            this._dispatchMeta({ hoveringCell: null, tableNode: null, tablePos: null });
            return;
        }
        const hoveringCell = (0, utils_1.getHoveringCell)(view, event);
        if (hoveringCell) {
            if (current?.hoveringCell?.cellPos === hoveringCell.cellPos)
                return;
            this._hoveringCell = hoveringCell;
            const $cell = view.state.doc.resolve(hoveringCell.cellPos);
            const tableInfo = (0, query_1.findTable)($cell);
            this._dispatchMeta({
                hoveringCell,
                tableNode: tableInfo?.node ?? null,
                tablePos: tableInfo?.pos ?? null,
            });
            return;
        }
        const $cellPos = (0, tables_2.cellAround)(view.state.selection.$head);
        if ($cellPos) {
            const cellInfo = (0, utils_1.cellInfoFromResolvedCell)($cellPos);
            if (current?.hoveringCell?.cellPos === cellInfo.cellPos)
                return;
            this._hoveringCell = cellInfo;
            const tableInfo = (0, query_1.findTable)($cellPos);
            this._dispatchMeta({
                hoveringCell: cellInfo,
                tableNode: tableInfo?.node ?? null,
                tablePos: tableInfo?.pos ?? null,
            });
            return;
        }
        this._hoveringCell = undefined;
        if (current?.hoveringCell == null && current?.tableNode == null && current?.tablePos == null)
            return;
        this._dispatchMeta({ hoveringCell: null, tableNode: null, tablePos: null });
    };
    _onSelectionUpdate = () => {
        if (!this.editor.isEditable)
            return;
        const current = exports.TableDndKey.getState(this.editor.state);
        if (current?.frozen || current?.dragging)
            return;
        const $cellPos = (0, tables_2.cellAround)(this.editor.state.selection.$head);
        if (!$cellPos)
            return;
        const cellInfo = (0, utils_1.cellInfoFromResolvedCell)($cellPos);
        if (current?.hoveringCell?.cellPos === cellInfo.cellPos)
            return;
        this._hoveringCell = cellInfo;
        const tableInfo = (0, query_1.findTable)($cellPos);
        this._dispatchMeta({
            hoveringCell: cellInfo,
            tableNode: tableInfo?.node ?? null,
            tablePos: tableInfo?.pos ?? null,
        });
    };
    _dispatchMeta = (patch) => {
        const tr = this.editor.state.tr.setMeta(exports.TableDndKey, patch);
        tr.setMeta("addToHistory", false);
        this.editor.view.dispatch(tr);
    };
    startDragFromHandle = (orientation, clientX, clientY) => {
        if (!this._hoveringCell)
            return false;
        this._dragging = true;
        this._draggingDirection = orientation;
        this._startCoords = { x: clientX, y: clientY };
        const draggingIndex = (orientation === "col"
            ? this._hoveringCell.colIndex
            : this._hoveringCell.rowIndex) ?? 0;
        this._draggingIndex = draggingIndex;
        const relatedDoms = (0, utils_1.getDndRelatedDOMs)(this.editor.view, this._hoveringCell.cellPos, draggingIndex, orientation);
        if (!relatedDoms) {
            this._dragging = false;
            return false;
        }
        this._draggingDOMs = relatedDoms;
        this._previewController.onDragStart(relatedDoms, draggingIndex, orientation);
        this._dropIndicatorController.onDragStart(relatedDoms, orientation);
        const state = this.editor.state;
        const currentTable = (0, query_1.findTable)(state.selection.$from);
        const hoverTable = (() => {
            try {
                return (0, query_1.findTable)(state.doc.resolve(this._hoveringCell.cellPos));
            }
            catch {
                return undefined;
            }
        })();
        const tr = state.tr;
        if (hoverTable &&
            (!currentTable || currentTable.pos !== hoverTable.pos)) {
            try {
                const $inside = state.doc.resolve(this._hoveringCell.cellPos + 1);
                tr.setSelection(state_1.TextSelection.near($inside, 1));
            }
            catch { }
        }
        tr.setMeta(exports.TableDndKey, {
            dragging: { orientation, index: draggingIndex },
        });
        tr.setMeta("addToHistory", false);
        this.editor.view.dispatch(tr);
        return true;
    };
    updateDragPosition = (clientX, clientY) => {
        const draggingDOMs = this._draggingDOMs;
        if (!draggingDOMs || !this._dragging)
            return;
        if (this._draggingDirection === "col") {
            this._previewController.onDragging(draggingDOMs, clientX, clientY, "col");
            const direction = this._startCoords.x > clientX ? "left" : "right";
            const dragOverColumn = (0, calc_drag_over_1.getDragOverColumn)(draggingDOMs.table, clientX);
            if (!dragOverColumn)
                return;
            const [col, index] = dragOverColumn;
            this._droppingIndex = index;
            this._dropIndicatorController.onDragging(col, direction, "col");
            return;
        }
        this._previewController.onDragging(draggingDOMs, clientX, clientY, "row");
        const direction = this._startCoords.y > clientY ? "up" : "down";
        const dragOverRow = (0, calc_drag_over_1.getDragOverRow)(draggingDOMs.table, clientY);
        if (!dragOverRow)
            return;
        const [row, index] = dragOverRow;
        this._droppingIndex = index;
        this._dropIndicatorController.onDragging(row, direction, "row");
    };
    commitDrop = () => {
        if (!this._dragging)
            return;
        const direction = this._draggingDirection;
        const from = this._draggingIndex;
        const to = this._droppingIndex;
        if (from < 0 || to < 0 || from === to)
            return;
        const tr = this.editor.state.tr;
        const pos = this.editor.state.selection.from;
        if (direction === "col") {
            if ((0, utils_2.moveColumn)({ tr, originIndex: from, targetIndex: to, select: true, pos })) {
                this.editor.view.dispatch(tr);
            }
            return;
        }
        if ((0, utils_2.moveRow)({ tr, originIndex: from, targetIndex: to, select: true, pos })) {
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
function getTableHandlePluginSpec(editor) {
    const plugin = exports.TableDndKey.get(editor.state);
    if (!plugin)
        return null;
    return plugin.spec;
}
exports.TableDndExtension = core_1.Extension.create({
    name: "table-drag-and-drop",
    addProseMirrorPlugins() {
        const editor = this.editor;
        const spec = new TableHandlePluginSpec(editor);
        return [new state_1.Plugin(spec)];
    },
});
exports.TableHandleCommandsExtension = core_1.Extension.create({
    name: "table-handle-commands",
    addCommands() {
        return {
            freezeHandles: () => ({ tr, dispatch }) => {
                if (dispatch) {
                    tr.setMeta(exports.TableDndKey, { frozen: true });
                    tr.setMeta("addToHistory", false);
                }
                return true;
            },
            unfreezeHandles: () => ({ tr, state, dispatch }) => {
                if (dispatch) {
                    const patch = { frozen: false };
                    const $cellPos = (0, tables_2.cellAround)(state.selection.$head);
                    if ($cellPos) {
                        const cellInfo = (0, utils_1.cellInfoFromResolvedCell)($cellPos);
                        const tableInfo = (0, query_1.findTable)($cellPos);
                        patch.hoveringCell = cellInfo;
                        patch.tableNode = tableInfo?.node ?? null;
                        patch.tablePos = tableInfo?.pos ?? null;
                    }
                    else {
                        patch.hoveringCell = null;
                        patch.tableNode = null;
                        patch.tablePos = null;
                    }
                    tr.setMeta(exports.TableDndKey, patch);
                    tr.setMeta("addToHistory", false);
                }
                return true;
            },
        };
    },
});
//# sourceMappingURL=dnd-extension.js.map