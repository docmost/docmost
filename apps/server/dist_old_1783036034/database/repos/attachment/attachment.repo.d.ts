import { KyselyDB, KyselyTransaction } from "../../types/kysely.types";
import { Attachment, InsertableAttachment, UpdatableAttachment } from "../../types/entity.types";
export declare class AttachmentRepo {
    private readonly db;
    constructor(db: KyselyDB);
    private baseFields;
    findById(attachmentId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<Attachment>;
    findByIdWithContent(attachmentId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<Attachment>;
    insertAttachment(insertableAttachment: InsertableAttachment, trx?: KyselyTransaction): Promise<Attachment>;
    findBySpaceId(spaceId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<Attachment[]>;
    findByIds(ids: string[], opts?: {
        trx?: KyselyTransaction;
    }): Promise<Attachment[]>;
    findByAiChatId(aiChatId: string, opts?: {
        trx?: KyselyTransaction;
    }): Promise<Attachment[]>;
    updateAttachmentsByPageId(updatableAttachment: UpdatableAttachment, pageIds: string[], trx?: KyselyTransaction): Promise<{
        type: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        tsv: string;
        spaceId: string;
        textContent: string;
        pageId: string;
        aiChatId: string;
        fileExt: string;
        fileName: string;
        filePath: string;
        fileSize: string;
        mimeType: string;
    }>;
    updateAttachment(updatableAttachment: UpdatableAttachment, attachmentId: string): Promise<Attachment>;
    claimAttachmentsForChat(attachmentIds: string[], aiChatId: string, creatorId: string, workspaceId: string): Promise<void>;
    deleteAttachmentById(attachmentId: string): Promise<void>;
    deleteAttachmentByFilePath(attachmentFilePath: string): Promise<void>;
}
