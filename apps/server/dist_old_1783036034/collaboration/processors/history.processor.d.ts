import { OnModuleDestroy } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { IPageHistoryJob } from '../../integrations/queue/constants/queue.interface';
import { PageHistoryRepo } from "../../database/repos/page/page-history.repo";
import { PageRepo } from "../../database/repos/page/page.repo";
import { CollabHistoryService } from '../services/collab-history.service';
import { WatcherService } from '../../core/watcher/watcher.service';
export declare class HistoryProcessor extends WorkerHost implements OnModuleDestroy {
    private readonly pageHistoryRepo;
    private readonly pageRepo;
    private readonly collabHistory;
    private readonly watcherService;
    private notificationQueue;
    private generalQueue;
    private readonly logger;
    constructor(pageHistoryRepo: PageHistoryRepo, pageRepo: PageRepo, collabHistory: CollabHistoryService, watcherService: WatcherService, notificationQueue: Queue, generalQueue: Queue);
    process(job: Job<IPageHistoryJob, void>): Promise<void>;
    onActive(job: Job): void;
    onError(job: Job): void;
    onModuleDestroy(): Promise<void>;
}
