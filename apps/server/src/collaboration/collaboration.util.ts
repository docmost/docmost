import { StarterKit } from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import { Superscript } from '@tiptap/extension-superscript';
import SubScript from '@tiptap/extension-subscript';
import { Highlight } from '@tiptap/extension-highlight';
import { Typography } from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Youtube } from '@tiptap/extension-youtube';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import {
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
} from '@docmost/editor-ext';
import { generateText, getSchema, JSONContent } from '@tiptap/core';
import { generateHTML } from '../common/helpers/prosemirror/html';
import { generateJSON } from '../common/helpers/prosemirror/html';
// @tiptap/html library works best for generating prosemirror json state but not HTML
// see: https://github.com/ueberdosis/tiptap/issues/5352
// see:https://github.com/ueberdosis/tiptap/issues/4089
//import { generateJSON } from '@tiptap/html';
import { Node } from '@tiptap/pm/model';

export const tiptapExtensions = [
  StarterKit.configure({
    codeBlock: false,
    link: false,
    trailingNode: false,
  }),
  Comment,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
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
  return generateJSON(html, tiptapExtensions);
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
