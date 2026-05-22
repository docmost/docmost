import { Injectable } from '@nestjs/common';
import { BacklinkRepo } from '@docmost/db/repos/backlink/backlink.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

export type BacklinkDirection = 'incoming' | 'outgoing';

@Injectable()
export class BacklinkService {
  constructor(
    private readonly backlinkRepo: BacklinkRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
  ) {}

  async countByPageId(
    pageId: string,
    userId: string,
  ): Promise<{ incoming: number; outgoing: number }> {
    const [incomingIds, outgoingIds] = await Promise.all([
      this.accessibleRelatedIds(pageId, 'incoming', userId),
      this.accessibleRelatedIds(pageId, 'outgoing', userId),
    ]);
    return { incoming: incomingIds.length, outgoing: outgoingIds.length };
  }

  async findByPageId(
    pageId: string,
    direction: BacklinkDirection,
    userId: string,
    pagination: PaginationOptions,
  ) {
    const accessibleIds = await this.accessibleRelatedIds(
      pageId,
      direction,
      userId,
    );
    return this.backlinkRepo.findPagesByIdsPaginated(accessibleIds, pagination);
  }

  private async accessibleRelatedIds(
    pageId: string,
    direction: BacklinkDirection,
    userId: string,
  ): Promise<string[]> {
    const candidateIds = await this.backlinkRepo.findRelatedPageIds(
      pageId,
      direction,
      userId,
    );
    if (candidateIds.length === 0) return [];
    return this.pagePermissionRepo.filterAccessiblePageIds({
      pageIds: candidateIds,
      userId,
    });
  }
}
