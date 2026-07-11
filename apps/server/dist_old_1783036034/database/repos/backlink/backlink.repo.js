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
exports.BacklinkRepo = void 0;
const utils_1 = require("../../utils");
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const space_member_repo_1 = require("../space/space-member.repo");
const postgres_1 = require("kysely/helpers/postgres");
let BacklinkRepo = class BacklinkRepo {
    constructor(db, spaceMemberRepo) {
        this.db = db;
        this.spaceMemberRepo = spaceMemberRepo;
    }
    async findById(backlinkId, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .selectFrom('backlinks')
            .select([
            'id',
            'sourcePageId',
            'targetPageId',
            'workspaceId',
            'createdAt',
            'updatedAt',
        ])
            .where('id', '=', backlinkId)
            .where('workspaceId', '=', workspaceId)
            .executeTakeFirst();
    }
    async insertBacklink(insertableBacklink, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('backlinks')
            .values(insertableBacklink)
            .onConflict((oc) => oc.columns(['sourcePageId', 'targetPageId']).doNothing())
            .returningAll()
            .executeTakeFirst();
    }
    async updateBacklink(updatableBacklink, backlinkId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .updateTable('userTokens')
            .set(updatableBacklink)
            .where('id', '=', backlinkId)
            .execute();
    }
    async deleteBacklink(backlinkId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db.deleteFrom('backlinks').where('id', '=', backlinkId).execute();
    }
    async findRelatedPageIds(pageId, direction, userId) {
        const userSpaceIds = this.spaceMemberRepo.getUserSpaceIdsQuery(userId);
        if (direction === 'incoming') {
            const rows = await this.db
                .selectFrom('backlinks')
                .innerJoin('pages', 'pages.id', 'backlinks.sourcePageId')
                .select('backlinks.sourcePageId as relatedId')
                .where('backlinks.targetPageId', '=', pageId)
                .where('pages.deletedAt', 'is', null)
                .where('pages.spaceId', 'in', userSpaceIds)
                .execute();
            return rows.map((r) => r.relatedId);
        }
        const rows = await this.db
            .selectFrom('backlinks')
            .innerJoin('pages', 'pages.id', 'backlinks.targetPageId')
            .select('backlinks.targetPageId as relatedId')
            .where('backlinks.sourcePageId', '=', pageId)
            .where('pages.deletedAt', 'is', null)
            .where('pages.spaceId', 'in', userSpaceIds)
            .execute();
        return rows.map((r) => r.relatedId);
    }
    async findPagesByIdsPaginated(pageIds, pagination) {
        if (pageIds.length === 0) {
            return (0, cursor_pagination_1.emptyCursorPaginationResult)(pagination.limit);
        }
        const query = this.db
            .selectFrom('pages')
            .select((eb) => [
            'pages.id',
            'pages.slugId',
            'pages.title',
            'pages.icon',
            'pages.spaceId',
            'pages.updatedAt',
            (0, postgres_1.jsonObjectFrom)(eb
                .selectFrom('spaces')
                .select(['spaces.id', 'spaces.slug', 'spaces.name'])
                .whereRef('spaces.id', '=', 'pages.spaceId')).as('space'),
        ])
            .where('pages.deletedAt', 'is', null)
            .where('pages.id', 'in', pageIds);
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [
                { expression: 'pages.updatedAt', direction: 'desc', key: 'updatedAt' },
                { expression: 'pages.id', direction: 'desc', key: 'id' },
            ],
            parseCursor: (cursor) => ({
                updatedAt: new Date(cursor.updatedAt),
                id: cursor.id,
            }),
        });
    }
};
exports.BacklinkRepo = BacklinkRepo;
exports.BacklinkRepo = BacklinkRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object, space_member_repo_1.SpaceMemberRepo])
], BacklinkRepo);
//# sourceMappingURL=backlink.repo.js.map