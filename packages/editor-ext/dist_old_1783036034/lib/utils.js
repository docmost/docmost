"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNodeId = exports.isRowGripSelected = exports.isColumnGripSelected = exports.selectTable = exports.selectRow = exports.selectColumn = exports.findCellClosestToPos = exports.findParentNodeClosestToPos = exports.getCellsInTable = exports.getCellsInRow = exports.getCellsInColumn = exports.isTableSelected = exports.isRowSelected = exports.isColumnSelected = exports.isCellSelection = exports.findTable = exports.isRectSelected = void 0;
exports.isEditorReady = isEditorReady;
exports.isTextSelected = isTextSelected;
exports.setAttributes = setAttributes;
exports.icon = icon;
exports.sanitizeUrl = sanitizeUrl;
exports.isInternalFileUrl = isInternalFileUrl;
exports.copyToClipboard = copyToClipboard;
exports.execCommandCopy = execCommandCopy;
const core_1 = require("@tiptap/core");
const tables_1 = require("@tiptap/pm/tables");
const sanitize_url_1 = require("@braintree/sanitize-url");
const nanoid_1 = require("nanoid");
const isRectSelected = (rect) => (selection) => {
    const map = tables_1.TableMap.get(selection.$anchorCell.node(-1));
    const start = selection.$anchorCell.start(-1);
    const cells = map.cellsInRect(rect);
    const selectedCells = map.cellsInRect(map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start));
    for (let i = 0, count = cells.length; i < count; i += 1) {
        if (selectedCells.indexOf(cells[i]) === -1) {
            return false;
        }
    }
    return true;
};
exports.isRectSelected = isRectSelected;
const findTable = (selection) => (0, core_1.findParentNode)((node) => node.type.spec.tableRole && node.type.spec.tableRole === "table")(selection);
exports.findTable = findTable;
const isCellSelection = (selection) => selection instanceof tables_1.CellSelection;
exports.isCellSelection = isCellSelection;
const isColumnSelected = (columnIndex) => (selection) => {
    if ((0, exports.isCellSelection)(selection)) {
        const map = tables_1.TableMap.get(selection.$anchorCell.node(-1));
        return (0, exports.isRectSelected)({
            left: columnIndex,
            right: columnIndex + 1,
            top: 0,
            bottom: map.height,
        })(selection);
    }
    return false;
};
exports.isColumnSelected = isColumnSelected;
const isRowSelected = (rowIndex) => (selection) => {
    if ((0, exports.isCellSelection)(selection)) {
        const map = tables_1.TableMap.get(selection.$anchorCell.node(-1));
        return (0, exports.isRectSelected)({
            left: 0,
            right: map.width,
            top: rowIndex,
            bottom: rowIndex + 1,
        })(selection);
    }
    return false;
};
exports.isRowSelected = isRowSelected;
const isTableSelected = (selection) => {
    if ((0, exports.isCellSelection)(selection)) {
        const map = tables_1.TableMap.get(selection.$anchorCell.node(-1));
        return (0, exports.isRectSelected)({
            left: 0,
            right: map.width,
            top: 0,
            bottom: map.height,
        })(selection);
    }
    return false;
};
exports.isTableSelected = isTableSelected;
const getCellsInColumn = (columnIndex) => (selection) => {
    const table = (0, exports.findTable)(selection);
    if (table) {
        const map = tables_1.TableMap.get(table.node);
        const indexes = Array.isArray(columnIndex)
            ? columnIndex
            : Array.from([columnIndex]);
        return indexes.reduce((acc, index) => {
            if (index >= 0 && index <= map.width - 1) {
                const cells = map.cellsInRect({
                    left: index,
                    right: index + 1,
                    top: 0,
                    bottom: map.height,
                });
                return acc.concat(cells.map((nodePos) => {
                    const node = table.node.nodeAt(nodePos);
                    const pos = nodePos + table.start;
                    return { pos, start: pos + 1, node };
                }));
            }
            return acc;
        }, []);
    }
    return null;
};
exports.getCellsInColumn = getCellsInColumn;
const getCellsInRow = (rowIndex) => (selection) => {
    const table = (0, exports.findTable)(selection);
    if (table) {
        const map = tables_1.TableMap.get(table.node);
        const indexes = Array.isArray(rowIndex)
            ? rowIndex
            : Array.from([rowIndex]);
        return indexes.reduce((acc, index) => {
            if (index >= 0 && index <= map.height - 1) {
                const cells = map.cellsInRect({
                    left: 0,
                    right: map.width,
                    top: index,
                    bottom: index + 1,
                });
                return acc.concat(cells.map((nodePos) => {
                    const node = table.node.nodeAt(nodePos);
                    const pos = nodePos + table.start;
                    return { pos, start: pos + 1, node };
                }));
            }
            return acc;
        }, []);
    }
    return null;
};
exports.getCellsInRow = getCellsInRow;
const getCellsInTable = (selection) => {
    const table = (0, exports.findTable)(selection);
    if (table) {
        const map = tables_1.TableMap.get(table.node);
        const cells = map.cellsInRect({
            left: 0,
            right: map.width,
            top: 0,
            bottom: map.height,
        });
        return cells.map((nodePos) => {
            const node = table.node.nodeAt(nodePos);
            const pos = nodePos + table.start;
            return { pos, start: pos + 1, node };
        });
    }
    return null;
};
exports.getCellsInTable = getCellsInTable;
const findParentNodeClosestToPos = ($pos, predicate) => {
    for (let i = $pos.depth; i > 0; i -= 1) {
        const node = $pos.node(i);
        if (predicate(node)) {
            return {
                pos: i > 0 ? $pos.before(i) : 0,
                start: $pos.start(i),
                depth: i,
                node,
            };
        }
    }
    return null;
};
exports.findParentNodeClosestToPos = findParentNodeClosestToPos;
const findCellClosestToPos = ($pos) => {
    const predicate = (node) => node.type.spec.tableRole && /cell/i.test(node.type.spec.tableRole);
    return (0, exports.findParentNodeClosestToPos)($pos, predicate);
};
exports.findCellClosestToPos = findCellClosestToPos;
const select = (type) => (index) => (tr) => {
    const table = (0, exports.findTable)(tr.selection);
    const isRowSelection = type === "row";
    if (table) {
        const map = tables_1.TableMap.get(table.node);
        if (index >= 0 && index < (isRowSelection ? map.height : map.width)) {
            const left = isRowSelection ? 0 : index;
            const top = isRowSelection ? index : 0;
            const right = isRowSelection ? map.width : index + 1;
            const bottom = isRowSelection ? index + 1 : map.height;
            const cellsInFirstRow = map.cellsInRect({
                left,
                top,
                right: isRowSelection ? right : left + 1,
                bottom: isRowSelection ? top + 1 : bottom,
            });
            const cellsInLastRow = bottom - top === 1
                ? cellsInFirstRow
                : map.cellsInRect({
                    left: isRowSelection ? left : right - 1,
                    top: isRowSelection ? bottom - 1 : top,
                    right,
                    bottom,
                });
            const head = table.start + cellsInFirstRow[0];
            const anchor = table.start + cellsInLastRow[cellsInLastRow.length - 1];
            const $head = tr.doc.resolve(head);
            const $anchor = tr.doc.resolve(anchor);
            return tr.setSelection(new tables_1.CellSelection($anchor, $head));
        }
    }
    return tr;
};
exports.selectColumn = select("column");
exports.selectRow = select("row");
const selectTable = (tr) => {
    const table = (0, exports.findTable)(tr.selection);
    if (table) {
        const { map } = tables_1.TableMap.get(table.node);
        if (map && map.length) {
            const head = table.start + map[0];
            const anchor = table.start + map[map.length - 1];
            const $head = tr.doc.resolve(head);
            const $anchor = tr.doc.resolve(anchor);
            return tr.setSelection(new tables_1.CellSelection($anchor, $head));
        }
    }
    return tr;
};
exports.selectTable = selectTable;
const isColumnGripSelected = ({ editor, view, state, from, }) => {
    const domAtPos = view.domAtPos(from).node;
    const nodeDOM = view.nodeDOM(from);
    const node = nodeDOM || domAtPos;
    if (!editor.isActive("table") || !node || (0, exports.isTableSelected)(state.selection)) {
        return false;
    }
    let container = node;
    while (container && !["TD", "TH"].includes(container.tagName)) {
        container = container.parentElement;
    }
    const gripColumn = container &&
        container.querySelector &&
        container.querySelector("a.grip-column.selected");
    return !!gripColumn;
};
exports.isColumnGripSelected = isColumnGripSelected;
const isRowGripSelected = ({ editor, view, state, from, }) => {
    const domAtPos = view.domAtPos(from).node;
    const nodeDOM = view.nodeDOM(from);
    const node = nodeDOM || domAtPos;
    if (!editor.isActive("table") || !node || (0, exports.isTableSelected)(state.selection)) {
        return false;
    }
    let container = node;
    while (container && !["TD", "TH"].includes(container.tagName)) {
        container = container.parentElement;
    }
    const gripRow = container &&
        container.querySelector &&
        container.querySelector("a.grip-row.selected");
    return !!gripRow;
};
exports.isRowGripSelected = isRowGripSelected;
function isEditorReady(editor) {
    return !!editor && editor.isInitialized;
}
function isTextSelected(editor) {
    const { state: { doc, selection, selection: { empty, from, to }, }, } = editor;
    const isEmptyTextBlock = !doc.textBetween(from, to).length && (0, core_1.isTextSelection)(selection);
    if (empty || isEmptyTextBlock || !editor.isEditable) {
        return false;
    }
    return true;
}
function setAttributes(editor, getPos, attrs) {
    if (editor.isEditable && typeof getPos === "function") {
        editor.view.dispatch(editor.view.state.tr.setNodeMarkup(getPos(), undefined, attrs));
    }
}
function icon(name) {
    return `<span class="ProseMirror-icon ProseMirror-icon-${name}"></span>`;
}
function sanitizeUrl(url) {
    if (!url)
        return "";
    const sanitized = (0, sanitize_url_1.sanitizeUrl)(url);
    return sanitized === "about:blank" ? "" : sanitized;
}
function isInternalFileUrl(url) {
    if (!url)
        return false;
    const normalized = url.trim();
    return normalized.startsWith("/api/files/") || normalized.startsWith("/files/");
}
const alphabet = "abcdefghijklmnopqrstuvwxyz";
exports.generateNodeId = (0, nanoid_1.customAlphabet)(alphabet, 12);
function copyToClipboard(text) {
    if ("clipboard" in navigator) {
        navigator.clipboard.writeText(text).catch(() => {
            execCommandCopy(text);
        });
    }
    else {
        execCommandCopy(text);
    }
}
function execCommandCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
}
//# sourceMappingURL=utils.js.map