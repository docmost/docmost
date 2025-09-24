import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from 'src/integrations/queue/constants';
import { FileImportTaskService } from '../services/file-import-task.service';
import { FileTaskStatus } from '../utils/file.utils';
import { StorageService } from '../../storage/storage.service';

@Processor(QueueName.FILE_TASK_QUEUE)
export class FileTaskProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(FileTaskProcessor.name);

  constructor(
    private readonly fileTaskService: FileImportTaskService,
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
      `Error processing ${job.name} job. Import Task ID: ${job.data.fileTaskId}. Reason: ${job.failedReason}`,
    );

    await this.handleFailedJob(job);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job) {
    this.logger.log(
      `Completed ${job.name} job for File task ID ${job.data.fileTaskId}`,
    );

    try {
      const fileTask = await this.fileTaskService.getFileTask(
        job.data.fileTaskId,
      );
      if (fileTask) {
        await this.storageService.delete(fileTask.filePath);
        this.logger.debug(`Deleted imported zip file: ${fileTask.filePath}`);
      }
    } catch (err) {
      this.logger.error(`Failed to delete imported zip file:`, err);
    }
  }

  private async handleFailedJob(job: Job) {
    try {
      const fileTaskId = job.data.fileTaskId;
      const reason = job.failedReason || 'Unknown error';

      await this.fileTaskService.updateTaskStatus(
        fileTaskId,
        FileTaskStatus.Failed,
        reason,
      );

      const fileTask = await this.fileTaskService.getFileTask(fileTaskId);
      if (fileTask) {
        await this.storageService.delete(fileTask.filePath);
      }
    } catch (err) {
      this.logger.error(err);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
