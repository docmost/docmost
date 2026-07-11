import { InsertableUserSession, UserSession } from "../../types/entity.types";
import { KyselyDB, KyselyTransaction } from "../../types/kysely.types";
export declare class UserSessionRepo {
    private readonly db;
    constructor(db: KyselyDB);
    insertSession(session: InsertableUserSession, trx?: KyselyTransaction): Promise<UserSession>;
    findActiveById(id: string): Promise<UserSession | undefined>;
    findActiveByUser(userId: string, workspaceId: string): Promise<UserSession[]>;
    updateLastActiveAt(id: string): Promise<void>;
    revokeById(id: string, userId: string, workspaceId: string): Promise<void>;
    revokeAllExceptCurrent(currentSessionId: string, userId: string, workspaceId: string): Promise<void>;
    revokeByUserId(userId: string, workspaceId: string, trx?: KyselyTransaction): Promise<void>;
    deleteByUserId(userId: string, workspaceId: string): Promise<void>;
    deleteAllExceptCurrent(currentSessionId: string, userId: string, workspaceId: string): Promise<void>;
    deleteStale(retentionDays: number): Promise<void>;
    trimExcessSessions(maxPerUser: number): Promise<void>;
}
