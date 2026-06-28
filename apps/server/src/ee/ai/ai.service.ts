import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { SearchService } from '../../core/search/search.service';
import { SearchDTO } from '../../core/search/dto/search.dto';
import { AiAction } from './ai.types';

export interface AiGenerateInput {
  action?: AiAction;
  content: string;
  prompt?: string;
}

export interface AiContentResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class AiService {
  constructor(
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly searchService: SearchService,
  ) {}

  private async assertAiEnabled(workspaceId: string) {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    const settings = (workspace?.settings ?? {}) as Record<string, any>;
    if (!settings?.ai?.enabled) {
      throw new ForbiddenException('AI is not enabled for this workspace');
    }
  }

  private buildStubResponse(data: AiGenerateInput): AiContentResponse {
    const action = data.action ?? AiAction.CUSTOM;
    const stub =
      `[AI stub] Action "${action}" received. Configure an LLM provider in workspace AI settings to enable generation.\n\n` +
      `Input:\n${data.content.slice(0, 500)}`;

    return {
      content: stub,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  async generate(
    data: AiGenerateInput,
    workspaceId: string,
  ): Promise<AiContentResponse> {
    await this.assertAiEnabled(workspaceId);
    if (!data.content?.trim()) {
      throw new BadRequestException('Content is required');
    }
    return this.buildStubResponse(data);
  }

  async *generateStream(
    data: AiGenerateInput,
    workspaceId: string,
  ): AsyncGenerator<{ content: string } | { error: string }> {
    await this.assertAiEnabled(workspaceId);
    if (!data.content?.trim()) {
      yield { error: 'Content is required' };
      return;
    }
    const result = this.buildStubResponse(data);
    yield { content: result.content };
  }

  async *answerStream(
    params: SearchDTO,
    opts: { userId: string; workspaceId: string },
  ): AsyncGenerator<
    { content?: string; sources?: unknown[] } | { error: string }
  > {
    await this.assertAiEnabled(opts.workspaceId);
    if (!params.query?.trim()) {
      yield { error: 'Query is required' };
      return;
    }
    const search = await this.searchService.searchPage(params, opts);
    const sources = search.items.slice(0, 5).map((item) => ({
      pageId: item.id,
      title: item.title,
      spaceSlug: item.space?.slug,
      excerpt: item.highlight,
      similarity: item.rank,
    }));
    yield { sources };
    const summary =
      `[AI search stub] Found ${search.items.length} result(s) for "${params.query}". ` +
      'Configure an LLM provider to generate natural-language answers.';
    yield { content: summary };
  }
}
