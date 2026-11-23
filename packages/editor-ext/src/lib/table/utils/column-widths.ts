import type { Node } from '@tiptap/pm/model';

export function getTableColumnWidths(table: Node): number[] {
  const widths: number[] = [];
  table.firstChild?.forEach(({ attrs }) => {
    for (let col = 0; col < attrs.colspan; col++) {
      widths.push(attrs.colwidth?.[col] || 0);
    }
  });
  return widths;
}

export function getPreferredTableWidth(widths: number[]): string {
  let fixed = 0;
  let automatic = 0;
  for (const width of widths) {
    if (width) fixed += width;
    else automatic++;
  }

  // Fit three automatic columns on a phone and give wider grids room to scroll.
  return automatic
    ? `calc(${fixed}px + ${automatic} * min(8rem, 100% / 3))`
    : '';
}
