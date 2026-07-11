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
exports.WorkspaceRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
const kysely_1 = require("kysely");
let WorkspaceRepo = class WorkspaceRepo {
    constructor(db) {
        this.db = db;
        this.baseFields = [
            'id',
            'name',
            'description',
            'logo',
            'hostname',
            'customDomain',
            'settings',
            'defaultRole',
            'emailDomains',
            'defaultSpaceId',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'stripeCustomerId',
            'status',
            'billingEmail',
            'trialEndAt',
            'enforceSso',
            'plan',
            'enforceMfa',
            'trashRetentionDays',
            'isScimEnabled',
        ];
    }
    async findById(workspaceId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        let query = db
            .selectFrom('workspaces')
            .select(this.baseFields)
            .where('id', '=', workspaceId);
        if (opts?.withMemberCount) {
            query = query.select(this.withMemberCount);
        }
        if (opts?.withLicenseKey) {
            query = query.select('licenseKey');
        }
        if (opts?.withLock && opts?.trx) {
            query = query.forUpdate();
        }
        return query.executeTakeFirst();
    }
    async findLicenseKeyById(workspaceId) {
        const row = await this.db
            .selectFrom('workspaces')
            .select('licenseKey')
            .where('id', '=', workspaceId)
            .executeTakeFirst();
        return row?.licenseKey;
    }
    async findFirst() {
        return await this.db
            .selectFrom('workspaces')
            .selectAll()
            .orderBy('createdAt', 'asc')
            .limit(1)
            .executeTakeFirst();
    }
    async findByHostname(hostname) {
        return await this.db
            .selectFrom('workspaces')
            .selectAll()
            .where((0, kysely_1.sql) `LOWER(hostname)`, '=', (0, kysely_1.sql) `LOWER(${hostname})`)
            .executeTakeFirst();
    }
    async hostnameExists(hostname, trx) {
        if (hostname?.length < 1)
            return false;
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        let { count } = await db
            .selectFrom('workspaces')
            .select((eb) => eb.fn.count('id').as('count'))
            .where((0, kysely_1.sql) `LOWER(hostname)`, '=', (0, kysely_1.sql) `LOWER(${hostname})`)
            .executeTakeFirst();
        count = count;
        return count != 0;
    }
    async updateWorkspace(updatableWorkspace, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .updateTable('workspaces')
            .set({ ...updatableWorkspace, updatedAt: new Date() })
            .where('id', '=', workspaceId)
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    async insertWorkspace(insertableWorkspace, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('workspaces')
            .values(insertableWorkspace)
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    async count() {
        const { count } = await this.db
            .selectFrom('workspaces')
            .select((eb) => eb.fn.count('id').as('count'))
            .executeTakeFirst();
        return count;
    }
    withMemberCount(eb) {
        return eb
            .selectFrom('users')
            .select((eb) => eb.fn.countAll().as('count'))
            .where('users.deactivatedAt', 'is', null)
            .where('users.deletedAt', 'is', null)
            .whereRef('users.workspaceId', '=', 'workspaces.id')
            .as('memberCount');
    }
    async getActiveUserCount(workspaceId) {
        const users = await this.db
            .selectFrom('users')
            .select(['id', 'deactivatedAt', 'deletedAt'])
            .where('workspaceId', '=', workspaceId)
            .execute();
        const activeUsers = users.filter((user) => user.deletedAt === null && user.deactivatedAt === null);
        return activeUsers.length;
    }
    async updateApiSettings(workspaceId, prefKey, prefValue, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .updateTable('workspaces')
            .set({
            settings: (0, kysely_1.sql) `COALESCE(settings, '{}'::jsonb)
                || jsonb_build_object('api', COALESCE(settings->'api', '{}'::jsonb)
                || jsonb_build_object('${kysely_1.sql.raw(prefKey)}', ${kysely_1.sql.lit(prefValue)}))`,
            updatedAt: new Date(),
        })
            .where('id', '=', workspaceId)
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    async updateAiSettings(workspaceId, prefKey, prefValue, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .updateTable('workspaces')
            .set({
            settings: (0, kysely_1.sql) `COALESCE(settings, '{}'::jsonb)
                || jsonb_build_object('ai', COALESCE(settings->'ai', '{}'::jsonb)
                || jsonb_build_object('${kysely_1.sql.raw(prefKey)}', ${kysely_1.sql.lit(prefValue)}))`,
            updatedAt: new Date(),
        })
            .where('id', '=', workspaceId)
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    async updateSharingSettings(workspaceId, prefKey, prefValue, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .updateTable('workspaces')
            .set({
            settings: (0, kysely_1.sql) `COALESCE(settings, '{}'::jsonb)
                || jsonb_build_object('sharing', COALESCE(settings->'sharing', '{}'::jsonb)
                || jsonb_build_object('${kysely_1.sql.raw(prefKey)}', ${kysely_1.sql.lit(prefValue)}))`,
            updatedAt: new Date(),
        })
            .where('id', '=', workspaceId)
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    async updateTemplateSettings(workspaceId, prefKey, prefValue, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .updateTable('workspaces')
            .set({
            settings: (0, kysely_1.sql) `COALESCE(settings, '{}'::jsonb)
                || jsonb_build_object('templates', COALESCE(settings->'templates', '{}'::jsonb)
                || jsonb_build_object('${kysely_1.sql.raw(prefKey)}', ${kysely_1.sql.lit(prefValue)}))`,
            updatedAt: new Date(),
        })
            .where('id', '=', workspaceId)
            .returning(this.baseFields)
            .executeTakeFirst();
    }
};
exports.WorkspaceRepo = WorkspaceRepo;
exports.WorkspaceRepo = WorkspaceRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], WorkspaceRepo);
//# sourceMappingURL=workspace.repo.js.map