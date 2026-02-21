import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as path from 'path';
import { QueueJob, QueueName } from '../queue/constants';
import { EnvironmentService } from '../environment/environment.service';

export type BackupJobStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'canceled';
export type BackupTriggerType = 'schedule' | 'manual' | 'api';

export interface BackupJobRow {
  id: string;
  workspaceId: string;
  policyId: string | null;
  triggerType: BackupTriggerType;
  triggeredByUserId: string | null;
  status: BackupJobStatus;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  durationMs: string | null;
  artifactPath: string | null;
  artifactSizeBytes: string | null;
  checksum: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: unknown;
  createdAt: Date | string;
  triggererName?: string | null;
}

export interface ListBackupJobsResult {
  items: BackupJobRow[];
  nextCursor: string | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

@Injectable()
export class BackupJobService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.BACKUP_QUEUE) private readonly backupQueue: Queue,
    private readonly environmentService: EnvironmentService,
  ) {}

  async createManualJob(
    workspaceId: string,
    userId: string,
  ): Promise<BackupJobRow> {
    const [row] = await this.db
      .insertInto('backupJobs')
      .values({
        workspaceId,
        policyId: null,
        triggerType: 'manual',
        triggeredByUserId: userId,
        status: 'pending',
      })
      .returningAll()
      .execute();

    await this.backupQueue.add(
      QueueJob.BACKUP_JOB,
      { jobId: row.id, workspaceId },
      { jobId: row.id },
    );

    const out = await this.getJobWithTriggerer(workspaceId, row.id);
    return out!;
  }

  async getJobWithTriggerer(
    workspaceId: string,
    jobId: string,
  ): Promise<BackupJobRow | null> {
    const job = await this.db
      .selectFrom('backupJobs')
      .leftJoin('users', 'users.id', 'backupJobs.triggeredByUserId')
      .select([
        'backupJobs.id',
        'backupJobs.workspaceId',
        'backupJobs.policyId',
        'backupJobs.triggerType',
        'backupJobs.triggeredByUserId',
        'backupJobs.status',
        'backupJobs.startedAt',
        'backupJobs.endedAt',
        'backupJobs.durationMs',
        'backupJobs.artifactPath',
        'backupJobs.artifactSizeBytes',
        'backupJobs.checksum',
        'backupJobs.errorCode',
        'backupJobs.errorMessage',
        'backupJobs.metadata',
        'backupJobs.createdAt',
        'users.name as triggererName',
      ])
      .where('backupJobs.workspaceId', '=', workspaceId)
      .where('backupJobs.id', '=', jobId)
      .executeTakeFirst();

    return job as BackupJobRow | null;
  }

  async listJobs(
    workspaceId: string,
    opts: { cursor?: string; limit?: number },
  ): Promise<ListBackupJobsResult> {
    const limit = Math.min(opts.limit ?? 20, 100);
    let q = this.db
      .selectFrom('backupJobs')
      .leftJoin('users', 'users.id', 'backupJobs.triggeredByUserId')
      .select([
        'backupJobs.id',
        'backupJobs.workspaceId',
        'backupJobs.policyId',
        'backupJobs.triggerType',
        'backupJobs.triggeredByUserId',
        'backupJobs.status',
        'backupJobs.startedAt',
        'backupJobs.endedAt',
        'backupJobs.durationMs',
        'backupJobs.artifactPath',
        'backupJobs.artifactSizeBytes',
        'backupJobs.checksum',
        'backupJobs.errorCode',
        'backupJobs.errorMessage',
        'backupJobs.metadata',
        'backupJobs.createdAt',
        'users.name as triggererName',
      ])
      .where('backupJobs.workspaceId', '=', workspaceId)
      .orderBy('backupJobs.createdAt', 'desc')
      .limit(limit + 1);

    if (opts.cursor) {
      q = q.where('backupJobs.createdAt', '<', opts.cursor as any) as typeof q;
    }
    const rows = await q.execute();

    const items = rows.slice(0, limit) as BackupJobRow[];
    const hasNextPage = rows.length > limit;
    const nextCursor =
      hasNextPage && items.length > 0
        ? String(items[items.length - 1].createdAt)
        : null;

    return {
      items,
      nextCursor,
      hasNextPage,
      hasPrevPage: !!opts.cursor,
    };
  }

  async getDownloadUrl(
    workspaceId: string,
    jobId: string,
  ): Promise<{ url: string } | null> {
    const job = await this.db
      .selectFrom('backupJobs')
      .select(['id', 'status', 'artifactPath'])
      .where('workspaceId', '=', workspaceId)
      .where('id', '=', jobId)
      .executeTakeFirst();

    if (!job || job.status !== 'success' || !job.artifactPath) {
      return null;
    }

    return { url: `/api/backups/jobs/${jobId}/download` };
  }

  async updateJobStatus(
    jobId: string,
    status: BackupJobStatus,
    opts?: {
      startedAt?: Date;
      endedAt?: Date;
      durationMs?: number;
      artifactPath?: string;
      artifactSizeBytes?: number;
      errorCode?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    const set: Record<string, unknown> = { status };
    if (opts?.startedAt) set.startedAt = opts.startedAt;
    if (opts?.endedAt) set.endedAt = opts.endedAt;
    if (opts?.durationMs != null) set.durationMs = String(opts.durationMs);
    if (opts?.artifactPath) set.artifactPath = opts.artifactPath;
    if (opts?.artifactSizeBytes != null)
      set.artifactSizeBytes = String(opts.artifactSizeBytes);
    if (opts?.errorCode) set.errorCode = opts.errorCode;
    if (opts?.errorMessage) set.errorMessage = opts.errorMessage;

    await this.db
      .updateTable('backupJobs')
      .set(set)
      .where('id', '=', jobId)
      .execute();
  }

  async getJob(
    workspaceId: string,
    jobId: string,
  ): Promise<{ id: string; status: string } | null> {
    const row = await this.db
      .selectFrom('backupJobs')
      .select(['id', 'status'])
      .where('workspaceId', '=', workspaceId)
      .where('id', '=', jobId)
      .executeTakeFirst();
    return row as { id: string; status: string } | null;
  }

  getArtifactFullPath(workspaceId: string, jobId: string): Promise<string | null> {
    return this.db
      .selectFrom('backupJobs')
      .select('artifactPath')
      .where('workspaceId', '=', workspaceId)
      .where('id', '=', jobId)
      .where('status', '=', 'success')
      .executeTakeFirst()
      .then((row) => {
        if (!row?.artifactPath) return null;
        const root = this.environmentService.getBackupLocalPath();
        return path.join(root, row.artifactPath);
      });
  }
}
