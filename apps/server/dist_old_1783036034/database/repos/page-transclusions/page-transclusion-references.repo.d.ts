import { KyselyDB, KyselyTransaction } from "../../types/kysely.types";
import { InsertablePageTransclusionReference, PageTransclusionReference } from "../../types/entity.types";
export type TransclusionReferenceKey = {
    sourcePageId: string;
    transclusionId: string;
};
export declare class PageTransclusionReferencesRepo {
    private readonly db;
    constructor(db: KyselyDB);
    findByReferencePageId(referencePageId: string, trx?: KyselyTransaction): Promise<PageTransclusionReference[]>;
    findReferencePageIdsByTransclusion(sourcePageId: string, transclusionId: string, workspaceId: string, trx?: KyselyTransaction): Promise<string[]>;
    insertMany(rows: InsertablePageTransclusionReference[], trx?: KyselyTransaction): Promise<void>;
    deleteByReferenceAndKeys(referencePageId: string, keys: TransclusionReferenceKey[], trx?: KyselyTransaction): Promise<void>;
    deleteOne(referencePageId: string, sourcePageId: string, transclusionId: string, trx?: KyselyTransaction): Promise<void>;
}
