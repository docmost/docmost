import { StarterKit } from '@tiptap/starter-kit';
import { Document } from '@tiptap/extension-document';
import { TextAlign } from '@tiptap/extension-text-align';
import { Superscript } from '@tiptap/extension-superscript';
import SubScript from '@tiptap/extension-subscript';
import { Typography } from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import { Youtube } from '@tiptap/extension-youtube';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import {
  Heading,
  SectionAnchor,
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
  TiptapAudio,
  TiptapPdf,
  PageBreak,
  TrailingNode,
  Attachment,
  Drawio,
  Excalidraw,
  Embed,
  Mention,
  Subpages,
  RecentlyUpdated,
  ItemsByLabel,
  Highlight,
  Color,
  Indent,
  UniqueID,
  Columns,
  Column,
  Status,
  DateNode,
  TemplatePlaceholder,
  TemplateVariableNode,
  addUniqueIdsToDoc,
  htmlToMarkdown,
  TransclusionSource,
  TransclusionReference,
  BaseEmbed,
  Footnotes,
  Footnote,
  FootnoteReference,
  IntegrationCard,
  IntegrationMention,
  LinkCard,
  LinkMention,
  Tabs,
  Tab,
  TabLabel,
  TabPanel,
  MicrosoftFile,
  MicrosoftFolder,
} from '@docmost/editor-ext';
import {
  extensions as coreExtensions,
  generateText,
  getSchema,
  JSONContent,
  type Extensions,
} from '@tiptap/core';
import { generateHTML, generateJSON } from '../common/helpers/prosemirror/html';
import { collapseBlankLines } from '../common/helpers';
// @tiptap/html library works best for generating prosemirror json state but not HTML
// see: https://github.com/ueberdosis/tiptap/issues/5352
// see:https://github.com/ueberdosis/tiptap/issues/4089
//import { generateJSON } from '@tiptap/html';
import { Node, Schema } from '@tiptap/pm/model';
import * as Y from 'yjs';
import { Logger } from '@nestjs/common';

export const tiptapExtensions = [
  coreExtensions.TextDirection.configure({ direction: 'auto' }),
  StarterKit.configure({
    document: false,
    codeBlock: false,
    link: false,
    trailingNode: false,
    heading: false,
  }),
  Document.extend({
    content: 'block+ footnotes?',
  }),
  Heading,
  SectionAnchor,
  UniqueID.configure({
    types: ['heading', 'paragraph', 'transclusionSource', 'sectionAnchor'],
  }),
  Comment,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Indent,
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
  Tabs,
  Tab,
  TabLabel,
  TabPanel,
  CustomTable,
  TableCell,
  TableRow,
  TableHeader,
  Youtube,
  TiptapImage,
  TiptapVideo,
  TiptapAudio,
  TiptapPdf,
  PageBreak,
  Callout,
  Attachment,
  CustomCodeBlock,
  Drawio,
  Excalidraw,
  Embed,
  Mention,
  Subpages,
  RecentlyUpdated,
  ItemsByLabel,
  Columns,
  Column,
  Status,
  DateNode,
  TemplatePlaceholder,
  TransclusionSource,
  TransclusionReference,
  BaseEmbed,
  Footnotes,
  Footnote,
  FootnoteReference,
  IntegrationCard,
  IntegrationMention,
  LinkCard,
  LinkMention,
  MicrosoftFile,
  MicrosoftFolder,
] as any;

export const templateExtensions: Extensions = [
  ...tiptapExtensions,
  TemplateVariableNode,
];

// Pages and templates share serializers. Only template imports retain editable fields.
export function jsonToHtml(tiptapJson: any) {
  return generateHTML(tiptapJson, templateExtensions);
}

export function htmlToJson(
  html: string,
  extensions: Extensions = tiptapExtensions,
) {
  const pmJson = generateJSON(html, extensions);

  try {
    return addUniqueIdsToDoc(pmJson, extensions);
  } catch (error) {
    console.warn('failed to add unique ids to doc', error);
    return pmJson;
  }
}

