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
exports.PageTransclusionReferencesRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
let PageTransclusionReferencesRepo = class PageTransclusionReferencesRepo {
    constructor(db) {
        this.db = db;
    }
    async findByReferencePageId(referencePageId, trx) {
        return (0, utils_1.dbOrTx)(this.db, trx)
            .selectFrom('pageTransclusionReferences')
            .selectAll()
            .where('referencePageId', '=', referencePageId)
            .execute();
    }
    async findReferencePageIdsByTransclusion(sourcePageId, transclusionId, workspaceId, trx) {
        const rows = await (0, utils_1.dbOrTx)(this.db, trx)
            .selectFrom('pageTransclusionReferences')
            .select('referencePageId')
            .distinct()
            .where('workspaceId', '=', workspaceId)
            .where('sourcePageId', '=', sourcePageId)
            .where('transclusionId', '=', transclusionId)
            .execute();
        return rows.map((r) => r.referencePageId);
    }
    async insertMany(rows, trx) {
        if (rows.length === 0)
            return;
        await (0, utils_1.dbOrTx)(this.db, trx)
            .insertInto('pageTransclusionReferences')
            .values(rows)
            .onConflict((oc) => oc
            .columns(['referencePageId', 'sourcePageId', 'transclusionId'])
            .doNothing())
            .execute();
    }
    async deleteByReferenceAndKeys(referencePageId, keys, trx) {
        if (keys.length === 0)
            return;
        await (0, utils_1.dbOrTx)(this.db, trx)
            .deleteFrom('pageTransclusionReferences')
            .where('referencePageId', '=', referencePageId)
            .where((eb) => eb.or(keys.map((k) => eb.and([
            eb('sourcePageId', '=', k.sourcePageId),
            eb('transclusionId', '=', k.transclusionId),
        ]))))
            .execute();
    }
    async deleteOne(referencePageId, sourcePageId, transclusionId, trx) {
        await (0, utils_1.dbOrTx)(this.db, trx)
            .deleteFrom('pageTransclusionReferences')
            .where('referencePageId', '=', referencePageId)
            .where('sourcePageId', '=', sourcePageId)
            .where('transclusionId', '=', transclusionId)
            .execute();
    }
};
exports.PageTransclusionReferencesRepo = PageTransclusionReferencesRepo;
exports.PageTransclusionReferencesRepo = PageTransclusionReferencesRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], PageTransclusionReferencesRepo);
//# sourceMappingURL=page-transclusion-references.repo.js.map