"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableView = void 0;
exports.updateColumns = updateColumns;
const col_style_1 = require("./utils/col-style");
function updateColumns(node, colgroup, table, cellMinWidth, overrideCol, overrideValue) {
    let totalWidth = 0;
    let fixedWidth = true;
    let nextDOM = colgroup.firstChild;
    const row = node.firstChild;
    if (row !== null) {
        for (let i = 0, col = 0; i < row.childCount; i += 1) {
            const { colspan, colwidth } = row.child(i).attrs;
            for (let j = 0; j < colspan; j += 1, col += 1) {
                const hasWidth = overrideCol === col
                    ? overrideValue
                    : (colwidth && colwidth[j]);
                const cssWidth = hasWidth ? `${hasWidth}px` : '';
                totalWidth += hasWidth || cellMinWidth;
                if (!hasWidth) {
                    fixedWidth = false;
                }
                if (!nextDOM) {
                    const colElement = document.createElement('col');
                    const [propertyKey, propertyValue] = (0, col_style_1.getColStyleDeclaration)(cellMinWidth, hasWidth);
                    colElement.style.setProperty(propertyKey, propertyValue);
                    colgroup.appendChild(colElement);
                }
                else {
                    if (nextDOM.style.width !== cssWidth) {
                        const [propertyKey, propertyValue] = (0, col_style_1.getColStyleDeclaration)(cellMinWidth, hasWidth);
                        nextDOM.style.setProperty(propertyKey, propertyValue);
                    }
                    nextDOM = nextDOM.nextSibling;
                }
            }
        }
    }
    while (nextDOM) {
        const after = nextDOM.nextSibling;
        nextDOM.parentNode?.removeChild(nextDOM);
        nextDOM = after;
    }
    const hasUserWidth = node.attrs.style &&
        typeof node.attrs.style === 'string' &&
        /\bwidth\s*:/i.test(node.attrs.style);
    if (fixedWidth && !hasUserWidth) {
        table.style.width = `${totalWidth}px`;
        table.style.minWidth = '';
    }
    else {
        table.style.width = '';
        table.style.minWidth = `${totalWidth}px`;
    }
}
class TableView {
    node;
    cellMinWidth;
    dom;
    table;
    colgroup;
    contentDOM;
    constructor(node, cellMinWidth) {
        this.node = node;
        this.cellMinWidth = cellMinWidth;
        this.dom = document.createElement('div');
        this.dom.className = 'tableWrapper';
        this.table = this.dom.appendChild(document.createElement('table'));
        if (node.attrs.style) {
            this.table.style.cssText = node.attrs.style;
        }
        this.colgroup = this.table.appendChild(document.createElement('colgroup'));
        updateColumns(node, this.colgroup, this.table, cellMinWidth);
        this.contentDOM = this.table.appendChild(document.createElement('tbody'));
    }
    update(node) {
        if (node.type !== this.node.type)
            return false;
        this.node = node;
        updateColumns(node, this.colgroup, this.table, this.cellMinWidth);
        return true;
    }
    ignoreMutation(mutation) {
        const target = mutation.target;
        const isInsideWrapper = this.dom.contains(target);
        const isInsideContent = this.contentDOM.contains(target);
        if (isInsideWrapper && !isInsideContent) {
            if (mutation.type === 'attributes' ||
                mutation.type === 'childList' ||
                mutation.type === 'characterData') {
                return true;
            }
        }
        if (mutation.type === 'childList') {
            const nodes = [
                ...Array.from(mutation.addedNodes),
                ...Array.from(mutation.removedNodes),
            ];
            if (nodes.some((n) => n instanceof Element &&
                n.classList.contains('tableReadonlySortChevron'))) {
                return true;
            }
        }
        return false;
    }
}
exports.TableView = TableView;
//# sourceMappingURL=table-view.js.map