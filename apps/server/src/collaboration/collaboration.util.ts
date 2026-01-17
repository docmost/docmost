import { StarterKit } from '@tiptap/starter-kit';
import {
  initProseMirrorDoc,
  relativePositionToAbsolutePosition,
} from 'y-prosemirror';
import * as Y from 'yjs';
import { Document } from '@hocuspocus/server';
import { TextAlign } from '@tiptap/extension-text-align';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Underline } from '@tiptap/extension-underline';
import { Superscript } from '@tiptap/extension-superscript';
import SubScript from '@tiptap/extension-subscript';
import { Typography } from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Youtube } from '@tiptap/extension-youtube';
import {
  Heading,
  Callout,
  Comment,
  CustomCodeBlock,
  Details,
  DetailsContent,
  DetailsSummary,
  LinkExtension,
  MathBlock,
  MathInline,
  TableHeader,
  TableCell,
  TableRow,
  CustomTable,
  TiptapImage,
  TiptapVideo,
  TrailingNode,
  Attachment,
  Drawio,
  Excalidraw,
  Embed,
  Mention,
  Subpages,
  Highlight,
  UniqueID,
  addUniqueIdsToDoc,
} from '@docmost/editor-ext';
import { generateText, getSchema, JSONContent } from '@tiptap/core';
import { generateHTML, generateJSON } from '../common/helpers/prosemirror/html';
// @tiptap/html library works best for generating prosemirror json state but not HTML
// see: https://github.com/ueberdosis/tiptap/issues/5352
// see:https://github.com/ueberdosis/tiptap/issues/4089
import { Node } from '@tiptap/pm/model';

export const tiptapExtensions = [
  StarterKit.configure({
    codeBlock: false,
    heading: false,
  }),
  Heading,
  UniqueID.configure({
    types: ['heading', 'paragraph'],
  }),
  Comment,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Underline,
  LinkExtension,
  Superscript,
  SubScript,
  Highlight,
  Typography,
  TrailingNode,
  TextStyle,
  Color,
  MathInline,
  MathBlock,
  Details,
  DetailsContent,
  DetailsSummary,
  CustomTable,
  TableCell,
  TableRow,
  TableHeader,
  Youtube,
  TiptapImage,
  TiptapVideo,
  Callout,
  Attachment,
  CustomCodeBlock,
  Drawio,
  Excalidraw,
  Embed,
  Mention,
  Subpages,
] as any;

export function jsonToHtml(tiptapJson: any) {
  return generateHTML(tiptapJson, tiptapExtensions);
}

export function htmlToJson(html: string) {
  const pmJson = generateJSON(html, tiptapExtensions);

  try {
    return addUniqueIdsToDoc(pmJson, tiptapExtensions);
  } catch (error) {
    console.warn('failed to add unique ids to doc', error);
    return pmJson;
  }
}

export function jsonToText(tiptapJson: JSONContent) {
  return generateText(tiptapJson, tiptapExtensions);
}

export function jsonToNode(tiptapJson: JSONContent) {
  return Node.fromJSON(getSchema(tiptapExtensions), tiptapJson);
}

export function getPageId(documentName: string) {
  return documentName.split('.')[1];
}

export type YjsSelection = {
  anchor: any;
  head: any;
};

export function setYjsMark(
  doc: Document,
  fragment: Y.XmlFragment,
  yjsSelection: YjsSelection,
  markName: string,
  markAttributes: Record<string, any>,
) {
  const schema = getSchema(tiptapExtensions);
  const { mapping } = initProseMirrorDoc(fragment, schema);

  // Convert JSON positions to Y.js RelativePosition objects
  const anchorRelPos = Y.createRelativePositionFromJSON(yjsSelection.anchor);
  const headRelPos = Y.createRelativePositionFromJSON(yjsSelection.head);

  const anchor = relativePositionToAbsolutePosition(
    doc,
    fragment,
    anchorRelPos,
    mapping,
  );
  const head = relativePositionToAbsolutePosition(
    doc,
    fragment,
    headRelPos,
    mapping,
  );

  if (anchor === null || head === null) {
    throw new Error(
      'Could not resolve Y.js relative positions to absolute positions',
    );
  }

  const from = Math.min(anchor, head);
  const to = Math.max(anchor, head);

  // Apply mark directly to Y.js XmlText nodes
  // This bypasses updateYFragment which has compatibility issues
  applyMarkToYFragment(fragment, from, to, markName, markAttributes);
}

function applyMarkToYFragment(
  fragment: Y.XmlFragment,
  from: number,
  to: number,
  markName: string,
  markAttributes: Record<string, any>,
) {
  let pos = 0;

  const processItem = (item: any): boolean => {
    if (pos >= to) return false;

    if (item instanceof Y.XmlText) {
      const textLength = item.length;
      const itemEnd = pos + textLength;

      if (itemEnd > from && pos < to) {
        const formatFrom = Math.max(0, from - pos);
        const formatTo = Math.min(textLength, to - pos);
        const formatLength = formatTo - formatFrom;

        if (formatLength > 0) {
          item.format(formatFrom, formatLength, { [markName]: markAttributes });
        }
      }
      pos = itemEnd;
    } else if (item instanceof Y.XmlElement) {
      pos++; // Opening tag
      for (let i = 0; i < item.length; i++) {
        if (!processItem(item.get(i))) return false;
      }
      pos++; // Closing tag
    }
    return true;
  };

  for (let i = 0; i < fragment.length; i++) {
    if (!processItem(fragment.get(i))) break;
  }
}
