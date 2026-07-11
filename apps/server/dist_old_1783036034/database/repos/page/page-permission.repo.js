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
exports.PagePermissionRepo = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
const kysely_1 = require("kysely");
const group_repo_1 = require("../group/group.repo");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const with_cache_1 = require("../../../common/helpers/with-cache");
const cache_keys_1 = require("../../../common/helpers/cache-keys");
let PagePermissionRepo = class PagePermissionRepo {
    constructor(db, groupRepo, cacheManager) {
        this.db = db;
        this.groupRepo = groupRepo;
        this.cacheManager = cacheManager;
    }
    async findPageAccessByPageId(pageId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .selectFrom('pageAccess')
            .selectAll()
            .where('pageId', '=', pageId)
            .executeTakeFirst();
    }
    async insertPageAccess(data, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('pageAccess')
            .values(data)
            .returningAll()
            .executeTakeFirst();
    }
    async deletePageAccess(pageId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db.deleteFrom('pageAccess').where('pageId', '=', pageId).execute();
    }
    async insertPagePermissions(permissions, trx) {
        if (permissions.length === 0)
            return;
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db.insertInto('pagePermissions').values(permissions).execute();
    }
    async findPagePermissionByUserId(pageAccessId, userId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .selectFrom('pagePermissions')
            .selectAll()
            .where('pageAccessId', '=', pageAccessId)
            .where('userId', '=', userId)
            .executeTakeFirst();
    }
    async findPagePermissionByGroupId(pageAccessId, groupId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .selectFrom('pagePermissions')
            .selectAll()
            .where('pageAccessId', '=', pageAccessId)
            .where('groupId', '=', groupId)
            .executeTakeFirst();
    }
    async deletePagePermissionByUserId(pageAccessId, userId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('pagePermissions')
            .where('pageAccessId', '=', pageAccessId)
            .where('userId', '=', userId)
            .execute();
    }
    async deletePagePermissionByGroupId(pageAccessId, groupId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('pagePermissions')
            .where('pageAccessId', '=', pageAccessId)
            .where('groupId', '=', groupId)
            .execute();
    }
    async deletePagePermissionsByUserIds(pageAccessId, userIds, trx) {
        if (userIds.length === 0)
            return;
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('pagePermissions')
            .where('pageAccessId', '=', pageAccessId)
            .where('userId', 'in', userIds)
            .execute();
    }
    async deletePagePermissionsByGroupIds(pageAccessId, groupIds, trx) {
        if (groupIds.length === 0)
            return;
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('pagePermissions')
            .where('pageAccessId', '=', pageAccessId)
            .where('groupId', 'in', groupIds)
            .execute();
    }
    async updatePagePermissionRole(pageAccessId, role, opts, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        let query = db
            .updateTable('pagePermissions')
            .set({ role, updatedAt: new Date() })
            .where('pageAccessId', '=', pageAccessId);
        if (opts.userId) {
            query = query.where('userId', '=', opts.userId);
        }
        else if (opts.groupId) {
            query = query.where('groupId', '=', opts.groupId);
        }
        await query.execute();
    }
    async countWritersByPageAccessId(pageAccessId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        const result = await db
            .selectFrom('pagePermissions')
            .select((eb) => eb.fn.count('id').as('count'))
            .where('pageAccessId', '=', pageAccessId)
            .where('role', '=', 'writer')
            .executeTakeFirst();
        return Number(result?.count ?? 0);
    }
    async getPagePermissionsPaginated(pageAccessId, pagination) {
        let baseQuery = this.db
            .selectFrom('pagePermissions')
            .leftJoin('users', 'users.id', 'pagePermissions.userId')
            .leftJoin('groups', 'groups.id', 'pagePermissions.groupId')
            .select([
            'pagePermissions.id',
            'pagePermissions.role',
            'pagePermissions.createdAt',
            'users.id as userId',
            'users.name as userName',
            'users.avatarUrl as userAvatarUrl',
            'users.email as userEmail',
            'groups.id as groupId',
            'groups.name as groupName',
            'groups.isDefault as groupIsDefault',
        ])
            .select((eb) => this.groupRepo.withMemberCount(eb))
            .select((eb) => eb
            .case()
            .when('groups.id', 'is not', null)
            .then(1)
            .else(0)
            .end()
            .as('isGroup'))
            .where('pageAccessId', '=', pageAccessId);
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
                { expression: 'sub.isGroup', direction: 'desc', key: 'isGroup' },
                { expression: 'sub.id', direction: 'asc', key: 'id' },
            ],
            parseCursor: (cursor) => ({
                isGroup: parseInt(cursor.isGroup, 10),
                id: cursor.id,
            }),
        });
        const items = result.items.map((member) => {
            if (member.userId) {
                return {
                    id: member.userId,
                    name: member.userName,
                    email: member.userEmail,
                    avatarUrl: member.userAvatarUrl,
                    type: 'user',
                    role: member.role,
                    createdAt: member.createdAt,
                };
            }
            else {
                return {
                    id: member.groupId,
                    name: member.groupName,
                    memberCount: member.memberCount,
                    isDefault: member.groupIsDefault,
                    type: 'group',
                    role: member.role,
                    createdAt: member.createdAt,
                };
            }
        });
        return { items, meta: result.meta };
    }
    async getUserPagePermission(userId, pageId) {
        const result = await this.db
            .selectFrom('pageAccess')
            .innerJoin('pagePermissions', 'pagePermissions.pageAccessId', 'pageAccess.id')
            .select(['pagePermissions.role'])
            .where('pageAccess.pageId', '=', pageId)
            .where('pagePermissions.userId', '=', userId)
            .unionAll(this.db
            .selectFrom('pageAccess')
            .innerJoin('pagePermissions', 'pagePermissions.pageAccessId', 'pageAccess.id')
            .innerJoin('groupUsers', 'groupUsers.groupId', 'pagePermissions.groupId')
            .select(['pagePermissions.role'])
            .where('pageAccess.pageId', '=', pageId)
            .where('groupUsers.userId', '=', userId))
            .executeTakeFirst();
        return result;
    }
    async findRestrictedAncestor(pageId) {
        return this.db
            .withRecursive('ancestors', (qb) => qb
            .selectFrom('pages')
            .select([
            'pages.id as ancestorId',
            'pages.parentPageId',
            (0, kysely_1.sql) `0`.as('depth'),
        ])
            .where('pages.id', '=', pageId)
            .unionAll((eb) => eb
            .selectFrom('pages')
            .innerJoin('ancestors', 'ancestors.parentPageId', 'pages.id')
            .select([
            'pages.id as ancestorId',
            'pages.parentPageId',
            (0, kysely_1.sql) `ancestors.depth + 1`.as('depth'),
        ])))
            .selectFrom('ancestors')
            .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
            .select([
            'pageAccess.id as pageAccessId',
            'pageAccess.pageId',
            'pageAccess.accessLevel',
            'ancestors.depth',
        ])
            .orderBy('ancestors.depth', 'asc')
            .executeTakeFirst();
    }
    async canUserAccessPage(userId, pageId) {
        const { canAccess } = await this.canUserEditPage(userId, pageId);
        return canAccess;
    }
    async canUserEditPage(userId, pageId) {
        return (0, with_cache_1.withCache)(this.cacheManager, cache_keys_1.CacheKey.PAGE_CAN_EDIT(userId, pageId), cache_keys_1.PERMISSION_CACHE_TTL_MS, async () => {
            const result = await (0, kysely_1.sql) `
          WITH RECURSIVE ancestors AS (
            SELECT id AS ancestor_id, parent_page_id, 0 AS depth
            FROM pages
            WHERE id = ${pageId}::uuid
            UNION ALL
            SELECT p.id, p.parent_page_id, a.depth + 1
            FROM pages p
            JOIN ancestors a ON a.parent_page_id = p.id
          )
          SELECT
            bool_and(pp.id IS NOT NULL) AS "canAccess",
            -- nearest restricted ancestor's highest role wins (DESC: 'writer' > 'reader', NULLS LAST: no-permission after real roles)
            (array_agg(pp.role ORDER BY a.depth ASC, pp.role DESC NULLS LAST))[1] = 'writer' AS "canEdit"
          FROM ancestors a
          JOIN page_access pa ON pa.page_id = a.ancestor_id
          LEFT JOIN page_permissions pp ON pp.page_access_id = pa.id
            AND (
              pp.user_id = ${userId}::uuid
              OR pp.group_id IN (
                SELECT gu.group_id FROM group_users gu WHERE gu.user_id = ${userId}::uuid
              )
            )
        `.execute(this.db);
            const row = result.rows[0];
            if (!row || row.canAccess === null) {
                return { hasAnyRestriction: false, canAccess: true, canEdit: true };
            }
            return {
                hasAnyRestriction: true,
                canAccess: row.canAccess,
                canEdit: row.canAccess && (row.canEdit ?? false),
            };
        });
    }
    async getUserPageAccessLevel(userId, pageId) {
        const result = await this.db
            .withRecursive('ancestors', (qb) => qb
            .selectFrom('pages')
            .select([
            'pages.id as ancestorId',
            'pages.parentPageId',
            (0, kysely_1.sql) `0`.as('depth'),
        ])
            .where('pages.id', '=', pageId)
            .unionAll((eb) => eb
            .selectFrom('pages')
            .innerJoin('ancestors', 'ancestors.parentPageId', 'pages.id')
            .select([
            'pages.id as ancestorId',
            'pages.parentPageId',
            (0, kysely_1.sql) `ancestors.depth + 1`.as('depth'),
        ])))
            .selectFrom('pages')
            .select((eb) => [
            eb
                .case()
                .when(eb.exists(eb
                .selectFrom('pageAccess')
                .select('pageAccess.id')
                .whereRef('pageAccess.pageId', '=', 'pages.id')))
                .then(true)
                .else(false)
                .end()
                .as('hasDirectRestriction'),
            eb
                .case()
                .when(eb.exists(eb
                .selectFrom('ancestors')
                .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
                .select('pageAccess.id')
                .where('ancestors.depth', '>', 0)))
                .then(true)
                .else(false)
                .end()
                .as('hasInheritedRestriction'),
            eb
                .case()
                .when(eb.not(eb.exists(eb
                .selectFrom('ancestors')
                .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
                .leftJoin('pagePermissions', (join) => join
                .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
                .on((eb2) => eb2.or([
                eb2('pagePermissions.userId', '=', userId),
                eb2('pagePermissions.groupId', 'in', this.userGroupIdsSubquery(eb2, userId)),
            ])))
                .select('pageAccess.pageId')
                .where('pagePermissions.id', 'is', null))))
                .then(true)
                .else(false)
                .end()
                .as('canAccess'),
            eb
                .case()
                .when(eb.exists(eb
                .selectFrom('ancestors')
                .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
                .leftJoin('pagePermissions', (join) => join
                .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
                .on((eb2) => eb2.or([
                eb2('pagePermissions.userId', '=', userId),
                eb2('pagePermissions.groupId', 'in', this.userGroupIdsSubquery(eb2, userId)),
            ])))
                .select('pageAccess.pageId')
                .where('pagePermissions.id', 'is', null)))
                .then(false)
                .when(eb.not(eb.exists(eb
                .selectFrom('ancestors')
                .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
                .select('pageAccess.id'))))
                .then(true)
                .when(eb.exists(eb
                .selectFrom('pagePermissions')
                .select('pagePermissions.id')
                .where('pagePermissions.role', '=', 'writer')
                .where('pagePermissions.pageAccessId', '=', (0, kysely_1.sql) `(
                    SELECT pa.id FROM ancestors a_nr
                    JOIN page_access pa ON pa.page_id = a_nr.ancestor_id
                    ORDER BY a_nr.depth ASC
                    LIMIT 1
                  )`)
                .where((eb2) => eb2.or([
                eb2('pagePermissions.userId', '=', userId),
                eb2('pagePermissions.groupId', 'in', this.userGroupIdsSubquery(eb2, userId)),
            ]))))
                .then(true)
                .else(false)
                .end()
                .as('canEdit'),
        ])
            .where('pages.id', '=', pageId)
            .executeTakeFirst();
        const hasDirectRestriction = Boolean(result?.hasDirectRestriction);
        const hasInheritedRestriction = Boolean(result?.hasInheritedRestriction);
        return {
            hasDirectRestriction,
            hasInheritedRestriction,
            hasAnyRestriction: hasDirectRestriction || hasInheritedRestriction,
            canAccess: Boolean(result?.canAccess),
            canEdit: Boolean(result?.canEdit),
        };
    }
    async filterAccessiblePageIds(opts) {
        const { pageIds, userId, spaceId } = opts;
        if (pageIds.length === 0)
            return [];
        if (spaceId) {
            const hasRestrictions = await this.hasRestrictedPagesInSpace(spaceId);
            if (!hasRestrictions) {
                return pageIds;
            }
        }
        const results = await this.db
            .withRecursive('allAncestors', (qb) => qb
            .selectFrom('pages')
            .select([
            'pages.id as pageId',
            'pages.id as ancestorId',
            'pages.parentPageId',
        ])
            .where((0, kysely_1.sql) `pages.id = ANY(${pageIds}::uuid[])`)
            .unionAll((eb) => eb
            .selectFrom('pages')
            .innerJoin('allAncestors', 'allAncestors.parentPageId', 'pages.id')
            .select([
            'allAncestors.pageId',
            'pages.id as ancestorId',
            'pages.parentPageId',
        ])))
            .selectFrom('pages')
            .select('pages.id')
            .where((0, kysely_1.sql) `pages.id = ANY(${pageIds}::uuid[])`)
            .where(({ not, exists, selectFrom }) => not(exists(selectFrom('allAncestors')
            .innerJoin('pageAccess', 'pageAccess.pageId', 'allAncestors.ancestorId')
            .leftJoin('pagePermissions', (join) => join
            .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
            .on((eb) => eb.or([
            eb('pagePermissions.userId', '=', userId),
            eb('pagePermissions.groupId', 'in', this.userGroupIdsSubquery(eb, userId)),
        ])))
            .select('pageAccess.pageId')
            .whereRef('allAncestors.pageId', '=', 'pages.id')
            .where('pagePermissions.id', 'is', null))))
            .execute();
        return results.map((r) => r.id);
    }
    async filterAccessiblePageIdsWithPermissions(pageIds, userId) {
        if (pageIds.length === 0)
            return [];
        const results = await this.db
            .withRecursive('allAncestors', (qb) => qb
            .selectFrom('pages')
            .select([
            'pages.id as pageId',
            'pages.id as ancestorId',
            'pages.parentPageId',
            (0, kysely_1.sql) `0`.as('depth'),
        ])
            .where((0, kysely_1.sql) `pages.id = ANY(${pageIds}::uuid[])`)
            .unionAll((eb) => eb
            .selectFrom('pages')
            .innerJoin('allAncestors', 'allAncestors.parentPageId', 'pages.id')
            .select([
            'allAncestors.pageId',
            'pages.id as ancestorId',
            'pages.parentPageId',
            (0, kysely_1.sql) `all_ancestors.depth + 1`.as('depth'),
        ])))
            .selectFrom('pages')
            .select('pages.id')
            .select((eb) => eb
            .case()
            .when(eb.not(eb.exists(eb
            .selectFrom('allAncestors')
            .innerJoin('pageAccess', 'pageAccess.pageId', 'allAncestors.ancestorId')
            .select('pageAccess.id')
            .whereRef('allAncestors.pageId', '=', 'pages.id'))))
            .then(true)
            .when(eb.exists(eb
            .selectFrom('pagePermissions')
            .select('pagePermissions.id')
            .where('pagePermissions.role', '=', 'writer')
            .where('pagePermissions.pageAccessId', '=', (0, kysely_1.sql) `(
                    SELECT pa.id FROM all_ancestors aa
                    JOIN page_access pa ON pa.page_id = aa.ancestor_id
                    WHERE aa.page_id = pages.id
                    ORDER BY aa.depth ASC
                    LIMIT 1
                  )`)
            .where((eb2) => eb2.or([
            eb2('pagePermissions.userId', '=', userId),
            eb2('pagePermissions.groupId', 'in', this.userGroupIdsSubquery(eb2, userId)),
        ]))))
            .then(true)
            .else(false)
            .end()
            .as('canEdit'))
            .where((0, kysely_1.sql) `pages.id = ANY(${pageIds}::uuid[])`)
            .where(({ not, exists, selectFrom }) => not(exists(selectFrom('allAncestors')
            .innerJoin('pageAccess', 'pageAccess.pageId', 'allAncestors.ancestorId')
            .leftJoin('pagePermissions', (join) => join
            .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
            .on((eb) => eb.or([
            eb('pagePermissions.userId', '=', userId),
            eb('pagePermissions.groupId', 'in', this.userGroupIdsSubquery(eb, userId)),
        ])))
            .select('pageAccess.pageId')
            .whereRef('allAncestors.pageId', '=', 'pages.id')
            .where('pagePermissions.id', 'is', null))))
            .execute();
        return results.map((r) => ({ id: r.id, canEdit: Boolean(r.canEdit) }));
    }
    async hasRestrictedAncestor(pageId) {
        const result = await this.db
            .withRecursive('ancestors', (qb) => qb
            .selectFrom('pages')
            .select(['pages.id as ancestorId', 'pages.parentPageId'])
            .where('pages.id', '=', pageId)
            .unionAll((eb) => eb
            .selectFrom('pages')
            .innerJoin('ancestors', 'ancestors.parentPageId', 'pages.id')
            .select(['pages.id as ancestorId', 'pages.parentPageId'])))
            .selectFrom('ancestors')
            .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
            .select('pageAccess.id')
            .executeTakeFirst();
        return !!result;
    }
    async hasRestrictedPagesInSpace(spaceId) {
        const result = await this.db
            .selectNoFrom((eb) => eb
            .exists(eb
            .selectFrom('pageAccess')
            .select((0, kysely_1.sql) `1`.as('one'))
            .where('pageAccess.spaceId', '=', spaceId))
            .as('exists'))
            .executeTakeFirst();
        return Boolean(result?.exists);
    }
    async getParentIdsWithAccessibleChildren(parentIds, userId) {
        if (parentIds.length === 0)
            return [];
        const results = await this.db
            .withRecursive('childAncestors', (qb) => qb
            .selectFrom('pages as child')
            .select([
            'child.id as childId',
            'child.id as ancestorId',
            'child.parentPageId as ancestorParentId',
        ])
            .where('child.parentPageId', 'in', parentIds)
            .where('child.deletedAt', 'is', null)
            .unionAll((eb) => eb
            .selectFrom('pages')
            .innerJoin('childAncestors', 'childAncestors.ancestorParentId', 'pages.id')
            .select([
            'childAncestors.childId',
            'pages.id as ancestorId',
            'pages.parentPageId as ancestorParentId',
        ])))
            .selectFrom('pages as child')
            .select('child.parentPageId')
            .distinct()
            .where('child.parentPageId', 'in', parentIds)
            .where('child.deletedAt', 'is', null)
            .where(({ not, exists, selectFrom }) => not(exists(selectFrom('childAncestors')
            .innerJoin('pageAccess', 'pageAccess.pageId', 'childAncestors.ancestorId')
            .leftJoin('pagePermissions', (join) => join
            .onRef('pagePermissions.pageAccessId', '=', 'pageAccess.id')
            .on((eb) => eb.or([
            eb('pagePermissions.userId', '=', userId),
            eb('pagePermissions.groupId', 'in', this.userGroupIdsSubquery(eb, userId)),
        ])))
            .select('pageAccess.pageId')
            .whereRef('childAncestors.childId', '=', 'child.id')
            .where('pagePermissions.id', 'is', null))))
            .execute();
        return results.map((r) => r.parentPageId);
    }
    async getRestrictedSubtreeIds(rootPageId) {
        const results = await this.db
            .withRecursive('descendants', (qb) => qb
            .selectFrom('pages')
            .select(['pages.id as descendantId', 'pages.parentPageId'])
            .where('pages.id', '=', rootPageId)
            .unionAll((eb) => eb
            .selectFrom('pages')
            .innerJoin('descendants', 'descendants.descendantId', 'pages.parentPageId')
            .select(['pages.id as descendantId', 'pages.parentPageId'])
            .where('pages.deletedAt', 'is', null)))
            .withRecursive('descendantAncestors', (qb) => qb
            .selectFrom('descendants')
            .innerJoin('pages', 'pages.id', 'descendants.descendantId')
            .select([
            'descendants.descendantId',
            'pages.id as ancestorId',
            'pages.parentPageId as ancestorParentId',
        ])
            .unionAll((eb) => eb
            .selectFrom('pages')
            .innerJoin('descendantAncestors', 'descendantAncestors.ancestorParentId', 'pages.id')
            .select([
            'descendantAncestors.descendantId',
            'pages.id as ancestorId',
            'pages.parentPageId as ancestorParentId',
        ])))
            .selectFrom('descendantAncestors')
            .innerJoin('pageAccess', 'pageAccess.pageId', 'descendantAncestors.ancestorId')
            .select('descendantAncestors.descendantId')
            .distinct()
            .execute();
        return results.map((r) => r.descendantId);
    }
    async getUserIdsWithPageAccess(pageId, userIds) {
        if (userIds.length === 0)
            return [];
        const results = await (0, kysely_1.sql) `
      WITH RECURSIVE ancestors AS (
        SELECT id AS ancestor_id, parent_page_id
        FROM pages
        WHERE id = ${pageId}::uuid
        UNION ALL
        SELECT p.id, p.parent_page_id
        FROM pages p
        JOIN ancestors a ON a.parent_page_id = p.id
      )
      SELECT cu.user_id AS "userId"
      FROM unnest(${userIds}::uuid[]) AS cu(user_id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM ancestors a
        JOIN page_access pa ON pa.page_id = a.ancestor_id
        LEFT JOIN page_permissions pp ON pp.page_access_id = pa.id
          AND (
            pp.user_id = cu.user_id
            OR pp.group_id IN (
              SELECT gu.group_id FROM group_users gu WHERE gu.user_id = cu.user_id
            )
          )
        WHERE pp.id IS NULL
      )
    `.execute(this.db);
        return results.rows.map((r) => r.userId);
    }
    userGroupIdsSubquery(eb, userId) {
        return eb
            .selectFrom('groupUsers')
            .select('groupUsers.groupId')
            .where('groupUsers.userId', '=', userId);
    }
};
exports.PagePermissionRepo = PagePermissionRepo;
exports.PagePermissionRepo = PagePermissionRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __param(2, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [Object, group_repo_1.GroupRepo, Object])
], PagePermissionRepo);
//# sourceMappingURL=page-permission.repo.js.map