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
import { extractHeadingsFromContent } from './utils/heading-extractor';

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
    query: string,
    searchParams: SearchDTO,
    opts: {
      userId?: string;
      workspaceId: string;
    },
  ): Promise<SearchResponseDto[]> {
    if (query.length < 1) {
      return;
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
        sql<number>`ts_rank(tsv, to_tsquery(${searchQuery}))`.as('rank'),
        sql<string>`ts_headline('english', text_content, to_tsquery(${searchQuery}),'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
          'highlight',
        ),
      ])
      .where('tsv', '@@', sql<string>`to_tsquery(${searchQuery})`)
      .$if(Boolean(searchParams.creatorId), (qb) =>
        qb.where('creatorId', '=', searchParams.creatorId),
      )
      .orderBy('rank', 'desc')
      .limit(searchParams.limit | 20)
      .offset(searchParams.offset || 0);

    if (!searchParams.shareId) {
      queryResults = queryResults.select((eb) => this.pageRepo.withSpace(eb));
    }

    if (searchParams.spaceId) {
      // search by spaceId
      queryResults = queryResults.where('spaceId', '=', searchParams.spaceId);
    } else if (opts.userId && !searchParams.spaceId) {
      // only search spaces the user is a member of
      const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(
        opts.userId,
      );
      if (userSpaceIds.length > 0) {
        queryResults = queryResults
          .where('spaceId', 'in', userSpaceIds)
          .where('workspaceId', '=', opts.workspaceId);
      } else {
        return [];
      }
    } else if (searchParams.shareId && !searchParams.spaceId && !opts.userId) {
      // search in shares
      const shareId = searchParams.shareId;
      const share = await this.shareRepo.findById(shareId);
      if (!share || share.workspaceId !== opts.workspaceId) {
        return [];
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
        return [];
      }
    } else {
      return [];
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
    const query = suggestion.query.toLowerCase().trim();

    if (suggestion.includeUsers) {
      users = await this.db
        .selectFrom('users')
        .select(['id', 'name', 'avatarUrl'])
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
      // only search spaces the user has access to
      const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

      const pageSearch = await this.db
        .withRecursive('page_ancestors', (db) =>
          db
            .selectFrom('pages')
            .select(['id', 'title', 'parentPageId', 'id as rootId'])
            .where((eb) =>
              eb(sql`LOWER(title)`, 'like', `%${query.toLowerCase()}%`),
            )
            .where('workspaceId', '=', workspaceId)
            .$if(suggestion?.spaceId && userSpaceIds.includes(suggestion.spaceId), (qb) =>
              qb.where('spaceId', '=', suggestion.spaceId),
            )
            // we need this check or the query will throw an error if the userSpaceIds array is empty
            .$if(userSpaceIds?.length > 0, (qb) =>
              qb.where('spaceId', 'in', userSpaceIds),
            )
            .unionAll((db) =>
              db
                .selectFrom('pages')
                .innerJoin(
                  'page_ancestors as pa',
                  'pa.parentPageId',
                  'pages.id',
                )
                .select([
                  'pages.id',
                  'pages.title',
                  'pages.parentPageId',
                  'pa.rootId',
                ]),
            ),
        )
        .selectFrom('page_ancestors as pa')
        .innerJoin('pages', 'pages.id', 'pa.rootId')
        .select([
          'pages.id',
          'pages.slugId',
          'pages.title',
          'pages.icon',
          'pages.spaceId',
          'pages.content',
          sql`COALESCE(json_agg(pa.title ORDER BY pa.id ASC) FILTER (WHERE pa.id != pages.id), '[]')`.as(
            'breadcrumbs',
          ),
        ])
        .groupBy([
          'pages.id',
          'pages.slugId',
          'pages.title',
          'pages.icon',
          'pages.spaceId',
          'pages.content',
        ])
        .limit(limit)
        .execute();

      pages = pageSearch.map((page) => ({
        id: page.id,
        slugId: page.slugId,
        title: page.title,
        icon: page.icon,
        spaceId: page.spaceId,
        breadcrumbs: page.breadcrumbs,
        headings: extractHeadingsFromContent(page.content),
      }));
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
