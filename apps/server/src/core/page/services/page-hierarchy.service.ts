import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { PageHierarchyRepo } from '@docmost/db/repos/page/page-hierarchy.repo';
import { executeTx } from '@docmost/db/utils';

type RebuildResult = { rebuilt: boolean; count: number };

@Injectable()
export class PageHierarchyService {
  private readonly logger = new Logger(PageHierarchyService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageHierarchyRepo: PageHierarchyRepo,
  ) {}

  async rebuildAll(): Promise<RebuildResult> {
    return executeTx(this.db, async (trx) => {
      const locked = await this.pageHierarchyRepo.tryAcquireGlobalLock(trx);
      if (!locked) {
        this.logger.debug('Rebuild all skipped - another process holds the lock');
        return { rebuilt: false, count: 0 };
      }

      this.logger.log('Rebuilding hierarchy for all pages');
      const count = await this.pageHierarchyRepo.rebuildAll(trx);
      this.logger.log(`Rebuilt hierarchy for all pages (${count} entries)`);

      return { rebuilt: true, count };
    });
  }

  async rebuildBySpace(spaceId: string): Promise<RebuildResult> {
    return executeTx(this.db, async (trx) => {
      const locked = await this.pageHierarchyRepo.tryAcquireSpaceLock(
        spaceId,
        trx,
      );
      if (!locked) {
        this.logger.debug(
          `Rebuild for space ${spaceId} skipped - another process holds the lock`,
        );
        return { rebuilt: false, count: 0 };
      }

      this.logger.log(`Rebuilding hierarchy for space ${spaceId}`);
      const count = await this.pageHierarchyRepo.rebuildBySpace(spaceId, trx);
      this.logger.log(
        `Rebuilt hierarchy for space ${spaceId} (${count} entries)`,
      );

      return { rebuilt: true, count };
    });
  }
}
