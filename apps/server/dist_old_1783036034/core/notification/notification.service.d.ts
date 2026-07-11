import { KyselyDB } from "../../database/types/kysely.types";
import { NotificationRepo } from "../../database/repos/notification/notification.repo";
import { InsertableNotification } from "../../database/types/entity.types";
import { PaginationOptions } from "../../database/pagination/pagination-options";
import { WsGateway } from '../../ws/ws.gateway';
import { MailService } from '../../integrations/mail/mail.service';
import { NotificationTab, NotificationType } from './notification.constants';
import { PagePermissionRepo } from "../../database/repos/page/page-permission.repo";
export declare class NotificationService {
    private readonly notificationRepo;
    private readonly pagePermissionRepo;
    private readonly wsGateway;
    private readonly mailService;
    private readonly db;
    private readonly logger;
    constructor(notificationRepo: NotificationRepo, pagePermissionRepo: PagePermissionRepo, wsGateway: WsGateway, mailService: MailService, db: KyselyDB);
    create(data: InsertableNotification): Promise<{
        type: string;
        data: import("../../database/types/db").JsonValue;
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
    }>;
    findByUserId(userId: string, pagination: PaginationOptions, type?: NotificationTab): Promise<import("../../database/pagination/cursor-pagination").CursorPaginationResult<{
        type: string;
        data: import("../../database/types/db").JsonValue;
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
    getUnreadCount(userId: string): Promise<number>;
    markAsRead(notificationId: string, userId: string): Promise<void>;
    markMultipleAsRead(notificationIds: string[], userId: string): Promise<void>;
    markAllAsRead(userId: string): Promise<void>;
    queueEmail(userId: string, notificationId: string, subject: string, template: any, type?: NotificationType): Promise<void>;
}
