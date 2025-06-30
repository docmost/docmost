import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { ShareRepo } from '@docmost/db/repos/share/share.repo';
import { VectorService } from './vector.service';
import { EmbeddingService } from './embedding.service';
import { RedisVectorService } from './redis-vector.service';
import {
  SemanticSearchDto,
  SemanticSearchResponseDto,
  HybridSearchResponseDto,
  ReindexDto,
} from '../dto/semantic-search.dto';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsquery = require('pg-tsquery')();

@Injectable()
export class AiSearchService {
  private readonly logger = new Logger(AiSearchService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageRepo: PageRepo,
    private readonly shareRepo: ShareRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly vectorService: VectorService,
    private readonly embeddingService: EmbeddingService,
    private readonly redisVectorService: RedisVectorService,
  ) {}

  async semanticSearch(
    query: string,
    searchParams: SemanticSearchDto,
    opts: {
      userId?: string;
      workspaceId: string;
    },
  ): Promise<SemanticSearchResponseDto[]> {
    if (query.length < 1) {
      return [];
    }

    try {
      // Generate embedding for the query
      const queryEmbedding =
        await this.embeddingService.generateEmbedding(query);

      // Get page IDs that user has access to
      const accessiblePageIds = await this.getAccessiblePageIds(
        searchParams,
        opts,
      );

      console.log('accessible', accessiblePageIds);

      if (accessiblePageIds.length === 0) {
        return [];
      }

      // Perform vector search
      const vectorResults = await this.redisVectorService.searchSimilar(
        queryEmbedding,
        {
          limit: searchParams.limit || 20,
          offset: searchParams.offset || 0,
          threshold: searchParams.similarity_threshold || 0.7,
          filters: {
            workspace_id: opts.workspaceId,
            page_ids: accessiblePageIds,
          },
        },
      );

      console.log('vectorResults', vectorResults);

      if (vectorResults.length === 0) {
        return [];
      }

      // Get page details from database
      const pageIds = vectorResults.map((result) => result.pageId);
      const pages = await this.getPageDetails(pageIds, searchParams);

      // Combine vector results with page details
      const results = this.combineVectorResultsWithPages(
        vectorResults,
        pages,
        query,
        searchParams.include_highlights,
      );

      return results;
    } catch (error) {
      this.logger.error(`Semantic search failed: ${error?.['message']}`, error);
      throw error;
    }
  }

  async hybridSearch(
    query: string,
    searchParams: SemanticSearchDto,
    opts: {
      userId?: string;
      workspaceId: string;
    },
  ): Promise<HybridSearchResponseDto[]> {
    if (query.length < 1) {
      return [];
    }

    try {
      // Run both semantic and text search in parallel
      const [semanticResults, textResults] = await Promise.all([
        this.semanticSearch(query, searchParams, opts),
        this.performTextSearch(query, searchParams, opts),
      ]);

      // Combine and rank results
      const hybridResults = this.combineHybridResults(
        semanticResults,
        textResults,
        query,
      );

      return hybridResults;
    } catch (error) {
      this.logger.error(`Hybrid search failed: ${error?.['message']}`, error);
      throw error;
    }
  }

