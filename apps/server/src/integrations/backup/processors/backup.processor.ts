import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from '../../queue/constants';
import { BackupJobService } from '../backup-job.service';
import { BackupPackageService } from '../backup-package.service';

interface IBackupJobPayload {
  jobId: string;
  workspaceId: string;
}

@Processor(QueueName.BACKUP_QUEUE)
export class BackupProcessor extends WorkerHost {
  private readonly logger = new Logger(BackupProcessor.name);

  constructor(
    private readonly backupJobService: BackupJobService,
    private readonly backupPackageService: BackupPackageService,
  ) {
    super();
  }

  async process(job: Job<IBackupJobPayload>): Promise<void> {
    if (job.name !== QueueJob.BACKUP_JOB) return;

    const { jobId, workspaceId } = job.data;
    const startedAt = new Date();

    try {
      await this.backupJobService.updateJobStatus(jobId, 'running', {
        startedAt,
      });

      const result = await this.backupPackageService.runBackup(
        workspaceId,
        jobId,
      );

      const endedAt = new Date();
      await this.backupJobService.updateJobStatus(jobId, 'success', {
        endedAt,
        durationMs: endedAt.getTime() - startedAt.getTime(),
        artifactPath: result.artifactPath,
        artifactSizeBytes: result.artifactSizeBytes,
      });
    } catch (err) {
      this.logger.warn(`Backup job ${jobId} failed: ${err}`);
      await this.backupJobService.updateJobStatus(jobId, 'failed', {
        endedAt: new Date(),
        errorCode: 'BACKUP_FAILED',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
