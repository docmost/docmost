import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import {
  IPageBacklinkJob,
  IPageHistoryJob,
  IPageUpdateNotificationJob,
} from '../../integrations/queue/constants/queue.interface';
import {
  extractMentions,
  extractPageMentions,
  extractInternalLinkSlugIds,
} from '../../common/helpers/prosemirror/utils';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { isDeepStrictEqual } from 'node:util';
import { CollabHistoryService } from '../services/collab-history.service';
import { WatcherService } from '../../core/watcher/watcher.service';
import { isEmptyParagraphDoc } from '../collaboration.util';

@Processor(QueueName.HISTORY_QUEUE)
export class HistoryProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(HistoryProcessor.name);

  constructor(
    private readonly pageHistoryRepo: PageHistoryRepo,
    private readonly pageRepo: PageRepo,
    private readonly collabHistory: CollabHistoryService,
    private readonly watcherService: WatcherService,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE) private notificationQueue: Queue,
    @InjectQueue(QueueName.GENERAL_QUEUE) private generalQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<IPageHistoryJob, void>): Promise<void> {
    if (job.name !== QueueJob.PAGE_HISTORY) return;

    try {
      const { pageId } = job.data;

      const page = await this.pageRepo.findById(pageId, {
        includeContent: true,
      });

      if (!page) {
        this.logger.warn(`Page ${pageId} not found, skipping history`);
        await this.collabHistory.clearContributors(pageId);
        return;
      }

      const lastHistory = await this.pageHistoryRepo.findPageLastHistory(
        pageId,
        { includeContent: true },
      );

      if (!lastHistory && isEmptyParagraphDoc(page.content as any)) {
        this.logger.debug(
          `Skipping first history for page ${pageId}: empty content`,
        );
        await this.collabHistory.clearContributors(pageId);
        return;
      }

      if (
        !lastHistory ||
        !isDeepStrictEqual(lastHistory.content, page.content)
      ) {
        const contributorIds = await this.collabHistory.popContributors(pageId);

        try {
          await this.watcherService.addPageWatchers(
            contributorIds,
            pageId,
            page.spaceId,
            page.workspaceId,
          );

          await this.pageHistoryRepo.saveHistory(page, { contributorIds });
          this.logger.debug(`History created for page: ${pageId}`);
        } catch (err) {
          await this.collabHistory.addContributors(pageId, contributorIds);
          throw err;
        }

        const mentions = extractMentions(page.content);
        const pageMentions = extractPageMentions(mentions);
        const internalLinkSlugIds = extractInternalLinkSlugIds(page.content);

        await this.generalQueue
          .add(QueueJob.PAGE_BACKLINKS, {
            pageId,
            workspaceId: page.workspaceId,
            mentions: pageMentions,
            internalLinkSlugIds,
          } as IPageBacklinkJob)
          .catch((err) => {
            this.logger.error(
              `Failed to queue backlinks for ${pageId}: ${err.message}`,
            );
          });

        if (contributorIds.length > 0 && lastHistory?.content) {
          await this.notificationQueue
            .add(QueueJob.PAGE_UPDATED, {
              pageId,
              spaceId: page.spaceId,
              workspaceId: page.workspaceId,
              actorIds: contributorIds,
            } as IPageUpdateNotificationJob)
            .catch((err) => {
              this.logger.error(
                `Failed to queue page update notification for ${pageId}: ${err.message}`,
              );
            });
        }
      }
    } catch (err) {
      throw err;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Processing ${job.name} for page: ${job.data.pageId}`);
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    this.logger.error(
      `Failed ${job.name} for page: ${job.data.pageId}. Reason: ${job.failedReason}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
