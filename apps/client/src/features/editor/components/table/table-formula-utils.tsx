import type { Editor } from "@tiptap/react";

export type TableFormulaType = "sum" | "average" | "count" | "min" | "max";

/**
 * Cells containing text that starts with one of these labels followed by " ="
 * mark the entire row as the "formula row".
 */
const FORMULA_ROW_PATTERN = /^(SUM|AVERAGE|COUNT|MIN|MAX)\s*=/i;

interface CellContext {
  cellDepth: number;
  rowDepth: number;
  tableDepth: number;
}

interface RowInfo {
  node: any; // ProseMirror Node — typed as `any` to avoid @tiptap/pm imports
  offset: number;
  isFormula: boolean;
}

// ── ProseMirror tree helpers ─────────────────────────────────────────────────

/**
 * Walks up from the cursor to find the depths of the enclosing tableCell /
 * tableHeader, tableRow, and table nodes. Returns null outside a table cell.
 */
function findCellContext(editor: Editor): CellContext | null {
  const $pos = editor.state.selection.$from;
  let cellDepth = -1;
  let rowDepth = -1;
  let tableDepth = -1;

  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    const role = node.type.spec.tableRole as string | undefined;

    if (
      (node.type.name === "tableCell" || node.type.name === "tableHeader") &&
      cellDepth === -1
    ) {
      cellDepth = d;
    } else if (role === "row" && rowDepth === -1 && cellDepth !== -1) {
      rowDepth = d;
    } else if (role === "table" && tableDepth === -1 && rowDepth !== -1) {
      tableDepth = d;
      break;
    }
  }

  if (cellDepth === -1 || rowDepth === -1 || tableDepth === -1) return null;
  return { cellDepth, rowDepth, tableDepth };
}

/**
 * Returns the 0-based column index of the cursor's current cell, by comparing
 * the cell's opening-token position against each child offset in the row.
 */
function getCurrentColumnIndex(
  editor: Editor,
  ctx: CellContext,
): number | null {
  const $pos = editor.state.selection.$from;
  const rowNode = $pos.node(ctx.rowDepth);

  const cellOpeningPos = $pos.before(ctx.cellDepth); // absolute pos of cell open token
  const rowContentStart = $pos.start(ctx.rowDepth); // absolute pos of row content start

  let columnIndex = -1;
  rowNode.forEach((_child: any, offset: number, index: number) => {
    // rowContentStart + offset  ===  absolute position of this child's opening token
    if (rowContentStart + offset === cellOpeningPos) {
      columnIndex = index;
    }
  });

  return columnIndex === -1 ? null : columnIndex;
}

// ── Data extraction ──────────────────────────────────────────────────────────

/**
 * Collects every numeric value from all cells in `columnIndex`.
 * Non-numeric and empty cells are silently skipped.
 * Formula cells (e.g. "SUM = 42") produce NaN → also skipped, so they never
 * pollute a subsequent calculation.
 */
function getColumnNumericValues(
  editor: Editor,
  ctx: CellContext,
  columnIndex: number,
): number[] {
  const $pos = editor.state.selection.$from;
  const tableNode = $pos.node(ctx.tableDepth);
  const numbers: number[] = [];

  tableNode.forEach((rowNode: any) => {
    const role = rowNode.type.spec.tableRole as string | undefined;
    if (role !== "row") return;

    rowNode.forEach((cellNode: any, _offset: number, cellIdx: number) => {
      if (cellIdx !== columnIndex) return;
      const text = cellNode.textContent.trim();
      if (!text) return;
      const num = parseFloat(text);
      if (!isNaN(num)) numbers.push(num);
    });
  });

  return numbers;
}

// ── Formula computation ──────────────────────────────────────────────────────

/** Strips floating-point noise (e.g. 1.0000000001 → "1"). */
function formatNumber(value: number): string {
  const rounded = Math.round(value * 1e10) / 1e10;
  return (rounded === 0 ? 0 : rounded).toString();
}

function computeFormulaResult(
  numbers: number[],
  formula: TableFormulaType,
): string {
  switch (formula) {
    case "sum":
      return formatNumber(numbers.reduce((a, b) => a + b, 0));
    case "average":
      if (numbers.length === 0) return "0";
      return formatNumber(numbers.reduce((a, b) => a + b, 0) / numbers.length);
    case "count":
      return numbers.length.toString();
    case "min":
      return numbers.length === 0 ? "0" : formatNumber(Math.min(...numbers));
    case "max":
      return numbers.length === 0 ? "0" : formatNumber(Math.max(...numbers));
  }
}

