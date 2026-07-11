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
exports.FavoriteRepo = exports.FavoriteType = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const postgres_1 = require("kysely/helpers/postgres");
const kysely_1 = require("kysely");
const utils_1 = require("../../utils");
exports.FavoriteType = {
    PAGE: 'page',
    SPACE: 'space',
    TEMPLATE: 'template',
};
let FavoriteRepo = class FavoriteRepo {
    constructor(db) {
        this.db = db;
    }
    async insert(favorite) {
        try {
            return await this.db
                .insertInto('favorites')
                .values(favorite)
                .returningAll()
                .executeTakeFirst();
        }
        catch (err) {
            if (err?.code === '23505')
                return undefined;
            throw err;
        }
    }
    async deleteByUserAndPage(userId, pageId) {
        await this.db
            .deleteFrom('favorites')
            .where('userId', '=', userId)
            .where('pageId', '=', pageId)
            .execute();
    }
    async deleteByUserAndSpace(userId, spaceId) {
        await this.db
            .deleteFrom('favorites')
            .where('userId', '=', userId)
            .where('spaceId', '=', spaceId)
            .where('type', '=', exports.FavoriteType.SPACE)
            .execute();
    }
    async deleteByUserAndTemplate(userId, templateId) {
        await this.db
            .deleteFrom('favorites')
            .where('userId', '=', userId)
            .where('templateId', '=', templateId)
            .execute();
    }
    async getFavoriteIds(userId, workspaceId, type, spaceId) {
        const idColumn = type === exports.FavoriteType.PAGE
            ? 'pageId'
            : type === exports.FavoriteType.SPACE
                ? 'spaceId'
                : 'templateId';
        let query = this.db
            .selectFrom('favorites')
            .select(['favorites.id', `favorites.${idColumn} as entityId`])
            .where('favorites.userId', '=', userId)
            .where('favorites.workspaceId', '=', workspaceId)
            .where('favorites.type', '=', type);
        if (spaceId) {
            query = this.applySpaceFilter(query, type, spaceId);
        }
        const result = await (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: 250,
            fields: [{ expression: 'favorites.id', direction: 'desc' }],
            parseCursor: (cursor) => ({ id: cursor.id }),
        });
        return {
            items: result.items
                .map((r) => r.entityId)
                .filter(Boolean),
            meta: result.meta,
        };
    }
    async findUserFavorites(userId, workspaceId, pagination, type, spaceId) {
        let query = this.db
            .selectFrom('favorites')
            .selectAll('favorites')
            .where('favorites.userId', '=', userId)
            .where('favorites.workspaceId', '=', workspaceId);
        if (type) {
            query = query.where('favorites.type', '=', type);
        }
        if (spaceId) {
            query = this.applySpaceFilter(query, type, spaceId);
        }
        if (type === exports.FavoriteType.PAGE || !type) {
            query = query.select((eb) => this.withPage(eb));
        }
        if (type === exports.FavoriteType.PAGE) {
            query = query.select((eb) => this.withPageSpace(eb));
        }
        else if (type === exports.FavoriteType.SPACE) {
            query = query.select((eb) => this.withSpace(eb));
        }
        else {
            query = query.select((eb) => this.withSpaceResolved(eb));
        }
        if (type === exports.FavoriteType.TEMPLATE || !type) {
            query = query.select((eb) => this.withTemplate(eb));
        }
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [{ expression: 'favorites.id', direction: 'desc' }],
            parseCursor: (cursor) => ({
                id: cursor.id,
            }),
        });
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
            .deleteFrom('favorites')
            .where('userId', 'in', userIds)
            .where('spaceId', '=', spaceId)
            .where('userId', 'not in', usersWithAccess)
            .execute();
    }
    async deleteByUserAndWorkspace(userId, workspaceId, opts) {
        const { trx } = opts;
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('favorites')
            .where('userId', '=', userId)
            .where('workspaceId', '=', workspaceId)
            .execute();
    }
    applySpaceFilter(query, type, spaceId) {
        if (type === exports.FavoriteType.PAGE) {
            return query.where((eb) => eb.exists(eb
                .selectFrom('pages')
                .select((0, kysely_1.sql) `1`.as('one'))
                .whereRef('pages.id', '=', 'favorites.pageId')
                .where('pages.spaceId', '=', spaceId)));
        }
        if (type === exports.FavoriteType.SPACE) {
            return query.where('favorites.spaceId', '=', spaceId);
        }
        if (type === exports.FavoriteType.TEMPLATE) {
            return query.where((eb) => eb.exists(eb
                .selectFrom('templates')
                .select((0, kysely_1.sql) `1`.as('one'))
                .whereRef('templates.id', '=', 'favorites.templateId')
                .where('templates.spaceId', '=', spaceId)));
        }
        return query;
    }
    withPage(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('pages')
            .select([
            'pages.id',
            'pages.slugId',
            'pages.title',
            'pages.icon',
            'pages.spaceId',
        ])
            .whereRef('pages.id', '=', 'favorites.pageId')).as('page');
    }
    withSpace(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('spaces')
            .select(['spaces.id', 'spaces.name', 'spaces.slug', 'spaces.logo'])
            .whereRef('spaces.id', '=', 'favorites.spaceId')).as('space');
    }
    withPageSpace(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('spaces')
            .innerJoin('pages', 'pages.spaceId', 'spaces.id')
            .select(['spaces.id', 'spaces.name', 'spaces.slug', 'spaces.logo'])
            .whereRef('pages.id', '=', 'favorites.pageId')).as('space');
    }
    withSpaceResolved(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('spaces')
            .select(['spaces.id', 'spaces.name', 'spaces.slug', 'spaces.logo'])
            .where(({ or, ref }) => or([
            (0, kysely_1.sql) `${ref('spaces.id')} = ${ref('favorites.spaceId')}`,
            (0, kysely_1.sql) `${ref('spaces.id')} = (SELECT pages.space_id FROM pages WHERE pages.id = ${ref('favorites.pageId')})`,
        ]))).as('space');
    }
    withTemplate(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('templates')
            .select([
            'templates.id',
            'templates.title',
            'templates.description',
            'templates.icon',
            'templates.spaceId',
        ])
            .whereRef('templates.id', '=', 'favorites.templateId')).as('template');
    }
};
exports.FavoriteRepo = FavoriteRepo;
exports.FavoriteRepo = FavoriteRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], FavoriteRepo);
//# sourceMappingURL=favorite.repo.js.map