import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { embed, streamText } from 'ai';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { EmbeddingRepo } from '@docmost/db/repos/embedding/embedding.repo';
import { AiProviderService } from './ai-provider.service';

export interface AiAnswerSource {
  pageId: string;
  title: string | null;
  slugId: string;
  spaceSlug: string;
  similarity: number;
  distance: number;
  chunkIndex: number;
  excerpt: string;
}

const TOP_K = 8;

@Injectable()
export class AiAnswerService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly embeddingRepo: EmbeddingRepo,
    private readonly aiProviderService: AiProviderService,
  ) {}

  isConfigured(): boolean {
    return (
      this.aiProviderService.isEmbeddingConfigured() &&
      this.aiProviderService.isConfigured()
    );
  }

  /**
   * Embeds the query, runs an ANN search scoped to the caller's accessible
   * spaces, and builds grounded context + a deduped source list (highest
   * similarity per page).
   */
  async retrieve(
    query: string,
    opts: { userId: string; workspaceId: string; spaceId?: string },
  ): Promise<{ sources: AiAnswerSource[]; context: string }> {
    let spaceIds = await this.spaceMemberRepo.getUserSpaceIds(opts.userId);
    if (opts.spaceId) {
      spaceIds = spaceIds.filter((id) => id === opts.spaceId);
    }
    if (spaceIds.length === 0) return { sources: [], context: '' };

    const { embedding } = await embed({
      model: this.aiProviderService.embeddingModel(),
      value: query,
    });

    const rows = await this.embeddingRepo.search(opts.workspaceId, embedding, {
      spaceIds,
      limit: TOP_K,
    });
    if (rows.length === 0) return { sources: [], context: '' };

    const pageIds = [...new Set(rows.map((r) => r.pageId))];
    const pages = await this.db
      .selectFrom('pages')
      .select(['id', 'textContent'])
      .where('id', 'in', pageIds)
      .execute();
    const textById = new Map(pages.map((p) => [p.id, p.textContent ?? '']));

    const excerptOf = (pageId: string, start: number, length: number) => {
      const text = textById.get(pageId) ?? '';
      const slice = text.slice(start, start + length).trim();
      return slice || text.slice(0, 200).trim();
    };

    const sources: AiAnswerSource[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      if (seen.has(r.pageId)) continue;
      seen.add(r.pageId);
      sources.push({
        pageId: r.pageId,
        title: r.title,
        slugId: r.slugId,
        spaceSlug: r.spaceSlug,
        similarity: 1 - r.distance,
        distance: r.distance,
        chunkIndex: r.chunkIndex,
        excerpt: excerptOf(r.pageId, r.chunkStart, r.chunkLength),
      });
    }

    const context = rows
      .map((r, i) => {
        const excerpt = excerptOf(r.pageId, r.chunkStart, r.chunkLength);
        return `[${i + 1}] ${r.title ?? 'Untitled'}\n${excerpt}`;
      })
      .join('\n\n');

    return { sources, context };
  }

  async *streamAnswer(query: string, context: string): AsyncGenerator<string> {
    const model = this.aiProviderService.completionModel();
    const system =
      'You are a helpful assistant answering questions about a wiki. Use ONLY the provided context. ' +
      'If the answer is not contained in the context, say you do not know. ' +
      'Cite sources inline using their [n] markers.';
    const user = context
      ? `Context:\n${context}\n\nQuestion: ${query}`
      : `Question: ${query}\n\n(No relevant wiki context was found.)`;

    const result = streamText({ model, system, prompt: user });
    for await (const delta of result.textStream) {
      yield delta;
    }
  }
}
