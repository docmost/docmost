import { AiIndexingService } from './ai-indexing.service';

// chainable kysely stub for the workspace settings lookup in isEnabled()
function dbReturning(settings: unknown) {
  return {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          executeTakeFirst: async () => ({ settings }),
        }),
      }),
    }),
  } as any;
}

describe('AiIndexingService', () => {
  let embeddingRepo: any;
  let provider: any;
  let environmentService: any;

  beforeEach(() => {
    embeddingRepo = {
      deleteByPageIds: jest.fn().mockResolvedValue(undefined),
      deleteByWorkspace: jest.fn().mockResolvedValue(undefined),
      replacePageChunks: jest.fn().mockResolvedValue(undefined),
      listWorkspacePageIds: jest.fn().mockResolvedValue([]),
    };
    provider = {
      isEmbeddingConfigured: jest.fn().mockReturnValue(true),
      embeddingModel: jest.fn().mockReturnValue({}),
      embeddingDimension: jest.fn().mockReturnValue(1536),
    };
    environmentService = {
      getAiEmbeddingModel: jest.fn().mockReturnValue('text-embedding-3-small'),
    };
  });

  const make = (settings: unknown) =>
    new AiIndexingService(
      dbReturning(settings),
      embeddingRepo,
      provider,
      environmentService,
    );

  describe('isEnabled', () => {
    it('is false when embeddings are not configured (no db hit)', async () => {
      provider.isEmbeddingConfigured.mockReturnValue(false);
      const svc = make({ ai: { search: true } });
      expect(await svc.isEnabled('ws-1')).toBe(false);
    });

    it('is false when the workspace has AI Search off', async () => {
      const svc = make({ ai: { search: false } });
      expect(await svc.isEnabled('ws-1')).toBe(false);
    });

    it('is true when configured and AI Search is on', async () => {
      const svc = make({ ai: { search: true } });
      expect(await svc.isEnabled('ws-1')).toBe(true);
    });
  });

  describe('embedPages', () => {
    it('no-ops (no embed, no write) when disabled', async () => {
      const svc = make({ ai: { search: false } });
      await svc.embedPages(['p1'], 'ws-1');
      expect(provider.embeddingModel).not.toHaveBeenCalled();
      expect(embeddingRepo.replacePageChunks).not.toHaveBeenCalled();
    });

    it('no-ops for an empty page list', async () => {
      const svc = make({ ai: { search: true } });
      await svc.embedPages([], 'ws-1');
      expect(provider.embeddingModel).not.toHaveBeenCalled();
    });
  });

  describe('delete paths', () => {
    it('deletePages delegates to the repo', async () => {
      const svc = make({});
      await svc.deletePages(['p1', 'p2']);
      expect(embeddingRepo.deleteByPageIds).toHaveBeenCalledWith(['p1', 'p2']);
    });

    it('deleteWorkspace delegates to the repo', async () => {
      const svc = make({});
      await svc.deleteWorkspace('ws-9');
      expect(embeddingRepo.deleteByWorkspace).toHaveBeenCalledWith('ws-9');
    });

    it('backfill no-ops when disabled', async () => {
      const svc = make({ ai: { search: false } });
      await svc.backfillWorkspace('ws-1');
      expect(embeddingRepo.listWorkspacePageIds).not.toHaveBeenCalled();
    });
  });
});
