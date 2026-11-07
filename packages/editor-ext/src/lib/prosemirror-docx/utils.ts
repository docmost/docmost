import {
  Document,
  IImageOptions,
  ImageRun,
  INumberingOptions,
  IPropertiesOptions,
  ISectionOptions,
  Packer,
  SectionType,
  sectionMarginDefaults,
  sectionPageSizeDefaults,
} from 'docx';
import { imageDimensionsFromData } from 'image-dimensions';
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

export type ImageWidth = number | string | null;

type ImageInfo = {
  type: 'png' | 'jpg' | 'gif' | 'svg';
  width: number;
  height: number;
};

// The raster formats docx declares a content type for. Other formats, such as
// WebP or HEIC, would produce a media part that Word cannot read.
const DOCX_RASTER_TYPES: Record<string, ImageInfo['type']> = {
  png: 'png',
  jpeg: 'jpg',
  gif: 'gif',
};

// The size browsers give an SVG that does not declare one
const SVG_DEFAULT_WIDTH = 300;
const SVG_DEFAULT_HEIGHT = 150;

// The svg element has to be the root, so only a prolog can come before it. Its
// tag is matched attribute by attribute since a value can contain ">".
const SVG_ROOT_TAG =
  /^\s*(?:<\?[\s\S]*?\?>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>\s*)*<svg\b((?:[^>"']|"[^"]*"|'[^']*')*)>/;
const XML_ATTRIBUTE = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const SVG_UNITS_IN_PX: Record<string, number> = {
  '': 1,
  px: 1,
  pt: 96 / 72,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
};

// Word shows this to readers that cannot render SVG, stretched to the image size
const SVG_FALLBACK_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGO4BAAA1ADTqstRPwAAAABJRU5ErkJggg=='),
  (char) => char.charCodeAt(0),
);

// Relative units are ignored because they say nothing about the image's own size
function parseSvgLength(value?: string): number | undefined {
  const match = value?.trim().match(/^(\d*\.?\d+)([a-z]*)$/);
  const unit = match && SVG_UNITS_IN_PX[match[2]];
  const length = unit ? parseFloat(match[1]) * unit : 0;
  return length > 0 ? length : undefined;
}

function getSvgInfo(buffer: Uint8Array): ImageInfo | undefined {
  const rootTag = new TextDecoder().decode(buffer).match(SVG_ROOT_TAG);
  if (!rootTag) return undefined;

  const attrs = new Map(
    [...rootTag[1].matchAll(XML_ATTRIBUTE)].map(([, name, double, single]) => [
      name,
      double ?? single,
    ]),
  );
  const width = parseSvgLength(attrs.get('width'));
  const height = parseSvgLength(attrs.get('height'));
  if (width && height) return { type: 'svg', width, height };

  const [, , viewBoxWidth, viewBoxHeight] = (attrs.get('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(parseFloat);
  if (viewBoxWidth > 0 && viewBoxHeight > 0) {
    const aspect = viewBoxHeight / viewBoxWidth;
    const resolvedWidth = width ?? (height ? height / aspect : viewBoxWidth);
    return { type: 'svg', width: resolvedWidth, height: resolvedWidth * aspect };
  }

  return {
    type: 'svg',
    width: width ?? SVG_DEFAULT_WIDTH,
    height: height ?? SVG_DEFAULT_HEIGHT,
  };
}

// The type comes from the bytes because a src says little about the file: it
// can be a data URI, have a query string, or have no extension at all.
export function getImageInfo(buffer: Uint8Array): ImageInfo | undefined {
  const dimensions = imageDimensionsFromData(buffer);
  if (!dimensions) return getSvgInfo(buffer);

  const type = DOCX_RASTER_TYPES[dimensions.type];
  return type && { type, width: dimensions.width, height: dimensions.height };
}

// A number is in px and a string can also be a percentage of maxWidth. Without
// a usable width the image keeps its natural size, up to maxWidth.
export function resolveImageWidth(
  width: ImageWidth | undefined,
  naturalWidth: number,
  maxWidth: number,
): number {
  const value = typeof width === 'string' ? parseFloat(width) : width;
  if (!value || value < 0) return Math.min(naturalWidth, maxWidth);

  const isPercent = typeof width === 'string' && width.trim().endsWith('%');
  return Math.min(isPercent ? (maxWidth * value) / 100 : value, maxWidth);
}

export function createImageRun(
  buffer: Uint8Array,
  image: ImageInfo,
  width: number,
  imageRunOpts?: Partial<IImageOptions>,
): ImageRun {
  const typeOpts =
    image.type === 'svg'
      ? { type: image.type, fallback: { type: 'png', data: SVG_FALLBACK_PNG } }
      : { type: image.type };

  return new ImageRun({
    data: buffer,
    ...imageRunOpts,
    ...typeOpts,
    transformation: {
      ...imageRunOpts?.transformation,
      width,
      height: width * (image.height / image.width),
    },
  } as IImageOptions);
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
