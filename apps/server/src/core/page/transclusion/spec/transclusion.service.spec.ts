import { Test } from '@nestjs/testing';
import { TransclusionService } from '../transclusion.service';
import { PageTransclusionsRepo } from '@docmost/db/repos/page-transclusions/page-transclusions.repo';
import { PageTransclusionReferencesRepo } from '@docmost/db/repos/page-transclusions/page-transclusion-references.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { StorageService } from '../../../../integrations/storage/storage.service';
import { PageAccessService } from '../../page-access/page-access.service';

describe('TransclusionService.syncPageTransclusions', () => {
  let service: TransclusionService;
  let repo: jest.Mocked<PageTransclusionsRepo>;

  beforeEach(async () => {
    const mockRepo: jest.Mocked<Partial<PageTransclusionsRepo>> = {
      findByPageId: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      deleteByPageAndTransclusionIds: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        TransclusionService,
        { provide: PageTransclusionsRepo, useValue: mockRepo },
        { provide: PageTransclusionReferencesRepo, useValue: {} },
        { provide: PageRepo, useValue: {} },
        { provide: PagePermissionRepo, useValue: {} },
        { provide: AttachmentRepo, useValue: {} },
        { provide: StorageService, useValue: {} },
        { provide: PageAccessService, useValue: {} },
      ],
    }).compile();
    service = module.get(TransclusionService);
    repo = module.get(PageTransclusionsRepo);
  });

  const pageId = '00000000-0000-0000-0000-000000000001';
  const workspaceId = '00000000-0000-0000-0000-000000000099';

  it('inserts new transclusions that did not exist before', async () => {
    repo.findByPageId.mockResolvedValue([]);
    const pm = {
      type: 'doc',
      content: [
        {
          type: 'transclusionSource',
          attrs: { id: 'a' },
          content: [{ type: 'paragraph' }],
        },
      ],
    };

    const result = await service.syncPageTransclusions(pageId, workspaceId, pm);

    expect(result).toEqual({ inserted: 1, updated: 0, deleted: 0 });
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId,
        transclusionId: 'a',
      }),
      undefined,
    );
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.deleteByPageAndTransclusionIds).not.toHaveBeenCalled();
  });

  it('updates transclusions whose content changed', async () => {
    repo.findByPageId.mockResolvedValue([
      {
        id: 'row1',
        pageId,
        transclusionId: 'a',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);
    const newContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'X' }] },
      ],
    };
    const pm = {
      type: 'doc',
      content: [
        {
          type: 'transclusionSource',
          attrs: { id: 'a' },
          content: newContent.content,
        },
      ],
    };

    const result = await service.syncPageTransclusions(pageId, workspaceId, pm);

    expect(result).toEqual({ inserted: 0, updated: 1, deleted: 0 });
    expect(repo.update).toHaveBeenCalledWith(
      pageId,
      'a',
      expect.objectContaining({ content: newContent }),
      undefined,
    );
  });

  it('skips update when content is unchanged', async () => {
    const sameContent = {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
    repo.findByPageId.mockResolvedValue([
      {
        id: 'row1',
        pageId,
        transclusionId: 'a',
        content: sameContent,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);
    const pm = {
      type: 'doc',
      content: [
        {
          type: 'transclusionSource',
          attrs: { id: 'a' },
          content: sameContent.content,
        },
      ],
    };

    const result = await service.syncPageTransclusions(pageId, workspaceId, pm);

    expect(result).toEqual({ inserted: 0, updated: 0, deleted: 0 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('deletes transclusions that no longer appear in the doc', async () => {
    repo.findByPageId.mockResolvedValue([
      {
        id: 'r',
        pageId,
        transclusionId: 'gone',
        content: { type: 'doc', content: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);
    const pm = { type: 'doc', content: [{ type: 'paragraph' }] };

    const result = await service.syncPageTransclusions(pageId, workspaceId, pm);

    expect(result).toEqual({ inserted: 0, updated: 0, deleted: 1 });
    expect(repo.deleteByPageAndTransclusionIds).toHaveBeenCalledWith(
      pageId,
      ['gone'],
      undefined,
    );
  });

  it('handles empty doc → noop', async () => {
    repo.findByPageId.mockResolvedValue([]);
    const result = await service.syncPageTransclusions(pageId, workspaceId, null);
    expect(result).toEqual({ inserted: 0, updated: 0, deleted: 0 });
    expect(repo.insert).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.deleteByPageAndTransclusionIds).not.toHaveBeenCalled();
  });
});

describe('TransclusionService.syncPageReferences', () => {
  let service: TransclusionService;
  let refRepo: jest.Mocked<PageTransclusionReferencesRepo>;

  beforeEach(async () => {
    const mockTransclusionsRepo: Partial<PageTransclusionsRepo> = {};
    const mockRefRepo: jest.Mocked<Partial<PageTransclusionReferencesRepo>> = {
      findByReferencePageId: jest.fn(),
      insertMany: jest.fn(),
      deleteByReferenceAndKeys: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        TransclusionService,
        { provide: PageTransclusionsRepo, useValue: mockTransclusionsRepo },
        { provide: PageTransclusionReferencesRepo, useValue: mockRefRepo },
        { provide: PageRepo, useValue: {} },
        { provide: PagePermissionRepo, useValue: {} },
        { provide: AttachmentRepo, useValue: {} },
        { provide: StorageService, useValue: {} },
        { provide: PageAccessService, useValue: {} },
      ],
    }).compile();
    service = module.get(TransclusionService);
    refRepo = module.get(PageTransclusionReferencesRepo);
  });

  const referencePageId = '00000000-0000-0000-0000-000000000001';
  const workspaceId = '00000000-0000-0000-0000-000000000099';

  it('inserts new loose references, no deletes when none existed', async () => {
    refRepo.findByReferencePageId.mockResolvedValue([]);
    const pm = {
      type: 'doc',
      content: [
        {
          type: 'transclusionReference',
          attrs: { sourcePageId: 'p1', transclusionId: 'e1' },
        },
        {
          type: 'transclusionReference',
          attrs: { sourcePageId: 'p2', transclusionId: 'e2' },
        },
      ],
    };

    const result = await service.syncPageReferences(referencePageId, workspaceId, pm);

    expect(result).toEqual({ inserted: 2, deleted: 0 });
    expect(refRepo.insertMany).toHaveBeenCalledWith(
      [
        {
          workspaceId,
          referencePageId,
          sourcePageId: 'p1',
          transclusionId: 'e1',
        },
        {
          workspaceId,
          referencePageId,
          sourcePageId: 'p2',
          transclusionId: 'e2',
        },
      ],
      undefined,
    );
    expect(refRepo.deleteByReferenceAndKeys).not.toHaveBeenCalled();
  });

  it('ignores references nested inside a source (schema-forbidden)', async () => {
    refRepo.findByReferencePageId.mockResolvedValue([]);
    const pm = {
      type: 'doc',
      content: [
        {
          type: 'transclusionSource',
          attrs: { id: 's1' },
          content: [
            {
              type: 'transclusionReference',
              attrs: { sourcePageId: 'p2', transclusionId: 'e2' },
            },
          ],
        },
      ],
    };

    const result = await service.syncPageReferences(referencePageId, workspaceId, pm);

    expect(result).toEqual({ inserted: 0, deleted: 0 });
    expect(refRepo.insertMany).not.toHaveBeenCalled();
  });

  it('deletes references that no longer appear', async () => {
    refRepo.findByReferencePageId.mockResolvedValue([
      {
        id: 'r1',
        referencePageId,
        sourcePageId: 'p1',
        transclusionId: 'e1',
        createdAt: new Date(),
      } as any,
    ]);
    const pm = { type: 'doc', content: [{ type: 'paragraph' }] };

    const result = await service.syncPageReferences(referencePageId, workspaceId, pm);

    expect(result).toEqual({ inserted: 0, deleted: 1 });
    expect(refRepo.deleteByReferenceAndKeys).toHaveBeenCalledWith(
      referencePageId,
      [
        {
          sourcePageId: 'p1',
          transclusionId: 'e1',
        },
      ],
      undefined,
    );
    expect(refRepo.insertMany).not.toHaveBeenCalled();
  });

  it('is a no-op when desired matches existing exactly', async () => {
    refRepo.findByReferencePageId.mockResolvedValue([
      {
        id: 'r',
        referencePageId,
        sourcePageId: 'p1',
        transclusionId: 'e1',
        createdAt: new Date(),
      } as any,
    ]);
    const pm = {
      type: 'doc',
      content: [
        {
          type: 'transclusionReference',
          attrs: { sourcePageId: 'p1', transclusionId: 'e1' },
        },
      ],
    };

    const result = await service.syncPageReferences(referencePageId, workspaceId, pm);

    expect(result).toEqual({ inserted: 0, deleted: 0 });
    expect(refRepo.insertMany).not.toHaveBeenCalled();
    expect(refRepo.deleteByReferenceAndKeys).not.toHaveBeenCalled();
  });
});
