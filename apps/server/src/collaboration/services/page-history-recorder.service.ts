import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { isDeepStrictEqual } from 'node:util';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import {
  IPageBacklinkJob,
  IPageUpdateNotificationJob,
} from '../../integrations/queue/constants/queue.interface';
import {
  extractMentions,
  extractPageMentions,
  extractInternalLinkSlugIds,
} from '../../common/helpers/prosemirror/utils';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { CollabHistoryService } from './collab-history.service';
import { WatcherService } from '../../core/watcher/watcher.service';
import { isEmptyParagraphDoc } from '../collaboration.util';

@Injectable()
export class PageHistoryRecorderService {
  private readonly logger = new Logger(PageHistoryRecorderService.name);

  constructor(
    private readonly pageHistoryRepo: PageHistoryRepo,
    private readonly pageRepo: PageRepo,
    private readonly collabHistory: CollabHistoryService,
    private readonly watcherService: WatcherService,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE) private notificationQueue: Queue,
    @InjectQueue(QueueName.GENERAL_QUEUE) private generalQueue: Queue,
  ) {}

  // Returns the id of the version holding the page's current title and content.
  async recordPageHistory(
    pageId: string,
    opts?: { allowEmpty?: boolean },
  ): Promise<string | null> {
    const page = await this.pageRepo.findById(pageId, {
      includeContent: true,
    });

    if (!page) {
      this.logger.warn(`Page ${pageId} not found, skipping history`);
      await this.collabHistory.clearContributors(pageId);
      return null;
    }

    const lastHistory = await this.pageHistoryRepo.findPageLastHistory(pageId, {
      includeContent: true,
    });

    if (
      !lastHistory &&
      !opts?.allowEmpty &&
      isEmptyParagraphDoc(page.content as any)
    ) {
      this.logger.debug(
        `Skipping first history for page ${pageId}: empty content`,
      );
      await this.collabHistory.clearContributors(pageId);
      return null;
    }

    if (
      lastHistory &&
      isDeepStrictEqual(lastHistory.content, page.content) &&
      lastHistory.title === page.title
    ) {
      return lastHistory.id;
    }

    const contributorIds = await this.collabHistory.popContributors(pageId);

    let historyId: string;
    try {
      await this.watcherService.addPageWatchers(
        contributorIds,
        pageId,
        page.spaceId,
        page.workspaceId,
      );

      const saved = await this.pageHistoryRepo.saveHistory(page, {
        contributorIds,
      });
      historyId = saved.id;
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

    return historyId;
  }
}
