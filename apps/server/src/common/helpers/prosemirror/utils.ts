import { Node } from '@tiptap/pm/model';
import { jsonToNode, tiptapExtensions } from '../../../collaboration/collaboration.util';
import { validate as isValidUUID } from 'uuid';
import { Transform } from '@tiptap/pm/transform';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
export {
  MentionNode,
  extractMentions,
  extractPageMentions,
  extractUserMentions,
  prosemirrorToTextWithMentions,
} from './mentions';

export function getProsemirrorContent(content: any) {
  return (
    content ?? {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { textAlign: 'left' } }],
    }
  );
}

export function isAttachmentNode(nodeType: string) {
  const attachmentNodeTypes = [
    'attachment',
    'image',
    'video',
    'excalidraw',
    'drawio',
  ];
  return attachmentNodeTypes.includes(nodeType);
}

export function getAttachmentIds(prosemirrorJson: any) {
  const doc = jsonToNode(prosemirrorJson);
  const attachmentIds = [];

  doc?.descendants((node: Node) => {
    if (isAttachmentNode(node.type.name)) {
      if (node.attrs.attachmentId && isValidUUID(node.attrs.attachmentId)) {
        if (!attachmentIds.includes(node.attrs.attachmentId)) {
          attachmentIds.push(node.attrs.attachmentId);
        }
      }
    }
  });

  return attachmentIds;
}

export function removeMarkTypeFromDoc(doc: Node, markName: string): Node {
  const { schema } = doc.type;
  const markType = schema.marks[markName];

  if (!markType) {
    return doc;
  }

  const tr = new Transform(doc).removeMark(0, doc.content.size, markType);
  return tr.doc;
}

export function createYdocFromJson(prosemirrorJson: any): Buffer | null {
  if (prosemirrorJson) {
    const ydoc = TiptapTransformer.toYdoc(
      prosemirrorJson,
      'default',
      tiptapExtensions,
    );

    Y.encodeStateAsUpdate(ydoc);

    return Buffer.from(Y.encodeStateAsUpdate(ydoc));
  }
  return null;
}
