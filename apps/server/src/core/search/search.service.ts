import { Injectable } from '@nestjs/common';
import { SearchDTO, SearchSuggestionDTO } from './dto/search.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsquery = require('pg-tsquery')();

@Injectable()
export class SearchService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private pageRepo: PageRepo,
    private spaceMemberRepo: SpaceMemberRepo,
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
        'slugId',
        'title',
        'icon',
        'parentPageId',
        'creatorId',
        'createdAt',
        'updatedAt',
        sql<number>`ts_rank(tsv, to_tsquery(${searchQuery}))`.as('rank'),
        sql<string>`ts_headline('english', text_content, to_tsquery(${searchQuery}),'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
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
    userId: string,
    workspaceId: string,
  ) {
    let users = [];
    let groups = [];
    let pages = [];

    const limit = suggestion?.limit || 10;

    if (suggestion.includeUsers) {
      users = await this.db
        .selectFrom('users')
        .select(['id', 'name', 'avatarUrl'])
        .where((eb) =>
          eb(
            sql`LOWER(users.name)`,
            'like',
            `%${suggestion.query.toLowerCase().trim()}%`,
          ),
        )
        .where('workspaceId', '=', workspaceId)
        .limit(limit)
        .execute();
    }

    if (suggestion.includeGroups) {
      groups = await this.db
        .selectFrom('groups')
        .select(['id', 'name', 'description'])
        .where((eb) =>
          eb(
            sql`LOWER(groups.name)`,
            'like',
            `%${suggestion.query.toLowerCase().trim()}%`,
          ),
        )
        .where('workspaceId', '=', workspaceId)
        .limit(limit)
        .execute();
    }

    if (suggestion.includePages) {
      const searchQuery = tsquery(suggestion.query.trim() + '*');
      let hasSpaceId = true;

      let pageSearch = this.db
        .selectFrom('pages')
        .select([
          'id',
          'slugId',
          'title',
          'icon',
          'spaceId',
          sql<number>`ts_rank(tsv, to_tsquery(${searchQuery}))`.as('rank'),
        ])
        .where('tsv', '@@', sql<string>`to_tsquery(${searchQuery})`)
        .orderBy('rank', 'desc')
        .where('workspaceId', '=', workspaceId)
        .limit(limit);

      if (suggestion.spaceId) {
        pageSearch = pageSearch.where('spaceId', '=', suggestion.spaceId);
      } else {
        // only search spaces the user has access to
        const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

        // we need this check or the query will throw an error if the userSpaceIds array is empty
        if (userSpaceIds.length > 0) {
          // make sure users can only search pages they have access to
          pageSearch = pageSearch.where('spaceId', 'in', userSpaceIds);
        } else {
          hasSpaceId = false;
        }
      }
      if (hasSpaceId) {
        pages = await pageSearch.execute();
      }
    }

    return { users, groups, pages };
  }
}
