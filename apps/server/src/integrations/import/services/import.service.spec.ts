import * as Y from 'yjs';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { ImportService } from './import.service';
import { EventName } from '../../../common/events/event.contants';

// ESM only, which Jest does not transform here
jest.mock('@sindresorhus/slugify', () => ({ default: (text: string) => text }));

const USER_ID = '019a5000-0000-7000-8000-000000000001';
const WORKSPACE_ID = '019a5000-0000-7000-8000-000000000002';
const SPACE_ID = '019a5000-0000-7000-8000-000000000003';
const PAGE_ID = '019a5000-0000-7000-8000-000000000004';
const LICENSE_KEY = 'license-key';
const BLOCK_SOURCE = '<div class="card">\n  <b>héllo</b>\n</div>';

const MARKDOWN = [
  '# Imported',
  '',
  'Intro',
  '',
  '```html-block',
  BLOCK_SOURCE,
  '```',
].join('\n');

function uploadFile(filename: string, content: string) {
  return Promise.resolve({
    filename,
    file: { truncated: false },
    toBuffer: async () => Buffer.from(content),
  } as any);
}

function buildService(opts: {
  role: string;
  allowMembers?: boolean;
  enabled?: boolean;
  licensed?: boolean;
  deactivatedAt?: Date;
  deletedAt?: Date;
}) {
  const events: string[] = [];
  const insertedRows: any[] = [];
  const insertedTables: string[] = [];
  const trx = {
    insertInto: (table: string) => ({
      values: (row: any) => ({
        returning: () => ({
          executeTakeFirstOrThrow: async () => {
            insertedTables.push(table);
            insertedRows.push(row);
            return { id: PAGE_ID };
          },
        }),
      }),
    }),
  };
  const pageRepo = {
    insertPage: jest.fn(async (page: any, _trx?: unknown) => ({
      id: PAGE_ID,
      ...page,
    })),
    findById: jest.fn(async (id: string, _opts?: unknown) => ({
      id,
      title: insertedRows[0]?.title,
    })),
  };
  // only the position lookup and the transaction the import service runs
  const db = {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              where: () => ({ executeTakeFirst: async () => undefined }),
            }),
          }),
        }),
      }),
    }),
    transaction: () => ({
      execute: async (callback: any) => {
        const result = await callback(trx);
        events.push('commit');
        return result;
      },
    }),
  };
  const workspaceRepo = {
    findById: jest.fn(async () => ({
      id: WORKSPACE_ID,
      plan: null,
      licenseKey: LICENSE_KEY,
      settings: {
        htmlBlocks: {
          enabled: opts.enabled ?? true,
          allowMembers: opts.allowMembers ?? false,
        },
      },
    })),
  };
  const userRepo = {
    findById: jest.fn(async () => ({
      id: USER_ID,
      role: opts.role,
      deactivatedAt: opts.deactivatedAt ?? null,
      deletedAt: opts.deletedAt ?? null,
    })),
  };
  const htmlBlockRepo = { insertMany: jest.fn(async () => undefined) };
  const licenseCheckService = {
    hasFeature: jest.fn(() => opts.licensed ?? true),
  };
  const eventEmitter = {
    emit: jest.fn((_event: string, _payload: unknown) => events.push('emit')),
  };
  const service = new ImportService(
    pageRepo as any,
    {} as any,
    db as any,
    {} as any,
    {} as any,
    workspaceRepo as any,
    userRepo as any,
    htmlBlockRepo as any,
    licenseCheckService as any,
    eventEmitter as any,
  );
  return {
    service,
    trx,
    events,
    insertedRows,
    insertedTables,
    pageRepo,
    workspaceRepo,
    userRepo,
    htmlBlockRepo,
    licenseCheckService,
    eventEmitter,
  };
}

function findNodes(json: any, type: string): any[] {
  return [
    ...(json?.type === type ? [json] : []),
    ...(json?.content ?? []).flatMap((child: any) => findNodes(child, type)),
  ];
}

