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
exports.PageTransclusionsRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
let PageTransclusionsRepo = class PageTransclusionsRepo {
    constructor(db) {
        this.db = db;
    }
    async findByPageId(pageId, trx) {
        return (0, utils_1.dbOrTx)(this.db, trx)
            .selectFrom('pageTransclusions')
            .selectAll()
            .where('pageId', '=', pageId)
            .orderBy('createdAt', 'asc')
            .execute();
    }
    async findByPageAndTransclusion(pageId, transclusionId, trx) {
        return (0, utils_1.dbOrTx)(this.db, trx)
            .selectFrom('pageTransclusions')
            .selectAll()
            .where('pageId', '=', pageId)
            .where('transclusionId', '=', transclusionId)
            .executeTakeFirst();
    }
    async findManyByPageAndTransclusion(keys, workspaceId, trx) {
        if (keys.length === 0)
            return [];
        return (0, utils_1.dbOrTx)(this.db, trx)
            .selectFrom('pageTransclusions')
            .selectAll()
            .where('workspaceId', '=', workspaceId)
            .where((eb) => eb.or(keys.map((k) => eb.and([
            eb('pageId', '=', k.pageId),
            eb('transclusionId', '=', k.transclusionId),
        ]))))
            .execute();
    }
    async insert(data, trx) {
        return (0, utils_1.dbOrTx)(this.db, trx)
            .insertInto('pageTransclusions')
            .values(data)
            .returningAll()
            .executeTakeFirstOrThrow();
    }
    async insertMany(data, trx) {
        if (data.length === 0)
            return;
        await (0, utils_1.dbOrTx)(this.db, trx)
            .insertInto('pageTransclusions')
            .values(data)
            .execute();
    }
    async update(pageId, transclusionId, data, trx) {
        await (0, utils_1.dbOrTx)(this.db, trx)
            .updateTable('pageTransclusions')
            .set({ ...data, updatedAt: new Date() })
            .where('pageId', '=', pageId)
            .where('transclusionId', '=', transclusionId)
            .execute();
    }
    async deleteByPageAndTransclusionIds(pageId, transclusionIds, trx) {
        if (transclusionIds.length === 0)
            return;
        await (0, utils_1.dbOrTx)(this.db, trx)
            .deleteFrom('pageTransclusions')
            .where('pageId', '=', pageId)
            .where('transclusionId', 'in', transclusionIds)
            .execute();
    }
};
exports.PageTransclusionsRepo = PageTransclusionsRepo;
exports.PageTransclusionsRepo = PageTransclusionsRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], PageTransclusionsRepo);
//# sourceMappingURL=page-transclusions.repo.js.map