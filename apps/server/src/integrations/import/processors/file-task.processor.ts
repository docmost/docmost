import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from 'src/integrations/queue/constants';
import { FileTaskService } from '../services/file-task.service';
import { FileTaskStatus } from '../utils/file.utils';
import { StorageService } from '../../storage/storage.service';

@Processor(QueueName.FILE_TASK_QUEUE)
export class FileTaskProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(FileTaskProcessor.name);

  constructor(
    private readonly fileTaskService: FileTaskService,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<any, void>): Promise<void> {
    try {
      switch (job.name) {
        case QueueJob.IMPORT_TASK:
          await this.fileTaskService.processZIpImport(job.data.fileTaskId);
          break;
        case QueueJob.EXPORT_TASK:
          // TODO: export task
          break;
      }
    } catch (err) {
      this.logger.error('File task failed', err);
      throw err;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Processing ${job.name} job`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job) {
    this.logger.error(
      `Error processing ${job.name} job. Reason: ${job.failedReason}`,
    );

    const MAX_JOB_ATTEMPTS = 3;
    const fileTaskId = job.data.fileTaskId;

    if (job.attemptsMade >= MAX_JOB_ATTEMPTS) {
      this.logger.error(`Max import attempts reached for Task ${fileTaskId}.`);
      await this.fileTaskService.updateTaskStatus(
        fileTaskId,
        FileTaskStatus.Failed,
        job.failedReason,
      );

      try {
        const fileTask = await this.fileTaskService.getFileTask(fileTaskId);
        if (fileTask) {
          await this.storageService.delete(fileTask.filePath);
        }
      } catch (err) {
        this.logger.error(err);
      }
    }
  }

  @OnWorkerEvent('stalled')
  async onStalled(job: Job) {
    this.logger.error(
      `Stalled processing ${job.name} job. Reason: ${job.failedReason}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(
      `Completed ${job.name} job for File task ID ${job.data.fileTaskId}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
