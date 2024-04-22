import {
  Extension,
  onChangePayload,
  onDisconnectPayload,
} from '@hocuspocus/server';
import { Injectable } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';

@Injectable()
export class HistoryExtension implements Extension {
  ACTIVE_EDITING_INTERVAL = 10 * 60 * 1000; // 10 minutes
  historyIntervalMap = new Map<string, NodeJS.Timeout>();
  lastEditTimeMap = new Map<string, number>();

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pageHistoryRepo: PageHistoryRepo,
  ) {}

  async onChange(data: onChangePayload): Promise<void> {
    const pageId = data.documentName;
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
    const pageId = data.documentName;
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
      console.log(`New history created for: ${pageId}`);
    } catch (err) {
      console.error('An error occurred saving page history', err);
    }
  }
}
