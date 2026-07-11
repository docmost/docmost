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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const postgres_1 = require("kysely/helpers/postgres");
const space_member_repo_1 = require("../space/space-member.repo");
const notification_constants_1 = require("../../../core/notification/notification.constants");
let NotificationRepo = class NotificationRepo {
    constructor(db, spaceMemberRepo) {
        this.db = db;
        this.spaceMemberRepo = spaceMemberRepo;
    }
    async findById(notificationId) {
        return this.db
            .selectFrom('notifications')
            .selectAll('notifications')
            .where('id', '=', notificationId)
            .executeTakeFirst();
    }
    async findByUserId(userId, pagination, type = 'all') {
        let query = this.db
            .selectFrom('notifications')
            .selectAll('notifications')
            .select((eb) => this.withActor(eb))
            .select((eb) => this.withPage(eb))
            .select((eb) => this.withSpace(eb))
            .where('userId', '=', userId)
            .where((eb) => eb.or([
            eb('spaceId', 'is', null),
            eb('spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(userId)),
        ]));
        if (type === 'direct') {
            query = query.where('type', '!=', notification_constants_1.NotificationType.PAGE_UPDATED);
        }
        else if (type === 'updates') {
            query = query.where('type', '=', notification_constants_1.NotificationType.PAGE_UPDATED);
        }
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [{ expression: 'id', direction: 'desc' }],
            parseCursor: (cursor) => ({ id: cursor.id }),
        });
    }
    async insert(notification) {
        return this.db
            .insertInto('notifications')
            .values(notification)
            .returningAll()
            .executeTakeFirst();
    }
    async getUnreadCount(userId) {
        const result = await this.db
            .selectFrom('notifications')
            .select((eb) => eb.fn.count('id').as('count'))
            .where('userId', '=', userId)
            .where('readAt', 'is', null)
            .where((eb) => eb.or([
            eb('spaceId', 'is', null),
            eb('spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(userId)),
        ]))
            .executeTakeFirst();
        return Number(result?.count ?? 0);
    }
    async markAsRead(notificationId, userId) {
        await this.db
            .updateTable('notifications')
            .set({ readAt: new Date() })
            .where('id', '=', notificationId)
            .where('userId', '=', userId)
            .where('readAt', 'is', null)
            .execute();
    }
    async markMultipleAsRead(notificationIds, userId) {
        if (notificationIds.length === 0) {
            return;
        }
        await this.db
            .updateTable('notifications')
            .set({ readAt: new Date() })
            .where('id', 'in', notificationIds)
            .where('userId', '=', userId)
            .where('readAt', 'is', null)
            .execute();
    }
    async markAllAsRead(userId) {
        await this.db
            .updateTable('notifications')
            .set({ readAt: new Date() })
            .where('userId', '=', userId)
            .where('readAt', 'is', null)
            .execute();
    }
    async markAsEmailed(notificationId) {
        await this.db
            .updateTable('notifications')
            .set({ emailedAt: new Date() })
            .where('id', '=', notificationId)
            .where('emailedAt', 'is', null)
            .execute();
    }
    async getRecentlyNotifiedUserIds(userIds, pageId, type, withinHours) {
        if (userIds.length === 0)
            return new Set();
        const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);
        const rows = await this.db
            .selectFrom('notifications')
            .select('userId')
            .where('userId', 'in', userIds)
            .where('pageId', '=', pageId)
            .where('type', '=', type)
            .where('createdAt', '>', cutoff)
            .groupBy('userId')
            .execute();
        return new Set(rows.map((r) => r.userId));
    }
    withActor(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'notifications.actorId')).as('actor');
    }
    withPage(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('pages')
            .select(['pages.id', 'pages.title', 'pages.slugId', 'pages.icon'])
            .whereRef('pages.id', '=', 'notifications.pageId')).as('page');
    }
    withSpace(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('spaces')
            .select(['spaces.id', 'spaces.name', 'spaces.slug'])
            .whereRef('spaces.id', '=', 'notifications.spaceId')).as('space');
    }
};
exports.NotificationRepo = NotificationRepo;
exports.NotificationRepo = NotificationRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object, space_member_repo_1.SpaceMemberRepo])
], NotificationRepo);
//# sourceMappingURL=notification.repo.js.map