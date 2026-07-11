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
exports.PageRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const uuid_1 = require("uuid");
const kysely_1 = require("kysely");
const postgres_1 = require("kysely/helpers/postgres");
const space_member_repo_1 = require("../space/space-member.repo");
const event_emitter_1 = require("@nestjs/event-emitter");
const event_contants_1 = require("../../../common/events/event.contants");
let PageRepo = class PageRepo {
    constructor(db, spaceMemberRepo, eventEmitter) {
        this.db = db;
        this.spaceMemberRepo = spaceMemberRepo;
        this.eventEmitter = eventEmitter;
        this.baseFields = [
            'id',
            'slugId',
            'title',
            'icon',
            'coverPhoto',
            'position',
            'parentPageId',
            'creatorId',
            'lastUpdatedById',
            'spaceId',
            'workspaceId',
            'isLocked',
            'metadata',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'contributorIds',
        ];
    }
    async findById(pageId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        let query = db
            .selectFrom('pages')
            .select(this.baseFields)
            .$if(opts?.includeContent, (qb) => qb.select('content'))
            .$if(opts?.includeYdoc, (qb) => qb.select('ydoc'))
            .$if(opts?.includeTextContent, (qb) => qb.select('textContent'))
            .$if(opts?.includeHasChildren, (qb) => qb.select((eb) => this.withHasChildren(eb)));
        if (opts?.includeCreator) {
            query = query.select((eb) => this.withCreator(eb));
        }
        if (opts?.includeLastUpdatedBy) {
            query = query.select((eb) => this.withLastUpdatedBy(eb));
        }
        if (opts?.includeContributors) {
            query = query.select((eb) => this.withContributors(eb));
        }
        if (opts?.includeDeletedBy) {
            query = query.select((eb) => this.withDeletedBy(eb));
        }
        if (opts?.includeSpace) {
            query = query.select((eb) => this.withSpace(eb));
        }
        if (opts?.withLock && opts?.trx) {
            query = query.forUpdate();
        }
        if ((0, uuid_1.validate)(pageId)) {
            query = query.where('id', '=', pageId);
        }
        else {
            query = query.where('slugId', '=', pageId);
        }
        return query.executeTakeFirst();
    }
    async findManyByIds(pageIds, opts) {
        if (pageIds.length === 0)
            return [];
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        let query = db
            .selectFrom('pages')
            .select(this.baseFields)
            .where('id', 'in', pageIds);
        if (opts?.workspaceId) {
            query = query
                .where('workspaceId', '=', opts.workspaceId)
                .where('deletedAt', 'is', null);
        }
        return query.execute();
    }
    async updatePage(updatablePage, pageId, trx) {
        return this.updatePages(updatablePage, [pageId], trx);
    }
    async updatePages(updatePageData, pageIds, trx) {
        const result = await (0, utils_1.dbOrTx)(this.db, trx)
            .updateTable('pages')
            .set({ ...updatePageData, updatedAt: new Date() })
            .where(pageIds.some((pageId) => !(0, uuid_1.validate)(pageId)) ? 'slugId' : 'id', 'in', pageIds)
            .executeTakeFirst();
        this.eventEmitter.emit(event_contants_1.EventName.PAGE_UPDATED, {
            pageIds: pageIds,
            workspaceId: updatePageData.workspaceId,
        });
        return result;
    }
    async insertPage(insertablePage, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        const result = await db
            .insertInto('pages')
            .values(insertablePage)
            .returning(this.baseFields)
            .executeTakeFirst();
        this.eventEmitter.emit(event_contants_1.EventName.PAGE_CREATED, {
            pageIds: [result.id],
            workspaceId: result.workspaceId,
        });
        return result;
    }
    async deletePage(pageId) {
        let query = this.db.deleteFrom('pages');
        if ((0, uuid_1.validate)(pageId)) {
            query = query.where('id', '=', pageId);
        }
        else {
            query = query.where('slugId', '=', pageId);
        }
        await query.execute();
    }
    async removePage(pageId, deletedById, workspaceId) {
        const currentDate = new Date();
        const descendants = await this.db
            .withRecursive('page_descendants', (db) => db
            .selectFrom('pages')
            .select(['id'])
            .where('id', '=', pageId)
            .where('deletedAt', 'is', null)
            .unionAll((exp) => exp
            .selectFrom('pages as p')
            .select(['p.id'])
            .innerJoin('page_descendants as pd', 'pd.id', 'p.parentPageId')
            .where('p.deletedAt', 'is', null)))
            .selectFrom('page_descendants')
            .selectAll()
            .execute();
        const pageIds = descendants.map((d) => d.id);
        if (pageIds.length > 0) {
            await (0, utils_1.executeTx)(this.db, async (trx) => {
                await trx
                    .updateTable('pages')
                    .set({
                    deletedById: deletedById,
                    deletedAt: currentDate,
                })
                    .where('id', 'in', pageIds)
                    .where('deletedAt', 'is', null)
                    .execute();
                await trx.deleteFrom('shares').where('pageId', 'in', pageIds).execute();
            });
            this.eventEmitter.emit(event_contants_1.EventName.PAGE_SOFT_DELETED, {
                pageIds: pageIds,
                workspaceId,
            });
        }
    }
    async restorePage(pageId, workspaceId) {
        const pageToRestore = await this.db
            .selectFrom('pages')
            .select(['id', 'parentPageId'])
            .where('id', '=', pageId)
            .executeTakeFirst();
        if (!pageToRestore) {
            return;
        }
        let shouldDetachFromParent = false;
        if (pageToRestore.parentPageId) {
            const parent = await this.db
                .selectFrom('pages')
                .select(['id', 'deletedAt'])
                .where('id', '=', pageToRestore.parentPageId)
                .executeTakeFirst();
            shouldDetachFromParent = parent?.deletedAt !== null;
        }
        const pages = await this.db
            .withRecursive('page_descendants', (db) => db
            .selectFrom('pages')
            .select(['id'])
            .where('id', '=', pageId)
            .unionAll((exp) => exp
            .selectFrom('pages as p')
            .select(['p.id'])
            .innerJoin('page_descendants as pd', 'pd.id', 'p.parentPageId')))
            .selectFrom('page_descendants')
            .selectAll()
            .execute();
        const pageIds = pages.map((p) => p.id);
        await this.db
            .updateTable('pages')
            .set({ deletedById: null, deletedAt: null })
            .where('id', 'in', pageIds)
            .execute();
        if (shouldDetachFromParent) {
            await this.db
                .updateTable('pages')
                .set({ parentPageId: null })
                .where('id', '=', pageId)
                .execute();
        }
        this.eventEmitter.emit(event_contants_1.EventName.PAGE_RESTORED, {
            pageIds: pageIds,
            workspaceId: workspaceId,
        });
    }
    async getRecentPagesInSpace(spaceId, pagination) {
        const query = this.db
            .selectFrom('pages')
            .select(this.baseFields)
            .select((eb) => this.withSpace(eb))
            .where('spaceId', '=', spaceId)
            .where('deletedAt', 'is', null);
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [
                { expression: 'updatedAt', direction: 'desc' },
                { expression: 'id', direction: 'desc' },
            ],
            parseCursor: (cursor) => ({
                updatedAt: new Date(cursor.updatedAt),
                id: cursor.id,
            }),
        });
    }
    async getRecentPages(userId, pagination) {
        const query = this.db
            .selectFrom('pages')
            .select(this.baseFields)
            .select((eb) => this.withSpace(eb))
            .where('spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(userId))
            .where('deletedAt', 'is', null);
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [
                { expression: 'updatedAt', direction: 'desc' },
                { expression: 'id', direction: 'desc' },
            ],
            parseCursor: (cursor) => ({
                updatedAt: new Date(cursor.updatedAt),
                id: cursor.id,
            }),
        });
    }
    async getCreatedByPages(creatorId, requestingUserId, pagination, spaceId) {
        let query = this.db
            .selectFrom('pages')
            .select(this.baseFields)
            .select((eb) => this.withSpace(eb))
            .where('creatorId', '=', creatorId)
            .where('deletedAt', 'is', null);
        if (spaceId) {
            query = query.where('spaceId', '=', spaceId);
        }
        else {
            query = query.where('spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(requestingUserId));
        }
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [
                { expression: 'updatedAt', direction: 'desc' },
                { expression: 'id', direction: 'desc' },
            ],
            parseCursor: (cursor) => ({
                updatedAt: new Date(cursor.updatedAt),
                id: cursor.id,
            }),
        });
    }
    async getDeletedPagesInSpace(spaceId, pagination) {
        const query = this.db
            .selectFrom('pages')
            .select(this.baseFields)
            .select('content')
            .select((eb) => this.withSpace(eb))
            .select((eb) => this.withDeletedBy(eb))
            .where('spaceId', '=', spaceId)
            .where('deletedAt', 'is not', null)
            .where((eb) => eb.or([
            eb('parentPageId', 'is', null),
            eb.not(eb.exists(eb
                .selectFrom('pages as parent')
                .select('parent.id')
                .where('parent.id', '=', eb.ref('pages.parentPageId'))
                .where('parent.deletedAt', 'is not', null))),
        ]));
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [
                { expression: 'deletedAt', direction: 'desc' },
                { expression: 'id', direction: 'desc' },
            ],
            parseCursor: (cursor) => ({
                deletedAt: new Date(cursor.deletedAt),
                id: cursor.id,
            }),
        });
    }
    withSpace(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('spaces')
            .select(['spaces.id', 'spaces.name', 'spaces.slug'])
            .whereRef('spaces.id', '=', 'pages.spaceId')).as('space');
    }
    withCreator(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'pages.creatorId')).as('creator');
    }
    withLastUpdatedBy(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'pages.lastUpdatedById')).as('lastUpdatedBy');
    }
    withDeletedBy(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'pages.deletedById')).as('deletedBy');
    }
    withContributors(eb) {
        return (0, postgres_1.jsonArrayFrom)(eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', (0, kysely_1.sql) `ANY(${eb.ref('pages.contributorIds')})`)).as('contributors');
    }
    withHasChildren(eb) {
        return eb
            .selectFrom('pages as child')
            .select((eb) => eb
            .case()
            .when(eb.fn.countAll(), '>', 0)
            .then(true)
            .else(false)
            .end()
            .as('count'))
            .whereRef('child.parentPageId', '=', 'pages.id')
            .where('child.deletedAt', 'is', null)
            .limit(1)
            .as('hasChildren');
    }
    async getPageAndDescendants(parentPageId, opts) {
        return this.db
            .withRecursive('page_hierarchy', (db) => db
            .selectFrom('pages')
            .select([
            'id',
            'slugId',
            'title',
            'icon',
            'position',
            'parentPageId',
            'spaceId',
            'workspaceId',
            'createdAt',
            'updatedAt',
            'metadata',
        ])
            .$if(opts?.includeContent, (qb) => qb.select('content'))
            .where('id', '=', parentPageId)
            .where('deletedAt', 'is', null)
            .unionAll((exp) => exp
            .selectFrom('pages as p')
            .select([
            'p.id',
            'p.slugId',
            'p.title',
            'p.icon',
            'p.position',
            'p.parentPageId',
            'p.spaceId',
            'p.workspaceId',
            'p.createdAt',
            'p.updatedAt',
            'p.metadata',
        ])
            .$if(opts?.includeContent, (qb) => qb.select('p.content'))
            .innerJoin('page_hierarchy as ph', 'p.parentPageId', 'ph.id')
            .where('p.deletedAt', 'is', null)))
            .selectFrom('page_hierarchy')
            .selectAll()
            .execute();
    }
    async getPageAndDescendantsExcludingRestricted(parentPageId, opts) {
        return (this.db
            .withRecursive('page_hierarchy', (db) => db
            .selectFrom('pages')
            .leftJoin('pageAccess', 'pageAccess.pageId', 'pages.id')
            .select([
            'pages.id',
            'pages.slugId',
            'pages.title',
            'pages.icon',
            'pages.position',
            'pages.parentPageId',
            'pages.spaceId',
            'pages.workspaceId',
            (0, kysely_1.sql) `page_access.id IS NOT NULL`.as('isRestricted'),
        ])
            .$if(opts?.includeContent, (qb) => qb.select('pages.content'))
            .where('pages.id', '=', parentPageId)
            .where('pages.deletedAt', 'is', null)
            .unionAll((exp) => exp
            .selectFrom('pages as p')
            .innerJoin('page_hierarchy as ph', 'p.parentPageId', 'ph.id')
            .leftJoin('pageAccess', 'pageAccess.pageId', 'p.id')
            .select([
            'p.id',
            'p.slugId',
            'p.title',
            'p.icon',
            'p.position',
            'p.parentPageId',
            'p.spaceId',
            'p.workspaceId',
            (0, kysely_1.sql) `page_access.id IS NOT NULL`.as('isRestricted'),
        ])
            .$if(opts?.includeContent, (qb) => qb.select('p.content'))
            .where('p.deletedAt', 'is', null)
            .where('ph.isRestricted', '=', false)))
            .selectFrom('page_hierarchy')
            .select([
            'id',
            'slugId',
            'title',
            'icon',
            'position',
            'parentPageId',
            'spaceId',
            'workspaceId',
        ])
            .$if(opts?.includeContent, (qb) => qb.select('content'))
            .where('isRestricted', '=', false)
            .execute());
    }
};
exports.PageRepo = PageRepo;
exports.PageRepo = PageRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object, space_member_repo_1.SpaceMemberRepo,
        event_emitter_1.EventEmitter2])
], PageRepo);
//# sourceMappingURL=page.repo.js.map