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
exports.GroupRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
const kysely_1 = require("kysely");
const create_group_dto_1 = require("../../../core/group/dto/create-group.dto");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
let GroupRepo = class GroupRepo {
    constructor(db) {
        this.db = db;
        this.baseFields = [
            'id',
            'name',
            'description',
            'isDefault',
            'isExternal',
            'creatorId',
            'workspaceId',
            'createdAt',
            'updatedAt',
            'deletedAt',
        ];
    }
    async findById(groupId, workspaceId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        return db
            .selectFrom('groups')
            .select(this.baseFields)
            .$if(opts?.includeMemberCount, (qb) => qb.select(this.withMemberCount))
            .$if(opts?.includeScimExternalId, (qb) => qb.select('scimExternalId'))
            .where('id', '=', groupId)
            .where('workspaceId', '=', workspaceId)
            .executeTakeFirst();
    }
    async findByName(groupName, workspaceId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        return db
            .selectFrom('groups')
            .select(this.baseFields)
            .$if(opts?.includeMemberCount, (qb) => qb.select(this.withMemberCount))
            .$if(opts?.includeScimExternalId, (qb) => qb.select('scimExternalId'))
            .where((0, kysely_1.sql) `LOWER(name)`, '=', (0, kysely_1.sql) `LOWER(${groupName})`)
            .where('workspaceId', '=', workspaceId)
            .executeTakeFirst();
    }
    async update(updatableGroup, groupId, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .updateTable('groups')
            .set({ ...updatableGroup, updatedAt: new Date() })
            .where('id', '=', groupId)
            .where('workspaceId', '=', workspaceId)
            .execute();
    }
    async insertGroup(insertableGroup, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('groups')
            .values(insertableGroup)
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    async getDefaultGroup(workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return (db
            .selectFrom('groups')
            .select(this.baseFields)
            .where('isDefault', '=', true)
            .where('workspaceId', '=', workspaceId)
            .executeTakeFirst());
    }
    async createDefaultGroup(workspaceId, opts) {
        const { userId, trx } = opts;
        const insertableGroup = {
            name: create_group_dto_1.DefaultGroup.EVERYONE,
            isDefault: true,
            creatorId: userId,
            workspaceId: workspaceId,
        };
        return this.insertGroup(insertableGroup, trx);
    }
    async getGroupsPaginated(workspaceId, pagination) {
        let baseQuery = this.db
            .selectFrom('groups')
            .select(this.baseFields)
            .select((eb) => this.withMemberCount(eb))
            .where('workspaceId', '=', workspaceId);
        if (pagination.query) {
            baseQuery = baseQuery.where((eb) => eb((0, kysely_1.sql) `f_unaccent(name)`, 'ilike', (0, kysely_1.sql) `f_unaccent(${'%' + pagination.query + '%'})`).or((0, kysely_1.sql) `f_unaccent(description)`, 'ilike', (0, kysely_1.sql) `f_unaccent(${'%' + pagination.query + '%'})`));
        }
        const query = this.db.selectFrom(baseQuery.as('sub')).selectAll('sub');
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [
                {
                    expression: 'sub.memberCount',
                    direction: 'desc',
                    key: 'memberCount',
                },
                { expression: 'sub.name', direction: 'asc', key: 'name' },
                { expression: 'sub.id', direction: 'asc', key: 'id' },
            ],
            parseCursor: (cursor) => ({
                memberCount: parseInt(cursor.memberCount, 10),
                name: cursor.name,
                id: cursor.id,
            }),
        });
    }
    withMemberCount(eb) {
        return eb
            .selectFrom('groupUsers')
            .select((eb) => eb.fn.countAll().as('count'))
            .whereRef('groupUsers.groupId', '=', 'groups.id')
            .as('memberCount');
    }
    async delete(groupId, workspaceId, opts) {
        const { trx } = opts;
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('groups')
            .where('id', '=', groupId)
            .where('workspaceId', '=', workspaceId)
            .execute();
    }
};
exports.GroupRepo = GroupRepo;
exports.GroupRepo = GroupRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], GroupRepo);
//# sourceMappingURL=group.repo.js.map