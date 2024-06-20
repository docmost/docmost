import { StarterKit } from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { Superscript } from '@tiptap/extension-superscript';
import SubScript from '@tiptap/extension-subscript';
import { Highlight } from '@tiptap/extension-highlight';
import { Typography } from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Youtube } from '@tiptap/extension-youtube';
import {
  Callout,
  Comment,
  Details,
  DetailsContent,
  DetailsSummary,
  MathBlock,
  MathInline,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  TiptapImage,
  TiptapVideo,
  TrailingNode,
} from '@docmost/editor-ext';
import { generateHTML, generateJSON } from '@tiptap/html';
import { generateText, JSONContent } from '@tiptap/core';

export const tiptapExtensions = [
  StarterKit,
  Comment,
  TextAlign,
  TaskList,
  TaskItem,
  Underline,
  Link,
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
  Table,
  TableHeader,
  TableRow,
  TableCell,
  Youtube,
  TiptapImage,
  TiptapVideo,
  Callout,
] as any;

export function jsonToHtml(tiptapJson: JSONContent) {
  return generateHTML(tiptapJson, tiptapExtensions);
}

export function htmlToJson(html: string) {
  return generateJSON(html, tiptapExtensions);
}

export function jsonToText(tiptapJson: JSONContent) {
  return generateText(tiptapJson, tiptapExtensions);
}

export function getPageId(documentName: string) {
  return documentName.split('.')[1];
}
