import { Node } from '@tiptap/pm/model';
import {
  jsonToNode,
  tiptapExtensions,
} from '../../../collaboration/collaboration.util';
import { validate as isValidUUID } from 'uuid';
import { Transform } from '@tiptap/pm/transform';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';

export interface MentionNode {
  id: string;
  label: string;
  entityType: 'user' | 'page';
  entityId: string;
  creatorId: string;
}

export function extractMentions(prosemirrorJson: any) {
  const mentionList: MentionNode[] = [];
  const doc = jsonToNode(prosemirrorJson);

  doc.descendants((node: Node) => {
    if (node.type.name === 'mention') {
      if (
        node.attrs.id &&
        !mentionList.some((mention) => mention.id === node.attrs.id)
      ) {
        mentionList.push({
          id: node.attrs.id,
          label: node.attrs.label,
          entityType: node.attrs.entityType,
          entityId: node.attrs.entityId,
          creatorId: node.attrs.creatorId,
        });
      }
    }
  });
  return mentionList;
}

export function extractUserMentions(mentionList: MentionNode[]): MentionNode[] {
  const userList = [];
  for (const mention of mentionList) {
    if (mention.entityType === 'user') {
      userList.push(mention);
    }
  }
  return userList as MentionNode[];
}

export function extractPageMentions(mentionList: MentionNode[]): MentionNode[] {
  const pageMentionList = [];
  for (const mention of mentionList) {
    if (
      mention.entityType === 'page' &&
      !pageMentionList.some(
        (pageMention) => pageMention.entityId === mention.entityId,
      )
    ) {
      pageMentionList.push(mention);
    }
  }
  return pageMentionList as MentionNode[];
}

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
