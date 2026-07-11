import { KyselyDB } from "../types/kysely.types";
export declare class MigrationService {
    private readonly db;
    private readonly logger;
    constructor(db: KyselyDB);
    migrateToLatest(): Promise<void>;
}
