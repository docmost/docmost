import { PaginationOptions } from "../../../database/pagination/pagination-options";
export declare class NotificationIdDto {
    notificationId: string;
}
export declare class MarkNotificationsReadDto {
    notificationIds?: string[];
}
export declare class ListNotificationsDto extends PaginationOptions {
    type?: 'direct' | 'updates' | 'all';
}
