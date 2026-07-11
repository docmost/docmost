import { KyselyDB } from "../../../database/types/kysely.types";
import { IApprovalRejectedNotificationJob, IApprovalRequestedNotificationJob, IPageVerifiedNotificationJob, IVerificationExpiringNotificationJob, IVerificationExpiredNotificationJob } from '../../../integrations/queue/constants/queue.interface';
import { NotificationService } from '../notification.service';
import { SpaceMemberRepo } from "../../../database/repos/space/space-member.repo";
import { PagePermissionRepo } from "../../../database/repos/page/page-permission.repo";
export declare class VerificationNotificationService {
    private readonly db;
    private readonly notificationService;
    private readonly spaceMemberRepo;
    private readonly pagePermissionRepo;
    constructor(db: KyselyDB, notificationService: NotificationService, spaceMemberRepo: SpaceMemberRepo, pagePermissionRepo: PagePermissionRepo);
    private getAlreadyNotifiedUserIds;
    private filterAccessibleRecipients;
    processVerificationExpiring(data: IVerificationExpiringNotificationJob, appUrl: string): Promise<void>;
    processVerificationExpired(data: IVerificationExpiredNotificationJob, appUrl: string): Promise<void>;
    processPageVerified(data: IPageVerifiedNotificationJob): Promise<void>;
    processApprovalRequested(data: IApprovalRequestedNotificationJob, appUrl: string): Promise<void>;
    processApprovalRejected(data: IApprovalRejectedNotificationJob, appUrl: string): Promise<void>;
    private getUserName;
    private getPageContext;
}
