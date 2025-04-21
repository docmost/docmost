import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from '../constants';
import { IPageBacklinkJob } from '../constants/queue.interface';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BacklinkRepo } from '@docmost/db/repos/backlink/backlink.repo';
import { executeTx } from '@docmost/db/utils';

@Processor(QueueName.GENERAL_QUEUE)
export class BacklinksProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(BacklinksProcessor.name);
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly backlinkRepo: BacklinkRepo,
  ) {
    super();
  }

  async process(job: Job<IPageBacklinkJob, void>): Promise<void> {
    try {
      const { pageId, mentions, workspaceId } = job.data;

      switch (job.name) {
        case QueueJob.PAGE_BACKLINKS:
          {
            await executeTx(this.db, async (trx) => {
              const existingBacklinks = await trx
                .selectFrom('backlinks')
                .select('targetPageId')
                .where('sourcePageId', '=', pageId)
                .execute();

              if (existingBacklinks.length === 0 && mentions.length === 0) {
                return;
              }

              const existingTargetPageIds = existingBacklinks.map(
                (backlink) => backlink.targetPageId,
              );

              const targetPageIds = mentions
                .filter((mention) => mention.entityId !== pageId)
                .map((mention) => mention.entityId);

              // make sure target pages belong to the same workspace
              let validTargetPages = [];
              if (targetPageIds.length > 0) {
                validTargetPages = await trx
                  .selectFrom('pages')
                  .select('id')
                  .where('id', 'in', targetPageIds)
                  .where('workspaceId', '=', workspaceId)
                  .execute();
              }

              const validTargetPageIds = validTargetPages.map(
                (page) => page.id,
              );

              // new backlinks
              const backlinksToAdd = validTargetPageIds.filter(
                (id) => !existingTargetPageIds.includes(id),
              );

              // stale backlinks
              const backlinksToRemove = existingTargetPageIds.filter(
                (existingId) => !validTargetPageIds.includes(existingId),
              );

              // add new backlinks
              if (backlinksToAdd.length > 0) {
                const newBacklinks = backlinksToAdd.map((targetPageId) => ({
                  sourcePageId: pageId,
                  targetPageId: targetPageId,
                  workspaceId: workspaceId,
                }));

                await this.backlinkRepo.insertBacklink(newBacklinks, trx);
                this.logger.debug(
                  `Added ${newBacklinks.length} new backlinks to ${pageId}`,
                );
              }

              // remove stale backlinks
              if (backlinksToRemove.length > 0) {
                await this.db
                  .deleteFrom('backlinks')
                  .where('sourcePageId', '=', pageId)
                  .where('targetPageId', 'in', backlinksToRemove)
                  .execute();

                this.logger.debug(
                  `Removed ${backlinksToRemove.length} outdated backlinks from ${pageId}.`,
                );
              }
            });
          }
          break;
      }
    } catch (err) {
      throw err;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    if (job.name === QueueJob.PAGE_BACKLINKS) {
      this.logger.debug(`Processing ${job.name} job`);
    }
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    if (job.name === QueueJob.PAGE_BACKLINKS) {
      this.logger.error(
        `Error processing ${job.name} job. Reason: ${job.failedReason}`,
      );
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    if (job.name === QueueJob.PAGE_BACKLINKS) {
      this.logger.debug(`Completed ${job.name} job`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