describe('ImportService html blocks', () => {
  it('turns html-block code into a block owned by the imported page', async () => {
    const {
      service,
      trx,
      events,
      insertedRows,
      insertedTables,
      pageRepo,
      workspaceRepo,
      userRepo,
      htmlBlockRepo,
      licenseCheckService,
      eventEmitter,
    } = buildService({ role: 'admin' });

    const page = await service.importPage(
      uploadFile('imported.md', MARKDOWN),
      USER_ID,
      SPACE_ID,
      WORKSPACE_ID,
    );

    expect(page).toEqual({ id: PAGE_ID, title: 'Imported' });
    expect(insertedTables).toEqual(['pages']);
    expect(pageRepo.insertPage).not.toHaveBeenCalled();
    expect(pageRepo.findById).toHaveBeenCalledWith(PAGE_ID, { trx });
    const [inserted] = insertedRows;
    expect(inserted.title).toBe('Imported');
    const [node] = findNodes(inserted.content, 'htmlBlock');
    expect(node.attrs).toMatchObject({
      htmlBlockId: expect.any(String),
      height: null,
    });
    expect(findNodes(inserted.content, 'codeBlock')).toEqual([]);
    expect(htmlBlockRepo.insertMany).toHaveBeenCalledWith(
      [
        {
          id: node.attrs.htmlBlockId,
          workspaceId: WORKSPACE_ID,
          pageId: PAGE_ID,
          content: BLOCK_SOURCE,
          creatorId: USER_ID,
        },
      ],
      trx,
    );
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(EventName.PAGE_CREATED, {
      pageIds: [PAGE_ID],
      workspaceId: WORKSPACE_ID,
    });
    expect(events).toEqual(['commit', 'emit']);
    expect(inserted.textContent).toContain('Intro');
    expect(inserted.textContent).not.toContain('héllo');
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, inserted.ydoc);
    expect(
      findNodes(TiptapTransformer.fromYdoc(ydoc, 'default'), 'htmlBlock').map(
        (n) => n.attrs.htmlBlockId,
      ),
    ).toEqual([node.attrs.htmlBlockId]);
    expect(workspaceRepo.findById).toHaveBeenCalledWith(WORKSPACE_ID, {
      withLicenseKey: true,
    });
    expect(userRepo.findById).toHaveBeenCalledWith(USER_ID, WORKSPACE_ID);
    expect(licenseCheckService.hasFeature).toHaveBeenCalledWith(
      LICENSE_KEY,
      'html-blocks',
      null,
    );
  });

  it('keeps html-block code inside a table cell as html code and inserts no row for it', async () => {
    const { service, insertedRows, htmlBlockRepo } = buildService({
      role: 'owner',
    });
    const html =
      '<h1>Cells</h1>' +
      '<pre><code class="language-html-block">&lt;p&gt;top&lt;/p&gt;</code></pre>' +
      '<table><tbody><tr><td>' +
      '<pre><code class="language-html-block">&lt;p&gt;cell&lt;/p&gt;</code></pre>' +
      '</td></tr></tbody></table>';

    await service.importPage(
      uploadFile('cells.html', html),
      USER_ID,
      SPACE_ID,
      WORKSPACE_ID,
    );

    const [inserted] = insertedRows;
    const htmlBlocks = findNodes(inserted.content, 'htmlBlock');
    expect(htmlBlocks).toHaveLength(1);
    const [tableCell] = findNodes(inserted.content, 'tableCell');
    expect(
      findNodes(tableCell, 'codeBlock').map((n) => [
        n.attrs.language,
        n.content[0].text,
      ]),
    ).toEqual([['html', '<p>cell</p>']]);
    expect(htmlBlockRepo.insertMany).toHaveBeenCalledTimes(1);
    expect(htmlBlockRepo.insertMany).toHaveBeenCalledWith(
      [
        {
          id: htmlBlocks[0].attrs.htmlBlockId,
          workspaceId: WORKSPACE_ID,
          pageId: PAGE_ID,
          content: '<p>top</p>',
          creatorId: USER_ID,
        },
      ],
      expect.anything(),
    );
  });

  it('gives a member live blocks when members may add them', async () => {
    const { service, insertedRows, htmlBlockRepo } = buildService({
      role: 'member',
      allowMembers: true,
    });

    await service.importPage(
      uploadFile('imported.md', MARKDOWN),
      USER_ID,
      SPACE_ID,
      WORKSPACE_ID,
    );

    const [node] = findNodes(insertedRows[0].content, 'htmlBlock');
    expect(htmlBlockRepo.insertMany).toHaveBeenCalledWith(
      [
        {
          id: node.attrs.htmlBlockId,
          workspaceId: WORKSPACE_ID,
          pageId: PAGE_ID,
          content: BLOCK_SOURCE,
          creatorId: USER_ID,
        },
      ],
      expect.anything(),
    );
  });

  it('drops an htmlBlock element that arrives in the imported file', async () => {
    const { service, pageRepo, htmlBlockRepo } = buildService({
      role: 'owner',
    });
    const html =
      '<h1>Foreign</h1><p>Before</p>' +
      '<div data-type="htmlBlock" data-html-block-id="019a5000-0000-7000-8000-0000000000ff"></div>';

    await service.importPage(
      uploadFile('foreign.html', html),
      USER_ID,
      SPACE_ID,
      WORKSPACE_ID,
    );

    const [inserted] = pageRepo.insertPage.mock.calls[0];
    expect(findNodes(inserted.content, 'htmlBlock')).toEqual([]);
    expect(inserted.textContent).toContain('Before');
    expect(htmlBlockRepo.insertMany).not.toHaveBeenCalled();
  });

  it.each([
    ['a member when members may not add blocks', { role: 'member' }],
    ['an owner without the license feature', { role: 'owner', licensed: false }],
    ['an owner when the workspace switch is off', { role: 'owner', enabled: false }],
    ['a deactivated owner', { role: 'owner', deactivatedAt: new Date() }],
    ['a deleted owner', { role: 'owner', deletedAt: new Date() }],
  ])('keeps html code and inserts no block for %s', async (_label, opts) => {
    const { service, events, pageRepo, htmlBlockRepo, eventEmitter } =
      buildService(opts);

    await service.importPage(
      uploadFile('imported.md', MARKDOWN),
      USER_ID,
      SPACE_ID,
      WORKSPACE_ID,
    );

    const [inserted, insertTrx] = pageRepo.insertPage.mock.calls[0];
    expect(insertTrx).toBeUndefined();
    expect(findNodes(inserted.content, 'htmlBlock')).toEqual([]);
    const codeBlocks = findNodes(inserted.content, 'codeBlock');
    expect(codeBlocks.map((n) => n.attrs.language)).toEqual(['html']);
    expect(codeBlocks[0].content[0].text).toBe(BLOCK_SOURCE);
    expect(htmlBlockRepo.insertMany).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });
});
