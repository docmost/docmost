import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { Interval } from '@nestjs/schedule';
import { getExpiringVerificationStatus } from './page-verification.utils';

@Injectable()
export class PageVerificationSchedulerService {
  private readonly logger = new Logger(PageVerificationSchedulerService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  @Interval('page-verification-reconcile', 6 * 60 * 60 * 1000)
  async scheduleReconcile() {
    try {
      await this.reconcile();
    } catch (error) {
      this.logger.error('Failed to reconcile page verifications', error);
    }
  }

  async reconcile() {
    const verifications = await this.db
      .selectFrom('pageVerifications')
      .select(['id', 'type', 'status', 'expiresAt'])
      .where('type', '=', 'expiring')
      .where('status', '!=', 'obsolete')
      .execute();

    for (const verification of verifications) {
      const nextStatus = getExpiringVerificationStatus(
        verification.expiresAt ? new Date(verification.expiresAt) : null,
      );

      if (verification.status === nextStatus) {
        continue;
      }

      await this.db
        .updateTable('pageVerifications')
        .set({
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where('id', '=', verification.id)
        .execute();

      if (nextStatus === 'expiring') {
        await this.notificationQueue.add(QueueJob.PAGE_VERIFICATION_EXPIRING, {
          verificationId: verification.id,
        });
      }

      if (nextStatus === 'expired') {
        await this.notificationQueue.add(QueueJob.PAGE_VERIFICATION_EXPIRED, {
          verificationId: verification.id,
        });
      }
    }
  }
}
