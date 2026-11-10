import { ForbiddenException } from '@nestjs/common';
import { v5 as uuid5 } from 'uuid';
import { PageService } from './page.service';

const WORKSPACE_ID = '019a2c00-0000-7000-8000-000000000001';
const OTHER_WORKSPACE_ID = '019a2c00-0000-7000-8000-000000000002';
const USER_ID = '019a2c00-0000-7000-8000-000000000003';
const SPACE_ID = '019a2c00-0000-7000-8000-000000000004';
const PAGE_ID = '019a2c00-0000-7000-8000-000000000005';
const OTHER_SPACE_ID = '019a2c00-0000-7000-8000-000000000006';
const OTHER_PAGE_ID = '019a2c00-0000-7000-8000-000000000007';
const OWN_FILE_ID = '019a2c00-0000-7000-8000-0000000000a1';
const OTHER_FILE_ID = '019a2c00-0000-7000-8000-0000000000a2';
const DIAGRAM_ID = '019a2c00-0000-7000-8000-0000000000a3';
const UNKNOWN_FILE_ID = '019a2c00-0000-7000-8000-0000000000a4';

function attachment(overrides: Record<string, unknown>) {
  const row = {
    type: 'file',
    fileName: 'cat.png',
    fileSize: 1024,
    mimeType: 'image/png',
    fileExt: '.png',
    creatorId: 'someone-else',
    workspaceId: WORKSPACE_ID,
    ...overrides,
  } as Record<string, any>;
  row.filePath = `${row.workspaceId}/files/${row.id}/${row.fileName}`;
  return row;
}

const image = (attrs: Record<string, unknown>) => ({ type: 'image', attrs });
const doc = (...content: unknown[]) => ({ type: 'doc', content });
const fileUrl = (id: string, name = 'cat.png') => `/api/files/${id}/${name}`;

function makeService(opts: { canViewOtherPage: boolean }) {
  const attachments = new Map<string, Record<string, any>>(
    [
      attachment({ id: OWN_FILE_ID, pageId: PAGE_ID, spaceId: SPACE_ID }),
      attachment({
        id: OTHER_FILE_ID,
        pageId: OTHER_PAGE_ID,
        spaceId: OTHER_SPACE_ID,
      }),
      attachment({
        id: DIAGRAM_ID,
        pageId: OTHER_PAGE_ID,
        spaceId: OTHER_SPACE_ID,
        fileName: 'diagram.drawio.svg',
      }),
    ].map((row) => [row.id, row]),
  );
  const pages = new Map<string, Record<string, any>>([
    [PAGE_ID, { id: PAGE_ID, spaceId: SPACE_ID, workspaceId: WORKSPACE_ID }],
    [
      OTHER_PAGE_ID,
      { id: OTHER_PAGE_ID, spaceId: OTHER_SPACE_ID, workspaceId: WORKSPACE_ID },
    ],
  ]);

  const pageRepo = { findById: jest.fn(async (id: string) => pages.get(id)) };
  const attachmentRepo = {
    findByIds: jest.fn(async (ids: string[]) =>
      ids.map((id) => attachments.get(id)).filter(Boolean),
    ),
    findById: jest.fn(async (id: string) => attachments.get(id)),
  };
  // stands in for insertInto('attachments')…onConflict(doNothing).returning('id')
  const db = {
    insertInto: jest.fn(() => ({
      values: (row: Record<string, any>) => ({
        onConflict: () => ({
          returning: () => ({
            executeTakeFirst: async () => {
              if (attachments.has(row.id)) return undefined;
              attachments.set(row.id, row);
              return { id: row.id };
            },
          }),
        }),
      }),
    })),
  };
  const storageService = { copy: jest.fn(async () => undefined) };
  const collaborationGateway = {
    handleYjsEvent: jest.fn(async () => undefined),
  };
  const userRepo = { findById: jest.fn(async () => ({ id: USER_ID })) };
  const pageAccessService = {
    validateCanView: jest.fn(async () => {
      if (!opts.canViewOtherPage) throw new ForbiddenException();
    }),
  };

  const service = new PageService(
    pageRepo as any,
    {} as any,
    attachmentRepo as any,
    db as any,
    storageService as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    collaborationGateway as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    userRepo as any,
    pageAccessService as any,
  );

  const save = async (content: string | object, format: any = 'json') => {
    await service.updatePageContent(PAGE_ID, content, 'replace', format, {
      id: USER_ID,
    } as any);
    const calls = collaborationGateway.handleYjsEvent.mock.calls as any[][];
    const saved = calls[calls.length - 1][2].prosemirrorJson;
    const nodes: Record<string, any>[] = [];
    const collect = (node: any) => {
      if (node?.attrs?.src) nodes.push(node.attrs);
      node?.content?.forEach(collect);
    };
    collect(saved);
    return nodes;
  };

  return { save, attachments, storageService, pageAccessService, pages };
}

