import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import {
  IApprovalRejectedNotificationJob,
  IApprovalRequestedNotificationJob,
  ICommentNotificationJob,
  ICommentResolvedNotificationJob,
  IPageMentionNotificationJob,
  IPageUpdateNotificationJob,
  IPageVerifiedNotificationJob,
  IPermissionGrantedNotificationJob,
  IVerificationExpiringNotificationJob,
  IVerificationExpiredNotificationJob,
  IVerificationReconcileJob,
} from '../../integrations/queue/constants/queue.interface';
import { CommentNotificationService } from './services/comment.notification';
import { PageNotificationService } from './services/page.notification';
import { VerificationNotificationService } from './services/verification.notification';
import { DomainService } from '../../integrations/environment/domain.service';

@Processor(QueueName.NOTIFICATION_QUEUE)
export class NotificationProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly commentNotificationService: CommentNotificationService,
    private readonly pageNotificationService: PageNotificationService,
    private readonly verificationNotificationService: VerificationNotificationService,
    private readonly domainService: DomainService,
    private readonly moduleRef: ModuleRef,
    @InjectKysely() private readonly db: KyselyDB,
  ) {
    super();
  }

  async process(
    job: Job<
      | ICommentNotificationJob
      | ICommentResolvedNotificationJob
      | IPageMentionNotificationJob
      | IPageUpdateNotificationJob
      | IPermissionGrantedNotificationJob
      | IVerificationExpiringNotificationJob
      | IVerificationExpiredNotificationJob
      | IVerificationReconcileJob
      | IPageVerifiedNotificationJob
      | IApprovalRequestedNotificationJob
      | IApprovalRejectedNotificationJob,
      void
    >,
  ): Promise<void> {
    try {
      if (job.name === QueueJob.VERIFICATION_RECONCILE) {
        await this.runVerificationReconcile();
        return;
      }

      const workspaceId = await this.resolveWorkspaceId(job);
      const appUrl = await this.getWorkspaceUrl(workspaceId);

      switch (job.name) {
        case QueueJob.COMMENT_NOTIFICATION: {
          await this.commentNotificationService.processComment(
            job.data as ICommentNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.COMMENT_RESOLVED_NOTIFICATION: {
          await this.commentNotificationService.processResolved(
            job.data as ICommentResolvedNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.PAGE_MENTION_NOTIFICATION: {
          await this.pageNotificationService.processPageMention(
            job.data as IPageMentionNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.PAGE_PERMISSION_GRANTED: {
          await this.pageNotificationService.processPermissionGranted(
            job.data as IPermissionGrantedNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.PAGE_UPDATED: {
          await this.pageNotificationService.processPageUpdate(
            job.data as IPageUpdateNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.PAGE_UPDATE_DIGEST: {
          const { userId } = job.data as unknown as { userId: string };
          await this.pageNotificationService.processDigest(userId, appUrl);
          break;
        }

        case QueueJob.PAGE_VERIFICATION_EXPIRING: {
          await this.verificationNotificationService.processVerificationExpiring(
            job.data as IVerificationExpiringNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.PAGE_VERIFICATION_EXPIRED: {
          await this.verificationNotificationService.processVerificationExpired(
            job.data as IVerificationExpiredNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.PAGE_VERIFIED_NOTIFICATION: {
          await this.verificationNotificationService.processPageVerified(
            job.data as IPageVerifiedNotificationJob,
          );
          break;
        }

        case QueueJob.PAGE_APPROVAL_REQUESTED_NOTIFICATION: {
          await this.verificationNotificationService.processApprovalRequested(
            job.data as IApprovalRequestedNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.PAGE_APPROVAL_REJECTED_NOTIFICATION: {
          await this.verificationNotificationService.processApprovalRejected(
            job.data as IApprovalRejectedNotificationJob,
            appUrl,
          );
          break;
        }

        default:
          this.logger.warn(`Unknown notification job: ${job.name}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to process ${job.name}: ${message}`);
      throw err;
    }
  }

  private async resolveWorkspaceId(job: Job): Promise<string> {
    if (
      job.name === QueueJob.PAGE_VERIFICATION_EXPIRING ||
      job.name === QueueJob.PAGE_VERIFICATION_EXPIRED
    ) {
      const { verificationId } = job.data as { verificationId: string };
      const row = await this.db
        .selectFrom('pageVerifications')
        .select('workspaceId')
        .where('id', '=', verificationId)
        .executeTakeFirst();
      return row?.workspaceId ?? '';
    }
    return (job.data as { workspaceId: string }).workspaceId;
  }

  private async runVerificationReconcile(): Promise<void> {
    let eeModule: { PageVerificationSchedulerService?: unknown };
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      eeModule = require('../../ee/page-verification/page-verification-scheduler.service');
    } catch {
      this.logger.debug(
        'VERIFICATION_RECONCILE fired but EE scheduler not bundled in this build',
      );
      return;
    }

    const schedulerClass = eeModule.PageVerificationSchedulerService as
      | (new (...args: unknown[]) => { reconcile(): Promise<void> })
      | undefined;
    if (!schedulerClass) return;

    const scheduler = this.moduleRef.get(schedulerClass, { strict: false });
    if (!scheduler) {
      this.logger.warn(
        'VERIFICATION_RECONCILE fired but scheduler service not resolvable',
      );
      return;
    }
    await scheduler.reconcile();
  }

  private async getWorkspaceUrl(workspaceId: string): Promise<string> {
    const workspace = await this.db
      .selectFrom('workspaces')
      .select('hostname')
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    return this.domainService.getUrl(workspace?.hostname);
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    this.logger.error(
      `Error processing ${job.name} job. Reason: ${job.failedReason}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
