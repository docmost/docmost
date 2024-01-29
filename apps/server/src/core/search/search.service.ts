import { Injectable } from '@nestjs/common';
import { PageRepository } from '../page/repositories/page.repository';
import { SearchDTO } from './dto/search.dto';
import { SearchResponseDto } from './dto/search-response.dto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tsquery = require('pg-tsquery')();

@Injectable()
export class SearchService {
  constructor(private pageRepository: PageRepository) {}

  async searchPage(
    query: string,
    searchParams: SearchDTO,
    workspaceId: string,
  ): Promise<SearchResponseDto[]> {
    if (query.length < 1) {
      return;
    }
    const searchQuery = tsquery(query.trim() + '*');

    const selectColumns = [
      'page.id as id',
      'page.title as title',
      'page.icon as icon',
      'page.parentPageId as "parentPageId"',
      'page.creatorId as "creatorId"',
      'page.createdAt as "createdAt"',
      'page.updatedAt as "updatedAt"',
    ];

    const searchQueryBuilder = await this.pageRepository
      .createQueryBuilder('page')
      .select(selectColumns);

    searchQueryBuilder.andWhere('page.workspaceId = :workspaceId', {
      workspaceId,
    });

    searchQueryBuilder
      .addSelect('ts_rank(page.tsv, to_tsquery(:searchQuery))', 'rank')
      .addSelect(
        `ts_headline('english', page.textContent, to_tsquery(:searchQuery), 'MinWords=9, MaxWords=10, MaxFragments=10')`,
        'highlight',
      )
      .andWhere('page.tsv @@ to_tsquery(:searchQuery)', { searchQuery })
      .orderBy('rank', 'DESC');

    if (searchParams?.creatorId) {
      searchQueryBuilder.andWhere('page.creatorId = :creatorId', {
        creatorId: searchParams.creatorId,
      });
    }

    searchQueryBuilder
      .take(searchParams.limit || 20)
      .offset(searchParams.offset || 0);

    const results = await searchQueryBuilder.getRawMany();

    const searchResults = results.map((result) => {
      if (result.highlight) {
        result.highlight = result.highlight
          .replace(/\r\n|\r|\n/g, ' ')
          .replace(/\s+/g, ' ');
      }
      return result;
    });

    return searchResults;
  }
}
