import { Injectable } from '@nestjs/common';
import {
  WatcherRepo,
  WatcherType,
} from '@docmost/db/repos/watcher/watcher.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { InsertableWatcher } from '@docmost/db/types/entity.types';

@Injectable()
export class WatcherService {
  constructor(private readonly watcherRepo: WatcherRepo) {}

  async watchPage(
    userId: string,
    pageId: string,
    spaceId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ) {
    const watcher: InsertableWatcher = {
      userId,
      pageId,
      spaceId,
      workspaceId,
      type: WatcherType.PAGE,
      addedById: userId,
    };
    return this.watcherRepo.upsert(watcher, trx);
  }

  async addPageWatchers(
    userIds: string[],
    pageId: string,
    spaceId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ) {
    if (userIds.length === 0) return;

    const watchers: InsertableWatcher[] = userIds.map((userId) => ({
      userId,
      pageId,
      spaceId,
      workspaceId,
      type: WatcherType.PAGE,
      addedById: userId,
    }));

    return this.watcherRepo.insertMany(watchers, trx);
  }

  async unwatchPage(userId: string, pageId: string) {
    return this.watcherRepo.mute(userId, pageId);
  }

  async isWatchingPage(userId: string, pageId: string): Promise<boolean> {
    return this.watcherRepo.isWatching(userId, pageId);
  }

  async getPageWatchers(pageId: string, pagination: PaginationOptions) {
    return this.watcherRepo.findPageWatchers(pageId, pagination);
  }

  async getPageWatcherIds(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    return this.watcherRepo.getPageWatcherIds(pageId, trx);
  }

  async countPageWatchers(pageId: string): Promise<number> {
    return this.watcherRepo.countPageWatchers(pageId);
  }

  async cleanupOnSpaceAccessChange(
    userIds: string[],
    spaceId: string,
    opts?: { trx?: KyselyTransaction },
  ): Promise<void> {
    const { trx } = opts;
    await this.watcherRepo.deleteByUsersWithoutSpaceAccess(userIds, spaceId, {
      trx,
    });
  }

  async movePageWatchersToSpace(
    pageIds: string[],
    spaceId: string,
    opts?: { trx?: KyselyTransaction },
  ): Promise<void> {
    await this.watcherRepo.updateSpaceIdByPageIds(spaceId, pageIds, opts);
    await this.watcherRepo.deleteByPageIdsWithoutSpaceAccess(
      pageIds,
      spaceId,
      opts,
    );
  }
}
