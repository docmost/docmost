import {
  Extension,
  onChangePayload,
  onDisconnectPayload,
} from '@hocuspocus/server';
import { Injectable, Logger } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { getPageId } from '../collaboration.util';

@Injectable()
export class HistoryExtension implements Extension {
  private readonly logger = new Logger(HistoryExtension.name);

  ACTIVE_EDITING_INTERVAL = 10 * 60 * 1000; // 10 minutes
  historyIntervalMap = new Map<string, NodeJS.Timeout>();
  lastEditTimeMap = new Map<string, number>();

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pageHistoryRepo: PageHistoryRepo,
  ) {}

  async onChange(data: onChangePayload): Promise<void> {
    const pageId = getPageId(data.documentName);

    this.lastEditTimeMap.set(pageId, Date.now());

    if (!this.historyIntervalMap.has(pageId)) {
      const historyInterval = setInterval(() => {
        if (this.isActiveEditing(pageId)) {
          this.recordHistory(pageId);
        }
      }, this.ACTIVE_EDITING_INTERVAL);
      this.historyIntervalMap.set(pageId, historyInterval);
    }
  }

  async onDisconnect(data: onDisconnectPayload): Promise<void> {
    const pageId = getPageId(data.documentName);
    if (data.clientsCount === 0) {
      if (this.historyIntervalMap.has(pageId)) {
        clearInterval(this.historyIntervalMap.get(pageId));
        this.historyIntervalMap.delete(pageId);
        this.lastEditTimeMap.delete(pageId);
      }
    }
  }

  isActiveEditing(pageId: string): boolean {
    const lastEditTime = this.lastEditTimeMap.get(pageId);
    if (!lastEditTime) {
      return false;
    }
    return Date.now() - lastEditTime < this.ACTIVE_EDITING_INTERVAL;
  }

  async recordHistory(pageId: string) {
    try {
      const page = await this.pageRepo.findById(pageId, {
        includeContent: true,
      });
      // Todo: compare if data is the same as the previous version
      await this.pageHistoryRepo.saveHistory(page);
      this.logger.debug(`New history created for: ${pageId}`);
    } catch (err) {
      this.logger.error(
        `An error occurred saving page history for:  ${pageId}`,
        err,
      );
    }
  }
}
