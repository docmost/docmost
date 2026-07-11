"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPDATES_NOTIFICATION_TYPES = exports.DIRECT_NOTIFICATION_TYPES = exports.NotificationTypeToSettingKey = exports.NotificationType = void 0;
exports.getTypesForTab = getTypesForTab;
exports.NotificationType = {
    COMMENT_USER_MENTION: 'comment.user_mention',
    COMMENT_CREATED: 'comment.created',
    COMMENT_RESOLVED: 'comment.resolved',
    PAGE_USER_MENTION: 'page.user_mention',
    PAGE_PERMISSION_GRANTED: 'page.permission_granted',
    PAGE_UPDATED: 'page.updated',
    PAGE_VERIFICATION_EXPIRING: 'page.verification_expiring',
    PAGE_VERIFICATION_EXPIRED: 'page.verification_expired',
    PAGE_VERIFIED: 'page.verified',
    PAGE_APPROVAL_REQUESTED: 'page.approval_requested',
    PAGE_APPROVAL_REJECTED: 'page.approval_rejected',
};
exports.NotificationTypeToSettingKey = {
    [exports.NotificationType.PAGE_UPDATED]: 'page.updated',
    [exports.NotificationType.PAGE_USER_MENTION]: 'page.userMention',
    [exports.NotificationType.COMMENT_USER_MENTION]: 'comment.userMention',
    [exports.NotificationType.COMMENT_CREATED]: 'comment.created',
    [exports.NotificationType.COMMENT_RESOLVED]: 'comment.resolved',
};
exports.DIRECT_NOTIFICATION_TYPES = [
    exports.NotificationType.COMMENT_USER_MENTION,
    exports.NotificationType.COMMENT_CREATED,
    exports.NotificationType.COMMENT_RESOLVED,
    exports.NotificationType.PAGE_USER_MENTION,
    exports.NotificationType.PAGE_PERMISSION_GRANTED,
];
exports.UPDATES_NOTIFICATION_TYPES = [
    exports.NotificationType.PAGE_UPDATED,
];
function getTypesForTab(tab) {
    if (tab === 'direct')
        return exports.DIRECT_NOTIFICATION_TYPES;
    if (tab === 'updates')
        return exports.UPDATES_NOTIFICATION_TYPES;
    return undefined;
}
//# sourceMappingURL=notification.constants.js.map