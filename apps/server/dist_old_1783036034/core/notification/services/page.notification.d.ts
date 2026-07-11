import { Queue } from 'bullmq';
import { KyselyDB } from "../../../database/types/kysely.types";
import { IPageMentionNotificationJob, IPageUpdateNotificationJob, IPermissionGrantedNotificationJob } from '../../../integrations/queue/constants/queue.interface';
import { NotificationService } from '../notification.service';
import { NotificationRepo } from "../../../database/repos/notification/notification.repo";
import { SpaceMemberRepo } from "../../../database/repos/space/space-member.repo";
import { PagePermissionRepo } from "../../../database/repos/page/page-permission.repo";
import { WatcherRepo } from "../../../database/repos/watcher/watcher.repo";
import { PageUpdateEmailRateLimiter } from './page-update-email-rate-limiter';
export declare class PageNotificationService {
    private readonly db;
    private readonly notificationService;
    private readonly notificationRepo;
    private readonly spaceMemberRepo;
    private readonly pagePermissionRepo;
    private readonly watcherRepo;
    private readonly rateLimiter;
    private notificationQueue;
    private readonly logger;
    constructor(db: KyselyDB, notificationService: NotificationService, notificationRepo: NotificationRepo, spaceMemberRepo: SpaceMemberRepo, pagePermissionRepo: PagePermissionRepo, watcherRepo: WatcherRepo, rateLimiter: PageUpdateEmailRateLimiter, notificationQueue: Queue);
    processPageMention(data: IPageMentionNotificationJob, appUrl: string): Promise<void>;
    private notifyMentionedUsers;
    processPermissionGranted(data: IPermissionGrantedNotificationJob, appUrl: string): Promise<void>;
    processPageUpdate(data: IPageUpdateNotificationJob, appUrl: string): Promise<void>;
    private getEligiblePageUpdateUsers;
    private scheduleDigest;
    processDigest(userId: string, appUrl: string): Promise<void>;
    private getPageContext;
}