const linkPreviewText = ({ node }: { node: Node }) =>
  [node.attrs.title, node.attrs.url].filter(Boolean).join(' ');

export function jsonToText(tiptapJson: JSONContent) {
  // Public search snippets use this stored text before the page is rendered.
  return collapseBlankLines(
    generateText(tiptapJson, templateExtensions, {
      textSerializers: {
        itemsByLabel: () => '',
        linkCard: linkPreviewText,
        linkMention: linkPreviewText,
      },
    }),
  );
}

export function parseDocumentJson(
  content: JSONContent,
  extensions: Extensions = tiptapExtensions,
) {
  const schema = getSchema(extensions);
  try {
    return { content, node: Node.fromJSON(schema, content) };
  } catch (error) {
    if (
      error instanceof RangeError &&
      error.message.includes('Unknown node type')
    ) {
      Logger.warn('Stripping unknown node types from document:', error.message);
      const cleaned = stripUnknownNodes(content, schema);
      return { content: cleaned, node: Node.fromJSON(schema, cleaned) };
    }
    throw error;
  }
}

export function jsonToNode(content: JSONContent) {
  return parseDocumentJson(content).node;
}

export function getPageId(documentName: string) {
  return documentName.split('.')[1];
}

export function isEmptyParagraphDoc(tiptapJson: JSONContent): boolean {
  if (!tiptapJson || tiptapJson.type !== 'doc') return false;
  const content = tiptapJson.content;
  if (!Array.isArray(content) || content.length !== 1) return false;
  const child = content[0];
  if (!child || child.type !== 'paragraph') return false;
  return (
    !child.content ||
    (Array.isArray(child.content) && child.content.length === 0)
  );
}

function stripUnknownNodes(
  json: JSONContent,
  schema: Schema,
): JSONContent | JSONContent[] | null {
  if (!json || typeof json !== 'object') return json;

  // Recursively clean children first, flattening any unwrapped content
  if (json.content && Array.isArray(json.content)) {
    const newContent: JSONContent[] = [];
    for (const child of json.content) {
      const cleaned = stripUnknownNodes(child, schema);
      if (Array.isArray(cleaned)) {
        newContent.push(...cleaned);
      } else if (cleaned) {
        newContent.push(cleaned);
      }
    }
    // in place: the single-page export renders the caller's JSON after jsonToNode
    json.content = newContent;
  }

  // Check if this node is unknown AFTER processing children
  if (json.type && !schema.nodes[json.type]) {
    const label = json.attrs?.name;
    if (json.type === 'templateVariable' && typeof label === 'string' && label) {
      return { type: 'text', text: label, ...(json.marks && { marks: json.marks }) };
    }
    // Unwrap: return cleaned children directly instead of wrapping
    return json.content?.length ? json.content : null;
  }

  return json;
}

export function prosemirrorNodeToYElement(node: any): Y.XmlElement | Y.XmlText {
  if (node.type === 'text') {
    const ytext = new Y.XmlText();
    ytext.insert(0, node.text || '');
    if (node.marks?.length > 0) {
      const attrs: Record<string, any> = {};
      for (const mark of node.marks) {
        attrs[mark.type] = mark.attrs || true;
      }
      ytext.format(0, node.text?.length || 0, attrs);
    }
    return ytext;
  }

  const element = new Y.XmlElement(node.type);
  if (node.attrs) {
    for (const [key, value] of Object.entries(node.attrs)) {
      if (value !== null && value !== undefined) {
        element.setAttribute(key, value as any);
      }
    }
  }
  if (node.content?.length > 0) {
    const children = node.content.map(prosemirrorNodeToYElement);
    element.insert(0, children);
  }
  return element;
}

export function jsonToMarkdown(tiptapJson: any): string {
  const html = jsonToHtml(tiptapJson);
  return htmlToMarkdown(html);
}

export function isRenderableObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
