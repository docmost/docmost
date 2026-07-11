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
exports.GroupUserRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
const kysely_1 = require("kysely");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const group_repo_1 = require("./group.repo");
const user_repo_1 = require("../user/user.repo");
let GroupUserRepo = class GroupUserRepo {
    constructor(db, groupRepo, userRepo) {
        this.db = db;
        this.groupRepo = groupRepo;
        this.userRepo = userRepo;
    }
    async getGroupUserById(userId, groupId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .selectFrom('groupUsers')
            .selectAll()
            .where('userId', '=', userId)
            .where('groupId', '=', groupId)
            .executeTakeFirst();
    }
    async insertGroupUser(insertableGroupUser, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('groupUsers')
            .values(insertableGroupUser)
            .returningAll()
            .executeTakeFirst();
    }
    async getGroupUsersPaginated(groupId, pagination) {
        let query = this.db
            .selectFrom('groupUsers')
            .innerJoin('users', 'users.id', 'groupUsers.userId')
            .selectAll('users')
            .where('groupId', '=', groupId);
        if (pagination.query) {
            query = query.where((eb) => eb((0, kysely_1.sql) `f_unaccent(users.name)`, 'ilike', (0, kysely_1.sql) `f_unaccent(${'%' + pagination.query + '%'})`));
        }
        const result = await (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [{ expression: 'users.id', direction: 'asc', key: 'id' }],
            parseCursor: (cursor) => ({ id: cursor.id }),
        });
        result.items.map((user) => {
            delete user.password;
        });
        return result;
    }
    async addUserToGroup(userId, groupId, workspaceId, trx) {
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            const group = await this.groupRepo.findById(groupId, workspaceId, {
                trx,
            });
            if (!group) {
                throw new common_1.NotFoundException('Group not found');
            }
            const user = await this.userRepo.findById(userId, workspaceId, {
                trx: trx,
            });
            if (!user) {
                throw new common_1.NotFoundException('User not found');
            }
            const groupUserExists = await this.getGroupUserById(userId, groupId, trx);
            if (groupUserExists) {
                throw new common_1.BadRequestException('User is already a member of this group');
            }
            await this.insertGroupUser({
                userId,
                groupId,
            }, trx);
        }, trx);
    }
    async addUserToDefaultGroup(userId, workspaceId, trx) {
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            const defaultGroup = await this.groupRepo.getDefaultGroup(workspaceId, trx);
            await this.insertGroupUser({
                userId,
                groupId: defaultGroup.id,
            }, trx);
        }, trx);
    }
    async getUserIdsByGroupId(groupId) {
        const rows = await this.db
            .selectFrom('groupUsers')
            .select('userId')
            .where('groupId', '=', groupId)
            .execute();
        return rows.map((r) => r.userId);
    }
    async delete(userId, groupId, opts) {
        const { trx } = opts;
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('groupUsers')
            .where('userId', '=', userId)
            .where('groupId', '=', groupId)
            .execute();
    }
    async getUserGroupIds(userId) {
        const results = await this.db
            .selectFrom('groupUsers')
            .select('groupId')
            .where('userId', '=', userId)
            .execute();
        return results.map((r) => r.groupId);
    }
};
exports.GroupUserRepo = GroupUserRepo;
exports.GroupUserRepo = GroupUserRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object, group_repo_1.GroupRepo,
        user_repo_1.UserRepo])
], GroupUserRepo);
//# sourceMappingURL=group-user.repo.js.map