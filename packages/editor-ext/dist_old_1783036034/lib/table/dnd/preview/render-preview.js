"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearPreviewDOM = clearPreviewDOM;
exports.createPreviewDOM = createPreviewDOM;
function clearPreviewDOM(previewRoot) {
    while (previewRoot.firstChild) {
        previewRoot.removeChild(previewRoot.firstChild);
    }
}
function createPreviewDOM(table, previewRoot, index, direction) {
    clearPreviewDOM(previewRoot);
    const previewTable = document.createElement('table');
    const previewTableBody = document.createElement('tbody');
    previewTable.appendChild(previewTableBody);
    previewRoot.appendChild(previewTable);
    const rows = table.querySelectorAll('tr');
    if (direction === 'row') {
        const row = rows[index];
        const rowDOM = row.cloneNode(true);
        previewTableBody.appendChild(rowDOM);
    }
    else {
        rows.forEach((row) => {
            const rowDOM = row.cloneNode(false);
            const cells = row.querySelectorAll('th,td');
            if (cells[index]) {
                const cellDOM = cells[index].cloneNode(true);
                rowDOM.appendChild(cellDOM);
                previewTableBody.appendChild(rowDOM);
            }
        });
    }
}
//# sourceMappingURL=render-preview.js.map