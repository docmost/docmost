export const WS_CACHE_TTL_MS = 30_000;
export const WS_SPACE_RESTRICTION_CACHE_PREFIX = 'ws:space-restrictions:';

export function getSpaceRoomName(spaceId: string): string {
  return `space-${spaceId}`;
}

export function getUserRoomName(userId: string): string {
  return `user-${userId}`;
}

export const TREE_EVENTS = new Set([
  'updateOne',
  'addTreeNode',
  'moveTreeNode',
  'deleteTreeNode',
]);
