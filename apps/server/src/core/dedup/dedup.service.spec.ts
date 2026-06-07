import { BadRequestException } from '@nestjs/common';
import { DedupService } from './dedup.service';

describe('DedupService', () => {
  let service: DedupService;
  let dedupRepo: any;
  const workspaceId = 'ws-1';

  beforeEach(() => {
    dedupRepo = {
      listPagesForHashing: jest.fn(),
      upsertHash: jest.fn().mockResolvedValue(undefined),
    };
    service = new DedupService(dedupRepo);
  });

  const page = (over: Partial<any>) => ({
    id: 'p',
    title: 't',
    slugId: 's',
    spaceId: 'space-1',
    textContent: 'content',
    createdAt: new Date('2026-01-01'),
    ...over,
  });

  describe('analyze', () => {
    it('groups pages with identical normalized content and recommends keeping the oldest', async () => {
      dedupRepo.listPagesForHashing.mockResolvedValue([
        page({ id: 'a', textContent: 'Hello World', createdAt: new Date('2026-01-03') }),
        page({ id: 'b', textContent: '  hello   world ', createdAt: new Date('2026-01-01') }),
        page({ id: 'c', textContent: 'unique text', createdAt: new Date('2026-01-02') }),
      ]);

      const result = await service.analyze(workspaceId);

      expect(result.scanned).toBe(3);
      expect(result.duplicateClusters).toBe(1);
      const cluster = result.clusters[0];
      // oldest (b) is kept, a is dropped
      expect(cluster.recommendation.keepPageId).toBe('b');
      expect(cluster.recommendation.dropPageIds).toEqual(['a']);
      expect(cluster.pages.map((p) => p.pageId)).toEqual(['b', 'a']);
      // hash persisted for each scanned page
      expect(dedupRepo.upsertHash).toHaveBeenCalledTimes(3);
    });

    it('skips empty/whitespace-only pages and reports no clusters', async () => {
      dedupRepo.listPagesForHashing.mockResolvedValue([
        page({ id: 'a', textContent: '   ' }),
        page({ id: 'b', textContent: null }),
        page({ id: 'c', textContent: 'real' }),
      ]);

      const result = await service.analyze(workspaceId);

      expect(result.scanned).toBe(1);
      expect(result.duplicateClusters).toBe(0);
      expect(dedupRepo.upsertHash).toHaveBeenCalledTimes(1);
    });

    it('passes the spaceId filter through to the repo', async () => {
      dedupRepo.listPagesForHashing.mockResolvedValue([]);
      await service.analyze(workspaceId, 'space-9');
      expect(dedupRepo.listPagesForHashing).toHaveBeenCalledWith(
        workspaceId,
        'space-9',
      );
    });
  });

  describe('assertResolvable', () => {
    it('rejects when keepPageId is also being dropped', () => {
      expect(() => service.assertResolvable('p1', ['p1', 'p2'])).toThrow(
        BadRequestException,
      );
    });

    it('passes for a disjoint keep/drop set', () => {
      expect(() => service.assertResolvable('p1', ['p2', 'p3'])).not.toThrow();
    });
  });
});
