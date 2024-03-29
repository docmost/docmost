import { BadRequestException, Injectable } from '@nestjs/common';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { Page, PageHistory } from '@docmost/db/types/entity.types';
import { PaginationOptions } from 'src/helpers/pagination/pagination-options';
import { PaginatedResult } from 'src/helpers/pagination/paginated-result';
import { PaginationMetaDto } from 'src/helpers/pagination/pagination-meta-dto';

@Injectable()
export class PageHistoryService {
  constructor(private pageHistoryRepo: PageHistoryRepo) {}

  async findById(historyId: string): Promise<PageHistory> {
    const history = await this.pageHistoryRepo.findById(historyId);
    if (!history) {
      throw new BadRequestException('History not found');
    }
    return history;
  }

  async saveHistory(page: Page): Promise<void> {
    await this.pageHistoryRepo.insertPageHistory({
      pageId: page.id,
      title: page.title,
      content: page.content,
      slug: page.slug,
      icon: page.icon,
      version: 1, // TODO: make incremental
      coverPhoto: page.coverPhoto,
      lastUpdatedById: page.lastUpdatedById ?? page.creatorId,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
    });
  }

  async findHistoryByPageId(
    pageId: string,
    paginationOptions: PaginationOptions,
  ) {
    const { pageHistory, count } =
      await this.pageHistoryRepo.findPageHistoryByPageId(
        pageId,
        paginationOptions,
      );

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });
    return new PaginatedResult(pageHistory, paginationMeta);
  }
}
