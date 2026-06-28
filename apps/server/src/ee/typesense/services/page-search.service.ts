import { Injectable } from '@nestjs/common';
import { SearchService } from '../../../core/search/search.service';
import { SearchDTO } from '../../../core/search/dto/search.dto';

@Injectable()
export class PageSearchService {
  constructor(private readonly searchService: SearchService) {}

  async searchPage(
    searchParams: SearchDTO,
    opts: { userId?: string; workspaceId: string },
  ) {
    return this.searchService.searchPage(searchParams, opts);
  }
}
