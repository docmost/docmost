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
      const { pageId, mentions, spaceId, workspaceId } = job.data;

      switch (job.name) {
        case QueueJob.PAGE_BACKLINKS:
          {
            await executeTx(this.db, async (trx) => {
              const existingBacklinks = await trx
                .selectFrom('backlinks')
                .select('targetPageId')
                .where('sourcePageId', '=', pageId)
                .where('spaceId', '=', spaceId)
                .execute();

              if (existingBacklinks.length === 0 && mentions.length === 0) {
                // nothing to do
                console.log('nothing to do');
                return;
              }

              const existingTargetPageIds = existingBacklinks.map(
                (backlink) => backlink.targetPageId,
              );

              // cannot add link to self
              const targetPageIds = mentions
                .filter((mention) => mention.entityId !== pageId)
                .map((mention) => mention.entityId);

              // make sure target pages belong to same space
              let validTargetPages = [];
              if (targetPageIds.length > 0) {
                validTargetPages = await trx
                  .selectFrom('pages')
                  .select('id')
                  .where('id', 'in', targetPageIds)
                  .where('spaceId', '=', spaceId)
                  .execute();
              }

              const validTargetPageIds = validTargetPages.map(
                (page) => page.id,
              );

              console.log('valid targetPageIds', validTargetPageIds);

              console.log('existing targetPageIds', existingTargetPageIds);

              // new backlinks
              const backlinksToAdd = validTargetPageIds.filter(
                (id) => !existingTargetPageIds.includes(id),
              );

              console.log('backlinksToAdd', backlinksToAdd);

              // stale backlinks
              const staleBacklinks = existingTargetPageIds.filter(
                (existingId) => !validTargetPageIds.includes(existingId),
              );

              // add new backlinks
              if (backlinksToAdd.length > 0) {
                const newBacklinks = backlinksToAdd.map((targetPageId) => ({
                  sourcePageId: pageId,
                  targetPageId: targetPageId,
                  spaceId: spaceId,
                  workspaceId: workspaceId,
                }));

                await this.backlinkRepo.insertBacklink(newBacklinks, trx);
                this.logger.debug(
                  `Added ${newBacklinks.length} new backlinks to ${pageId}`,
                );
              }

              // remove outdated backlinks
              if (staleBacklinks.length > 0) {
                await this.db
                  .deleteFrom('backlinks')
                  .where('sourcePageId', '=', pageId)
                  .where('targetPageId', 'in', staleBacklinks)
                  .where('spaceId', '=', spaceId)
                  .execute();

                this.logger.debug(
                  `Removed ${staleBacklinks.length} outdated backlinks from ${pageId}.`,
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
