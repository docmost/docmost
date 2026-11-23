import { Injectable } from '@nestjs/common';
import { upgradeRecentlyUpdatedContent } from '@docmost/editor-ext';
import type { JSONContent } from '@tiptap/core';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { PageHistory } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { CursorPaginationResult } from '@docmost/db/pagination/cursor-pagination';

@Injectable()
export class PageHistoryService {
  constructor(private pageHistoryRepo: PageHistoryRepo) {}

  async findById(historyId: string): Promise<PageHistory> {
    const history = await this.pageHistoryRepo.findById(historyId, {
      includeContent: true,
    });
    return history && {
      ...history,
      content: upgradeRecentlyUpdatedContent(history.content as JSONContent),
    };
  }

  async findHistoryByPageId(
    pageId: string,
    paginationOptions: PaginationOptions,
  ): Promise<CursorPaginationResult<PageHistory>> {
    return this.pageHistoryRepo.findPageHistoryByPageId(
      pageId,
      paginationOptions,
    );
  }
}
