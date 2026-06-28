import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PageVerificationRepo } from './page-verification.repo';
import {
  QueueJob,
  QueueName,
} from '../../integrations/queue/constants';

const EXPIRING_WARNING_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class PageVerificationSchedulerService {
  private readonly logger = new Logger(PageVerificationSchedulerService.name);

  constructor(
    private readonly pageVerificationRepo: PageVerificationRepo,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  async reconcile(): Promise<void> {
    const now = new Date();
    const warningBefore = new Date(now.getTime() + EXPIRING_WARNING_MS);

    const expiring =
      await this.pageVerificationRepo.findExpiringVerifications(
        now,
        warningBefore,
      );
    for (const verification of expiring) {
      await this.notificationQueue.add(
        QueueJob.PAGE_VERIFICATION_EXPIRING,
        { verificationId: verification.id },
      );
    }

    const expired =
      await this.pageVerificationRepo.findExpiredVerifications(now);
    for (const verification of expired) {
      await this.notificationQueue.add(
        QueueJob.PAGE_VERIFICATION_EXPIRED,
        { verificationId: verification.id },
      );
    }

    this.logger.debug(
      `Verification reconcile: ${expiring.length} expiring, ${expired.length} expired`,
    );
  }
}
