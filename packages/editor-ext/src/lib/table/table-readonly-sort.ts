import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

type SortDirection = 'asc' | 'desc';

type SortState = {
  col: number;
  direction: SortDirection;
};

const CHEVRON_CLASS = 'tableReadonlySortChevron';

const tableReadonlySortKey = new PluginKey('tableReadonlySort');

const sortStates = new WeakMap<HTMLTableElement, SortState>();
const originalOrders = new WeakMap<HTMLTableElement, HTMLTableRowElement[]>();

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function getColumnIndex(th: HTMLTableCellElement): number {
  const row = th.parentElement as HTMLTableRowElement;
  if (!row) return -1;
  let col = 0;
  for (let i = 0; i < row.cells.length; i++) {
    if (row.cells[i] === th) return col;
    col += row.cells[i].colSpan ?? 1;
  }
  return -1;
}

function getHeaderTh(target: EventTarget | null): HTMLTableCellElement | null {
  if (!(target instanceof Element)) return null;
  const th = target.closest('th') as HTMLTableCellElement | null;
  if (!th) return null;
  const row = th.parentElement;
  if (!row) return null;
  const tbody = row.parentElement;
  if (!tbody) return null;
  const table = tbody.closest('table');
  if (!table) return null;

  // th must be in the first row of the table (could be in thead or tbody)
  const firstRow = table.querySelector('tr');
  if (firstRow !== row) return null;

  return th;
}

function getCellText(row: HTMLTableRowElement, colIndex: number): string {
  let col = 0;
  for (let i = 0; i < row.cells.length; i++) {
    if (col === colIndex) return row.cells[i].textContent?.trim() ?? '';
    col += row.cells[i].colSpan ?? 1;
  }
  return '';
}

function getOrSaveOriginalOrder(
  table: HTMLTableElement,
  dataRows: HTMLTableRowElement[],
): HTMLTableRowElement[] {
  if (!originalOrders.has(table)) {
    originalOrders.set(table, [...dataRows]);
  }
  return originalOrders.get(table)!;
}

function sortDataRows(
  dataRows: HTMLTableRowElement[],
  colIndex: number,
  direction: SortDirection,
): HTMLTableRowElement[] {
  return [...dataRows].sort((a, b) => {
    const textA = getCellText(a, colIndex);
    const textB = getCellText(b, colIndex);
    const emptyA = textA === '';
    const emptyB = textB === '';
    if (emptyA && emptyB) return 0;
    if (emptyA) return 1;
    if (emptyB) return -1;
    const cmp = collator.compare(textA, textB);
    return direction === 'asc' ? cmp : -cmp;
  });
}

function applySort(table: HTMLTableElement, colIndex: number): void {
  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  const allRows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>(':scope > tr'));
  if (allRows.length === 0) return;

  const headerRow = allRows[0];
  const dataRows = allRows.slice(1);
  if (dataRows.length === 0) return;

  const current = sortStates.get(table) ?? null;
  const saved = getOrSaveOriginalOrder(table, dataRows);

  let next: SortState | null;
  if (!current || current.col !== colIndex) {
    next = { col: colIndex, direction: 'asc' };
  } else if (current.direction === 'asc') {
    next = { col: colIndex, direction: 'desc' };
  } else {
    next = null;
  }

  if (next === null) {
    sortStates.delete(table);
    tbody.append(headerRow, ...saved);
  } else {
    sortStates.set(table, next);
    const sorted = sortDataRows(saved, next.col, next.direction);
    tbody.append(headerRow, ...sorted);
  }

  updateChevrons(table);
}

const CHEVRON_SVG =
  '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">' +
  '<path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />' +
  '</svg>';

function ensureChevron(th: HTMLTableCellElement): HTMLSpanElement {
  let chevron = th.querySelector<HTMLSpanElement>(`.${CHEVRON_CLASS}`);
  if (!chevron) {
    chevron = document.createElement('span');
    chevron.className = CHEVRON_CLASS;
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = CHEVRON_SVG;
    th.appendChild(chevron);
  }
  return chevron;
}

function updateChevrons(table: HTMLTableElement): void {
  const firstRow = table.querySelector('tr');
  if (!firstRow) return;

  const state = sortStates.get(table) ?? null;
  let col = 0;
  for (let i = 0; i < firstRow.cells.length; i++) {
    const cell = firstRow.cells[i];
    if (cell.tagName !== 'TH') {
      col += cell.colSpan ?? 1;
      continue;
    }
    const chevron = ensureChevron(cell as HTMLTableCellElement);
    let label: string;
    if (state && state.col === col) {
      chevron.setAttribute('data-sort', state.direction);
      label = state.direction === 'asc' ? 'Sort descending' : 'Clear sort';
    } else {
      chevron.removeAttribute('data-sort');
      label = 'Sort ascending';
    }
    chevron.setAttribute('data-tooltip', label);
    chevron.setAttribute('aria-label', label);
    chevron.title = label;
    col += cell.colSpan ?? 1;
  }
}

function addChevronsToAllTables(editorRoot: HTMLElement): void {
  const tables = editorRoot.querySelectorAll<HTMLTableElement>('table');
  tables.forEach((table) => updateChevrons(table));
}

function removeAllChevrons(editorRoot: HTMLElement): void {
  editorRoot
    .querySelectorAll<HTMLSpanElement>(`.${CHEVRON_CLASS}`)
    .forEach((el) => el.remove());
}

export const TableReadonlySort = Extension.create({
  name: 'tableReadonlySort',

  addProseMirrorPlugins() {
    const editor = this.editor;
    let editorRoot: HTMLElement | null = null;

    const onClick = (event: MouseEvent) => {
      if (editor.isEditable) return;
      // Only react to clicks on the chevron, not anywhere else in the header
      // cell. This lets the user click into a header to select text without
      // accidentally triggering a sort.
      if (!(event.target instanceof Element)) return;
      const chevron = event.target.closest(`.${CHEVRON_CLASS}`);
      if (!chevron) return;
      const th = getHeaderTh(chevron);
      if (!th) return;
      const table = th.closest('table') as HTMLTableElement | null;
      if (!table) return;
      const colIndex = getColumnIndex(th);
      if (colIndex < 0) return;
      applySort(table, colIndex);
    };

    return [
      new Plugin({
        key: tableReadonlySortKey,

        view(editorView) {
          editorRoot = editorView.dom as HTMLElement;
          editorRoot.addEventListener('click', onClick);

          if (!editor.isEditable) {
            addChevronsToAllTables(editorRoot);
          }

          return {
            update(view) {
              const root = view.dom as HTMLElement;
              if (!editor.isEditable) {
                addChevronsToAllTables(root);
              } else {
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
