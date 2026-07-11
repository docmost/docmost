import { KyselyDB, KyselyTransaction } from "../../types/kysely.types";
import { InsertablePageTransclusion, PageTransclusion, UpdatablePageTransclusion } from "../../types/entity.types";
export declare class PageTransclusionsRepo {
    private readonly db;
    constructor(db: KyselyDB);
    findByPageId(pageId: string, trx?: KyselyTransaction): Promise<PageTransclusion[]>;
    findByPageAndTransclusion(pageId: string, transclusionId: string, trx?: KyselyTransaction): Promise<PageTransclusion | undefined>;
    findManyByPageAndTransclusion(keys: Array<{
        pageId: string;
        transclusionId: string;
    }>, workspaceId: string, trx?: KyselyTransaction): Promise<PageTransclusion[]>;
    insert(data: InsertablePageTransclusion, trx?: KyselyTransaction): Promise<PageTransclusion>;
    insertMany(data: InsertablePageTransclusion[], trx?: KyselyTransaction): Promise<void>;
    update(pageId: string, transclusionId: string, data: UpdatablePageTransclusion, trx?: KyselyTransaction): Promise<void>;
    deleteByPageAndTransclusionIds(pageId: string, transclusionIds: string[], trx?: KyselyTransaction): Promise<void>;
}