describe('PageService attachments in content saved through the API', () => {
  it("fills in the attachmentId of the page's own file in a markdown image", async () => {
    const { save, storageService } = makeService({ canViewOtherPage: true });

    const [saved] = await save(`![cat](${fileUrl(OWN_FILE_ID)})`, 'markdown');

    expect(saved.attachmentId).toBe(OWN_FILE_ID);
    expect(saved.src).toBe(fileUrl(OWN_FILE_ID));
    expect(storageService.copy).not.toHaveBeenCalled();
  });

  it('copies a file of another page the user can view to this page', async () => {
    const { save, attachments, storageService } = makeService({
      canViewOtherPage: true,
    });
    const copyId = uuid5(OTHER_FILE_ID, PAGE_ID);

    const [saved] = await save(doc(image({ src: fileUrl(OTHER_FILE_ID) })));

    expect(saved).toMatchObject({ attachmentId: copyId, src: fileUrl(copyId) });
    expect(storageService.copy).toHaveBeenCalledWith(
      `${WORKSPACE_ID}/files/${OTHER_FILE_ID}/cat.png`,
      `${WORKSPACE_ID}/files/${copyId}/cat.png`,
    );
    expect(attachments.get(copyId)).toMatchObject({
      pageId: PAGE_ID,
      spaceId: SPACE_ID,
      workspaceId: WORKSPACE_ID,
      creatorId: USER_ID,
      fileName: 'cat.png',
    });
    // the source stays where it was
    expect(attachments.get(OTHER_FILE_ID).pageId).toBe(OTHER_PAGE_ID);
  });

  it('reuses the copy when the same content is saved again', async () => {
    const { save, storageService } = makeService({ canViewOtherPage: true });
    const content = doc(
      image({ attachmentId: OTHER_FILE_ID, src: fileUrl(OTHER_FILE_ID) }),
    );

    const [first] = await save(content);
    const [second] = await save(content);

    expect(second.attachmentId).toBe(first.attachmentId);
    expect(storageService.copy).toHaveBeenCalledTimes(1);
  });

  it('leaves a file of a page the user cannot view alone', async () => {
    const { save, attachments, storageService, pageAccessService } =
      makeService({ canViewOtherPage: false });
    const attrs = { attachmentId: OTHER_FILE_ID, src: fileUrl(OTHER_FILE_ID) };

    const [saved] = await save(doc(image(attrs)));

    expect(saved).toMatchObject(attrs);
    expect(pageAccessService.validateCanView).toHaveBeenCalledTimes(1);
    expect(storageService.copy).not.toHaveBeenCalled();
    expect(attachments.size).toBe(3);
  });

  it('leaves a file of a deleted page alone without asking for access', async () => {
    const { save, pages, storageService, pageAccessService } = makeService({
      canViewOtherPage: true,
    });
    pages.get(OTHER_PAGE_ID).deletedAt = new Date();

    const [saved] = await save(doc(image({ src: fileUrl(OTHER_FILE_ID) })));

    expect(saved.attachmentId ?? null).toBeNull();
    expect(pageAccessService.validateCanView).not.toHaveBeenCalled();
    expect(storageService.copy).not.toHaveBeenCalled();
  });

  it.each([
    ['of another workspace', { workspaceId: OTHER_WORKSPACE_ID }],
    ['that belongs to no page', { pageId: null }],
  ])('leaves a file %s alone', async (_case, overrides) => {
    const { save, attachments, storageService } = makeService({
      canViewOtherPage: true,
    });
    Object.assign(attachments.get(OTHER_FILE_ID), overrides);

    const [saved] = await save(doc(image({ src: fileUrl(OTHER_FILE_ID) })));

    expect(saved.src).toBe(fileUrl(OTHER_FILE_ID));
    expect(saved.attachmentId ?? null).toBeNull();
    expect(storageService.copy).not.toHaveBeenCalled();
  });

  it('leaves urls that point to no known file alone', async () => {
    const { save, storageService } = makeService({ canViewOtherPage: true });

    const saved = await save(
      doc(
        image({ src: fileUrl(UNKNOWN_FILE_ID) }),
        image({ src: 'https://example.com/cat.png' }),
      ),
    );

    expect(saved.map((attrs) => attrs.src)).toEqual([
      fileUrl(UNKNOWN_FILE_ID),
      'https://example.com/cat.png',
    ]);
    expect(saved.every((attrs) => !attrs.attachmentId)).toBe(true);
    expect(storageService.copy).not.toHaveBeenCalled();
  });

  it('gives a diagram of another page its own copy on every save', async () => {
    const { save, storageService } = makeService({ canViewOtherPage: true });
    const content = doc({
      type: 'drawio',
      attrs: {
        attachmentId: DIAGRAM_ID,
        src: fileUrl(DIAGRAM_ID, 'diagram.drawio.svg'),
      },
    });

    const [first] = await save(content);
    const [second] = await save(content);

    expect(first.attachmentId).not.toBe(DIAGRAM_ID);
    expect(second.attachmentId).not.toBe(first.attachmentId);
    expect(second.src).toBe(fileUrl(second.attachmentId, 'diagram.drawio.svg'));
    expect(storageService.copy).toHaveBeenCalledTimes(2);
  });
});
