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
exports.PageHistoryRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const postgres_1 = require("kysely/helpers/postgres");
const kysely_1 = require("kysely");
let PageHistoryRepo = class PageHistoryRepo {
    constructor(db) {
        this.db = db;
        this.baseFields = [
            'id',
            'pageId',
            'slugId',
            'title',
            'icon',
            'coverPhoto',
            'lastUpdatedById',
            'contributorIds',
            'spaceId',
            'workspaceId',
            'createdAt',
        ];
    }
    async findById(pageHistoryId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        return await db
            .selectFrom('pageHistory')
            .select(this.baseFields)
            .$if(opts?.includeContent, (qb) => qb.select('content'))
            .select((eb) => this.withLastUpdatedBy(eb))
            .select((eb) => this.withContributors(eb))
            .where('id', '=', pageHistoryId)
            .executeTakeFirst();
    }
    async insertPageHistory(insertablePageHistory, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('pageHistory')
            .values(insertablePageHistory)
            .returningAll()
            .executeTakeFirst();
    }
    async saveHistory(page, opts) {
        await this.insertPageHistory({
            pageId: page.id,
            slugId: page.slugId,
            title: page.title,
            content: page.content,
            icon: page.icon,
            coverPhoto: page.coverPhoto,
            lastUpdatedById: page.lastUpdatedById ?? page.creatorId,
            contributorIds: opts?.contributorIds,
            spaceId: page.spaceId,
            workspaceId: page.workspaceId,
        }, opts?.trx);
    }
    async findPageHistoryByPageId(pageId, pagination) {
        const query = this.db
            .selectFrom('pageHistory')
            .select(this.baseFields)
            .select((eb) => this.withLastUpdatedBy(eb))
            .select((eb) => this.withContributors(eb))
            .where('pageId', '=', pageId);
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [{ expression: 'id', direction: 'desc' }],
            parseCursor: (cursor) => ({ id: cursor.id }),
        });
    }
    async findPageLastHistory(pageId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        return await db
            .selectFrom('pageHistory')
            .select(this.baseFields)
            .$if(opts?.includeContent, (qb) => qb.select('content'))
            .where('pageId', '=', pageId)
            .limit(1)
            .orderBy('createdAt', 'desc')
            .executeTakeFirst();
    }
    withLastUpdatedBy(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'pageHistory.lastUpdatedById')).as('lastUpdatedBy');
    }
    withContributors(eb) {
        return (0, postgres_1.jsonArrayFrom)(eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', (0, kysely_1.sql) `ANY(${eb.ref('pageHistory.contributorIds')})`)).as('contributors');
    }
};
exports.PageHistoryRepo = PageHistoryRepo;
exports.PageHistoryRepo = PageHistoryRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], PageHistoryRepo);
//# sourceMappingURL=page-history.repo.js.map