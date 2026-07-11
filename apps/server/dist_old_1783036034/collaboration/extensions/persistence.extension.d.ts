import { afterUnloadDocumentPayload, Extension, onChangePayload, onLoadDocumentPayload, onStoreDocumentPayload } from '@hocuspocus/server';
import * as Y from 'yjs';
import { PageRepo } from "../../database/repos/page/page.repo";
import { KyselyDB } from "../../database/types/kysely.types";
import { Queue } from 'bullmq';
import { CollabHistoryService } from '../services/collab-history.service';
import { TransclusionService } from '../../core/page/transclusion/transclusion.service';
export declare class PersistenceExtension implements Extension {
    private readonly pageRepo;
    private readonly db;
    private aiQueue;
    private historyQueue;
    private notificationQueue;
    private readonly collabHistory;
    private readonly transclusionService;
    private readonly logger;
    private contributors;
    constructor(pageRepo: PageRepo, db: KyselyDB, aiQueue: Queue, historyQueue: Queue, notificationQueue: Queue, collabHistory: CollabHistoryService, transclusionService: TransclusionService);
    onLoadDocument(data: onLoadDocumentPayload): Promise<Y.Doc>;
    onStoreDocument(data: onStoreDocumentPayload): Promise<void>;
    onChange(data: onChangePayload): Promise<void>;
    afterUnloadDocument(data: afterUnloadDocumentPayload): Promise<void>;
    private consumeContributors;
    private enqueuePageHistory;
    private syncTransclusion;
}
