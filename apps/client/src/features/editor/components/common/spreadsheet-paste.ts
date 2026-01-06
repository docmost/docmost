import type { EditorView } from "@tiptap/pm/view";
import { DOMParser } from "@tiptap/pm/model";

export const DEFAULT_SPREADSHEET_PASTE_LIMITS = {
  maxRows: 200,
  maxCols: 50,
} as const;

type DelimitedGrid = { delimiter: string; cells: string[][] } | null;

function isLikelySpreadsheetTSV(text: string): boolean {
  if (!text) return false;
  // Require at least one tab and at least 2 columns.
  if (!text.includes("\t")) return false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = normalized.split("\n").filter((r) => r.length > 0);
  if (rows.length === 0) return false;
  const maxCols = rows.reduce((acc, r) => Math.max(acc, r.split("\t").length), 0);
  return maxCols >= 2;
}

function inferDelimitedGrid(
  text: string,
  {
    maxRows,
    maxCols,
  }: { maxRows: number; maxCols: number } = DEFAULT_SPREADSHEET_PASTE_LIMITS,
): DelimitedGrid {
  if (!text) return null;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.replace(/\n+$/g, "").split("\n");
  if (lines.length === 0) return null;

  // Avoid treating single-line prose as a grid.
  const joined = lines.join("\n");
  if (lines.length === 1 && joined.length > 200) return null;

  const candidates = ["\t", ",", ";", "|"];
  let best: { delimiter: string; score: number; cols: number } | null = null;

  for (const delimiter of candidates) {
    const colCounts = lines.map((l) => l.split(delimiter).length);
    const maxCandidateCols = Math.max(...colCounts);
    if (maxCandidateCols < 2) continue;

    const avg =
      colCounts.reduce((sum, v) => sum + v, 0) / Math.max(colCounts.length, 1);
    const variance =
      colCounts.reduce((sum, v) => sum + (v - avg) ** 2, 0) /
      Math.max(colCounts.length, 1);

    // Prefer more columns, penalize raggedness.
    const score = maxCandidateCols * 10 - variance;

    if (!best || score > best.score) {
      best = { delimiter, score, cols: maxCandidateCols };
    }
  }

  if (!best) return null;

  // Require at least 2 columns and either multiple rows or 3+ columns,
  // to avoid converting normal comma-separated prose.
  if (best.cols < 2) return null;
  if (lines.length < 2 && best.cols < 3) return null;

  const cells = lines
    .slice(0, maxRows)
    .map((row) => row.split(best.delimiter).slice(0, maxCols));

  const normalizedMaxCols = Math.min(
    maxCols,
    cells.reduce((acc, r) => Math.max(acc, r.length), 0),
  );

  const normalizedCells = cells.map((r) => {
    const out = r.slice(0, normalizedMaxCols);
    while (out.length < normalizedMaxCols) out.push("");
    return out;
  });

  if (normalizedCells.length === 0 || normalizedCells[0].length < 2) return null;
  return { delimiter: best.delimiter, cells: normalizedCells };
}

function parseTSV(
  text: string,
  {
    maxRows,
    maxCols,
  }: { maxRows: number; maxCols: number } = DEFAULT_SPREADSHEET_PASTE_LIMITS,
): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Trim only trailing empty lines.
  const rawRows = normalized.replace(/\n+$/g, "").split("\n");
  const rows = rawRows.slice(0, maxRows).map((row) => row.split("\t"));
  const normalizedMaxCols = Math.min(
    maxCols,
    rows.reduce((acc, r) => Math.max(acc, r.length), 0),
  );
  return rows.map((r) => {
    const trimmed = r.slice(0, normalizedMaxCols);
    while (trimmed.length < normalizedMaxCols) trimmed.push("");
    return trimmed;
  });
}

