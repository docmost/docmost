import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from 'src/integrations/queue/constants';
import { FileImportTaskService } from '../services/file-import-task.service';
import { FileTaskStatus } from '../utils/file.utils';
import { StorageService } from '../../storage/storage.service';
import { ModuleRef } from '@nestjs/core';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

@Processor(QueueName.FILE_TASK_QUEUE)
export class FileTaskProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(FileTaskProcessor.name);

  constructor(
    private readonly fileTaskService: FileImportTaskService,
    private readonly storageService: StorageService,
    private readonly moduleRef: ModuleRef,
    @InjectKysely() private readonly db: KyselyDB,
  ) {
    super();
  }

  async process(job: Job<any, void>): Promise<void> {
    try {
      switch (job.name) {
        case QueueJob.IMPORT_TASK:
          await this.fileTaskService.processZIpImport(job.data.fileTaskId);
          break;
        case QueueJob.PDF_EXPORT_TASK:
          await this.processExportTask(job.data.fileTaskId);
          break;
        case QueueJob.PDF_EXPORT_CLEANUP:
          await this.processExportCleanup();
          break;
      }
    } catch (err) {
      this.logger.error('File task failed', err);
      throw err;
    }
  }

  private getPdfExportService() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PdfExportModule = require('./../../../ee/pdf-export/pdf-export.service');
    return this.moduleRef.get(PdfExportModule.PdfExportService, {
      strict: false,
    });
  }

  private async processExportTask(fileTaskId: string): Promise<void> {
    const pdfExportService = this.getPdfExportService();
    await pdfExportService.generateAndStorePdf(fileTaskId);
  }

  private async processExportCleanup(): Promise<void> {
    const pdfExportService = this.getPdfExportService();
    await pdfExportService.cleanupExpiredExports();
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Processing ${job.name} job`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job) {
    this.logger.error(
      `Error processing ${job.name} job. File Task ID: ${job.data?.fileTaskId}. Reason: ${job.failedReason}`,
    );

    if (job.name === QueueJob.IMPORT_TASK) {
      await this.handleFailedImportJob(job);
    } else if (job.name === QueueJob.PDF_EXPORT_TASK) {
      await this.handleFailedExportJob(job);
    }
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job) {
    this.logger.log(
      `Completed ${job.name} job for File task ID ${job.data?.fileTaskId}`,
    );

    if (job.name === QueueJob.IMPORT_TASK) {
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
    // Export tasks: do NOT delete the file on completion (kept for 24h cache)
  }

  private async handleFailedImportJob(job: Job) {
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

  private async handleFailedExportJob(job: Job) {
    try {
      const fileTaskId = job.data.fileTaskId;
      const reason = job.failedReason || 'Unknown error';

      await this.db
        .updateTable('fileTasks')
        .set({
          status: FileTaskStatus.Failed,
          errorMessage: reason,
          updatedAt: new Date(),
        })
        .where('id', '=', fileTaskId)
        .execute();
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
