import { Injectable } from '@nestjs/common';
import { SearchDTO, SearchSuggestionDTO } from './dto/search.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { ExpressionBuilder, sql } from 'kysely';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { ShareRepo } from '@docmost/db/repos/share/share.repo';
import { DB } from '@docmost/db/types/db';

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
  ): Promise<{ items: SearchResponseDto[] }> {
    const { query } = searchParams;

    if (query.length < 1) {
      return { items: [] };
    }
    const searchQuery = tsquery(query.trim() + '*');

    let queryResults = this.db
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
        sql<number>`ts_rank(tsv, to_tsquery('english', f_unaccent(${searchQuery})))`.as(
          'rank',
        ),
        sql<string>`ts_headline('english', text_content, to_tsquery('english', f_unaccent(${searchQuery})),'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
          'highlight',
        ),
      ])
      .where(
        'tsv',
        '@@',
        sql<string>`to_tsquery('english', f_unaccent(${searchQuery}))`,
      )
      .$if(Boolean(searchParams.creatorId), (qb) =>
        qb.where('creatorId', '=', searchParams.creatorId),
      )
      .where('deletedAt', 'is', null)
      .orderBy('rank', 'desc')
      .limit(searchParams.limit || 25)
      .offset(searchParams.offset || 0);

    if (!searchParams.shareId) {
      queryResults = queryResults.select((eb) => this.pageRepo.withSpace(eb));
    }

    if (searchParams.spaceId) {
      // search by spaceId
      queryResults = queryResults.where('spaceId', '=', searchParams.spaceId);
    } else if (opts.userId && !searchParams.spaceId) {
      // only search spaces the user is a member of
      queryResults = queryResults
        .where(
          'spaceId',
          'in',
          this.spaceMemberRepo.getUserSpaceIdsQuery(opts.userId),
        )
        .where('workspaceId', '=', opts.workspaceId);
    } else if (searchParams.shareId && !searchParams.spaceId && !opts.userId) {
      // search in shares
      const shareId = searchParams.shareId;
      const share = await this.shareRepo.findById(shareId);
      if (!share || share.workspaceId !== opts.workspaceId) {
        return { items: [] };
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
        queryResults = queryResults
          .where('id', 'in', pageIdsToSearch)
          .where('workspaceId', '=', opts.workspaceId);
      } else {
        return { items: [] };
      }
    } else {
      return { items: [] };
    }

    //@ts-ignore
    queryResults = await queryResults.execute();

    //@ts-ignore
    const searchResults = queryResults.map((result: SearchResponseDto) => {
      if (result.highlight) {
        result.highlight = result.highlight
          .replace(/\r\n|\r|\n/g, ' ')
          .replace(/\s+/g, ' ');
      }
      return result;
    });

    return { items: searchResults };
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

      for (const page of pages) {
        const childPageId = page.id;
        const ancestors = await this.db
          .withRecursive('page_ancestors', (db) =>
            db
              .selectFrom('pages')
              .select([
                'id',
                'slugId',
                'title',
                'icon',
                'position',
                'parentPageId',
                'spaceId',
              ])
              .select((eb) => this.withHasChildren(eb))
              .where('id', '=', childPageId)
              .unionAll((exp) =>
                exp
                  .selectFrom('pages as p')
                  .select([
                    'p.id',
                    'p.slugId',
                    'p.title',
                    'p.icon',
                    'p.position',
                    'p.parentPageId',
                    'p.spaceId',
                  ])
                  .select(
                    exp
                      .selectFrom('pages as child')
                      .select((eb) =>
                        eb
                          .case()
                          .when(eb.fn.countAll(), '>', 0)
                          .then(true)
                          .else(false)
                          .end()
                          .as('count'),
                      )
                      .whereRef('child.parentPageId', '=', 'id')
                      .limit(1)
                      .as('hasChildren'),
                  )
                  //.select((eb) => this.withHasChildren(eb))
                  .innerJoin('page_ancestors as pa', 'pa.parentPageId', 'p.id'),
              ),
          )
          .selectFrom('page_ancestors')
          .selectAll()
          .execute();

          const breadcrumbs = ancestors.slice(1).reverse().map(p => p.title);
          page.breadcrumbs = breadcrumbs;
      }
    }

    return { users, groups, pages };
  }

  withHasChildren(eb: ExpressionBuilder<DB, 'pages'>) {
    return eb
      .selectFrom('pages as child')
      .select((eb) =>
        eb
          .case()
          .when(eb.fn.countAll(), '>', 0)
          .then(true)
          .else(false)
          .end()
          .as('count'),
      )
      .whereRef('child.parentPageId', '=', 'pages.id')
      .limit(1)
      .as('hasChildren');
  }
}
