import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import { AttachmentService } from './attachment.service';
import { PAGE_LOCKED_MESSAGE } from '../../page/approval/page-approval.utils';

const WORKSPACE_ID = '01a14cce-0000-7000-8000-0000000000f1';
const PAGE_ID = '01a14cce-0000-7000-8000-0000000000b1';
const SPACE_ID = '01a14cce-0000-7000-8000-0000000000c1';
const EXISTING_ID = '01a14cce-0000-7000-8000-0000000000a1';
const NEW_BODY = '<svg>new</svg>';

const existingAttachment = (overrides: Record<string, unknown> = {}) => ({
  id: EXISTING_ID,
  type: 'file',
  fileName: 'diagram.drawio.svg',
  filePath: `${WORKSPACE_ID}/files/${EXISTING_ID}/diagram.drawio.svg`,
  fileExt: '.svg',
  fileSize: 10,
  pageId: PAGE_ID,
  spaceId: SPACE_ID,
  workspaceId: WORKSPACE_ID,
  publishedAt: null,
  deletedAt: null,
  ...overrides,
});

function makeService(existing: Record<string, unknown> | null) {
  const uploads: { path: string; body: string }[] = [];
  const storageService = {
    upload: jest.fn(async (path: string, stream: Readable) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      uploads.push({ path, body: Buffer.concat(chunks).toString() });
    }),
  };
  const attachmentRepo = {
    findById: jest.fn(async () => existing),
    insertAttachment: jest.fn(async (values: Record<string, unknown>) => ({
      ...values,
      publishedAt: null,
      deletedAt: null,
    })),
    updateAttachment: jest.fn(
      async (values: Record<string, unknown>, id: string) => ({
        ...existing,
        ...values,
        id,
      }),
    ),
  };
  const attachmentQueue = { add: jest.fn() };

  const service = new AttachmentService(
    storageService as any,
    attachmentRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    attachmentQueue as any,
  );

  return { service, storageService, attachmentRepo, uploads };
}

function upload(
  service: AttachmentService,
  approval: { controlled: boolean; locked: boolean } | null | undefined,
  attachmentId: string | null = EXISTING_ID,
) {
  return service.uploadFile({
    filePromise: Promise.resolve({
      filename: 'diagram.drawio.svg',
      file: Readable.from([Buffer.from(NEW_BODY)]),
    } as any),
    pageId: PAGE_ID,
    spaceId: SPACE_ID,
    userId: 'user-1',
    workspaceId: WORKSPACE_ID,
    attachmentId: attachmentId ?? undefined,
    approval,
  });
}

describe('AttachmentService.uploadFile', () => {
  it('copies a published attachment to a new id and leaves the old file untouched', async () => {
    const { service, attachmentRepo, uploads } = makeService(
      existingAttachment({ publishedAt: new Date('2026-10-01T00:00:00Z') }),
    );

    const result = await upload(service, { controlled: false, locked: false });

    expect(result.id).not.toBe(EXISTING_ID);
    expect(result.publishedAt).toBeNull();
    expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
    expect(attachmentRepo.insertAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.id,
        pageId: PAGE_ID,
        spaceId: SPACE_ID,
        workspaceId: WORKSPACE_ID,
        filePath: `${WORKSPACE_ID}/files/${result.id}/diagram.drawio.svg`,
      }),
      undefined,
    );
    expect(uploads).toEqual([
      {
        path: `${WORKSPACE_ID}/files/${result.id}/diagram.drawio.svg`,
        body: NEW_BODY,
      },
    ]);
  });

  it('copies an unpublished attachment on a controlled page', async () => {
    const { service, attachmentRepo, uploads } = makeService(
      existingAttachment(),
    );

    const result = await upload(service, { controlled: true, locked: false });

    expect(result.id).not.toBe(EXISTING_ID);
    expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
    expect(uploads.map((u) => u.path)).toEqual([
      `${WORKSPACE_ID}/files/${result.id}/diagram.drawio.svg`,
    ]);
  });

  it('replaces an unpublished attachment in place on an uncontrolled page', async () => {
    const { service, attachmentRepo, uploads } = makeService(
      existingAttachment(),
    );

    const result = await upload(service, { controlled: false, locked: false });

    expect(result.id).toBe(EXISTING_ID);
    expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
    expect(attachmentRepo.updateAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ fileSize: NEW_BODY.length }),
      EXISTING_ID,
    );
    expect(uploads.map((u) => u.path)).toEqual([
      `${WORKSPACE_ID}/files/${EXISTING_ID}/diagram.drawio.svg`,
    ]);
  });

  it('refuses a replace on a locked page before writing anything', async () => {
    const { service, storageService, attachmentRepo } = makeService(
      existingAttachment(),
    );

    const error = await upload(service, {
      controlled: true,
      locked: true,
    }).catch((err) => err);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe(PAGE_LOCKED_MESSAGE);
    expect(storageService.upload).not.toHaveBeenCalled();
    expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
    expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
  });

  it('never overwrites in place when the approval state is unknown', async () => {
    const { service, attachmentRepo } = makeService(existingAttachment());

    const result = await upload(service, undefined);

    expect(result.id).not.toBe(EXISTING_ID);
    expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
  });

  it('stores a new upload under a new id', async () => {
    const { service, attachmentRepo } = makeService(null);

    const result = await upload(service, null, null);

    expect(attachmentRepo.findById).not.toHaveBeenCalled();
    expect(attachmentRepo.insertAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ id: result.id, pageId: PAGE_ID }),
      undefined,
    );
  });
});
