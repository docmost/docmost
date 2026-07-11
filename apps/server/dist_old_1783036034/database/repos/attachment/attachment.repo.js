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
exports.AttachmentRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
const attachment_constants_1 = require("../../../core/attachment/attachment.constants");
let AttachmentRepo = class AttachmentRepo {
    constructor(db) {
        this.db = db;
        this.baseFields = [
            'id',
            'fileName',
            'filePath',
            'fileSize',
            'fileExt',
            'mimeType',
            'type',
            'creatorId',
            'pageId',
            'spaceId',
            'aiChatId',
            'workspaceId',
            'createdAt',
            'updatedAt',
            'deletedAt',
        ];
    }
    async findById(attachmentId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        return db
            .selectFrom('attachments')
            .select(this.baseFields)
            .where('id', '=', attachmentId)
            .executeTakeFirst();
    }
    async findByIdWithContent(attachmentId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        return db
            .selectFrom('attachments')
            .select([...this.baseFields, 'textContent'])
            .where('id', '=', attachmentId)
            .executeTakeFirst();
    }
    async insertAttachment(insertableAttachment, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('attachments')
            .values(insertableAttachment)
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    async findBySpaceId(spaceId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        return db
            .selectFrom('attachments')
            .select(this.baseFields)
            .where('spaceId', '=', spaceId)
            .execute();
    }
    async findByIds(ids, opts) {
        if (ids.length === 0)
            return [];
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        return db
            .selectFrom('attachments')
            .select(this.baseFields)
            .where('id', 'in', ids)
            .execute();
    }
    async findByAiChatId(aiChatId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        return db
            .selectFrom('attachments')
            .select(this.baseFields)
            .where('aiChatId', '=', aiChatId)
            .execute();
    }
    updateAttachmentsByPageId(updatableAttachment, pageIds, trx) {
        return (0, utils_1.dbOrTx)(this.db, trx)
            .updateTable('attachments')
            .set(updatableAttachment)
            .where('pageId', 'in', pageIds)
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    async updateAttachment(updatableAttachment, attachmentId) {
        return await this.db
            .updateTable('attachments')
            .set(updatableAttachment)
            .where('id', '=', attachmentId)
            .returning(this.baseFields)
            .executeTakeFirst();
    }
    async claimAttachmentsForChat(attachmentIds, aiChatId, creatorId, workspaceId) {
        if (attachmentIds.length === 0)
            return;
        await this.db
            .updateTable('attachments')
            .set({ aiChatId })
            .where('id', 'in', attachmentIds)
            .where('creatorId', '=', creatorId)
            .where('workspaceId', '=', workspaceId)
            .where('type', '=', attachment_constants_1.AttachmentType.Chat)
            .where('aiChatId', 'is', null)
            .execute();
    }
    async deleteAttachmentById(attachmentId) {
        await this.db
            .deleteFrom('attachments')
            .where('id', '=', attachmentId)
            .executeTakeFirst();
    }
    async deleteAttachmentByFilePath(attachmentFilePath) {
        await this.db
            .deleteFrom('attachments')
            .where('filePath', '=', attachmentFilePath)
            .executeTakeFirst();
    }
};
exports.AttachmentRepo = AttachmentRepo;
exports.AttachmentRepo = AttachmentRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], AttachmentRepo);
//# sourceMappingURL=attachment.repo.js.map