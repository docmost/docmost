import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import { IVerificationInvalidatedJob } from '../../../integrations/queue/constants/queue.interface';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import {
  shouldInvalidateVerification,
  shouldRecordLegacyBaseline,
} from './page-verification-invalidation.utils';
import {
  InvalidateForEditInput,
  PageVerificationInvalidation,
} from './page-verification-invalidation.types';

@Injectable()
export class PageVerificationInvalidationService {
  private readonly logger = new Logger(
    PageVerificationInvalidationService.name,
  );

  constructor(
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
    private readonly pageHistoryRepo: PageHistoryRepo,
  ) {}

  async invalidateForEdit(
    input: InvalidateForEditInput,
    trx: KyselyTransaction,
  ): Promise<PageVerificationInvalidation | null> {
    const verification = await trx
      .selectFrom('pageVerifications')
      .select([
        'id',
        'pageId',
        'spaceId',
        'workspaceId',
        'type',
        'status',
        'verifiedAt',
        'requestedAt',
        'expiresAt',
        'invalidatedAt',
        'verifiedHistoryId',
      ])
      .where('pageId', '=', input.pageId)
      .forUpdate()
      .executeTakeFirst();

    const now = new Date();
    if (
      !verification ||
      !shouldInvalidateVerification(verification, input.changedAt, now) ||
      !input.isMeaningfulChange()
    ) {
      return null;
    }

    const isQms = verification.type === 'qms';

    let verifiedHistoryId: string | undefined;
    if (shouldRecordLegacyBaseline(verification)) {
      const prev = await input.loadPreviousState();
      const baseline = await this.pageHistoryRepo.saveHistory(prev, {
        contributorIds: [],
        trx,
      });
      verifiedHistoryId = baseline.id;
    }
    await trx
      .updateTable('pageVerifications')
      .set({
        invalidatedAt: now,
        invalidatedById: input.userId,
        updatedAt: now,
        ...(verifiedHistoryId && { verifiedHistoryId }),
        ...(isQms && {
          status: 'draft',
          rejectedAt: null,
          rejectedById: null,
          rejectionComment: null,
          rejectedHistoryId: null,
        }),
      })
      .where('id', '=', verification.id)
      .execute();

    return {
      verificationId: verification.id,
      pageId: verification.pageId,
      spaceId: verification.spaceId,
      workspaceId: verification.workspaceId,
      verificationType: verification.type,
      previousStatus: isQms ? verification.status : 'verified',
      newStatus: isQms ? 'draft' : 'invalidated',
    };
  }

  async notifyInvalidated(
    invalidation: PageVerificationInvalidation,
    actorId: string | null,
    source: 'content' | 'title',
  ): Promise<void> {
    const job: IVerificationInvalidatedJob = {
      ...invalidation,
      actorId,
      source,
    };
    try {
      await this.notificationQueue.add(
        QueueJob.PAGE_VERIFICATION_INVALIDATED,
        job,
        { removeOnComplete: true },
      );
    } catch (err) {
      this.logger.error(
        { err, pageId: invalidation.pageId },
        'Failed to queue page verification invalidation',
      );
    }
  }
}
