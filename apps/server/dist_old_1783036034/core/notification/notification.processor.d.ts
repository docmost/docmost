import { OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { KyselyDB } from "../../database/types/kysely.types";
import { IApprovalRejectedNotificationJob, IApprovalRequestedNotificationJob, ICommentNotificationJob, ICommentResolvedNotificationJob, IPageMentionNotificationJob, IPageUpdateNotificationJob, IPageVerifiedNotificationJob, IPermissionGrantedNotificationJob, IVerificationExpiringNotificationJob, IVerificationExpiredNotificationJob, IVerificationReconcileJob } from '../../integrations/queue/constants/queue.interface';
import { CommentNotificationService } from './services/comment.notification';
import { PageNotificationService } from './services/page.notification';
import { VerificationNotificationService } from './services/verification.notification';
import { DomainService } from '../../integrations/environment/domain.service';
export declare class NotificationProcessor extends WorkerHost implements OnModuleDestroy {
    private readonly commentNotificationService;
    private readonly pageNotificationService;
    private readonly verificationNotificationService;
    private readonly domainService;
    private readonly moduleRef;
    private readonly db;
    private readonly logger;
    constructor(commentNotificationService: CommentNotificationService, pageNotificationService: PageNotificationService, verificationNotificationService: VerificationNotificationService, domainService: DomainService, moduleRef: ModuleRef, db: KyselyDB);
    process(job: Job<ICommentNotificationJob | ICommentResolvedNotificationJob | IPageMentionNotificationJob | IPageUpdateNotificationJob | IPermissionGrantedNotificationJob | IVerificationExpiringNotificationJob | IVerificationExpiredNotificationJob | IVerificationReconcileJob | IPageVerifiedNotificationJob | IApprovalRequestedNotificationJob | IApprovalRejectedNotificationJob, void>): Promise<void>;
    private resolveWorkspaceId;
    private runVerificationReconcile;
    private getWorkspaceUrl;
    onError(job: Job): void;
    onModuleDestroy(): Promise<void>;
}
