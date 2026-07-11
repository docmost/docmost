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
exports.UserRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const helpers_1 = require("../../../common/helpers");
const utils_1 = require("../../utils");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const kysely_1 = require("kysely");
const postgres_1 = require("kysely/helpers/postgres");
let UserRepo = class UserRepo {
    constructor(db) {
        this.db = db;
        this.baseFields = [
            'id',
            'email',
            'name',
            'emailVerifiedAt',
            'avatarUrl',
            'role',
            'workspaceId',
            'locale',
            'timezone',
            'settings',
            'lastLoginAt',
            'deactivatedAt',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'hasGeneratedPassword',
        ];
    }
    async findById(userId, workspaceId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        return db
            .selectFrom('users')
            .select(this.baseFields)
            .$if(opts?.includePassword, (qb) => qb.select('password'))
            .$if(opts?.includeUserMfa, (qb) => qb.select(this.withUserMfa))
            .$if(opts?.includeScimExternalId, (qb) => qb.select('scimExternalId'))
            .where('id', '=', userId)
            .where('workspaceId', '=', workspaceId)
            .executeTakeFirst();
    }
    async findByEmail(email, workspaceId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        return db
            .selectFrom('users')
            .select(this.baseFields)
            .$if(opts?.includePassword, (qb) => qb.select('password'))
            .$if(opts?.includeUserMfa, (qb) => qb.select(this.withUserMfa))
            .$if(opts?.includeScimExternalId, (qb) => qb.select('scimExternalId'))
            .where((0, kysely_1.sql) `LOWER(email)`, '=', (0, kysely_1.sql) `LOWER(${email})`)
            .where('workspaceId', '=', workspaceId)
            .executeTakeFirst();
    }
    async updateUser(updatableUser, userId, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return await db
            .updateTable('users')
            .set({ ...updatableUser, updatedAt: new Date() })
            .where('id', '=', userId)
            .where('workspaceId', '=', workspaceId)
            .execute();
    }
    async updateLastLogin(userId, workspaceId) {
        return await this.db
            .updateTable('users')
            .set({
            lastLoginAt: new Date(),
        })
            .where('id', '=', userId)
            .where('workspaceId', '=', workspaceId)
            .execute();
    }
    async insertUser(insertableUser, trx) {
        const user = {
            name: insertableUser.name || insertableUser.email.split('@')[0].toLowerCase(),
            email: insertableUser.email.toLowerCase(),
            password: await (0, helpers_1.hashPassword)(insertableUser.password),
            locale: 'en-US',
            role: insertableUser?.role,
            lastLoginAt: new Date(),
        };
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('users')
            .values({ ...insertableUser, ...user })
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    async roleCountByWorkspaceId(role, workspaceId) {
        const { count } = await this.db
            .selectFrom('users')
            .select((eb) => eb.fn.count('role').as('count'))
            .where('role', '=', role)
            .where('workspaceId', '=', workspaceId)
            .executeTakeFirst();
        return count;
    }
    async getUsersPaginated(workspaceId, pagination) {
        let query = this.db
            .selectFrom('users')
            .select(this.baseFields)
            .where('workspaceId', '=', workspaceId)
            .where('deletedAt', 'is', null);
        if (pagination.query) {
            query = query.where((eb) => eb((0, kysely_1.sql) `f_unaccent(users.name)`, 'ilike', (0, kysely_1.sql) `f_unaccent(${'%' + pagination.query + '%'})`).or((0, kysely_1.sql) `users.email`, 'ilike', (0, kysely_1.sql) `f_unaccent(${'%' + pagination.query + '%'})`));
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
    async updatePreference(userId, prefKey, prefValue) {
        return await this.db
            .updateTable('users')
            .set({
            settings: (0, kysely_1.sql) `COALESCE(settings, '{}'::jsonb)
                || jsonb_build_object('preferences', COALESCE(settings->'preferences', '{}'::jsonb) 
                || jsonb_build_object('${kysely_1.sql.raw(prefKey)}', ${kysely_1.sql.lit(prefValue)}))`,
            updatedAt: new Date(),
        })
            .where('id', '=', userId)
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    async updateNotificationSetting(userId, settingKey, settingValue) {
        return await this.db
            .updateTable('users')
            .set({
            settings: (0, kysely_1.sql) `COALESCE(settings, '{}'::jsonb)
                || jsonb_build_object('notifications', COALESCE(settings->'notifications', '{}'::jsonb)
                || jsonb_build_object(${kysely_1.sql.lit(settingKey)}, ${kysely_1.sql.lit(settingValue)}))`,
            updatedAt: new Date(),
        })
            .where('id', '=', userId)
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    withUserMfa(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('userMfa')
            .select([
            'userMfa.id',
            'userMfa.method',
            'userMfa.isEnabled',
            'userMfa.createdAt',
        ])
            .whereRef('userMfa.userId', '=', 'users.id')).as('mfa');
    }
};
exports.UserRepo = UserRepo;
exports.UserRepo = UserRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], UserRepo);
//# sourceMappingURL=user.repo.js.map