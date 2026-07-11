import { KyselyDB } from '../../types/kysely.types';
import { InsertableNotification, Notification } from "../../types/entity.types";
import { PaginationOptions } from "../../pagination/pagination-options";
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { SpaceMemberRepo } from "../space/space-member.repo";
import { NotificationTab } from '../../../core/notification/notification.constants';
export declare class NotificationRepo {
    private readonly db;
    private readonly spaceMemberRepo;
    constructor(db: KyselyDB, spaceMemberRepo: SpaceMemberRepo);
    findById(notificationId: string): Promise<Notification | undefined>;
    findByUserId(userId: string, pagination: PaginationOptions, type?: NotificationTab): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        type: string;
        data: import("@docmost/db/types/db").JsonValue;
        id: string;
        workspaceId: string;
        createdAt: Date;
        userId: string;
        spaceId: string;
        pageId: string;
        actorId: string;
        commentId: string;
        pageVerificationId: string;
        readAt: Date;
        emailedAt: Date;
        archivedAt: Date;
    } & {
        actor: {
            id: string;
            name: string;
            avatarUrl: string;
        };
    } & {
        page: {
            id: string;
            title: string;
            icon: string;
            slugId: string;
        };
    } & {
        space: {
            id: string;
            name: string;
            slug: string;
        };
    }, undefined>>;
    insert(notification: InsertableNotification): Promise<Notification>;
    getUnreadCount(userId: string): Promise<number>;
    markAsRead(notificationId: string, userId: string): Promise<void>;
    markMultipleAsRead(notificationIds: string[], userId: string): Promise<void>;
    markAllAsRead(userId: string): Promise<void>;
    markAsEmailed(notificationId: string): Promise<void>;
    getRecentlyNotifiedUserIds(userIds: string[], pageId: string, type: string, withinHours: number): Promise<Set<string>>;
    withActor(eb: ExpressionBuilder<DB, 'notifications'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        avatarUrl: string;
    }, "actor">;
    withPage(eb: ExpressionBuilder<DB, 'notifications'>): import("kysely").AliasedRawBuilder<{
        id: string;
        title: string;
        icon: string;
        slugId: string;
    }, "page">;
    withSpace(eb: ExpressionBuilder<DB, 'notifications'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        slug: string;
    }, "space">;
}
