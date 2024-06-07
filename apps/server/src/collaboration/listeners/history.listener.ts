import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { Page } from '@docmost/db/types/entity.types';
import { isDeepStrictEqual } from 'node:util';

export class UpdatedPageEvent {
  page: Page;
}

@Injectable()
export class HistoryListener {
  private readonly logger = new Logger(HistoryListener.name);

  constructor(private readonly pageHistoryRepo: PageHistoryRepo) {}

  @OnEvent('collab.page.updated')
  async handleCreatePageHistory(event: UpdatedPageEvent) {
    const { page } = event;

    const pageCreationTime = new Date(page.createdAt).getTime();
    const currentTime = Date.now();
    const TEN_MINUTES = 10 * 60 * 1000;

    if (currentTime - pageCreationTime < TEN_MINUTES) {
      return;
    }

    const lastHistory = await this.pageHistoryRepo.findPageLastHistory(page.id);

    if (
      !lastHistory ||
      (!isDeepStrictEqual(lastHistory.content, page.content) &&
        currentTime - new Date(lastHistory.createdAt).getTime() >= TEN_MINUTES)
    ) {
      try {
        await this.pageHistoryRepo.saveHistory(page);
        this.logger.debug(`New history created for: ${page.id}`);
      } catch (err) {
        this.logger.error(`Failed to create history for: ${page.id}`, err);
      }
    }
  }
}
