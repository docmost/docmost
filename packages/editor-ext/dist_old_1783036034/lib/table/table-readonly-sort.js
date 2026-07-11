"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableReadonlySort = void 0;
const core_1 = require("@tiptap/core");
const state_1 = require("@tiptap/pm/state");
const CHEVRON_CLASS = 'tableReadonlySortChevron';
const tableReadonlySortKey = new state_1.PluginKey('tableReadonlySort');
const sortStates = new WeakMap();
const originalOrders = new WeakMap();
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
function getColumnIndex(th) {
    const row = th.parentElement;
    if (!row)
        return -1;
    let col = 0;
    for (let i = 0; i < row.cells.length; i++) {
        if (row.cells[i] === th)
            return col;
        col += row.cells[i].colSpan ?? 1;
    }
    return -1;
}
function getHeaderTh(target) {
    if (!(target instanceof Element))
        return null;
    const th = target.closest('th');
    if (!th)
        return null;
    const row = th.parentElement;
    if (!row)
        return null;
    const tbody = row.parentElement;
    if (!tbody)
        return null;
    const table = tbody.closest('table');
    if (!table)
        return null;
    const firstRow = table.querySelector('tr');
    if (firstRow !== row)
        return null;
    return th;
}
function getCellText(row, colIndex) {
    let col = 0;
    for (let i = 0; i < row.cells.length; i++) {
        if (col === colIndex)
            return row.cells[i].textContent?.trim() ?? '';
        col += row.cells[i].colSpan ?? 1;
    }
    return '';
}
function getOrSaveOriginalOrder(table, dataRows) {
    if (!originalOrders.has(table)) {
        originalOrders.set(table, [...dataRows]);
    }
    return originalOrders.get(table);
}
function sortDataRows(dataRows, colIndex, direction) {
    return [...dataRows].sort((a, b) => {
        const textA = getCellText(a, colIndex);
        const textB = getCellText(b, colIndex);
        const emptyA = textA === '';
        const emptyB = textB === '';
        if (emptyA && emptyB)
            return 0;
        if (emptyA)
            return 1;
        if (emptyB)
            return -1;
        const cmp = collator.compare(textA, textB);
        return direction === 'asc' ? cmp : -cmp;
    });
}
function applySort(table, colIndex) {
    const tbody = table.querySelector('tbody');
    if (!tbody)
        return;
    const allRows = Array.from(tbody.querySelectorAll(':scope > tr'));
    if (allRows.length === 0)
        return;
    const headerRow = allRows[0];
    const dataRows = allRows.slice(1);
    if (dataRows.length === 0)
        return;
    const current = sortStates.get(table) ?? null;
    const saved = getOrSaveOriginalOrder(table, dataRows);
    let next;
    if (!current || current.col !== colIndex) {
        next = { col: colIndex, direction: 'asc' };
    }
    else if (current.direction === 'asc') {
        next = { col: colIndex, direction: 'desc' };
    }
    else {
        next = null;
    }
    if (next === null) {
        sortStates.delete(table);
        tbody.append(headerRow, ...saved);
    }
    else {
        sortStates.set(table, next);
        const sorted = sortDataRows(saved, next.col, next.direction);
        tbody.append(headerRow, ...sorted);
    }
    updateChevrons(table);
}
const CHEVRON_SVG = '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">' +
    '<path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />' +
    '</svg>';
function ensureChevron(th) {
    let chevron = th.querySelector(`.${CHEVRON_CLASS}`);
    if (!chevron) {
        chevron = document.createElement('span');
        chevron.className = CHEVRON_CLASS;
        chevron.setAttribute('aria-hidden', 'true');
        chevron.innerHTML = CHEVRON_SVG;
        th.appendChild(chevron);
    }
    return chevron;
}
function updateChevrons(table) {
    const firstRow = table.querySelector('tr');
    if (!firstRow)
        return;
    const state = sortStates.get(table) ?? null;
    let col = 0;
    for (let i = 0; i < firstRow.cells.length; i++) {
        const cell = firstRow.cells[i];
        if (cell.tagName !== 'TH') {
            col += cell.colSpan ?? 1;
            continue;
        }
        const chevron = ensureChevron(cell);
        let label;
        if (state && state.col === col) {
            chevron.setAttribute('data-sort', state.direction);
            label = state.direction === 'asc' ? 'Sort descending' : 'Clear sort';
        }
        else {
            chevron.removeAttribute('data-sort');
            label = 'Sort ascending';
        }
        chevron.setAttribute('data-tooltip', label);
        chevron.setAttribute('aria-label', label);
        chevron.title = label;
        col += cell.colSpan ?? 1;
    }
}
function addChevronsToAllTables(editorRoot) {
    const tables = editorRoot.querySelectorAll('table');
    tables.forEach((table) => updateChevrons(table));
}
function removeAllChevrons(editorRoot) {
    editorRoot
        .querySelectorAll(`.${CHEVRON_CLASS}`)
        .forEach((el) => el.remove());
}
exports.TableReadonlySort = core_1.Extension.create({
    name: 'tableReadonlySort',
    addProseMirrorPlugins() {
        const editor = this.editor;
        let editorRoot = null;
        const onClick = (event) => {
            if (editor.isEditable)
                return;
            if (!(event.target instanceof Element))
                return;
            const chevron = event.target.closest(`.${CHEVRON_CLASS}`);
            if (!chevron)
                return;
            const th = getHeaderTh(chevron);
            if (!th)
                return;
            const table = th.closest('table');
            if (!table)
                return;
            const colIndex = getColumnIndex(th);
            if (colIndex < 0)
                return;
            applySort(table, colIndex);
        };
        return [
            new state_1.Plugin({
                key: tableReadonlySortKey,
                view(editorView) {
                    editorRoot = editorView.dom;
                    editorRoot.addEventListener('click', onClick);
                    if (!editor.isEditable) {
                        addChevronsToAllTables(editorRoot);
                    }
                    return {
                        update(view) {
                            const root = view.dom;
                            if (!editor.isEditable) {
                                addChevronsToAllTables(root);
                            }
                            else {
                                removeAllChevrons(root);
                            }
                        },
                        destroy() {
                            if (editorRoot) {
                                editorRoot.removeEventListener('click', onClick);
                                removeAllChevrons(editorRoot);
                            }
                        },
                    };
                },
            }),
        ];
    },
});
//# sourceMappingURL=table-readonly-sort.js.map