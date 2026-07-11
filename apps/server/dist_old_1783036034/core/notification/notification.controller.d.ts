import { NotificationService } from './notification.service';
import { User } from "../../database/types/entity.types";
import { ListNotificationsDto, MarkNotificationsReadDto } from './dto/notification.dto';
export declare class NotificationController {
    private readonly notificationService;
    constructor(notificationService: NotificationService);
    getNotifications(dto: ListNotificationsDto, user: User): Promise<import("../../database/pagination/cursor-pagination").CursorPaginationResult<{
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
    getUnreadCount(user: User): Promise<{
        count: number;
    }>;
    markAsRead(dto: MarkNotificationsReadDto, user: User): Promise<void>;
    markAllAsRead(user: User): Promise<void>;
}
