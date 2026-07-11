import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { Comment, InsertableComment, UpdatableComment } from "../../types/entity.types";
import { PaginationOptions } from "../../pagination/pagination-options";
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
export declare class CommentRepo {
    private readonly db;
    constructor(db: KyselyDB);
    findById(commentId: string, opts?: {
        includeCreator: boolean;
        includeResolvedBy: boolean;
    }): Promise<Comment>;
    findPageComments(pageId: string, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        type: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        content: import("@docmost/db/types/db").JsonValue;
        spaceId: string;
        pageId: string;
        editedAt: Date;
        lastEditedById: string;
        parentCommentId: string;
        resolvedAt: Date;
        resolvedById: string;
        selection: string;
    } & {
        creator: {
            id: string;
            name: string;
            avatarUrl: string;
        };
    } & {
        resolvedBy: {
            id: string;
            name: string;
            avatarUrl: string;
        };
    }, undefined>>;
    updateComment(updatableComment: UpdatableComment, commentId: string, trx?: KyselyTransaction): Promise<void>;
    insertComment(insertableComment: InsertableComment, trx?: KyselyTransaction): Promise<Comment>;
    withCreator(eb: ExpressionBuilder<DB, 'comments'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        avatarUrl: string;
    }, "creator">;
    withResolvedBy(eb: ExpressionBuilder<DB, 'comments'>): import("kysely").AliasedRawBuilder<{
        id: string;
        name: string;
        avatarUrl: string;
    }, "resolvedBy">;
    deleteComment(commentId: string): Promise<void>;
    hasChildren(commentId: string): Promise<boolean>;
    hasChildrenFromOtherUsers(commentId: string, userId: string): Promise<boolean>;
}
