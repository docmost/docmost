import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as Y from 'yjs';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { FileImportTaskService } from './file-import-task.service';
import { ImportService } from './import.service';

// ESM only, which Jest does not transform here
jest.mock('@sindresorhus/slugify', () => ({ default: (text: string) => text }));
jest.mock('p-limit', () => jest.fn());

const USER_ID = '019a5000-0000-7000-8000-000000000011';
const WORKSPACE_ID = '019a5000-0000-7000-8000-000000000012';
const SPACE_ID = '019a5000-0000-7000-8000-000000000013';

const FILES = {
  'Alpha.md': '# Alpha\n\n```html-block\n<p>alpha</p>\n```\n',
  'Beta.md': [
    '# Beta',
    '',
    '```html-block',
    '<p>beta one</p>',
    '```',
    '',
    '```html-block',
    '<p>beta two</p>',
    '```',
  ].join('\n'),
};

function findNodes(json: any, type: string): any[] {
  return [
    ...(json?.type === type ? [json] : []),
    ...(json?.content ?? []).flatMap((child: any) => findNodes(child, type)),
  ];
}

async function buildService(role: string, deactivatedAt: Date | null = null) {
  const extractDir = await fs.mkdtemp(join(tmpdir(), 'zip-import-'));
  for (const [name, content] of Object.entries(FILES)) {
    await fs.writeFile(join(extractDir, name), content);
  }

  const writes: string[] = [];
  const insertedPages: any[] = [];
  const trx = {
    insertInto: (table: string) => ({
      values: (row: any) => ({
        execute: async () => {
          writes.push(table);
          insertedPages.push(row);
        },
      }),
    }),
  };
  // only the space lookup and the transaction the generic import runs
  const db = {
    selectFrom: () => ({
      select: () => ({
        where: () => ({ executeTakeFirst: async () => ({ slug: 'general' }) }),
      }),
    }),
    transaction: () => ({ execute: (callback: any) => callback(trx) }),
  };
  const userRepo = {
    findById: jest.fn(async () => ({
      id: USER_ID,
      role,
      deactivatedAt,
      deletedAt: null,
    })),
  };
  const importService = new ImportService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {
      findById: async () => ({
        id: WORKSPACE_ID,
        plan: null,
        licenseKey: 'license-key',
        settings: { htmlBlocks: { enabled: true } },
      }),
    } as any,
    userRepo as any,
    {} as any,
    { hasFeature: () => true } as any,
    {} as any,
    { isDisableHtmlBlocks: () => false } as any,
  );
  const htmlBlockRepo = {
    insertMany: jest.fn(async (rows: any[], _trx?: unknown) => {
      writes.push(`htmlBlocks x${rows.length}`);
    }),
  };
  const service = new FileImportTaskService(
    {} as any,
    importService,
    { nextPagePosition: async () => 'a0' } as any,
    { insertBacklink: jest.fn() } as any,
    db as any,
    { processAttachments: async ({ html }: { html: string }) => html } as any,
    {} as any,
    { emit: jest.fn() } as any,
    { logBatchWithContext: jest.fn() } as any,
    htmlBlockRepo as any,
  );
  const fileTask = {
    id: 'file-task-1',
    source: 'generic',
    spaceId: SPACE_ID,
    workspaceId: WORKSPACE_ID,
    creatorId: USER_ID,
  } as any;

  return {
    service,
    extractDir,
    fileTask,
    trx,
    writes,
    insertedPages,
    userRepo,
    htmlBlockRepo,
  };
}

describe('FileImportTaskService html blocks', () => {
  let extractDir: string | undefined;

  afterEach(async () => {
    if (extractDir) await fs.rm(extractDir, { recursive: true, force: true });
    extractDir = undefined;
  });

  it('turns html-block code into blocks owned by each imported page', async () => {
    const ctx = await buildService('owner');
    extractDir = ctx.extractDir;

    await ctx.service.processGenericImport({
      extractDir,
      fileTask: ctx.fileTask,
    });

    expect(ctx.userRepo.findById).toHaveBeenCalledTimes(1);
    const [alpha, beta] = ctx.insertedPages;
    expect([alpha.title, beta.title]).toEqual(['Alpha', 'Beta']);
    const blockIds = (doc: any) =>
      findNodes(doc, 'htmlBlock').map((n) => n.attrs.htmlBlockId);
    const [alphaId] = blockIds(alpha.content);
    const [betaOneId, betaTwoId] = blockIds(beta.content);
    expect(findNodes(alpha.content, 'codeBlock')).toEqual([]);
    expect(findNodes(beta.content, 'codeBlock')).toEqual([]);
    const row = (id: string, pageId: string, content: string) => ({
      id,
      workspaceId: WORKSPACE_ID,
      pageId,
      content,
      creatorId: USER_ID,
    });
    expect(ctx.htmlBlockRepo.insertMany.mock.calls).toEqual([
      [[row(alphaId, alpha.id, '<p>alpha</p>')], ctx.trx],
      [
        [
          row(betaOneId, beta.id, '<p>beta one</p>'),
          row(betaTwoId, beta.id, '<p>beta two</p>'),
        ],
        ctx.trx,
      ],
    ]);
    expect(ctx.writes).toEqual([
      'pages',
      'htmlBlocks x1',
      'pages',
      'htmlBlocks x2',
    ]);
    expect(beta.textContent).not.toContain('beta one');
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, beta.ydoc);
    expect(blockIds(TiptapTransformer.fromYdoc(ydoc, 'default'))).toEqual([
      betaOneId,
      betaTwoId,
    ]);
  });

  it.each([
    ['a deactivated owner', 'owner', new Date()],
  ])('keeps html code and inserts no block for %s', async (_label, role, deactivatedAt) => {
    const ctx = await buildService(role, deactivatedAt);
    extractDir = ctx.extractDir;

    await ctx.service.processGenericImport({
      extractDir,
      fileTask: ctx.fileTask,
    });

    expect(ctx.insertedPages).toHaveLength(2);
    for (const page of ctx.insertedPages) {
      expect(findNodes(page.content, 'htmlBlock')).toEqual([]);
      const languages = findNodes(page.content, 'codeBlock').map(
        (n) => n.attrs.language,
      );
      expect(languages.length).toBeGreaterThan(0);
      expect(languages.every((language) => language === 'html')).toBe(true);
    }
    expect(
      ctx.htmlBlockRepo.insertMany.mock.calls.flatMap(([rows]) => rows),
    ).toEqual([]);
  });
});
