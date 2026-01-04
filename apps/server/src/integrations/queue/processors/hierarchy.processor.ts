import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { QueueJob, QueueName } from '../constants';
import { IRebuildHierarchyJob } from '../constants/queue.interface';
import { PageHierarchyRepo } from '@docmost/db/repos/page/page-hierarchy.repo';
import { executeTx } from '@docmost/db/utils';

const HIERARCHY_JOBS = [
  QueueJob.REBUILD_HIERARCHY_ALL,
  QueueJob.REBUILD_HIERARCHY_ALL_BY_SPACE,
  QueueJob.REBUILD_HIERARCHY_SPACE,
] as const;

@Processor(QueueName.HIERARCHY_QUEUE)
export class HierarchyProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(HierarchyProcessor.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageHierarchyRepo: PageHierarchyRepo,
  ) {
    super();
  }

  async process(job: Job<IRebuildHierarchyJob, void>): Promise<void> {
    try {
      switch (job.name) {
        case QueueJob.REBUILD_HIERARCHY_ALL:
          await this.rebuildAll();
          break;

        case QueueJob.REBUILD_HIERARCHY_ALL_BY_SPACE:
          await this.rebuildAllBySpace();
          break;

        case QueueJob.REBUILD_HIERARCHY_SPACE:
          if (!job.data.spaceId) {
            throw new Error('spaceId is required for space rebuild');
          }
          await this.rebuildBySpace(job.data.spaceId);
          break;
      }
    } catch (err) {
      throw err;
    }
  }

  private async rebuildAll(): Promise<void> {
    await executeTx(this.db, async (trx) => {
      const locked = await this.pageHierarchyRepo.tryAcquireGlobalLock(trx);
      if (!locked) {
        this.logger.debug(
          'Rebuild all skipped - another process holds the lock',
        );
        return;
      }

      this.logger.debug('Rebuilding hierarchy for all pages');
      const count = await this.pageHierarchyRepo.rebuildAll(trx);
      this.logger.debug(`Rebuilt hierarchy for all pages (${count} entries)`);
    });
  }

  private async rebuildBySpace(spaceId: string): Promise<void> {
    await executeTx(this.db, async (trx) => {
      const locked = await this.pageHierarchyRepo.tryAcquireSpaceLock(
        spaceId,
        trx,
      );
      if (!locked) {
        this.logger.debug(
          `Rebuild for space ${spaceId} skipped - another process holds the lock`,
        );
        return;
      }

      this.logger.debug(`Rebuilding hierarchy for space ${spaceId}`);
      const count = await this.pageHierarchyRepo.rebuildBySpace(spaceId, trx);
      this.logger.debug(
        `Rebuilt hierarchy for space ${spaceId} (${count} entries)`,
      );
    });
  }

  private async rebuildAllBySpace(): Promise<void> {
    let lastId: string | null = null;
    const BATCH_SIZE = 100;
    let totalSpaces = 0;

    this.logger.debug('Starting hierarchy rebuild for all spaces');

    while (true) {
      const spaces = await this.db
        .selectFrom('spaces')
        .select('id')
        .$if(Boolean(lastId), (qb) => qb.where('id', '>', lastId!))
        .orderBy('id', 'asc')
        .limit(BATCH_SIZE)
        .execute();

      if (spaces.length === 0) break;

      for (const space of spaces) {
        await this.rebuildBySpace(space.id);
        totalSpaces++;
      }

      lastId = spaces[spaces.length - 1].id;
      this.logger.debug(`Rebuilt hierarchy for ${totalSpaces} spaces...`);
    }

    this.logger.debug(`Completed hierarchy rebuild for ${totalSpaces} spaces`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    if (HIERARCHY_JOBS.includes(job.name as (typeof HIERARCHY_JOBS)[number])) {
      this.logger.debug(`Processing ${job.name} job`);
    }
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    if (HIERARCHY_JOBS.includes(job.name as (typeof HIERARCHY_JOBS)[number])) {
      this.logger.error(
        `Error processing ${job.name} job. Reason: ${job.failedReason}`,
      );
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    if (HIERARCHY_JOBS.includes(job.name as (typeof HIERARCHY_JOBS)[number])) {
      this.logger.debug(`Completed ${job.name} job`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
