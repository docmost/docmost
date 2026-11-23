import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view';
import { getColStyleDeclaration } from './utils/col-style';
import {
  getPreferredTableWidth,
  getTableColumnWidths,
} from './utils/column-widths';

export function updateColumns(
  node: ProseMirrorNode,
  colgroup: HTMLElement,
  table: HTMLTableElement,
  cellMinWidth: number,
  overrideCol?: number,
  overrideValue?: number,
) {
  let totalWidth = 0;
  const widths = getTableColumnWidths(node);
  if (overrideCol !== undefined && overrideCol >= 0 && overrideCol < widths.length) {
    widths[overrideCol] = overrideValue || 0;
  }

  for (const [index, width] of widths.entries()) {
    totalWidth += width || cellMinWidth;
    const existing = colgroup.children.item(index) as HTMLTableColElement | null;
    const col = existing ?? colgroup.appendChild(document.createElement('col'));
    const [property, value] = getColStyleDeclaration(cellMinWidth, width);
    col.style.removeProperty(width ? 'min-width' : 'width');
    if (col.style.getPropertyValue(property) !== value) {
      col.style.setProperty(property, value);
    }
  }
  while (colgroup.children.length > widths.length) {
    colgroup.lastElementChild!.remove();
  }
  const preferredWidth = getPreferredTableWidth(widths);
  table.style.setProperty('--table-preferred-width', preferredWidth);

  const hasUserWidth =
    node.attrs.style &&
    typeof node.attrs.style === 'string' &&
    /\bwidth\s*:/i.test(node.attrs.style);

  if (!preferredWidth && !hasUserWidth) {
    table.style.width = `${totalWidth}px`;
    table.style.minWidth = '';
  } else {
    table.style.width = '';
    table.style.minWidth = `${totalWidth}px`;
  }
}

export class TableView implements NodeView {
  node: ProseMirrorNode;

  cellMinWidth: number;

  dom: HTMLDivElement;

  table: HTMLTableElement;

  colgroup: HTMLTableColElement;

  contentDOM: HTMLTableSectionElement;

  constructor(node: ProseMirrorNode, cellMinWidth: number) {
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

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) return false;

    this.node = node;
    updateColumns(node, this.colgroup, this.table, this.cellMinWidth);

    return true;
  }

  ignoreMutation(mutation: ViewMutationRecord) {
    const target = mutation.target as Node;
    const isInsideWrapper = this.dom.contains(target);
    const isInsideContent = this.contentDOM.contains(target);

    if (isInsideWrapper && !isInsideContent) {
      if (
        mutation.type === 'attributes' ||
        mutation.type === 'childList' ||
        mutation.type === 'characterData'
      ) {
        return true;
      }
    }

    // Chevron span (.tableReadonlySortChevron) added/removed by sort plugin.
    if (mutation.type === 'childList') {
      const nodes = [
        ...Array.from(mutation.addedNodes),
        ...Array.from(mutation.removedNodes),
      ];
      if (
        nodes.some(
          (n) =>
            n instanceof Element &&
            n.classList.contains('tableReadonlySortChevron'),
        )
      ) {
        return true;
      }
    }

    return false;
  }
}
