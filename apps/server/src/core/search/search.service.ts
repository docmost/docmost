import { Injectable } from '@nestjs/common';
import { SearchDTO, SearchSuggestionDTO } from './dto/search.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { ShareRepo } from '@docmost/db/repos/share/share.repo';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsquery = require('pg-tsquery')();

@Injectable()
export class SearchService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private pageRepo: PageRepo,
    private shareRepo: ShareRepo,
    private spaceMemberRepo: SpaceMemberRepo,
  ) {}

  async buildSearchQuery(
    searchQuery: string,
    searchParams: SearchDTO,
    opts: {
      userId?: string;
      workspaceId: string;
    },
    type: 'fts' | 'fuzzy',
  ) {
    let query = this.db
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
      ])
      .$if(Boolean(searchParams.creatorId), (qb) =>
        qb.where('creatorId', '=', searchParams.creatorId),
      )
      .limit(searchParams.limit ?? 20)
      .offset(searchParams.offset ?? 0);

    if (type === 'fts') {
      query = query
        .select([
          sql<number>`ts_rank(tsv, to_tsquery(${searchQuery}))`.as('rank'),
          sql<string>`ts_headline('english', text_content, to_tsquery(${searchQuery}),'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
            'highlight',
          ),
        ])
        .where('tsv', '@@', sql<string>`to_tsquery(${searchQuery})`)
        .orderBy('rank', 'desc');
    } else if (type === 'fuzzy') {
      query = query
        .select([
          sql<string>`regexp_replace(text_content, ${searchQuery}, '<b>\\&</b>', 'gi')`.as(
            'highlight',
          ),
          sql<number>`similarity(text_content, ${searchQuery}) > 0.1`.as(
            'similarity',
          ),
        ])
        .where((eb) =>
          eb.or([
            sql<boolean>`similarity(text_content, ${searchQuery}) > 0.1`,
            sql<boolean>`text_content ILIKE '%' || ${searchQuery} || '%'`,
          ]),
        );
    }

    if (!searchParams.shareId) {
      query = query.select((eb) => this.pageRepo.withSpace(eb));
    }

    if (searchParams.spaceId) {
      // search by spaceId
      query = query.where('spaceId', '=', searchParams.spaceId);
    } else if (opts.userId && !searchParams.spaceId) {
      // only search spaces the user is a member of
      const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(
        opts.userId,
      );
      if (userSpaceIds.length > 0) {
        query = query
          .where('spaceId', 'in', userSpaceIds)
          .where('workspaceId', '=', opts.workspaceId);
      } else {
        return null;
      }
    } else if (searchParams.shareId && !searchParams.spaceId && !opts.userId) {
      // search in shares
      const shareId = searchParams.shareId;
      const share = await this.shareRepo.findById(shareId);
      if (!share || share.workspaceId !== opts.workspaceId) {
        return null;
      }

      const pageIdsToSearch = [];
      if (share.includeSubPages) {
        const pageList = await this.pageRepo.getPageAndDescendants(
          share.pageId,
          {
            includeContent: false,
          },
        );

        pageIdsToSearch.push(...pageList.map((page) => page.id));
      } else {
        pageIdsToSearch.push(share.pageId);
      }

      if (pageIdsToSearch.length > 0) {
        query = query
          .where('id', 'in', pageIdsToSearch)
          .where('workspaceId', '=', opts.workspaceId);
      } else {
        return null;
      }
    } else {
      return null;
    }

    return {
      query,
    };
  }

  async searchPage(
    query: string,
    searchParams: SearchDTO,
    opts: {
      userId?: string;
      workspaceId: string;
    },
  ): Promise<SearchResponseDto[]> {
    if (!query || query.trim().length < 1) return [];

    const trimmedQuery = query.trim();
    const ftsQuery = tsquery(trimmedQuery + '*');

    const { query: ftsQueryBuilder } = await this.buildSearchQuery(
      ftsQuery,
      searchParams,
      opts,
      'fts',
    );

    if (!ftsQueryBuilder) return [];

    const ftsResults = await ftsQueryBuilder.execute();

    if (ftsResults.length > 0) {
      // @ts-expect-error
      return ftsResults.map((result: SearchResponseDto) => {
        if (result.highlight) {
          result.highlight = result.highlight
            .replace(/\r\n|\r|\n/g, ' ')
            .replace(/\s+/g, ' ');
        }
        return result;
      }) as unknown as SearchResponseDto[];
    }

    // Fuzzy fallback
    const { query: fuzzyQueryBuilder } = await this.buildSearchQuery(
      trimmedQuery,
      searchParams,
      opts,
      'fuzzy',
    );

    if (!fuzzyQueryBuilder) return [];

    const fuzzyResults = await fuzzyQueryBuilder.execute();

    return fuzzyResults as unknown as SearchResponseDto[];
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
    const query = suggestion.query.toLowerCase().trim();

    if (suggestion.includeUsers) {
      users = await this.db
        .selectFrom('users')
        .select(['id', 'name', 'email', 'avatarUrl'])
        .where((eb) => eb(sql`LOWER(users.name)`, 'like', `%${query}%`))
        .where('workspaceId', '=', workspaceId)
        .where('deletedAt', 'is', null)
        .limit(limit)
        .execute();
    }

    if (suggestion.includeGroups) {
      groups = await this.db
        .selectFrom('groups')
        .select(['id', 'name', 'description'])
        .where((eb) => eb(sql`LOWER(groups.name)`, 'like', `%${query}%`))
        .where('workspaceId', '=', workspaceId)
        .limit(limit)
        .execute();
    }

    if (suggestion.includePages) {
      let pageSearch = this.db
        .selectFrom('pages')
        .select(['id', 'slugId', 'title', 'icon', 'spaceId'])
        .where((eb) => eb(sql`LOWER(pages.title)`, 'like', `%${query}%`))
        .where('workspaceId', '=', workspaceId)
        .limit(limit);

      // only search spaces the user has access to
      const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

      if (suggestion?.spaceId) {
        if (userSpaceIds.includes(suggestion.spaceId)) {
          pageSearch = pageSearch.where('spaceId', '=', suggestion.spaceId);
          pages = await pageSearch.execute();
        }
      } else if (userSpaceIds?.length > 0) {
        // we need this check or the query will throw an error if the userSpaceIds array is empty
        pageSearch = pageSearch.where('spaceId', 'in', userSpaceIds);
        pages = await pageSearch.execute();
      }
    }

    return { users, groups, pages };
  }
}
