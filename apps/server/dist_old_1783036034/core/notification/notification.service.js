"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const notification_repo_1 = require("../../database/repos/notification/notification.repo");
const ws_gateway_1 = require("../../ws/ws.gateway");
const mail_service_1 = require("../../integrations/mail/mail.service");
const notification_constants_1 = require("./notification.constants");
const page_permission_repo_1 = require("../../database/repos/page/page-permission.repo");
let NotificationService = NotificationService_1 = class NotificationService {
    constructor(notificationRepo, pagePermissionRepo, wsGateway, mailService, db) {
        this.notificationRepo = notificationRepo;
        this.pagePermissionRepo = pagePermissionRepo;
        this.wsGateway = wsGateway;
        this.mailService = mailService;
        this.db = db;
        this.logger = new common_1.Logger(NotificationService_1.name);
    }
    async create(data) {
        const user = await this.db
            .selectFrom('users')
            .select(['id'])
            .where('id', '=', data.userId)
            .where('deletedAt', 'is', null)
            .where('deactivatedAt', 'is', null)
            .executeTakeFirst();
        if (!user)
            return null;
        const notification = await this.notificationRepo.insert(data);
        this.wsGateway.server
            .to(`user-${data.userId}`)
            .emit('notification', { id: notification.id, type: notification.type });
        return notification;
    }
    async findByUserId(userId, pagination, type = 'all') {
        const result = await this.notificationRepo.findByUserId(userId, pagination, type);
        const pageIds = result.items
            .map((n) => n.pageId)
            .filter(Boolean);
        if (pageIds.length > 0) {
            const accessiblePageIds = await this.pagePermissionRepo.filterAccessiblePageIds({
                pageIds,
                userId,
            });
            const accessibleSet = new Set(accessiblePageIds);
            result.items = result.items.filter((n) => !n.pageId || accessibleSet.has(n.pageId));
        }
        return result;
    }
    async getUnreadCount(userId) {
        return this.notificationRepo.getUnreadCount(userId);
    }
    async markAsRead(notificationId, userId) {
        return this.notificationRepo.markAsRead(notificationId, userId);
    }
    async markMultipleAsRead(notificationIds, userId) {
        return this.notificationRepo.markMultipleAsRead(notificationIds, userId);
    }
    async markAllAsRead(userId) {
        return this.notificationRepo.markAllAsRead(userId);
    }
    async queueEmail(userId, notificationId, subject, template, type) {
        try {
            const user = await this.db
                .selectFrom('users')
                .select(['email', 'settings'])
                .where('id', '=', userId)
                .where('deletedAt', 'is', null)
                .where('deactivatedAt', 'is', null)
                .executeTakeFirst();
            if (!user?.email)
                return;
            if (type) {
                const settingKey = notification_constants_1.NotificationTypeToSettingKey[type];
                if (settingKey) {
                    const settings = user.settings;
                    if (settings?.notifications?.[settingKey] === false)
                        return;
                }
            }
            await this.mailService.sendToQueue({
                to: user.email,
                subject,
                template,
                notificationId,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`Failed to queue email for notification ${notificationId}: ${message}`);
        }
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = NotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [notification_repo_1.NotificationRepo,
        page_permission_repo_1.PagePermissionRepo,
        ws_gateway_1.WsGateway,
        mail_service_1.MailService, Object])
], NotificationService);
//# sourceMappingURL=notification.service.js.map