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
exports.ShareRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const uuid_1 = require("uuid");
const kysely_1 = require("kysely");
const postgres_1 = require("kysely/helpers/postgres");
const space_member_repo_1 = require("../space/space-member.repo");
let ShareRepo = class ShareRepo {
    constructor(db, spaceMemberRepo) {
        this.db = db;
        this.spaceMemberRepo = spaceMemberRepo;
        this.baseFields = [
            'id',
            'key',
            'pageId',
            'includeSubPages',
            'searchIndexing',
            'creatorId',
            'spaceId',
            'workspaceId',
            'createdAt',
            'updatedAt',
            'deletedAt',
        ];
    }
    async findById(shareId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        let query = db.selectFrom('shares').select(this.baseFields);
        if (opts?.includeSharedPage) {
            query = query.select((eb) => this.withSharedPage(eb));
        }
        if (opts?.includeCreator) {
            query = query.select((eb) => this.withCreator(eb));
        }
        if (opts?.withLock && opts?.trx) {
            query = query.forUpdate();
        }
        if ((0, uuid_1.validate)(shareId)) {
            query = query.where('id', '=', shareId);
        }
        else {
            query = query.where((0, kysely_1.sql) `LOWER(key)`, '=', shareId.toLowerCase());
        }
        return query.executeTakeFirst();
    }
    async findByPageId(pageId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        let query = db
            .selectFrom('shares')
            .select(this.baseFields)
            .where('pageId', '=', pageId);
        if (opts?.includeCreator) {
            query = query.select((eb) => this.withCreator(eb));
        }
        if (opts?.withLock && opts?.trx) {
            query = query.forUpdate();
        }
        return query.executeTakeFirst();
    }
    async updateShare(updatableShare, shareId, trx) {
        return (0, utils_1.dbOrTx)(this.db, trx)
            .updateTable('shares')
            .set({ ...updatableShare, updatedAt: new Date() })
            .where((0, uuid_1.validate)(shareId) ? 'id' : (0, kysely_1.sql) `LOWER(key)`, '=', shareId.toLowerCase())
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    async insertShare(insertableShare, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('shares')
            .values(insertableShare)
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    async deleteShare(shareId) {
        let query = this.db.deleteFrom('shares');
        if ((0, uuid_1.validate)(shareId)) {
            query = query.where('id', '=', shareId);
        }
        else {
            query = query.where((0, kysely_1.sql) `LOWER(key)`, '=', shareId.toLowerCase());
        }
        await query.execute();
    }
    async deleteBySpaceId(spaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('shares')
            .where('spaceId', '=', spaceId)
            .execute();
    }
    async deleteByWorkspaceId(workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('shares')
            .where('workspaceId', '=', workspaceId)
            .execute();
    }
    async getShares(userId, pagination) {
        const query = this.db
            .selectFrom('shares')
            .select(this.baseFields)
            .select((eb) => this.withPage(eb))
            .select((eb) => this.withSpace(eb, userId))
            .select((eb) => this.withCreator(eb))
            .where('spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(userId));
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
    withPage(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('pages')
            .select(['pages.id', 'pages.title', 'pages.slugId', 'pages.icon'])
            .whereRef('pages.id', '=', 'shares.pageId')).as('page');
    }
    withSpace(eb, userId) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('spaces')
            .select(['spaces.id', 'spaces.name', 'spaces.slug'])
            .$if(Boolean(userId), (qb) => qb.select((eb) => this.withUserSpaceRole(eb, userId)))
            .whereRef('spaces.id', '=', 'shares.spaceId')).as('space');
    }
    withUserSpaceRole(eb, userId) {
        return eb
            .selectFrom(eb
            .selectFrom('spaceMembers')
            .select(['spaceMembers.role'])
            .whereRef('spaceMembers.spaceId', '=', 'spaces.id')
            .where('spaceMembers.userId', '=', userId)
            .unionAll(eb
            .selectFrom('spaceMembers')
            .innerJoin('groupUsers', 'groupUsers.groupId', 'spaceMembers.groupId')
            .select(['spaceMembers.role'])
            .whereRef('spaceMembers.spaceId', '=', 'spaces.id')
            .where('groupUsers.userId', '=', userId))
            .as('roles_union'))
            .select('roles_union.role')
            .orderBy((0, kysely_1.sql) `CASE roles_union.role
            WHEN 'admin' THEN 3
            WHEN 'writer' THEN 2
            WHEN 'reader' THEN 1
            ELSE 0
           END`, 'desc')
            .limit(1)
            .as('userRole');
    }
    withCreator(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'shares.creatorId')).as('creator');
    }
    withSharedPage(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('pages')
            .select([
            'pages.id',
            'pages.slugId',
            'pages.title',
            'pages.icon',
            'pages.parentPageId',
        ])
            .whereRef('pages.id', '=', 'shares.pageId')).as('sharedPage');
    }
};
exports.ShareRepo = ShareRepo;
exports.ShareRepo = ShareRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object, space_member_repo_1.SpaceMemberRepo])
], ShareRepo);
//# sourceMappingURL=share.repo.js.map