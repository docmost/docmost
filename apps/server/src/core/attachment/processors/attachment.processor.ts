import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AttachmentService } from '../services/attachment.service';
import { QueueJob, QueueName } from 'src/integrations/queue/constants';
import { ModuleRef } from '@nestjs/core';

@Processor(QueueName.ATTACHMENT_QUEUE)
export class AttachmentProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(AttachmentProcessor.name);
  constructor(
    private readonly attachmentService: AttachmentService,
    private moduleRef: ModuleRef,
  ) {
    super();
  }

  async process(job: Job<any, void>): Promise<void> {
    try {
      if (job.name === QueueJob.DELETE_SPACE_ATTACHMENTS) {
        await this.attachmentService.handleDeleteSpaceAttachments(job.data.id);
      }
      if (job.name === QueueJob.DELETE_USER_AVATARS) {
        await this.attachmentService.handleDeleteUserAvatars(job.data.id);
      }
      if (job.name === QueueJob.DELETE_PAGE_ATTACHMENTS) {
        await this.attachmentService.handleDeletePageAttachments(
          job.data.pageId,
        );
      }
      if (
        job.name === QueueJob.ATTACHMENT_INDEX_CONTENT ||
        job.name === QueueJob.ATTACHMENT_INDEXING
      ) {
        let AttachmentEeModule: any;
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          AttachmentEeModule = require('./../../../ee/attachments-ee/attachment-ee.service');
        } catch (err) {
          this.logger.debug(
            'Attachment enterprise module requested but EE module not bundled in this build',
          );
          return;
        }
        const attachmentEeService = this.moduleRef.get(
          AttachmentEeModule.AttachmentEeService,
          { strict: false },
        );

        if (job.name === QueueJob.ATTACHMENT_INDEX_CONTENT) {
          await attachmentEeService.indexAttachment(job.data.attachmentId);
        } else if (job.name === QueueJob.ATTACHMENT_INDEXING) {
          await attachmentEeService.indexAttachments(
            job.data.workspaceId,
          );
        }
      }
    } catch (err) {
      throw err;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Processing ${job.name} job`);
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    if (job.name === QueueJob.ATTACHMENT_INDEX_CONTENT) {
      this.logger.debug(
        `Error processing ${job.name} job for attachment ${job.data?.attachmentId}. Reason: ${job.failedReason}`,
      );
    } else {
      this.logger.error(
        `Error processing ${job.name} job. Reason: ${job.failedReason}`,
      );
    }
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
