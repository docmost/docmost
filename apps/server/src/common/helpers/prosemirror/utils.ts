import { Node } from '@tiptap/pm/model';
import {
  jsonToNode,
  tiptapExtensions,
} from '../../../collaboration/collaboration.util';
import { validate as isValidUUID } from 'uuid';
import { Transform } from '@tiptap/pm/transform';
import { TiptapTransformer } from '@hocuspocus/transformer';
import type { JSONContent } from '@tiptap/core';
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

export function extractInternalLinkSlugIds(prosemirrorJson: any): string[] {
  const slugIds: string[] = [];
  const doc = jsonToNode(prosemirrorJson);

  doc.descendants((node: Node) => {
    for (const mark of node.marks) {
      if (mark.type.name === 'link' && mark.attrs.internal && mark.attrs.href) {
        const match = mark.attrs.href.match(INTERNAL_LINK_REGEX);
        if (match) {
          const slugId = extractPageSlugId(match[5]);
          if (slugId && !slugIds.includes(slugId)) {
            slugIds.push(slugId);
          }
        }
      }
    }
  });

  return slugIds;
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

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/\.$/, '');
}

function normalizePath(path: string) {
  return path.replace(/\/+$/, '') || '/';
}

function isBlacklistedUrl(url: string, blockedUrls: string[]): boolean {
  try {
    const target = new URL(url);
    const targetHostname = normalizeHostname(target.hostname);
    const targetPath = normalizePath(target.pathname);

    return blockedUrls.some((blockedUrl) => {
      try {
        const blocked = new URL(blockedUrl);
        const blockedHostname = normalizeHostname(blocked.hostname);
        const blockedPath = normalizePath(blocked.pathname);

        const hostMatches =
          targetHostname === blockedHostname ||
          targetHostname.endsWith(`.${blockedHostname}`);

        if (!hostMatches) {
          return false;
        }

        if (blockedPath === '/') {
          return true;
        }

        return (
          targetPath === blockedPath || targetPath.startsWith(`${blockedPath}/`)
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function filterBlacklistedEmbeds(
  content: JSONContent,
  blacklist: string,
): JSONContent {
  let blockedUrls = [];
  if(!blacklist) return;

  try {
    blockedUrls = JSON.parse(blacklist);
  } catch (err) {
    return content;
  }

  if(!blockedUrls.length){
    return content;
  }
  
  function filterNode(node: JSONContent): JSONContent | null {
    const src = node.attrs?.src;

    if (
      node.type === 'embed' &&
      typeof src === 'string' &&
      isBlacklistedUrl(src, blockedUrls)
    ) {
      return null;
    }

    if (!node.content) {
      return node;
    }

    const filteredChildren: JSONContent[] = [];

    for (const child of node.content) {
      const filteredChild = filterNode(child);
      if (filteredChild) {
        filteredChildren.push(filteredChild);
      }
    }

    return { ...node, content: filteredChildren };
  }

  return filterNode(content) ?? content;
}