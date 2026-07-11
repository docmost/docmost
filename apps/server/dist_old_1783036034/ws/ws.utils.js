"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TREE_EVENTS = exports.WS_SPACE_RESTRICTION_CACHE_PREFIX = exports.WS_CACHE_TTL_MS = void 0;
exports.getSpaceRoomName = getSpaceRoomName;
exports.getUserRoomName = getUserRoomName;
exports.WS_CACHE_TTL_MS = 30_000;
exports.WS_SPACE_RESTRICTION_CACHE_PREFIX = 'ws:space-restrictions:';
function getSpaceRoomName(spaceId) {
    return `space-${spaceId}`;
}
function getUserRoomName(userId) {
    return `user-${userId}`;
}
exports.TREE_EVENTS = new Set([
    'updateOne',
    'addTreeNode',
    'moveTreeNode',
    'deleteTreeNode',
    'refetchRootTreeNodeEvent',
]);
//# sourceMappingURL=ws.utils.js.map