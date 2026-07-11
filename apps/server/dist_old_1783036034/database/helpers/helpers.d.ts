import { KyselyDB } from "../types/kysely.types";
export declare function isPageEmbeddingsTableExists(db: KyselyDB): Promise<boolean>;
export declare function tableExists(opts: {
    db: KyselyDB;
    tableName: string;
}): Promise<boolean>;
