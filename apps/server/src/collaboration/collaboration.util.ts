import { StarterKit } from '@tiptap/starter-kit';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import {
  initProseMirrorDoc,
  relativePositionToAbsolutePosition,
  updateYFragment,
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
  const { doc: pNode, mapping } = initProseMirrorDoc(fragment, schema);

  // Convert JSON positions to Y.js RelativePosition objects
  const anchorRelPos = Y.createRelativePositionFromJSON(yjsSelection.anchor);
  const headRelPos = Y.createRelativePositionFromJSON(yjsSelection.head);

  console.log(anchorRelPos, headRelPos);

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

  console.log('second')
  console.log(anchor, head);

  if (anchor === null || head === null) {
    throw new Error('Could not resolve Y.js relative positions to absolute positions');
  }

  const state = EditorState.create({
    doc: pNode,
    schema: schema,
    selection: TextSelection.create(pNode, anchor, head),
  });

  const tr = setMarkInProsemirror(schema.marks[markName], markAttributes, state);

  // Update the Y.js fragment with the modified ProseMirror document
  // @ts-ignore
  updateYFragment(doc, fragment, tr.doc, mapping);
}

function setMarkInProsemirror(
  type: any,
  attributes: Record<string, any>,
  state: EditorState,
) {
  let tr = state.tr;
  const { selection } = state;
  const { ranges } = selection;

  ranges.forEach((range) => {
    const from = range.$from.pos;
    const to = range.$to.pos;

    state.doc.nodesBetween(from, to, (node, pos) => {
      const trimmedFrom = Math.max(pos, from);
      const trimmedTo = Math.min(pos + node.nodeSize, to);
      const someHasMark = node.marks.find((mark) => mark.type === type);

      if (someHasMark) {
        node.marks.forEach((mark) => {
          if (type === mark.type) {
            tr = tr.addMark(
              trimmedFrom,
              trimmedTo,
              type.create({
                ...mark.attrs,
                ...attributes,
              }),
            );
          }
        });
      } else {
        tr = tr.addMark(trimmedFrom, trimmedTo, type.create(attributes));
      }
    });
  });
  return tr;
}
