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
exports.SpaceRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
const kysely_1 = require("kysely");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const uuid_1 = require("uuid");
const event_emitter_1 = require("@nestjs/event-emitter");
const event_contants_1 = require("../../../common/events/event.contants");
let SpaceRepo = class SpaceRepo {
    constructor(db, eventEmitter) {
        this.db = db;
        this.eventEmitter = eventEmitter;
    }
    async findById(spaceId, workspaceId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        let query = db
            .selectFrom('spaces')
            .selectAll('spaces')
            .$if(opts?.includeMemberCount, (qb) => qb.select(this.withMemberCount))
            .where('workspaceId', '=', workspaceId);
        if ((0, uuid_1.validate)(spaceId)) {
            query = query.where('id', '=', spaceId);
        }
        else {
            query = query.where((0, kysely_1.sql) `LOWER(slug)`, '=', (0, kysely_1.sql) `LOWER(${spaceId})`);
        }
        return query.executeTakeFirst();
    }
    async findBySlug(slug, workspaceId, opts) {
        return await this.db
            .selectFrom('spaces')
            .selectAll('spaces')
            .$if(opts?.includeMemberCount, (qb) => qb.select(this.withMemberCount))
            .where((0, kysely_1.sql) `LOWER(slug)`, '=', (0, kysely_1.sql) `LOWER(${slug})`)
            .where('workspaceId', '=', workspaceId)
            .executeTakeFirst();
    }
    async slugExists(slug, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        let { count } = await db
            .selectFrom('spaces')
            .select((eb) => eb.fn.count('id').as('count'))
            .where((0, kysely_1.sql) `LOWER(slug)`, '=', (0, kysely_1.sql) `LOWER(${slug})`)
            .where('workspaceId', '=', workspaceId)
            .executeTakeFirst();
        count = count;
        return count != 0;
    }
    async updateSpace(updatableSpace, spaceId, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .updateTable('spaces')
            .set({ ...updatableSpace, updatedAt: new Date() })
            .where('id', '=', spaceId)
            .where('workspaceId', '=', workspaceId)
            .returningAll()
            .executeTakeFirst();
    }
    async updateSharingSettings(spaceId, workspaceId, prefKey, prefValue, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .updateTable('spaces')
            .set({
            settings: (0, kysely_1.sql) `COALESCE(settings, '{}'::jsonb)
          || jsonb_build_object('sharing', COALESCE(settings->'sharing', '{}'::jsonb)
          || jsonb_build_object('${kysely_1.sql.raw(prefKey)}', ${kysely_1.sql.lit(prefValue)}))`,
            updatedAt: new Date(),
        })
            .where('id', '=', spaceId)
            .where('workspaceId', '=', workspaceId)
            .returningAll()
            .executeTakeFirst();
    }
    async updateCommentSettings(spaceId, workspaceId, prefKey, prefValue, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .updateTable('spaces')
            .set({
            settings: (0, kysely_1.sql) `COALESCE(settings, '{}'::jsonb)
          || jsonb_build_object('comments', COALESCE(settings->'comments', '{}'::jsonb)
          || jsonb_build_object('${kysely_1.sql.raw(prefKey)}', ${kysely_1.sql.lit(prefValue)}))`,
            updatedAt: new Date(),
        })
            .where('id', '=', spaceId)
            .where('workspaceId', '=', workspaceId)
            .returningAll()
            .executeTakeFirst();
    }
    async insertSpace(insertableSpace, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('spaces')
            .values(insertableSpace)
            .returningAll()
            .executeTakeFirst();
    }
    async getSpacesInWorkspace(workspaceId, pagination) {
        let query = this.db
            .selectFrom('spaces')
            .selectAll('spaces')
            .select((eb) => [this.withMemberCount(eb)])
            .where('workspaceId', '=', workspaceId);
        if (pagination.query) {
            query = query.where((eb) => eb((0, kysely_1.sql) `f_unaccent(name)`, 'ilike', (0, kysely_1.sql) `f_unaccent(${'%' + pagination.query + '%'})`).or((0, kysely_1.sql) `f_unaccent(description)`, 'ilike', (0, kysely_1.sql) `f_unaccent(${'%' + pagination.query + '%'})`));
        }
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [
                { expression: 'name', direction: 'asc' },
                { expression: 'id', direction: 'asc' },
            ],
            parseCursor: (cursor) => ({ name: cursor.name, id: cursor.id }),
        });
    }
    withMemberCount(eb) {
        const subquery = eb
            .selectFrom('spaceMembers')
            .select('spaceMembers.userId')
            .where('spaceMembers.userId', 'is not', null)
            .whereRef('spaceMembers.spaceId', '=', 'spaces.id')
            .union(eb
            .selectFrom('spaceMembers')
            .where('spaceMembers.groupId', 'is not', null)
            .leftJoin('groups', 'groups.id', 'spaceMembers.groupId')
            .leftJoin('groupUsers', 'groupUsers.groupId', 'groups.id')
            .select('groupUsers.userId')
            .whereRef('spaceMembers.spaceId', '=', 'spaces.id'))
            .as('userId');
        return eb
            .selectFrom(subquery)
            .select((eb) => eb.fn.count('userId').as('count'))
            .as('memberCount');
    }
    async deleteSpace(spaceId, workspaceId) {
        await this.db
            .deleteFrom('spaces')
            .where('id', '=', spaceId)
            .where('workspaceId', '=', workspaceId)
            .execute();
        this.eventEmitter.emit(event_contants_1.EventName.SPACE_DELETED, {
            spaceId,
        });
    }
};
exports.SpaceRepo = SpaceRepo;
exports.SpaceRepo = SpaceRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object, event_emitter_1.EventEmitter2])
], SpaceRepo);
//# sourceMappingURL=space.repo.js.map