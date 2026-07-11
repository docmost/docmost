import { InsertableUserToken, UpdatableUserToken, UserToken } from "../../types/entity.types";
import { KyselyDB, KyselyTransaction } from "../../types/kysely.types";
export declare class UserTokenRepo {
    private readonly db;
    constructor(db: KyselyDB);
    findById(token: string, workspaceId: string, trx?: KyselyTransaction): Promise<UserToken>;
    insertUserToken(insertableUserToken: InsertableUserToken, opts?: {
        trx?: KyselyTransaction;
    }): Promise<{
        type: string;
        token: string;
        id: string;
        workspaceId: string;
        createdAt: Date;
        userId: string;
        expiresAt: Date;
        usedAt: Date;
    }>;
    findByUserId(userId: string, workspaceId: string, tokenType: string, trx?: KyselyTransaction): Promise<UserToken[]>;
    updateUserToken(updatableUserToken: UpdatableUserToken, userTokenId: string, trx?: KyselyTransaction): Promise<import("kysely").UpdateResult[]>;
    deleteToken(token: string, trx?: KyselyTransaction): Promise<void>;
    deleteExpiredUserTokens(trx?: KyselyTransaction): Promise<void>;
}
