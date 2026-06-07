jest.mock('ai', () => ({
  embed: jest.fn().mockResolvedValue({ embedding: [0.1, 0.2, 0.3] }),
  streamText: jest.fn(),
}));

import { AiAnswerService } from './ai-answer.service';

function dbWithPages(pages: Array<{ id: string; textContent: string }>) {
  return {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          execute: async () => pages,
        }),
      }),
    }),
  } as any;
}

describe('AiAnswerService.retrieve', () => {
  let spaceMemberRepo: any;
  let embeddingRepo: any;
  let provider: any;

  beforeEach(() => {
    spaceMemberRepo = {
      getUserSpaceIds: jest.fn().mockResolvedValue(['s1', 's2']),
    };
    embeddingRepo = { search: jest.fn() };
    provider = {
      isEmbeddingConfigured: jest.fn().mockReturnValue(true),
      isConfigured: jest.fn().mockReturnValue(true),
      embeddingModel: jest.fn().mockReturnValue({}),
      completionModel: jest.fn().mockReturnValue({}),
    };
  });

  const make = (pages: any[]) =>
    new AiAnswerService(
      dbWithPages(pages),
      spaceMemberRepo,
      embeddingRepo,
      provider,
    );

  it('returns empty when the user has no accessible spaces', async () => {
    spaceMemberRepo.getUserSpaceIds.mockResolvedValue([]);
    const svc = make([]);
    const res = await svc.retrieve('q', { userId: 'u', workspaceId: 'w' });
    expect(res).toEqual({ sources: [], context: '' });
    expect(embeddingRepo.search).not.toHaveBeenCalled();
  });

  it('filters the space scope when spaceId is given', async () => {
    embeddingRepo.search.mockResolvedValue([]);
    const svc = make([]);
    await svc.retrieve('q', { userId: 'u', workspaceId: 'w', spaceId: 's2' });
    expect(embeddingRepo.search).toHaveBeenCalledWith(
      'w',
      [0.1, 0.2, 0.3],
      expect.objectContaining({ spaceIds: ['s2'] }),
    );
  });

  it('dedups sources per page (highest similarity first) and slices excerpts', async () => {
    embeddingRepo.search.mockResolvedValue([
      { pageId: 'p1', chunkIndex: 0, chunkStart: 0, chunkLength: 5, distance: 0.1, title: 'A', slugId: 'a', spaceId: 's1', spaceSlug: 'sp1' },
      { pageId: 'p1', chunkIndex: 1, chunkStart: 6, chunkLength: 5, distance: 0.3, title: 'A', slugId: 'a', spaceId: 's1', spaceSlug: 'sp1' },
      { pageId: 'p2', chunkIndex: 0, chunkStart: 0, chunkLength: 4, distance: 0.2, title: 'B', slugId: 'b', spaceId: 's1', spaceSlug: 'sp1' },
    ]);
    const svc = make([
      { id: 'p1', textContent: 'hello world here' },
      { id: 'p2', textContent: 'docs content' },
    ]);

    const { sources, context } = await svc.retrieve('q', {
      userId: 'u',
      workspaceId: 'w',
    });

    // one source per page
    expect(sources.map((s) => s.pageId)).toEqual(['p1', 'p2']);
    // similarity = 1 - distance, from the first (best) chunk of p1
    expect(sources[0]).toMatchObject({
      pageId: 'p1',
      distance: 0.1,
      excerpt: 'hello',
    });
    expect(sources[0].similarity).toBeCloseTo(0.9);
    // context includes all retrieved chunks, numbered
    expect(context).toContain('[1] A');
    expect(context).toContain('[3] B');
  });
});
