import { Cache } from 'cache-manager';
import { Server, Socket } from 'socket.io';
import { PagePermissionRepo } from "../database/repos/page/page-permission.repo";
export declare class WsService {
    private readonly pagePermissionRepo;
    private readonly cacheManager;
    private server;
    constructor(pagePermissionRepo: PagePermissionRepo, cacheManager: Cache);
    setServer(server: Server): void;
    handleTreeEvent(client: Socket, data: any): Promise<void>;
    invalidateSpaceRestrictionCache(spaceId: string): Promise<void>;
    emitCommentEvent(spaceId: string, pageId: string, data: any): Promise<void>;
    emitToUsers(userIds: string[], data: any): Promise<void>;
    emitToSpaceExceptUsers(spaceId: string, excludeUserIds: string[], data: any): Promise<void>;
    isTreeEvent(data: any): boolean;
    private broadcastToAuthorizedUsers;
    private spaceHasRestrictions;
    private extractPageId;
}
