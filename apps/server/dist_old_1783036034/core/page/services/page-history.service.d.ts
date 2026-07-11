import { PageHistoryRepo } from "../../../database/repos/page/page-history.repo";
import { PageHistory } from "../../../database/types/entity.types";
import { PaginationOptions } from "../../../database/pagination/pagination-options";
import { CursorPaginationResult } from "../../../database/pagination/cursor-pagination";
export declare class PageHistoryService {
    private pageHistoryRepo;
    constructor(pageHistoryRepo: PageHistoryRepo);
    findById(historyId: string): Promise<PageHistory>;
    findHistoryByPageId(pageId: string, paginationOptions: PaginationOptions): Promise<CursorPaginationResult<PageHistory>>;
}
