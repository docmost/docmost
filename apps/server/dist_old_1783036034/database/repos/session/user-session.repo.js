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
exports.UserSessionRepo = void 0;
const utils_1 = require("../../utils");
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const kysely_1 = require("kysely");
let UserSessionRepo = class UserSessionRepo {
    constructor(db) {
        this.db = db;
    }
    async insertSession(session, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('userSessions')
            .values(session)
            .returningAll()
            .executeTakeFirstOrThrow();
    }
    async findActiveById(id) {
        return this.db
            .selectFrom('userSessions')
            .selectAll()
            .where('id', '=', id)
            .where('expiresAt', '>', new Date())
            .where('revokedAt', 'is', null)
            .executeTakeFirst();
    }
    async findActiveByUser(userId, workspaceId) {
        return this.db
            .selectFrom('userSessions')
            .selectAll()
            .where('userId', '=', userId)
            .where('workspaceId', '=', workspaceId)
            .where('expiresAt', '>', new Date())
            .where('revokedAt', 'is', null)
            .orderBy('lastActiveAt', 'desc')
            .execute();
    }
    async updateLastActiveAt(id) {
        await this.db
            .updateTable('userSessions')
            .set({ lastActiveAt: new Date() })
            .where('id', '=', id)
            .execute();
    }
    async revokeById(id, userId, workspaceId) {
        await this.db
            .updateTable('userSessions')
            .set({ revokedAt: new Date() })
            .where('id', '=', id)
            .where('userId', '=', userId)
            .where('workspaceId', '=', workspaceId)
            .where('revokedAt', 'is', null)
            .execute();
    }
    async revokeAllExceptCurrent(currentSessionId, userId, workspaceId) {
        await this.db
            .updateTable('userSessions')
            .set({ revokedAt: new Date() })
            .where('userId', '=', userId)
            .where('workspaceId', '=', workspaceId)
            .where('id', '!=', currentSessionId)
            .where('revokedAt', 'is', null)
            .execute();
    }
    async revokeByUserId(userId, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .updateTable('userSessions')
            .set({ revokedAt: new Date() })
            .where('userId', '=', userId)
            .where('workspaceId', '=', workspaceId)
            .where('revokedAt', 'is', null)
            .execute();
    }
    async deleteByUserId(userId, workspaceId) {
        await this.db
            .deleteFrom('userSessions')
            .where('userId', '=', userId)
            .where('workspaceId', '=', workspaceId)
            .execute();
    }
    async deleteAllExceptCurrent(currentSessionId, userId, workspaceId) {
        await this.db
            .deleteFrom('userSessions')
            .where('userId', '=', userId)
            .where('workspaceId', '=', workspaceId)
            .where('id', '!=', currentSessionId)
            .execute();
    }
    async deleteStale(retentionDays) {
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        await this.db
            .deleteFrom('userSessions')
            .where((eb) => eb.or([
            eb('revokedAt', '<', cutoff),
            eb('expiresAt', '<', cutoff),
        ]))
            .execute();
    }
    async trimExcessSessions(maxPerUser) {
        const overflowed = await this.db
            .selectFrom('userSessions')
            .select(['userId', 'workspaceId'])
            .groupBy(['userId', 'workspaceId'])
            .having((0, kysely_1.sql) `COUNT(*)`, '>', maxPerUser)
            .execute();
        for (const { userId, workspaceId } of overflowed) {
            await (0, kysely_1.sql) `
        DELETE FROM user_sessions
        WHERE id IN (
          SELECT id FROM user_sessions
          WHERE user_id = ${userId} AND workspace_id = ${workspaceId}
          ORDER BY last_active_at DESC
          OFFSET ${maxPerUser}
        )
      `.execute(this.db);
        }
    }
};
exports.UserSessionRepo = UserSessionRepo;
exports.UserSessionRepo = UserSessionRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], UserSessionRepo);
//# sourceMappingURL=user-session.repo.js.map