import { PageService } from './page.service';

const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000001';
const SPACE_ID = '019a1f00-0000-7000-8000-000000000002';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000003';
const USER_ID = '019a1f00-0000-7000-8000-000000000005';
const FILE_ID = '019a1f00-0000-7000-8000-0000000000aa';
const IMAGE_ID = '019a1f00-0000-7000-8000-0000000000bb';
const OUTSIDE_PAGE_ID = '019a1f00-0000-7000-8000-000000000004';
const OUTSIDE_ID = '019a1f00-0000-7000-8000-0000000000cc';

const user = { id: USER_ID, workspaceId: WORKSPACE_ID } as any;

const content = {
  type: 'doc',
  content: [
    {
      type: 'attachment',
      attrs: {
        url: `/api/files/${FILE_ID}/report.pdf`,
        name: 'report.pdf',
        attachmentId: FILE_ID,
      },
    },
    {
      type: 'image',
      attrs: {
        src: `/api/files/${IMAGE_ID}/photo.png`,
        attachmentId: IMAGE_ID,
      },
    },
  ],
};

function makeAttachmentRow(
  id: string,
  fileName: string,
  pageId: string = PAGE_ID,
) {
  return {
    id,
    type: 'file',
    filePath: `${WORKSPACE_ID}/files/${id}/${fileName}`,
    fileName,
    fileSize: 10,
    mimeType: 'application/octet-stream',
    fileExt: '.bin',
    creatorId: USER_ID,
    workspaceId: WORKSPACE_ID,
    pageId,
    spaceId: SPACE_ID,
  };
}

function makeService(pageContent: any = content, extraRows: any[] = []) {
  const page = {
    id: PAGE_ID,
    slugId: 'pageSlug01',
    title: 'Report',
    content: pageContent,
    coverPhoto: null,
    position: 'a0',
    parentPageId: null,
    spaceId: SPACE_ID,
    workspaceId: WORKSPACE_ID,
  } as any;

  const inserted: any[] = [];
  const trx = {
    insertInto: () => ({
      values: (values: any) => ({
        execute: async () => {
          inserted.push(values);
        },
      }),
    }),
  };
  const selectQuery: any = {
    selectAll: () => selectQuery,
    where: () => selectQuery,
    execute: async () => [
      makeAttachmentRow(FILE_ID, 'report.pdf'),
      makeAttachmentRow(IMAGE_ID, 'photo.png'),
      ...extraRows,
    ],
  };
  const db = {
    transaction: () => ({
      execute: (callback: (t: unknown) => Promise<unknown>) => callback(trx),
    }),
    selectFrom: () => selectQuery,
    insertInto: () => ({
      values: () => ({ execute: async () => undefined }),
    }),
  };
  const pageRepo = {
    getPageAndDescendants: jest.fn(async () => [page]),
    findById: jest.fn(async () => page),
  };
  const pagePermissionRepo = {
    copyRestrictions: jest.fn(async () => 0),
  };
  const labelRepo = { copyLabelsToPages: jest.fn(async () => undefined) };
  const transclusionService = {
    insertTransclusionsForPages: jest.fn(async () => undefined),
    insertReferencesForPages: jest.fn(async () => undefined),
  };
  const storageService = { copy: jest.fn(async () => undefined) };
  const eventEmitter = { emit: jest.fn() };

  const service = new PageService(
    pageRepo as any,
    pagePermissionRepo as any,
    {} as any,
    db as any,
    storageService as any,
    {} as any,
    {} as any,
    {} as any,
    eventEmitter as any,
    {} as any,
    {} as any,
    transclusionService as any,
    labelRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  jest
    .spyOn(service as any, 'filterAccessibleTreePages')
    .mockResolvedValue([page]);

  return { service, page, inserted, storageService };
}

describe('PageService.duplicatePage attachments', () => {
  it('points file and image nodes at the copied attachments', async () => {
    const { service, page, inserted } = makeService();

    await service.duplicatePage(page, undefined, user);

    const [copy] = inserted[0];
    const [file, image] = copy.content.content;

    expect(file.attrs.attachmentId).not.toBe(FILE_ID);
    expect(file.attrs.url).toBe(
      `/api/files/${file.attrs.attachmentId}/report.pdf`,
    );
    expect(image.attrs.attachmentId).not.toBe(IMAGE_ID);
    expect(image.attrs.src).toBe(
      `/api/files/${image.attrs.attachmentId}/photo.png`,
    );
  });

  it('records the duplicating user as creator of the copied files', async () => {
    const { service, page } = makeService();
    const otherUser = '019a1f00-0000-7000-8000-000000000006';
    const rows = [
      makeAttachmentRow(FILE_ID, 'report.pdf'),
      makeAttachmentRow(IMAGE_ID, 'photo.png'),
    ].map((row) => ({ ...row, creatorId: otherUser }));
    const selectQuery: any = {
      selectAll: () => selectQuery,
      where: () => selectQuery,
      execute: async () => rows,
    };
    (service as any).db.selectFrom = () => selectQuery;
    const attachmentInserts: any[] = [];
    (service as any).db.insertInto = () => ({
      values: (values: any) => ({
        execute: async () => {
          attachmentInserts.push(values);
        },
      }),
    });

    await service.duplicatePage(page, undefined, user);

    expect(attachmentInserts).toHaveLength(2);
    expect(attachmentInserts.map((row) => row.creatorId)).toEqual([
      USER_ID,
      USER_ID,
    ]);
  });

  it('leaves links to files owned outside the copied pages untouched', async () => {
    const outsideContent = {
      type: 'doc',
      content: [
        {
          type: 'attachment',
          attrs: {
            url: `/api/files/${OUTSIDE_ID}/shared.pdf`,
            name: 'shared.pdf',
            attachmentId: OUTSIDE_ID,
          },
        },
        {
          type: 'image',
          attrs: {
            src: `/api/files/${OUTSIDE_ID}/shared.png`,
            attachmentId: OUTSIDE_ID,
          },
        },
      ],
    };
    const { service, page, inserted, storageService } = makeService(
      outsideContent,
      [makeAttachmentRow(OUTSIDE_ID, 'shared.pdf', OUTSIDE_PAGE_ID)],
    );
    const attachmentInserts: any[] = [];
    (service as any).db.insertInto = () => ({
      values: (values: any) => ({
        execute: async () => {
          attachmentInserts.push(values);
        },
      }),
    });

    await service.duplicatePage(page, undefined, user);

    const [copy] = inserted[0];
    const [file, image] = copy.content.content;
    expect(file.attrs.attachmentId).toBe(OUTSIDE_ID);
    expect(file.attrs.url).toBe(`/api/files/${OUTSIDE_ID}/shared.pdf`);
    expect(image.attrs.attachmentId).toBe(OUTSIDE_ID);
    expect(image.attrs.src).toBe(`/api/files/${OUTSIDE_ID}/shared.png`);
    expect(storageService.copy).not.toHaveBeenCalled();
    expect(attachmentInserts).toHaveLength(0);
  });
});
