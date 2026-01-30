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

  async searchPage(
    searchParams: SearchDTO,
    opts: {
      userId?: string;
      workspaceId: string;
    },
  ): Promise<SearchResponseDto[]> {
    const { query } = searchParams;

    if (query.length < 1) {
      return [];
    }
    const searchQuery = tsquery(query.trim() + '*');
    const limit = searchParams.limit || 25;
    const offset = searchParams.offset || 0;
    const includeSpace = !searchParams.shareId;

    // Handle share search - resolve page IDs first
    let sharePageIds: string[] | null = null;
    if (searchParams.shareId && !searchParams.spaceId && !opts.userId) {
      const share = await this.shareRepo.findById(searchParams.shareId);
      if (!share || share.workspaceId !== opts.workspaceId) {
        return [];
      }

      if (share.includeSubPages) {
        const pageList = await this.pageRepo.getPageAndDescendants(
          share.pageId,
          { includeContent: false },
        );
        sharePageIds = pageList.map((page) => page.id);
      } else {
        sharePageIds = [share.pageId];
      }

      if (sharePageIds.length === 0) {
        return [];
      }
    } else if (!searchParams.spaceId && !opts.userId) {
      return [];
    }

    // CTE to get top N page IDs by rank (without expensive ts_headline)
    // Join back to compute ts_headline only for those N rows
    const tsQuery = sql<string>`to_tsquery('english', f_unaccent(${searchQuery}))`;

    const queryResults = await this.db
      .with('ranked_pages', (db) => {
        let rankQuery = db
          .selectFrom('pages')
          .select(['id', sql<number>`ts_rank(tsv, ${tsQuery})`.as('rank')])
          .where('tsv', '@@', tsQuery)
          .where('deletedAt', 'is', null)
          .$if(Boolean(searchParams.creatorId), (qb) =>
            qb.where('creatorId', '=', searchParams.creatorId),
          );

        if (searchParams.spaceId) {
          rankQuery = rankQuery.where('spaceId', '=', searchParams.spaceId);
        } else if (opts.userId) {
          rankQuery = rankQuery
            .where(
              'spaceId',
              'in',
              this.spaceMemberRepo.getUserSpaceIdsQuery(opts.userId),
            )
            .where('workspaceId', '=', opts.workspaceId);
        } else if (sharePageIds) {
          rankQuery = rankQuery
            .where('id', 'in', sharePageIds)
            .where('workspaceId', '=', opts.workspaceId);
        }

        return rankQuery.orderBy('rank', 'desc').limit(limit).offset(offset);
      })
      .selectFrom('ranked_pages')
      .innerJoin('pages', 'pages.id', 'ranked_pages.id')
      .select([
        'pages.id',
        'pages.slugId',
        'pages.title',
        'pages.icon',
        'pages.parentPageId',
        'pages.creatorId',
        'pages.createdAt',
        'pages.updatedAt',
        'ranked_pages.rank',
        sql<string>`ts_headline('english', pages.text_content, ${tsQuery}, 'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
          'highlight',
        ),
      ])
      .$if(includeSpace, (qb) =>
        qb.innerJoin('spaces', 'spaces.id', 'pages.spaceId').select(
          sql<{
            id: string;
            name: string;
            slug: string;
          }>`jsonb_build_object('id', spaces.id, 'name', spaces.name, 'slug', spaces.slug)`.as(
            'space',
          ),
        ),
      )
      .orderBy('ranked_pages.rank', 'desc')
      .execute();

    return queryResults.map((result) => {
      const mapped = result as unknown as SearchResponseDto;
      if (mapped.highlight) {
        mapped.highlight = mapped.highlight
          .replace(/\r\n|\r|\n/g, ' ')
          .replace(/\s+/g, ' ');
      }
      return mapped;
    });
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
      const userQuery = this.db
        .selectFrom('users')
        .select(['id', 'name', 'email', 'avatarUrl'])
        .where('workspaceId', '=', workspaceId)
        .where('deletedAt', 'is', null)
        .where((eb) =>
          eb.or([
            eb(
              sql`LOWER(f_unaccent(users.name))`,
              'like',
              sql`LOWER(f_unaccent(${`%${query}%`}))`,
            ),
            eb(sql`users.email`, 'ilike', sql`f_unaccent(${`%${query}%`})`),
          ]),
        )
        .limit(limit);

      users = await userQuery.execute();
    }

    if (suggestion.includeGroups) {
      groups = await this.db
        .selectFrom('groups')
        .select(['id', 'name', 'description'])
        .where((eb) =>
          eb(
            sql`LOWER(f_unaccent(groups.name))`,
            'like',
            sql`LOWER(f_unaccent(${`%${query}%`}))`,
          ),
        )
        .where('workspaceId', '=', workspaceId)
        .limit(limit)
        .execute();
    }

    if (suggestion.includePages) {
      let pageSearch = this.db
        .selectFrom('pages')
        .select(['id', 'slugId', 'title', 'icon', 'spaceId'])
        .where((eb) =>
          eb(
            sql`LOWER(f_unaccent(pages.title))`,
            'like',
            sql`LOWER(f_unaccent(${`%${query}%`}))`,
          ),
        )
        .where('deletedAt', 'is', null)
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
