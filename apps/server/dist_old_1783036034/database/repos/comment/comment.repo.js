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
exports.CommentRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const postgres_1 = require("kysely/helpers/postgres");
let CommentRepo = class CommentRepo {
    constructor(db) {
        this.db = db;
    }
    async findById(commentId, opts) {
        return await this.db
            .selectFrom('comments')
            .selectAll('comments')
            .$if(opts?.includeCreator, (qb) => qb.select(this.withCreator))
            .$if(opts?.includeResolvedBy, (qb) => qb.select(this.withResolvedBy))
            .where('id', '=', commentId)
            .executeTakeFirst();
    }
    async findPageComments(pageId, pagination) {
        const query = this.db
            .selectFrom('comments')
            .selectAll('comments')
            .select((eb) => this.withCreator(eb))
            .select((eb) => this.withResolvedBy(eb))
            .where('pageId', '=', pageId);
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [{ expression: 'id', direction: 'asc' }],
            parseCursor: (cursor) => ({ id: cursor.id }),
        });
    }
    async updateComment(updatableComment, commentId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .updateTable('comments')
            .set(updatableComment)
            .where('id', '=', commentId)
            .execute();
    }
    async insertComment(insertableComment, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('comments')
            .values(insertableComment)
            .returningAll()
            .executeTakeFirst();
    }
    withCreator(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'comments.creatorId')).as('creator');
    }
    withResolvedBy(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'comments.resolvedById')).as('resolvedBy');
    }
    async deleteComment(commentId) {
        await this.db.deleteFrom('comments').where('id', '=', commentId).execute();
    }
    async hasChildren(commentId) {
        const result = await this.db
            .selectFrom('comments')
            .select((eb) => eb.fn.count('id').as('count'))
            .where('parentCommentId', '=', commentId)
            .executeTakeFirst();
        return Number(result?.count) > 0;
    }
    async hasChildrenFromOtherUsers(commentId, userId) {
        const result = await this.db
            .selectFrom('comments')
            .select((eb) => eb.fn.count('id').as('count'))
            .where('parentCommentId', '=', commentId)
            .where('creatorId', '!=', userId)
            .executeTakeFirst();
        return Number(result?.count) > 0;
    }
};
exports.CommentRepo = CommentRepo;
exports.CommentRepo = CommentRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], CommentRepo);
//# sourceMappingURL=comment.repo.js.map