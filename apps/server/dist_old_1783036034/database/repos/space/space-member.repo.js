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
exports.SpaceMemberRepo = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
const kysely_1 = require("kysely");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const group_repo_1 = require("../group/group.repo");
const space_repo_1 = require("./space.repo");
const with_cache_1 = require("../../../common/helpers/with-cache");
const cache_keys_1 = require("../../../common/helpers/cache-keys");
let SpaceMemberRepo = class SpaceMemberRepo {
    constructor(db, groupRepo, spaceRepo, cacheManager) {
        this.db = db;
        this.groupRepo = groupRepo;
        this.spaceRepo = spaceRepo;
        this.cacheManager = cacheManager;
    }
    async insertSpaceMember(insertableSpaceMember, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .insertInto('spaceMembers')
            .values(insertableSpaceMember)
            .returningAll()
            .execute();
    }
    async updateSpaceMember(updatableSpaceMember, spaceMemberId, spaceId) {
        await this.db
            .updateTable('spaceMembers')
            .set(updatableSpaceMember)
            .where('id', '=', spaceMemberId)
            .where('spaceId', '=', spaceId)
            .execute();
    }
    async getSpaceMemberByTypeId(spaceId, opts, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        let query = db
            .selectFrom('spaceMembers')
            .selectAll()
            .where('spaceId', '=', spaceId);
        if (opts.userId) {
            query = query.where('userId', '=', opts.userId);
        }
        else if (opts.groupId) {
            query = query.where('groupId', '=', opts.groupId);
        }
        else {
            throw new common_1.BadRequestException('Please provide a userId or groupId');
        }
        return query.executeTakeFirst();
    }
    async removeSpaceMemberById(memberId, spaceId, opts) {
        const { trx } = opts;
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('spaceMembers')
            .where('id', '=', memberId)
            .where('spaceId', '=', spaceId)
            .execute();
    }
    async roleCountBySpaceId(role, spaceId) {
        const { count } = await this.db
            .selectFrom('spaceMembers')
            .select((eb) => eb.fn.count('role').as('count'))
            .where('role', '=', role)
            .where('spaceId', '=', spaceId)
            .executeTakeFirst();
        return count;
    }
    async getSpaceMembersPaginated(spaceId, pagination) {
        let baseQuery = this.db
            .selectFrom('spaceMembers')
            .leftJoin('users', 'users.id', 'spaceMembers.userId')
            .leftJoin('groups', 'groups.id', 'spaceMembers.groupId')
            .select([
            'spaceMembers.id as id',
            'users.id as userId',
            'users.name as userName',
            'users.avatarUrl as userAvatarUrl',
            'users.email as userEmail',
            'groups.id as groupId',
            'groups.name as groupName',
            'groups.isDefault as groupIsDefault',
            'spaceMembers.role',
            'spaceMembers.createdAt',
        ])
            .select((eb) => this.groupRepo.withMemberCount(eb))
            .select((0, kysely_1.sql) `case when groups.id is not null then 1 else 0 end`.as('isGroup'))
            .select((0, kysely_1.sql) `case "space_members"."role" when 'admin' then 1 when 'writer' then 2 when 'reader' then 3 else 4 end`.as('roleOrder'))
            .select((0, kysely_1.sql) `coalesce(users.name, groups.name)`.as('memberName'))
            .where('spaceId', '=', spaceId);
        if (pagination.query) {
            baseQuery = baseQuery.where((eb) => eb((0, kysely_1.sql) `f_unaccent(users.name)`, 'ilike', (0, kysely_1.sql) `f_unaccent(${'%' + pagination.query + '%'})`)
                .or((0, kysely_1.sql) `users.email`, 'ilike', (0, kysely_1.sql) `f_unaccent(${'%' + pagination.query + '%'})`)
                .or((0, kysely_1.sql) `f_unaccent(groups.name)`, 'ilike', (0, kysely_1.sql) `f_unaccent(${'%' + pagination.query + '%'})`));
        }
        const query = this.db.selectFrom(baseQuery.as('sub')).selectAll('sub');
        const result = await (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [
                { expression: 'sub.roleOrder', direction: 'asc', key: 'roleOrder' },
                { expression: 'sub.isGroup', direction: 'desc', key: 'isGroup' },
                { expression: 'sub.memberName', direction: 'asc', key: 'memberName' },
                { expression: 'sub.id', direction: 'asc', key: 'id' },
            ],
            parseCursor: (cursor) => ({
                roleOrder: parseInt(cursor.roleOrder, 10),
                isGroup: parseInt(cursor.isGroup, 10),
                memberName: cursor.memberName,
                id: cursor.id,
            }),
        });
        let memberInfo;
        const members = result.items.map((member) => {
            if (member.userId) {
                memberInfo = {
                    id: member.userId,
                    name: member.userName,
                    email: member.userEmail,
                    avatarUrl: member.userAvatarUrl,
                    type: 'user',
                };
            }
            else if (member.groupId) {
                memberInfo = {
                    id: member.groupId,
                    name: member.groupName,
                    memberCount: member.memberCount,
                    isDefault: member.groupIsDefault,
                    type: 'group',
                };
            }
            return {
                ...memberInfo,
                role: member.role,
                createdAt: member.createdAt,
            };
        });
        result.items = members;
        return result;
    }
    async getUserSpaceRoles(userId, spaceId) {
        return (0, with_cache_1.withCache)(this.cacheManager, cache_keys_1.CacheKey.SPACE_ROLES(userId, spaceId), cache_keys_1.PERMISSION_CACHE_TTL_MS, async () => {
            const roles = await this.db
                .selectFrom('spaceMembers')
                .select(['userId', 'role'])
                .where('userId', '=', userId)
                .where('spaceId', '=', spaceId)
                .unionAll(this.db
                .selectFrom('spaceMembers')
                .innerJoin('groupUsers', 'groupUsers.groupId', 'spaceMembers.groupId')
                .select(['groupUsers.userId', 'spaceMembers.role'])
                .where('groupUsers.userId', '=', userId)
                .where('spaceMembers.spaceId', '=', spaceId))
                .execute();
            if (!roles || roles.length === 0) {
                return undefined;
            }
            return roles;
        });
    }
    async getUserIdsWithSpaceAccess(userIds, spaceId) {
        if (userIds.length === 0)
            return new Set();
        const rows = await this.db
            .selectFrom('spaceMembers')
            .select('userId')
            .where('userId', 'in', userIds)
            .where('spaceId', '=', spaceId)
            .unionAll(this.db
            .selectFrom('spaceMembers')
            .innerJoin('groupUsers', 'groupUsers.groupId', 'spaceMembers.groupId')
            .select('groupUsers.userId')
            .where('groupUsers.userId', 'in', userIds)
            .where('spaceMembers.spaceId', '=', spaceId))
            .execute();
        return new Set(rows.map((r) => r.userId));
    }
    async getSpaceIdsByGroupId(groupId) {
        const rows = await this.db
            .selectFrom('spaceMembers')
            .select('spaceId')
            .where('groupId', '=', groupId)
            .execute();
        return rows.map((r) => r.spaceId);
    }
    getUserSpaceIdsQuery(userId) {
        return this.db
            .selectFrom('spaceMembers')
            .innerJoin('spaces', 'spaces.id', 'spaceMembers.spaceId')
            .select('spaces.id')
            .where('userId', '=', userId)
            .union(this.db
            .selectFrom('spaceMembers')
            .innerJoin('groupUsers', 'groupUsers.groupId', 'spaceMembers.groupId')
            .innerJoin('spaces', 'spaces.id', 'spaceMembers.spaceId')
            .select('spaces.id')
            .where('groupUsers.userId', '=', userId));
    }
    async getUserSpaceIds(userId) {
        const membership = await this.getUserSpaceIdsQuery(userId).execute();
        return membership.map((space) => space.id);
    }
    async getUserRolesForSpaces(userId, spaceIds) {
        if (spaceIds.length === 0)
            return [];
        return this.db
            .selectFrom('spaceMembers')
            .select(['spaceId', 'role'])
            .where('userId', '=', userId)
            .where('spaceId', 'in', spaceIds)
            .unionAll(this.db
            .selectFrom('spaceMembers')
            .innerJoin('groupUsers', 'groupUsers.groupId', 'spaceMembers.groupId')
            .select(['spaceMembers.spaceId', 'spaceMembers.role'])
            .where('groupUsers.userId', '=', userId)
            .where('spaceMembers.spaceId', 'in', spaceIds))
            .execute();
    }
    async getUserSpaces(userId, pagination) {
        let query = this.db
            .selectFrom('spaces')
            .selectAll()
            .select((eb) => [this.spaceRepo.withMemberCount(eb)])
            .where('id', 'in', this.getUserSpaceIdsQuery(userId));
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
};
exports.SpaceMemberRepo = SpaceMemberRepo;
exports.SpaceMemberRepo = SpaceMemberRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __param(3, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [Object, group_repo_1.GroupRepo,
        space_repo_1.SpaceRepo, Object])
], SpaceMemberRepo);
//# sourceMappingURL=space-member.repo.js.map