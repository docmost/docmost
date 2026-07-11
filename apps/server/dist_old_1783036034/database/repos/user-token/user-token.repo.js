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
exports.UserTokenRepo = void 0;
const utils_1 = require("../../utils");
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
let UserTokenRepo = class UserTokenRepo {
    constructor(db) {
        this.db = db;
    }
    async findById(token, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .selectFrom('userTokens')
            .select([
            'id',
            'token',
            'userId',
            'workspaceId',
            'type',
            'expiresAt',
            'usedAt',
            'createdAt',
        ])
            .where('token', '=', token)
            .where('workspaceId', '=', workspaceId)
            .executeTakeFirst();
    }
    async insertUserToken(insertableUserToken, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        return db
            .insertInto('userTokens')
            .values(insertableUserToken)
            .returningAll()
            .executeTakeFirst();
    }
    async findByUserId(userId, workspaceId, tokenType, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .selectFrom('userTokens')
            .select([
            'id',
            'token',
            'userId',
            'workspaceId',
            'type',
            'expiresAt',
            'usedAt',
            'createdAt',
        ])
            .where('userId', '=', userId)
            .where('workspaceId', '=', workspaceId)
            .where('type', '=', tokenType)
            .orderBy('expiresAt', 'desc')
            .execute();
    }
    async updateUserToken(updatableUserToken, userTokenId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .updateTable('userTokens')
            .set(updatableUserToken)
            .where('id', '=', userTokenId)
            .execute();
    }
    async deleteToken(token, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db.deleteFrom('userTokens').where('token', '=', token).execute();
    }
    async deleteExpiredUserTokens(trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('userTokens')
            .where('expiresAt', '<', new Date())
            .execute();
    }
};
exports.UserTokenRepo = UserTokenRepo;
exports.UserTokenRepo = UserTokenRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], UserTokenRepo);
//# sourceMappingURL=user-token.repo.js.map