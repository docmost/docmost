import { validate as isValidUUID } from 'uuid';
import { TransclusionService } from './transclusion.service';

const OWNED_ID = '0199a1b2-0000-7000-8000-000000000001';
const FOREIGN_ID = '0199a1b2-0000-7000-8000-000000000002';
const TEMPLATE_ID = '0199a1b2-0000-7000-8000-000000000003';
const MISSING_ID = '0199a1b2-0000-7000-8000-000000000004';

const user = { id: 'user-1', workspaceId: 'ws-1' } as any;

const referencePage = {
  id: 'page-ref',
  workspaceId: 'ws-1',
  spaceId: 'space-ref',
  deletedAt: null,
};

const sourcePage = {
  id: 'page-src',
  workspaceId: 'ws-1',
  spaceId: 'space-src',
  deletedAt: null,
};

function htmlBlockNode(htmlBlockId: string, height: number | null = null) {
  return { type: 'htmlBlock', attrs: { htmlBlockId, height } };
}

function htmlBlockRow(overrides: Record<string, unknown>) {
  return {
    workspaceId: 'ws-1',
    pageId: null,
    templateId: null,
    content: '<p>Hi</p>',
    creatorId: 'user-other',
    createdAt: new Date('2026-11-21T10:00:00.000Z'),
    ...overrides,
  };
}

function buildService(content: unknown, rows: unknown[]) {
  const pageRepo = {
    findById: jest.fn(async (id: string) =>
      id === referencePage.id
        ? referencePage
        : id === sourcePage.id
          ? sourcePage
          : undefined,
    ),
  };
  const pageTransclusionsRepo = {
    findByPageAndTransclusion: jest.fn().mockResolvedValue({ content }),
  };
  const pageTransclusionReferencesRepo = {
    deleteOne: jest.fn().mockResolvedValue(undefined),
  };
  const attachmentRepo = {
    findByIds: jest.fn().mockResolvedValue([]),
    insertAttachment: jest.fn(),
  };
  const storageService = { copy: jest.fn() };
  const pageAccessService = {
    validateCanEdit: jest.fn().mockResolvedValue(undefined),
    validateCanView: jest.fn().mockResolvedValue(undefined),
  };
  const htmlBlockRepo = {
    findByIds: jest.fn().mockResolvedValue(rows),
    insertMany: jest.fn().mockResolvedValue(undefined),
  };
  const service = new TransclusionService(
    {} as any,
    pageTransclusionsRepo as any,
    pageTransclusionReferencesRepo as any,
    pageRepo as any,
    {} as any,
    {} as any,
    attachmentRepo as any,
    storageService as any,
    pageAccessService as any,
    htmlBlockRepo as any,
  );
  return { service, htmlBlockRepo, pageTransclusionReferencesRepo };
}

const insertedRows = (insertMany: jest.Mock) =>
  insertMany.mock.calls.flatMap(([rows]) => rows);

describe('TransclusionService.unsyncReference html blocks', () => {
  it('clones only the blocks owned by the source page and remaps their ids', async () => {
    const content = {
      type: 'doc',
      content: [
        htmlBlockNode(OWNED_ID, 320),
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [htmlBlockNode(FOREIGN_ID), htmlBlockNode(OWNED_ID)],
            },
          ],
        },
        htmlBlockNode(TEMPLATE_ID),
        htmlBlockNode(MISSING_ID),
        { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
      ],
    };
    const { service, htmlBlockRepo, pageTransclusionReferencesRepo } =
      buildService(content, [
        htmlBlockRow({
          id: OWNED_ID,
          pageId: 'page-src',
          content: '<p>Owned</p>',
        }),
        htmlBlockRow({ id: FOREIGN_ID, pageId: 'page-other' }),
        htmlBlockRow({ id: TEMPLATE_ID, templateId: 'tpl-1' }),
      ]);

    const result = await service.unsyncReference(
      'page-ref',
      'page-src',
      'transclusion-1',
      user,
    );

    expect(htmlBlockRepo.findByIds).toHaveBeenCalledTimes(1);
    const [requestedIds, workspaceId] = htmlBlockRepo.findByIds.mock.calls[0];
    expect([...requestedIds].sort()).toEqual(
      [OWNED_ID, FOREIGN_ID, TEMPLATE_ID, MISSING_ID].sort(),
    );
    expect(workspaceId).toBe('ws-1');

    const rows = insertedRows(htmlBlockRepo.insertMany);
    expect(rows).toHaveLength(1);
    const [clone] = rows;
    expect(clone).toEqual({
      id: expect.any(String),
      workspaceId: 'ws-1',
      pageId: 'page-ref',
      content: '<p>Owned</p>',
      creatorId: 'user-1',
    });
    expect(isValidUUID(clone.id)).toBe(true);
    expect(clone.id).not.toBe(OWNED_ID);

    expect(result.content).toEqual({
      type: 'doc',
      content: [
        htmlBlockNode(clone.id, 320),
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [htmlBlockNode(FOREIGN_ID), htmlBlockNode(clone.id)],
            },
          ],
        },
        htmlBlockNode(TEMPLATE_ID),
        htmlBlockNode(MISSING_ID),
        { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
      ],
    });
    expect(pageTransclusionReferencesRepo.deleteOne).toHaveBeenCalledWith(
      'page-ref',
      'page-src',
      'transclusion-1',
    );
  });

  it('inserts nothing when the source page owns none of the blocks', async () => {
    const content = {
      type: 'doc',
      content: [htmlBlockNode(FOREIGN_ID, 480), htmlBlockNode(TEMPLATE_ID)],
    };
    const { service, htmlBlockRepo } = buildService(content, [
      htmlBlockRow({ id: FOREIGN_ID, pageId: 'page-other' }),
      htmlBlockRow({ id: TEMPLATE_ID, templateId: 'tpl-1' }),
    ]);

    const result = await service.unsyncReference(
      'page-ref',
      'page-src',
      'transclusion-1',
      user,
    );

    expect(insertedRows(htmlBlockRepo.insertMany)).toEqual([]);
    expect(result.content).toEqual(content);
  });

  it('inserts nothing for content without html blocks', async () => {
    const content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }],
    };
    const { service, htmlBlockRepo } = buildService(content, []);

    const result = await service.unsyncReference(
      'page-ref',
      'page-src',
      'transclusion-1',
      user,
    );

    expect(insertedRows(htmlBlockRepo.insertMany)).toEqual([]);
    expect(result.content).toEqual(content);
  });
});
