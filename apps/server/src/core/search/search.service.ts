import { Injectable } from '@nestjs/common';
import { SearchDTO, SearchSuggestionDTO } from './dto/search.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import { PageRepo } from '@docmost/db/repos/page/page.repo';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsquery = require('pg-tsquery')();

@Injectable()
export class SearchService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private pageRepo: PageRepo,
  ) {}

  async searchPage(
    query: string,
    searchParams: SearchDTO,
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
        'slugId',
        'creatorId',
        'createdAt',
        'updatedAt',
        sql<number>`ts_rank(tsv, to_tsquery(${searchQuery}))`.as('rank'),
        sql<string>`ts_headline('english', text_content, to_tsquery(${searchQuery}), 'MinWords=9, MaxWords=10, MaxFragments=10')`.as(
          'highlight',
        ),
      ])
      .select((eb) => this.pageRepo.withSpace(eb))
      .where('spaceId', '=', searchParams.spaceId)
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

  async searchSuggestions(
    suggestion: SearchSuggestionDTO,
    workspaceId: string,
  ) {
    const limit = 25;

    const userSearch = this.db
      .selectFrom('users')
      .select(['id', 'name', 'avatarUrl'])
      .where((eb) => eb('users.name', 'ilike', `%${suggestion.query}%`))
      .where('workspaceId', '=', workspaceId)
      .limit(limit);

    const groupSearch = this.db
      .selectFrom('groups')
      .select(['id', 'name', 'description'])
      .where((eb) => eb('groups.name', 'ilike', `%${suggestion.query}%`))
      .where('workspaceId', '=', workspaceId)
      .limit(limit);

    let users = [];
    let groups = [];

    if (suggestion.includeUsers) {
      users = await userSearch.execute();
    }

    if (suggestion.includeGroups) {
      groups = await groupSearch.execute();
    }

    return { users, groups };
  }
}
