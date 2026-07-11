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
exports.LabelRepo = exports.LabelType = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
const space_member_repo_1 = require("../space/space-member.repo");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const postgres_1 = require("kysely/helpers/postgres");
const utils_2 = require("../../../core/label/utils");
exports.LabelType = {
    PAGE: 'page',
    SPACE: 'space',
};
let LabelRepo = class LabelRepo {
    constructor(db, spaceMemberRepo) {
        this.db = db;
        this.spaceMemberRepo = spaceMemberRepo;
    }
    async findById(labelId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .selectFrom('labels')
            .selectAll()
            .where('id', '=', labelId)
            .executeTakeFirst();
    }
    async findByNameAndWorkspace(name, workspaceId, type, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .selectFrom('labels')
            .selectAll()
            .where('name', '=', (0, utils_2.normalizeLabelName)(name))
            .where('type', '=', type)
            .where('workspaceId', '=', workspaceId)
            .executeTakeFirst();
    }
    async findOrCreate(name, workspaceId, type, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        const normalizedName = (0, utils_2.normalizeLabelName)(name);
        return db
            .insertInto('labels')
            .values({ name: normalizedName, type, workspaceId })
            .onConflict((oc) => oc
            .columns(['name', 'type', 'workspaceId'])
            .doUpdateSet({ name: normalizedName }))
            .returningAll()
            .executeTakeFirstOrThrow();
    }
    async findLabelsByPageId(pageId, pagination) {
        const query = this.db
            .selectFrom('labels')
            .innerJoin('pageLabels', 'pageLabels.labelId', 'labels.id')
            .select([
            'labels.id',
            'labels.name',
            'labels.type',
            'labels.createdAt',
            'labels.updatedAt',
            'labels.workspaceId',
            'pageLabels.id as joinId',
        ])
            .where('pageLabels.pageId', '=', pageId)
            .where('labels.type', '=', exports.LabelType.PAGE);
        const result = await (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [
                { expression: 'pageLabels.id', direction: 'asc', key: 'joinId' },
            ],
            parseCursor: (cursor) => ({
                joinId: cursor.joinId,
            }),
        });
        return {
            ...result,
            items: result.items.map(({ joinId: _joinId, ...rest }) => rest),
        };
    }
    async findLabels(workspaceId, userId, type, pagination) {
        let query = this.db
            .selectFrom('labels')
            .select(['id', 'name', 'type', 'createdAt', 'updatedAt', 'workspaceId'])
            .where('workspaceId', '=', workspaceId)
            .where('type', '=', type)
            .where('id', 'in', this.db
            .selectFrom('pageLabels')
            .innerJoin('pages', 'pages.id', 'pageLabels.pageId')
            .select('pageLabels.labelId')
            .where('pages.deletedAt', 'is', null)
            .where('pages.spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(userId)));
        if (pagination.query) {
            query = query.where('name', 'like', `%${pagination.query.toLowerCase()}%`);
        }
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [
                { expression: 'name', direction: 'asc' },
                { expression: 'id', direction: 'asc' },
            ],
            parseCursor: (cursor) => ({
                name: cursor.name,
                id: cursor.id,
            }),
        });
    }
    async addLabelToPage(pageId, labelId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .insertInto('pageLabels')
            .values({ pageId, labelId })
            .onConflict((oc) => oc.doNothing())
            .execute();
    }
    async removeLabelFromPage(pageId, labelId, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('pageLabels')
            .where('pageId', '=', pageId)
            .where('labelId', '=', labelId)
            .where((eb) => eb.exists(eb
            .selectFrom('labels')
            .select('id')
            .whereRef('labels.id', '=', 'pageLabels.labelId')
            .where('labels.workspaceId', '=', workspaceId)))
            .execute();
    }
    async getPageLabelCount(pageId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        const result = await db
            .selectFrom('pageLabels')
            .select((eb) => eb.fn.count('id').as('count'))
            .where('pageId', '=', pageId)
            .executeTakeFirst();
        return Number(result?.count ?? 0);
    }
    async getLabelPageCount(labelId, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        const result = await db
            .selectFrom('pageLabels')
            .innerJoin('labels', 'labels.id', 'pageLabels.labelId')
            .select((eb) => eb.fn.count('pageLabels.id').as('count'))
            .where('pageLabels.labelId', '=', labelId)
            .where('labels.workspaceId', '=', workspaceId)
            .executeTakeFirst();
        return Number(result?.count ?? 0);
    }
    async deleteLabel(labelId, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('labels')
            .where('id', '=', labelId)
            .where('workspaceId', '=', workspaceId)
            .execute();
    }
    async findPagesByLabelId(labelId, userId, opts) {
        let query = this.db
            .selectFrom('pages')
            .innerJoin('pageLabels', 'pageLabels.pageId', 'pages.id')
            .select((eb) => [
            'pages.id',
            'pages.slugId',
            'pages.title',
            'pages.icon',
            'pages.spaceId',
            'pages.createdAt',
            'pages.updatedAt',
            (0, postgres_1.jsonObjectFrom)(eb
                .selectFrom('spaces')
                .select(['spaces.id', 'spaces.name', 'spaces.slug', 'spaces.logo'])
                .whereRef('spaces.id', '=', 'pages.spaceId')).as('space'),
            (0, postgres_1.jsonObjectFrom)(eb
                .selectFrom('users')
                .select(['users.id', 'users.name', 'users.avatarUrl'])
                .whereRef('users.id', '=', 'pages.creatorId')).as('creator'),
            (0, postgres_1.jsonArrayFrom)(eb
                .selectFrom('labels')
                .innerJoin('pageLabels as pl', 'pl.labelId', 'labels.id')
                .select(['labels.id', 'labels.name'])
                .whereRef('pl.pageId', '=', 'pages.id')
                .where('labels.type', '=', exports.LabelType.PAGE)
                .orderBy('pl.id', 'asc')).as('labels'),
        ])
            .where('pageLabels.labelId', '=', labelId)
            .where('pages.deletedAt', 'is', null);
        if (opts.spaceId) {
            query = query.where('pages.spaceId', '=', opts.spaceId);
        }
        else {
            query = query.where('pages.spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(userId));
        }
        if (opts.query) {
            query = query.where('pages.title', 'ilike', `%${opts.query}%`);
        }
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: opts.pagination.limit,
            cursor: opts.pagination.cursor,
            beforeCursor: opts.pagination.beforeCursor,
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
    async getLabelPageCountForUser(labelId, userId, spaceId) {
        let query = this.db
            .selectFrom('pageLabels')
            .innerJoin('pages', 'pages.id', 'pageLabels.pageId')
            .select((eb) => eb.fn.count('pageLabels.id').as('count'))
            .where('pageLabels.labelId', '=', labelId)
            .where('pages.deletedAt', 'is', null);
        if (spaceId) {
            query = query.where('pages.spaceId', '=', spaceId);
        }
        else {
            query = query.where('pages.spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(userId));
        }
        const result = await query.executeTakeFirst();
        return Number(result?.count ?? 0);
    }
};
exports.LabelRepo = LabelRepo;
exports.LabelRepo = LabelRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object, space_member_repo_1.SpaceMemberRepo])
], LabelRepo);
//# sourceMappingURL=label.repo.js.map