export declare const CacheKey: {
    LICENSE_VALID: (workspaceId: string) => string;
    SPACE_ROLES: (userId: string, spaceId: string) => string;
    PAGE_CAN_EDIT: (userId: string, pageId: string) => string;
};
export declare const PERMISSION_CACHE_TTL_MS = 5000;
