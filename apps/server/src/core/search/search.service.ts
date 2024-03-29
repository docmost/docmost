import { Injectable } from '@nestjs/common';
import { SearchDTO } from './dto/search.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tsquery = require('pg-tsquery')();

@Injectable()
export class SearchService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async searchPage(
    query: string,
    searchParams: SearchDTO,
    workspaceId: string,
  ): Promise<SearchResponseDto[]> {
    if (query.length < 1) {
      return;
    }
    const searchQuery = tsquery(query.trim() + '*');

    const queryResults = await this.db
      .selectFrom('pages')
      .select([
        'id',
        'title',
        'icon',
        'parentPageId',
        'creatorId',
        'createdAt',
        'updatedAt',
        sql<number>`ts_rank(tsv, to_ts_query(${searchQuery}))`.as('rank'),
        sql<string>`ts_headline('english', page.textContent, to_tsquery(${searchQuery}), 'MinWords=9, MaxWords=10, MaxFragments=10')`.as(
          'highlight',
        ),
      ])
      .where('workspaceId', '=', workspaceId)
      .where('tsv', '@@', sql<string>`to_tsquery(${searchQuery})`)
      .$if(Boolean(searchParams.creatorId), (qb) =>
        qb.where('creatorId', '=', searchParams.creatorId),
      )
      .orderBy('rank', 'desc')
      .limit(searchParams.limit | 20)
      .offset(searchParams.offset || 0)
      .execute();

    const searchResults = queryResults.map((result) => {
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
