import { KyselyDB, KyselyTransaction } from "../../types/kysely.types";
import { InsertableTemplate, Template, UpdatableTemplate } from "../../types/entity.types";
import { PaginationOptions } from '../../pagination/pagination-options';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
export declare class TemplateRepo {
    private readonly db;
    private baseFields;
    constructor(db: KyselyDB);
    findById(templateId: string, workspaceId: string, opts?: {
        includeContent?: boolean;
        trx?: KyselyTransaction;
    }): Promise<Template>;
    findTemplates(workspaceId: string, accessibleSpaceIds: string[], pagination: PaginationOptions, opts?: {
        spaceId?: string;
    }): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        description: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        content: import("@docmost/db/types/db").JsonValue;
        tsv: string;
        spaceId: string;
        icon: string;
        lastUpdatedById: string;
        textContent: string;
        ydoc: Buffer<ArrayBufferLike>;
        collaboratorIds: string[];
    } & {
        creator: {
            id: string;
            name: string;
            avatarUrl: string;
        };
    }, undefined>>;
    insertTemplate(insertableTemplate: InsertableTemplate, trx?: KyselyTransaction): Promise<{
        id: string;
    }>;
    updateTemplate(updatableTemplate: UpdatableTemplate, templateId: string, workspaceId: string, trx?: KyselyTransaction): Promise<void>;
    deleteTemplate(templateId: string, workspaceId: string, trx?: KyselyTransaction): Promise<void>;
    withCreator(eb: ExpressionBuilder<DB, 'templates'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        avatarUrl: string;
    }, "creator">;
}
