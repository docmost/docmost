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
exports.WatcherRepo = exports.WatcherType = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const postgres_1 = require("kysely/helpers/postgres");
const utils_1 = require("../../utils");
exports.WatcherType = {
    PAGE: 'page',
    SPACE: 'space',
};
let WatcherRepo = class WatcherRepo {
    constructor(db) {
        this.db = db;
    }
    async findPageWatchers(pageId, pagination) {
        const query = this.db
            .selectFrom('watchers')
            .selectAll('watchers')
            .select((eb) => this.withUser(eb))
            .where('pageId', '=', pageId)
            .where('type', '=', exports.WatcherType.PAGE)
            .where('mutedAt', 'is', null);
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [{ expression: 'id', direction: 'asc' }],
            parseCursor: (cursor) => ({ id: cursor.id }),
        });
    }
    async getPageWatcherIds(pageId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        const watchers = await db
            .selectFrom('watchers')
            .select('userId')
            .where('pageId', '=', pageId)
            .where('type', '=', exports.WatcherType.PAGE)
            .where('mutedAt', 'is', null)
            .execute();
        return watchers.map((w) => w.userId);
    }
    async getPageUpdateRecipientIds(pageId, spaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        const pageWatchers = db
            .selectFrom('watchers')
            .select('userId')
            .where('pageId', '=', pageId)
            .where('type', '=', exports.WatcherType.PAGE)
            .where('mutedAt', 'is', null);
        const spaceWatchers = db
            .selectFrom('watchers as sw')
            .select('sw.userId')
            .where('sw.spaceId', '=', spaceId)
            .where('sw.pageId', 'is', null)
            .where('sw.type', '=', exports.WatcherType.SPACE)
            .where((eb) => eb.not(eb.exists(eb
            .selectFrom('watchers as pw')
            .select('pw.id')
            .whereRef('pw.userId', '=', 'sw.userId')
            .where('pw.pageId', '=', pageId)
            .where('pw.type', '=', exports.WatcherType.PAGE)
            .where('pw.mutedAt', 'is not', null))));
        const rows = await pageWatchers.union(spaceWatchers).execute();
        return [...new Set(rows.map((r) => r.userId))];
    }
    async insert(watcher, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('watchers')
            .values(watcher)
            .onConflict((oc) => oc.doNothing())
            .returningAll()
            .executeTakeFirst();
    }
    async insertMany(watchers, trx) {
        if (watchers.length === 0)
            return;
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .insertInto('watchers')
            .values(watchers)
            .onConflict((oc) => oc.doNothing())
            .execute();
    }
    async upsert(watcher, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('watchers')
            .values(watcher)
            .onConflict((oc) => oc
            .columns(['userId', 'pageId'])
            .where('pageId', 'is not', null)
            .doUpdateSet({ mutedAt: null }))
            .returningAll()
            .executeTakeFirst();
    }
    async upsertSpace(watcher, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('watchers')
            .values(watcher)
            .onConflict((oc) => oc
            .columns(['userId', 'spaceId'])
            .where('pageId', 'is', null)
            .doNothing())
            .returningAll()
            .executeTakeFirst();
    }
    async mute(userId, pageId, spaceId, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        const mutedAt = new Date();
        await db
            .insertInto('watchers')
            .values({
            userId,
            pageId,
            spaceId,
            workspaceId,
            type: exports.WatcherType.PAGE,
            addedById: userId,
            mutedAt,
        })
            .onConflict((oc) => oc
            .columns(['userId', 'pageId'])
            .where('pageId', 'is not', null)
            .doUpdateSet({ mutedAt }))
            .execute();
    }
    async deleteSpaceWatch(userId, spaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('watchers')
            .where('userId', '=', userId)
            .where('spaceId', '=', spaceId)
            .where('pageId', 'is', null)
            .where('type', '=', exports.WatcherType.SPACE)
            .execute();
    }
    async getWatchedSpaceIds(userId, workspaceId) {
        const query = this.db
            .selectFrom('watchers')
            .select(['watchers.id', 'watchers.spaceId'])
            .where('userId', '=', userId)
            .where('workspaceId', '=', workspaceId)
            .where('pageId', 'is', null)
            .where('type', '=', exports.WatcherType.SPACE);
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: 250,
            fields: [{ expression: 'watchers.id', direction: 'asc' }],
            parseCursor: (cursor) => ({ id: cursor.id }),
        });
    }
    async isWatchingSpace(userId, spaceId) {
        const watcher = await this.db
            .selectFrom('watchers')
            .select('id')
            .where('userId', '=', userId)
            .where('spaceId', '=', spaceId)
            .where('pageId', 'is', null)
            .where('type', '=', exports.WatcherType.SPACE)
            .executeTakeFirst();
        return !!watcher;
    }
    async isWatching(userId, pageId) {
        const watcher = await this.db
            .selectFrom('watchers')
            .select('id')
            .where('userId', '=', userId)
            .where('pageId', '=', pageId)
            .where('mutedAt', 'is', null)
            .executeTakeFirst();
        return !!watcher;
    }
    async countPageWatchers(pageId) {
        const result = await this.db
            .selectFrom('watchers')
            .select((eb) => eb.fn.count('id').as('count'))
            .where('pageId', '=', pageId)
            .where('type', '=', exports.WatcherType.PAGE)
            .where('mutedAt', 'is', null)
            .executeTakeFirst();
        return Number(result?.count ?? 0);
    }
    async deleteByUsersWithoutSpaceAccess(userIds, spaceId, opts) {
        if (userIds.length === 0)
            return;
        const { trx } = opts;
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        const usersWithAccess = db
            .selectFrom('spaceMembers')
            .select('userId')
            .where('spaceId', '=', spaceId)
            .where('userId', 'is not', null)
            .union(db
            .selectFrom('spaceMembers')
            .innerJoin('groupUsers', 'groupUsers.groupId', 'spaceMembers.groupId')
            .select('groupUsers.userId')
            .where('spaceMembers.spaceId', '=', spaceId));
        await db
            .deleteFrom('watchers')
            .where('userId', 'in', userIds)
            .where('spaceId', '=', spaceId)
            .where('userId', 'not in', usersWithAccess)
            .execute();
    }
    async updateSpaceIdByPageIds(spaceId, pageIds, opts) {
        if (pageIds.length === 0)
            return;
        const { trx } = opts;
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .updateTable('watchers')
            .set({ spaceId })
            .where('pageId', 'in', pageIds)
            .execute();
    }
    async deleteByPageIdsWithoutSpaceAccess(pageIds, spaceId, opts) {
        if (pageIds.length === 0)
            return;
        const { trx } = opts;
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        const usersWithAccess = db
            .selectFrom('spaceMembers')
            .select('userId')
            .where('spaceId', '=', spaceId)
            .where('userId', 'is not', null)
            .union(db
            .selectFrom('spaceMembers')
            .innerJoin('groupUsers', 'groupUsers.groupId', 'spaceMembers.groupId')
            .select('groupUsers.userId')
            .where('spaceMembers.spaceId', '=', spaceId));
        await db
            .deleteFrom('watchers')
            .where('pageId', 'in', pageIds)
            .where('userId', 'not in', usersWithAccess)
            .execute();
    }
    async deleteByUserAndWorkspace(userId, workspaceId, opts) {
        const { trx } = opts;
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('watchers')
            .where('userId', '=', userId)
            .where('workspaceId', '=', workspaceId)
            .execute();
    }
    withUser(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl', 'users.email'])
            .whereRef('users.id', '=', 'watchers.userId')).as('user');
    }
};
exports.WatcherRepo = WatcherRepo;
exports.WatcherRepo = WatcherRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], WatcherRepo);
//# sourceMappingURL=watcher.repo.js.map