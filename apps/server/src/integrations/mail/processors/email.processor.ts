import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { QueueName } from '../../queue/constants';
import { Job } from 'bullmq';
import { MailService } from '../mail.service';
import { MailMessage } from '../interfaces/mail.message';
import { NotificationRepo } from '@docmost/db/repos/notification/notification.repo';

@Processor(QueueName.EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(EmailProcessor.name);
  constructor(
    private readonly mailService: MailService,
    private readonly notificationRepo: NotificationRepo,
  ) {
    super();
  }

  async process(job: Job<MailMessage, void>): Promise<void> {
    try {
      await this.mailService.sendEmail(job.data);
    } catch (err) {
      throw err;
    }

    if (job.data.notificationId) {
      try {
        await this.notificationRepo.markAsEmailed(job.data.notificationId);
      } catch (err) {
        this.logger.warn(`Failed to mark notification ${job.data.notificationId} as emailed`);
      }
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Processing ${job.name} job`);
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    this.logger.error(
      `Error processing ${job.name} job. Reason: ${job.failedReason}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Completed ${job.name} job`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