// ── Row analysis ─────────────────────────────────────────────────────────────

/**
 * Scans every row in the table and records its node, offset, and whether any
 * cell contains text matching the formula pattern (e.g. "SUM = 42").
 */
function collectRows(tableNode: any): RowInfo[] {
  const rows: RowInfo[] = [];

  tableNode.forEach((rowNode: any, rowOffset: number) => {
    const role = rowNode.type.spec.tableRole as string | undefined;
    if (role !== "row") return;

    let isFormula = false;
    rowNode.forEach((cellNode: any) => {
      if (FORMULA_ROW_PATTERN.test(cellNode.textContent.trim())) {
        isFormula = true;
      }
    });

    rows.push({ node: rowNode, offset: rowOffset, isFormula });
  });

  return rows;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Applies `formula` to the column the cursor is currently in:
 *
 *  • If the **last row** of the table is already a formula row
 *    → update only the target cell in that row (other cells are untouched)
 *
 *  • Otherwise → append a brand-new formula row at the bottom where every
 *    cell is empty except the target column, which gets:
 *
 *      OPERATION = <result>   e.g.  "SUM = 42"  or  "AVERAGE = 14"
 */
export function insertTableFormula(
  editor: Editor,
  formula: TableFormulaType,
): boolean {
  if (!editor.isActive("table")) return false;

  const ctx = findCellContext(editor);
  if (!ctx) return false;

  const columnIndex = getCurrentColumnIndex(editor, ctx);
  if (columnIndex === null) return false;

  // ── Snapshot state values before entering the transaction ──────────────
  const $pos = editor.state.selection.$from;
  const tableNode = $pos.node(ctx.tableDepth);
  const tableContentStart = $pos.start(ctx.tableDepth);

  // Column count — read from the first row
  let columnCount = 0;
  let seenFirstRow = false;
  tableNode.forEach((rowNode: any) => {
    if (seenFirstRow) return;
    seenFirstRow = true;
    columnCount = rowNode.childCount;
  });
  if (columnCount === 0) return false;

  // Compute the result string:  "SUM = 42"
  const numbers = getColumnNumericValues(editor, ctx, columnIndex);
  const result = computeFormulaResult(numbers, formula);
  const cellText = `${formula.toUpperCase()} = ${result}`;

  // Determine whether the last row is already a formula row
  const rows = collectRows(tableNode);
  const lastRow = rows[rows.length - 1] ?? null;

  // ── Build and dispatch the transaction ─────────────────────────────────
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const { schema } = state;

      if (lastRow?.isFormula) {
        // ── UPDATE: replace the target cell's content in the existing row ──
        const lastRowContentStart = tableContentStart + lastRow.offset + 1;

        let targetCellOffset = -1;
        let targetCellContentSize = 0;
        lastRow.node.forEach(
          (cellNode: any, cellOffset: number, cellIdx: number) => {
            if (cellIdx !== columnIndex) return;
            targetCellOffset = cellOffset;
            targetCellContentSize = cellNode.content.size;
          },
        );
        if (targetCellOffset === -1) return false;

        // cellContentStart: just after the cell's opening token
        // cellContentEnd:   just before the cell's closing token
        const cellContentStart = lastRowContentStart + targetCellOffset + 1;
        const cellContentEnd = cellContentStart + targetCellContentSize;

        if (dispatch) {
          const para = schema.nodes.paragraph.create(null, [
            schema.text(cellText),
          ]);
          tr.replaceWith(cellContentStart, cellContentEnd, para);
          dispatch(tr);
        }
        return true;
      }

      // ── APPEND: insert a brand-new formula row at the end of the table ──
      const insertPos = tableContentStart + tableNode.content.size;

      const cells = Array.from({ length: columnCount }, (_, i) => {
        const para = schema.nodes.paragraph.create(
          null,
          i === columnIndex ? [schema.text(cellText)] : [],
        );
        return schema.nodes.tableCell.create(null, para);
      });

      const newRow = schema.nodes.tableRow.create(null, cells);

      if (dispatch) {
        tr.insert(insertPos, newRow);
        dispatch(tr);
      }
      return true;
    })
    .run();
}
