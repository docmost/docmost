import { OnModuleDestroy } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { KyselyDB } from "../../../database/types/kysely.types";
import { BacklinkRepo } from "../../../database/repos/backlink/backlink.repo";
import { WatcherRepo } from "../../../database/repos/watcher/watcher.repo";
export declare class GeneralQueueProcessor extends WorkerHost implements OnModuleDestroy {
    private readonly db;
    private readonly backlinkRepo;
    private readonly watcherRepo;
    private readonly logger;
    constructor(db: KyselyDB, backlinkRepo: BacklinkRepo, watcherRepo: WatcherRepo);
    process(job: Job): Promise<void>;
    onActive(job: Job): void;
    onError(job: Job): void;
    onCompleted(job: Job): void;
    onModuleDestroy(): Promise<void>;
}
