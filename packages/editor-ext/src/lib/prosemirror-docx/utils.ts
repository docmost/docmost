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
import { imageDimensionsFromData } from 'image-dimensions';
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

// docx requires a raster fallback next to an SVG; readers that cannot draw SVG show it
export const BLANK_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';

// WebP, AVIF and HEIC have no docx image type
const DOCX_RASTER_TYPES: Partial<Record<string, 'png' | 'jpg' | 'gif'>> = {
  png: 'png',
  jpeg: 'jpg',
  gif: 'gif',
};

const SVG_UNITS_IN_PX: Record<string, number> = {
  px: 1,
  pt: 4 / 3,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
};

// XML declaration, comments and doctype may precede the root svg start tag. Each part
// ends at its first terminator, so a failed match never backtracks across parts.
const SVG_START_TAG =
  /^(?:\s|<\?(?:[^?]|\?(?!>))*\?>|<!--(?:[^-]|-(?!->))*-->|<!DOCTYPE[^[>]*(?:\[(?:[^\]"']|"[^"]*"|'[^']*')*\][^>]*)?>)*<svg\b((?:[^>"']|"[^"]*"|'[^']*')*)>/i;

function svgLength(value?: string): number | undefined {
  const match = value
    ?.trim()
    .match(/^((?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)(px|pt|pc|in|cm|mm)?$/i);
  if (!match) return undefined;
  const px = parseFloat(match[1]) * SVG_UNITS_IN_PX[(match[2] ?? 'px').toLowerCase()];
  return px > 0 ? px : undefined;
}

// Sized like a browser sizes an SVG image: width and height, else the viewBox, else 300x150.
function svgDimensionsFromData(
  data: Uint8Array,
): { width: number; height: number } | undefined {
  const tag = new TextDecoder().decode(data).match(SVG_START_TAG)?.[1];
  if (tag === undefined) return undefined;

  const attrs: Record<string, string> = {};
  // a name starts after whitespace, so a long run of name characters is read only once
  for (const [, name, doubleQuoted, singleQuoted] of tag.matchAll(
    /(?:^|\s)([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
  )) {
    attrs[name] = doubleQuoted ?? singleQuoted;
  }

  let width = svgLength(attrs.width);
  let height = svgLength(attrs.height);
  const [, , boxWidth, boxHeight] = (attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  if (boxWidth > 0 && boxHeight > 0) {
    width ??= height ? (height * boxWidth) / boxHeight : boxWidth;
    height ??= (width * boxHeight) / boxWidth;
  }
  return { width: width ?? 300, height: height ?? 150 };
}

// The node's width in px or, on older pages, a percentage of the page, else the image's own
// width, never wider than the page or table cell.
export function getImageWidth(
  nodeWidth: number | string | null | undefined,
  naturalWidth: number,
  maxWidth: number,
): number {
  let width = naturalWidth;
  if (typeof nodeWidth === 'number' && nodeWidth > 0) {
    width = nodeWidth;
  } else if (typeof nodeWidth === 'string' && nodeWidth.endsWith('%')) {
    width = (parseFloat(nodeWidth) / 100) * maxWidth || naturalWidth;
  }
  return Math.min(width, maxWidth);
}

// The type docx embeds the image as, read from its bytes since URLs may carry a query string.
export function docxImageFromData(
  data: Uint8Array,
): { type: 'png' | 'jpg' | 'gif' | 'svg'; width: number; height: number } | undefined {
  const raster = imageDimensionsFromData(data);
  if (raster) {
    const type = DOCX_RASTER_TYPES[raster.type];
    return type && { type, width: raster.width, height: raster.height };
  }
  const svg = svgDimensionsFromData(data);
  return svg && { type: 'svg', ...svg };
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