function insertTableFromCells(view: EditorView, cells: string[][]): boolean {
  const { schema } = view.state;
  const tableType = schema.nodes.table;
  const rowType = schema.nodes.tableRow;
  const cellType = schema.nodes.tableCell;
  const headerType = schema.nodes.tableHeader;
  const paragraphType = schema.nodes.paragraph;

  if (!tableType || !rowType || !cellType || !paragraphType) return false;
  if (!cells?.length) return false;

  const maxCols = cells[0]?.length ?? 0;
  if (maxCols < 2) return false;

  const rows = cells.map((row, rowIdx) => {
    const cellsPM = row.map((text) => {
      const content = paragraphType.create(
        null,
        text ? schema.text(text) : undefined,
      );
      const type = rowIdx === 0 && headerType ? headerType : cellType;
      return type.create(null, content);
    });
    return rowType.create(null, cellsPM);
  });

  const tableNode = tableType.create(null, rows);
  const { tr } = view.state;
  const { from, to } = view.state.selection;
  tr.replaceRangeWith(from, to, tableNode);
  tr.setMeta("paste", true);
  view.dispatch(tr.scrollIntoView());
  return true;
}

function extractFirstTableHtml(html: string): string | null {
  if (!html) return null;
  const lower = html.toLowerCase();
  const idx = lower.indexOf("<table");
  if (idx === -1) return null;
  const endIdx = lower.lastIndexOf("</table>");
  if (endIdx === -1) return null;
  return html.slice(idx, endIdx + "</table>".length);
}

function extractTextFromHtml(html: string): string | null {
  if (!html) return null;
  try {
    const wrapped = `<body>${html}</body>`;
    const dom = new window.DOMParser().parseFromString(wrapped, "text/html").body;
    const text = dom.innerText;
    return text && text.trim() ? text : null;
  } catch {
    return null;
  }
}

export function clipboardHasMeaningfulText(event: ClipboardEvent): boolean {
  if (!event.clipboardData) return false;
  const plain = event.clipboardData.getData("text/plain");
  const html = event.clipboardData.getData("text/html");
  return (
    (typeof plain === "string" && plain.trim().length > 0) ||
    (typeof html === "string" && html.trim().length > 0)
  );
}

export function tryHandleSpreadsheetPaste(
  view: EditorView,
  event: ClipboardEvent,
  limits: { maxRows: number; maxCols: number } = DEFAULT_SPREADSHEET_PASTE_LIMITS,
): boolean {
  if (!event.clipboardData) return false;
  // Don’t interfere with code blocks.
  if (
    view.state.schema.nodes.codeBlock &&
    view.state.selection.$from.parent.type.name === "codeBlock"
  ) {
    return false;
  }

  const html = event.clipboardData.getData("text/html");
  const plain = event.clipboardData.getData("text/plain");

  // Prefer HTML tables if present (retains more formatting).
  const tableHtml = extractFirstTableHtml(html);
  if (tableHtml) {
    try {
      const wrapped = `<body>${tableHtml}</body>`;
      const dom = new window.DOMParser().parseFromString(wrapped, "text/html").body;
      const slice = DOMParser.fromSchema(view.state.schema).parseSlice(dom, {
        preserveWhitespace: true,
      });

      // If clipboard contains a <table>, prefer inserting it as a real table
      // (wins over image/file clipboard payloads, e.g. Nextcloud).
      event.preventDefault();
      const { tr } = view.state;
      const { from, to } = view.state.selection;
      tr.replaceRange(from, to, slice);
      tr.setMeta("paste", true);
      view.dispatch(tr.scrollIntoView());
      return true;
    } catch {
      // Ignore invalid clipboard HTML and fall back to other formats.
    }
  }

  // TSV → table.
  if (isLikelySpreadsheetTSV(plain)) {
    const cells = parseTSV(plain, limits);
    if (cells.length && cells[0].length >= 2) {
      event.preventDefault();
      return insertTableFromCells(view, cells);
    }
  }

  // CSV/semicolon/pipe grids (when no tabs/<table> are present).
  const grid =
    inferDelimitedGrid(plain, limits) ??
    inferDelimitedGrid(extractTextFromHtml(html) || "", limits);
  if (grid) {
    event.preventDefault();
    return insertTableFromCells(view, grid.cells);
  }

  return false;
}


