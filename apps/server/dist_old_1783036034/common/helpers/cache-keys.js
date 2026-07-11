"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_CACHE_TTL_MS = exports.CacheKey = void 0;
exports.CacheKey = {
    LICENSE_VALID: (workspaceId) => `license:valid:${workspaceId}`,
    SPACE_ROLES: (userId, spaceId) => `perm:space-roles:${userId}:${spaceId}`,
    PAGE_CAN_EDIT: (userId, pageId) => `perm:can-edit:${userId}:${pageId}`,
};
exports.PERMISSION_CACHE_TTL_MS = 5_000;
//# sourceMappingURL=cache-keys.js.map