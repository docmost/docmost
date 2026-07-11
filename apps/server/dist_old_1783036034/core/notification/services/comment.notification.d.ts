import { KyselyDB } from "../../../database/types/kysely.types";
import { ICommentNotificationJob, ICommentResolvedNotificationJob } from '../../../integrations/queue/constants/queue.interface';
import { NotificationService } from '../notification.service';
import { SpaceMemberRepo } from "../../../database/repos/space/space-member.repo";
import { PagePermissionRepo } from "../../../database/repos/page/page-permission.repo";
import { WatcherRepo } from "../../../database/repos/watcher/watcher.repo";
export declare class CommentNotificationService {
    private readonly db;
    private readonly notificationService;
    private readonly spaceMemberRepo;
    private readonly pagePermissionRepo;
    private readonly watcherRepo;
    private readonly logger;
    constructor(db: KyselyDB, notificationService: NotificationService, spaceMemberRepo: SpaceMemberRepo, pagePermissionRepo: PagePermissionRepo, watcherRepo: WatcherRepo);
    processComment(data: ICommentNotificationJob, appUrl: string): Promise<void>;
    processResolved(data: ICommentResolvedNotificationJob, appUrl: string): Promise<void>;
    private getThreadParticipantIds;
    private getCommentContext;
}
