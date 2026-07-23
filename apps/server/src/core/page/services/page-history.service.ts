import { Injectable } from '@nestjs/common';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import {
  PageHistory,
  PageHistoryWithEncodedBlob,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { CursorPaginationResult } from '@docmost/db/pagination/cursor-pagination';

@Injectable()
export class PageHistoryService {
  constructor(private pageHistoryRepo: PageHistoryRepo) {}

  /**
   * Encrypted snapshots carry a ciphertext blob instead of prosemirror JSON;
   * it is sent base64-encoded and decrypted client-side with the page DEK.
   */
  async findById(
    historyId: string,
  ): Promise<PageHistoryWithEncodedBlob | undefined> {
    const history = await this.pageHistoryRepo.findById(historyId, {
      includeContent: true,
      includeEncryptedBlob: true,
    });

    if (!history) return undefined;

    return {
      ...history,
      encryptedBlob: history.encryptedBlob
        ? Buffer.from(history.encryptedBlob).toString('base64')
        : null,
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
