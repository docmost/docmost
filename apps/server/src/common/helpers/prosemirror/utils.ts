import { Node } from '@tiptap/pm/model';
import {
  jsonToNode,
  tiptapExtensions,
} from '../../../collaboration/collaboration.util';
import { validate as isValidUUID } from 'uuid';
import { Transform } from '@tiptap/pm/transform';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import {
  INTERNAL_LINK_REGEX,
  extractPageSlugId,
} from '../../../integrations/export/utils';
import { isAttachmentNode } from './attachment-node-types';

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

// swaps saved user mention labels for current names; the input stays unchanged
export async function updateUserMentionLabels(
  prosemirrorJson: any,
  findNames: (userIds: string[]) => Promise<{ id: string; name: string }[]>,
): Promise<any> {
  const userIds = new Set<string>();
  collectUserMentionIds(prosemirrorJson, userIds);
  if (userIds.size === 0) return prosemirrorJson;

  const users = await findNames([...userIds]);
  if (users.length === 0) return prosemirrorJson;

  const names = new Map(users.map((user) => [user.id, user.name]));
  return setUserMentionLabels(prosemirrorJson, names);
}

function isUserMention(node: any): boolean {
  return node?.type === 'mention' && node.attrs?.entityType === 'user';
}

function collectUserMentionIds(node: any, userIds: Set<string>): void {
  if (isUserMention(node)) {
    if (isValidUUID(node.attrs.entityId)) userIds.add(node.attrs.entityId);
    return;
  }
  if (!Array.isArray(node?.content)) return;
  for (const child of node.content) collectUserMentionIds(child, userIds);
}

function setUserMentionLabels(node: any, names: Map<string, string>): any {
  if (isUserMention(node)) {
    const name = names.get(node.attrs.entityId);
    return name ? { ...node, attrs: { ...node.attrs, label: name } } : node;
  }
  if (!Array.isArray(node?.content)) return node;
  return {
    ...node,
    content: node.content.map((child: any) =>
      setUserMentionLabels(child, names),
    ),
  };
}

export function extractInternalLinkSlugIds(prosemirrorJson: any): string[] {
  const slugIds = new Set<string>();
  const doc = jsonToNode(prosemirrorJson);

  const addHref = (href: string) => {
    const path = href.split(/[?#]/, 1)[0];
    const match = INTERNAL_LINK_REGEX.exec(
      path.startsWith('/p/') ? path.slice(1) : path,
    );
    const slugId = match && extractPageSlugId(match[5]);
    if (slugId) slugIds.add(slugId);
  };
  doc.descendants((node: Node) => {
    if (node.type.name === 'image' && /^\/(?:s\/|p\/)/.test(node.attrs.href)) {
      addHref(node.attrs.href);
    }
    for (const mark of node.marks) {
      if (mark.type.name === 'link' && mark.attrs.internal && mark.attrs.href) {
        addHref(mark.attrs.href);
      }
    }
  });

  return [...slugIds];
}

export function extractUserMentionIdsFromJson(json: any): string[] {
  const userIds: string[] = [];

  function walk(node: any) {
    if (!node) return;
    if (
      node.type === 'mention' &&
      node.attrs?.entityType === 'user' &&
      node.attrs?.entityId &&
      !userIds.includes(node.attrs.entityId)
    ) {
      userIds.push(node.attrs.entityId);
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(json);
  return userIds;
}

export function getProsemirrorContent(content: any) {
  return (
    content ?? {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { textAlign: 'left' } }],
    }
  );
}

export { isAttachmentNode };

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

export function replaceAttachmentIds(
  prosemirrorJson: any,
  idMap: Map<string, string>,
): any {
  if (Array.isArray(prosemirrorJson)) {
    return prosemirrorJson.map((item) => replaceAttachmentIds(item, idMap));
  }

  if (!prosemirrorJson || typeof prosemirrorJson !== 'object') {
    return prosemirrorJson;
  }

  const node = { ...prosemirrorJson };

  if (node.content) {
    node.content = replaceAttachmentIds(node.content, idMap);
  }

  const oldId = node.attrs?.attachmentId;
  if (
    typeof node.type === 'string' &&
    isAttachmentNode(node.type) &&
    typeof oldId === 'string' &&
    idMap.has(oldId)
  ) {
    const newId = idMap.get(oldId);
    const attrs = { ...node.attrs, attachmentId: newId };
    for (const key of ['src', 'url']) {
      if (typeof attrs[key] === 'string') {
        attrs[key] = attrs[key].split(oldId).join(newId);
      }
    }
    node.attrs = attrs;
  }

  return node;
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