  async reindexPages(
    params: ReindexDto,
  ): Promise<{ indexed: number; errors?: string[] }> {
    try {
      let query = this.db
        .selectFrom('pages')
        .select(['id', 'title', 'textContent'])
        .where('workspaceId', '=', params.workspaceId)
        .where('deletedAt', 'is', null);

      if (params.spaceId) {
        query = query.where('spaceId', '=', params.spaceId);
      }

      if (params.pageIds && params.pageIds.length > 0) {
        query = query.where('id', 'in', params.pageIds);
      }

      const pages = await query.execute();

      const results = await Promise.allSettled(
        pages.map(async (page) => {
          const content =
            `${page.title || ''} ${page.textContent || ''}`.trim();
          if (!content) return null;

          const embedding =
            await this.embeddingService.generateEmbedding(content);

          await this.redisVectorService.indexPage({
            pageId: page.id,
            embedding,
            metadata: {
              title: page.title,
              workspaceId: params.workspaceId,
            },
          });

          return page.id;
        }),
      );

      const indexed = results.filter(
        (r) => r.status === 'fulfilled' && r.value,
      ).length;
      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => r.reason.message);

      this.logger.log(
        `Reindexed ${indexed} pages for workspace ${params.workspaceId}`,
      );

      return { indexed, errors: errors.length > 0 ? errors : undefined };
    } catch (error) {
      this.logger.error(`Reindexing failed: ${error?.['message']}`, error);
      throw error;
    }
  }

  private async getAccessiblePageIds(
    searchParams: SemanticSearchDto,
    opts: { userId?: string; workspaceId: string },
  ): Promise<string[]> {
    if (searchParams.shareId) {
      // Handle shared pages
      const share = await this.shareRepo.findById(searchParams.shareId);
      if (!share || share.workspaceId !== opts.workspaceId) {
        return [];
      }

      const pageIdsToSearch = [];
      if (share.includeSubPages) {
        const pageList = await this.pageRepo.getPageAndDescendants(
          share.pageId,
          { includeContent: false },
        );
        pageIdsToSearch.push(...pageList.map((page) => page.id));
      } else {
        pageIdsToSearch.push(share.pageId);
      }

      return pageIdsToSearch;
    }

    if (searchParams.spaceId) {
      // Get pages from specific space
      const pages = await this.db
        .selectFrom('pages')
        .select('id')
        .where('spaceId', '=', searchParams.spaceId)
        .where('workspaceId', '=', opts.workspaceId)
        .where('deletedAt', 'is', null)
        .execute();

      return pages.map((p) => p.id);
    }

    if (opts.userId) {
      // Get pages from user's accessible spaces
      const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(
        opts.userId,
      );
      if (userSpaceIds.length === 0) {
        return [];
      }

      const pages = await this.db
        .selectFrom('pages')
        .select('id')
        .where('spaceId', 'in', userSpaceIds)
        .where('workspaceId', '=', opts.workspaceId)
        .where('deletedAt', 'is', null)
        .execute();

      return pages.map((p) => p.id);
    }

    return [];
  }

  private async getPageDetails(
    pageIds: string[],
    searchParams: SemanticSearchDto,
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
        'textContent',
      ]);

    if (!searchParams.shareId) {
      query = query.select((eb) => this.pageRepo.withSpace(eb));
    }

    const pages = await query
      .where('id', 'in', pageIds)
      .where('deletedAt', 'is', null)
      .execute();

    return pages;
  }

  private combineVectorResultsWithPages(
    vectorResults: any[],
    pages: any[],
    query: string,
    includeHighlights: boolean = true,
  ): SemanticSearchResponseDto[] {
    const pageMap = new Map(pages.map((p) => [p.id, p]));

    return vectorResults
      .map((result, index) => {
        const page = pageMap.get(result.pageId);
        if (!page) return null;

        let highlight = '';
        if (includeHighlights && page.textContent) {
          highlight = this.generateHighlight(page.textContent, query);
        }

        return {
          id: page.id,
          title: page.title,
          icon: page.icon,
          parentPageId: page.parentPageId,
          creatorId: page.creatorId,
          similarity_score: result.score,
          semantic_rank: index + 1,
          highlight,
          createdAt: page.createdAt,
          updatedAt: page.updatedAt,
          space: page.space
            ? {
                id: page.space.id,
                name: page.space.name,
                slug: page.space.slug,
              }
            : undefined,
        };
      })
      .filter(Boolean);
  }

  private async performTextSearch(
    query: string,
    searchParams: SemanticSearchDto,
    opts: { userId?: string; workspaceId: string },
  ) {
    const searchQuery = tsquery(query.trim() + '*');
    const accessiblePageIds = await this.getAccessiblePageIds(
      searchParams,
      opts,
    );

    if (accessiblePageIds.length === 0) {
      return [];
    }

    const results = await this.db
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
        sql<number>`ts_rank(tsv, to_tsquery(${searchQuery}))`.as('text_rank'),
        sql<string>`ts_headline('english', text_content, to_tsquery(${searchQuery}),'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
          'highlight',
        ),
      ])
      .where('tsv', '@@', sql<string>`to_tsquery(${searchQuery})`)
      .where('id', 'in', accessiblePageIds)
      .orderBy('text_rank', 'desc')
      .limit(searchParams.limit || 20)
      .execute();

    return results.map((result) => ({
      ...result,
      text_rank: result.text_rank,
      search_type: 'text' as const,
    }));
  }

  private combineHybridResults(
    semanticResults: SemanticSearchResponseDto[],
    textResults: any[],
    query: string,
  ): HybridSearchResponseDto[] {
    const combinedMap = new Map<string, HybridSearchResponseDto>();

    // Add semantic results
    semanticResults.forEach((result, index) => {
      combinedMap.set(result.id, {
        ...result,
        text_rank: undefined,
        combined_score: result.similarity_score * 0.7, // Weight semantic results
        search_type: 'semantic',
      });
    });

    // Add text results or combine with existing
    textResults.forEach((result, index) => {
      const existing = combinedMap.get(result.id);
      if (existing) {
        // Combine scores
        existing.combined_score =
          existing.similarity_score * 0.7 + result.text_rank * 0.3;
        existing.text_rank = result.text_rank;
        existing.search_type = 'hybrid';
      } else {
        combinedMap.set(result.id, {
          id: result.id,
          title: result.title,
          icon: result.icon,
          parentPageId: result.parentPageId,
          creatorId: result.creatorId,
          similarity_score: 0,
          semantic_rank: 0,
          text_rank: result.text_rank,
          combined_score: result.text_rank * 0.3,
          highlight: result.highlight,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
          search_type: 'text',
        });
      }
    });

    // Sort by combined score
    return Array.from(combinedMap.values())
      .sort((a, b) => b.combined_score - a.combined_score)
      .slice(0, 20);
  }

  private generateHighlight(content: string, query: string): string {
    if (!content) return '';

    const words = query.toLowerCase().split(/\s+/);
    const sentences = content.split(/[.!?]+/);

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (words.some((word) => lowerSentence.includes(word))) {
        return sentence.trim().substring(0, 200) + '...';
      }
    }

    return content.substring(0, 200) + '...';
  }
}
