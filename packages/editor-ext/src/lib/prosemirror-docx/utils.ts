import {
  Document,
  INumberingOptions,
  IPropertiesOptions,
  ISectionOptions,
  Packer,
  SectionType,
  sectionMarginDefaults,
  sectionPageSizeDefaults,
} from 'docx';
import { Node as ProsemirrorNode } from 'prosemirror-model';
import { TableMap } from '@tiptap/pm/tables';
import { IFootnotes, SerializationState } from './types';

// twips between the margins of docx's default page
export const TEXT_WIDTH =
  sectionPageSizeDefaults.WIDTH - sectionMarginDefaults.LEFT - sectionMarginDefaults.RIGHT;

// twips of left and right cell padding Word gives tables by default
export const CELL_MARGIN = 108;

// colwidth is in editor px; these are the editor's default content width and cellMinWidth
const EDITOR_WIDTH = 772;
const CELL_MIN_WIDTH = 49;

export function createShortId() {
  return Math.random().toString(36).slice(2, 11);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

// Spreads TEXT_WIDTH over the columns in their editor proportions. Columns never resized
// have no colwidth and share what the resized ones leave of the editor width.
export function getTableColumnWidths(table: ProsemirrorNode): number[] {
  const colwidths: number[] = [];
  table.firstChild?.forEach((cell) => {
    for (let i = 0; i < cell.attrs.colspan; i += 1) {
      colwidths.push(cell.attrs.colwidth?.[i] ?? 0);
    }
  });

  const columnCount = TableMap.get(table).width;
  const resized = colwidths.filter((width) => width > 0);
  const unresizedCount = columnCount - resized.length;
  const share = unresizedCount ? (EDITOR_WIDTH - sum(resized)) / unresizedCount : 0;
  const widths = Array.from({ length: columnCount }, (_, i) =>
    Math.max(colwidths[i] || share, CELL_MIN_WIDTH),
  );

  const total = sum(widths);
  return widths.map((width) => Math.round((width / total) * TEXT_WIDTH));
}

// Each cell, by row and cell index, is as wide as the columns it spans.
export function getTableCellWidths(table: ProsemirrorNode, columnWidths: number[]): number[][] {
  const map = TableMap.get(table);
  const cellWidths: number[][] = [];
  table.forEach((row, rowOffset) => {
    const rowWidths: number[] = [];
    row.forEach((_cell, cellOffset) => {
      const { left, right } = map.findCell(rowOffset + 1 + cellOffset);
      rowWidths.push(sum(columnWidths.slice(left, right)));
    });
    cellWidths.push(rowWidths);
  });
  return cellWidths;
}

export function buildDoc(state: SerializationState, opts?: IPropertiesOptions): Document {
  let sections = state?.sections?.length
    ? state.sections.map((section) => ({
        properties: section.config.properties || {
          type: SectionType.CONTINUOUS,
        },
        headers: section.config.headers,
        footers: section.config.footers,
        children: section.children,
      }))
    : undefined;
  if (!sections) {
    sections = [
      {
        headers: undefined,
        footers: undefined,
        properties: {
          type: SectionType.CONTINUOUS,
        },
        children: state?.children || [],
      },
    ];
  }

  const doc = new Document({
    footnotes: state.footnotes,
    numbering: {
      config: state.numbering,
    },
    sections,
    ...(opts || {}),
  });
  return doc;
}

/**
 *  @deprecated - use `buildDoc` instead
 *  Creates a docx document from the given state.
 * */
export function createDocFromState(state: {
  numbering: INumberingOptions['config'];
  children: ISectionOptions['children'];
  footnotes?: IFootnotes;
}) {
  return buildDoc({
    numbering: state.numbering,
    sections: [
      {
        config: {},
        children: state.children,
      },
    ],
    footnotes: state.footnotes,
  });
}

export async function writeDocx(
  doc: Document,
  /**
   * @deprecated use `.then()` or `await` instead
   */
  write?: ((buffer: Buffer) => void) | ((buffer: Buffer) => Promise<void>),
) {
  const buffer = await Packer.toBuffer(doc);
  await write?.(buffer);
  return buffer;
}

export function getLatexFromNode(node: ProsemirrorNode): string {
  let math = '';
  node.forEach((child) => {
    if (child.isText) math += child.text;
    // TODO: improve this as we may have other things in the future
  });
  return math;
}
