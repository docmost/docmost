import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { Page } from '@docmost/db/types/entity.types';
import { isDeepStrictEqual } from 'node:util';
import { EnvironmentService } from '../../integrations/environment/environment.service';

export class UpdatedPageEvent {
  page: Page;
}

@Injectable()
export class HistoryListener {
  private readonly logger = new Logger(HistoryListener.name);

  constructor(
    private readonly pageHistoryRepo: PageHistoryRepo,
    private readonly environmentService: EnvironmentService,
  ) {}

  @OnEvent('collab.page.updated')
  async handleCreatePageHistory(event: UpdatedPageEvent) {
    const { page } = event;

    const pageCreationTime = new Date(page.createdAt).getTime();
    const currentTime = Date.now();
    const FIVE_MINUTES = this.environmentService.isDevelopment()
      ? 60 * 1000
      : 5 * 60 * 1000;

    if (currentTime - pageCreationTime < FIVE_MINUTES) {
      return;
    }

    const lastHistory = await this.pageHistoryRepo.findPageLastHistory(page.id, {
      includeContent: true,
    });

    if (
      !lastHistory ||
      (!isDeepStrictEqual(lastHistory.content, page.content) &&
        currentTime - new Date(lastHistory.createdAt).getTime() >= FIVE_MINUTES)
    ) {
      try {
        await this.pageHistoryRepo.saveHistory(page);
        this.logger.debug(`New history created for: ${page.id}`);
      } catch (err) {
        this.logger.error(`Failed to create history for page: ${page.id}`, err);
      }
    }
  }
}
