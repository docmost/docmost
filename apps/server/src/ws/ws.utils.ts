import { Page } from '@docmost/db/types/entity.types';

export const WS_CACHE_TTL_MS = 30_000;
export const WS_SPACE_RESTRICTION_CACHE_PREFIX = 'ws:space-restrictions:';

export function getSpaceRoomName(spaceId: string): string {
  return `space-${spaceId}`;
}

export function getUserRoomName(userId: string): string {
  return `user-${userId}`;
}

export function getSessionRoomName(sessionId: string): string {
  return `session-${sessionId}`;
}

export const TREE_EVENTS = new Set([
  'updateOne',
  'addTreeNode',
  'moveTreeNode',
  'deleteTreeNode',
  'refetchRootTreeNodeEvent',
]);

// A deleted node's subtree can hold titles of pages the receiver cannot see.
export function withoutTreeNodeChildren(data: any): any {
  if (data?.operation !== 'deleteTreeNode' || !data.payload?.node) return data;
  return {
    ...data,
    payload: { ...data.payload, node: { ...data.payload.node, children: [] } },
  };
}

export function buildAddTreeNodeEvent(page: Page) {
  return {
    operation: 'addTreeNode',
    spaceId: page.spaceId,
    payload: {
      parentId: page.parentPageId ?? null,
      index: 0,
      data: {
        id: page.id,
        slugId: page.slugId,
        name: page.title ?? '',
        title: page.title,
        icon: page.icon,
        position: page.position,
        spaceId: page.spaceId,
        parentPageId: page.parentPageId,
        creatorId: page.creatorId,
        hasChildren: false,
        children: [],
      },
    },
  };
}

export function getBaseRoomName(pageId: string): string {
  return `base-${pageId}`;
}

export const BASE_INBOUND_EVENTS = new Set([
  'base:subscribe',
  'base:unsubscribe',
  'base:presence',
  'base:presence:leave',
]);
