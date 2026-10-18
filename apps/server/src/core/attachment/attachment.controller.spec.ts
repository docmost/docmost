import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttachmentController } from './attachment.controller';
import { PAGE_LOCKED_MESSAGE } from '../page/approval/page-approval.utils';

const WORKSPACE = { id: 'ws-1', hostname: 'acme' } as any;
const USER = { id: 'user-1', workspaceId: 'ws-1' } as any;
const PAGE_ID = '01a14cce-0000-7000-8000-0000000000b1';
const FILE_ID = '01a14cce-0000-7000-8000-0000000000a1';
const PAGE = {
  id: PAGE_ID,
  spaceId: 'space-1',
  workspaceId: 'ws-1',
  isBase: false,
} as any;
const PUBLISHED_AT = new Date('2026-10-01T00:00:00Z');

type Approval = {
  controlled: boolean;
  canAccessDraft: boolean;
  locked: boolean;
  unpublished: boolean;
};

const READER: Approval = {
  controlled: true,
  canAccessDraft: false,
  locked: false,
  unpublished: false,
};
const DRAFT_USER: Approval = { ...READER, canAccessDraft: true };
const UNCONTROLLED_VIEWER: Approval = { ...READER, controlled: false };

const attachment = (overrides: Record<string, unknown> = {}) => ({
  id: FILE_ID,
  type: 'file',
  fileName: 'report.pdf',
  filePath: `ws-1/files/${FILE_ID}/report.pdf`,
  fileExt: '.pdf',
  fileSize: 3,
  mimeType: 'application/pdf',
  pageId: PAGE_ID,
  spaceId: 'space-1',
  workspaceId: 'ws-1',
  aiChatId: null,
  creatorId: 'user-2',
  publishedAt: null,
  deletedAt: null,
  ...overrides,
});

function makeController(
  opts: {
    attachment?: Record<string, unknown>;
    approval?: Approval;
    state?: { controlled: boolean; locked: boolean };
  } = {},
) {
  const approval = opts.approval ?? UNCONTROLLED_VIEWER;
  const attachmentService = {
    uploadFile: jest.fn(async () => attachment({ id: 'new-id' })),
  };
  const storageService = { readStream: jest.fn(async () => 'stream') };
  const pageRepo = { findById: jest.fn(async () => ({ ...PAGE })) };
  const attachmentRepo = {
    findById: jest.fn(async () => opts.attachment),
    findPageAttachments: jest.fn(async () => ({ items: [], meta: {} })),
  };
  const environmentService = { getFileUploadSizeLimit: () => '50mb' };
  const tokenService = {
    verifyJwt: jest.fn(async () => ({
      attachmentId: FILE_ID,
      pageId: PAGE_ID,
      workspaceId: 'ws-1',
    })),
  };
  const pageAccessService = {
    validateCanView: jest.fn(async () => undefined),
    validateCanEdit: jest.fn(async () => ({ hasRestriction: false })),
    validateCanViewWithPermissions: jest.fn(async () => ({
      canEdit: approval.canAccessDraft,
      hasRestriction: false,
      approval,
    })),
  };
  const domainService = { getUrl: () => 'https://acme.example.test' };
  const auditService = { log: jest.fn() };
  const pageApprovalService = {
    getState: jest.fn(async () => ({
      controlled: false,
      locked: false,
      ...opts.state,
    })),
  };

  const controller = new AttachmentController(
    attachmentService as any,
    storageService as any,
    {} as any,
    {} as any,
    pageRepo as any,
    attachmentRepo as any,
    environmentService as any,
    tokenService as any,
    pageAccessService as any,
    domainService as any,
    auditService as any,
    pageApprovalService as any,
  );

  return {
    controller,
    attachmentService,
    storageService,
    attachmentRepo,
    pageAccessService,
    pageApprovalService,
  };
}

function fakeReply() {
  const res: any = {};
  res.header = jest.fn(() => res);
  res.headers = jest.fn(() => res);
  res.status = jest.fn(() => res);
  res.send = jest.fn((body?: unknown) => body);
  return res;
}

const REQ = { headers: {} } as any;

describe('AttachmentController GET /files/:fileId', () => {
  const getFile = (controller: AttachmentController) =>
    controller.getFile(REQ, fakeReply(), USER, WORKSPACE, FILE_ID, 'report.pdf');

  it('hides an unpublished attachment of a controlled page from readers', async () => {
    const { controller, storageService } = makeController({
      attachment: attachment(),
      approval: READER,
    });

    await expect(getFile(controller)).rejects.toBeInstanceOf(NotFoundException);
    expect(storageService.readStream).not.toHaveBeenCalled();
  });

  it('serves an unpublished attachment of a controlled page to draft users', async () => {
    const { controller, storageService } = makeController({
      attachment: attachment(),
      approval: DRAFT_USER,
    });

    await getFile(controller);

    expect(storageService.readStream).toHaveBeenCalledWith(
      `ws-1/files/${FILE_ID}/report.pdf`,
    );
  });

  it('serves a published attachment to readers with the plain view check', async () => {
    const { controller, storageService, pageAccessService } = makeController({
      attachment: attachment({ publishedAt: PUBLISHED_AT }),
      approval: READER,
    });

    await getFile(controller);

    expect(pageAccessService.validateCanView).toHaveBeenCalled();
    expect(
      pageAccessService.validateCanViewWithPermissions,
    ).not.toHaveBeenCalled();
    expect(storageService.readStream).toHaveBeenCalled();
  });

  it('serves unpublished attachments of uncontrolled pages to viewers', async () => {
    const { controller, storageService } = makeController({
      attachment: attachment(),
      approval: UNCONTROLLED_VIEWER,
    });

    await getFile(controller);

    expect(storageService.readStream).toHaveBeenCalled();
  });

  it('refuses soft-deleted attachments to everyone', async () => {
    const { controller, storageService, pageAccessService } = makeController({
      attachment: attachment({
        publishedAt: PUBLISHED_AT,
        deletedAt: new Date(),
      }),
      approval: DRAFT_USER,
    });

    await expect(getFile(controller)).rejects.toBeInstanceOf(NotFoundException);
    expect(pageAccessService.validateCanView).not.toHaveBeenCalled();
    expect(storageService.readStream).not.toHaveBeenCalled();
  });
});

describe('AttachmentController GET /files/public/:fileId', () => {
  const getPublicFile = (controller: AttachmentController) =>
    controller.getPublicFile(
      REQ,
      fakeReply(),
      WORKSPACE,
      FILE_ID,
      'report.pdf',
      'jwt',
    );

  it('hides an unpublished attachment of a controlled page', async () => {
    const { controller, storageService } = makeController({
      attachment: attachment(),
      state: { controlled: true, locked: false },
    });

    await expect(getPublicFile(controller)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(storageService.readStream).not.toHaveBeenCalled();
  });

  it('serves unpublished attachments of uncontrolled pages', async () => {
    const { controller, storageService, pageApprovalService } =
      makeController({
        attachment: attachment(),
        state: { controlled: false, locked: false },
      });

    await getPublicFile(controller);

    expect(pageApprovalService.getState).toHaveBeenCalledWith(
      expect.objectContaining({ id: PAGE_ID }),
    );
    expect(storageService.readStream).toHaveBeenCalled();
  });

  it('serves published attachments without reading the approval state', async () => {
    const { controller, storageService, pageApprovalService } =
      makeController({
        attachment: attachment({ publishedAt: PUBLISHED_AT }),
        state: { controlled: true, locked: false },
      });

    await getPublicFile(controller);

    expect(pageApprovalService.getState).not.toHaveBeenCalled();
    expect(storageService.readStream).toHaveBeenCalled();
  });

  it('refuses soft-deleted attachments', async () => {
    const { controller, storageService } = makeController({
      attachment: attachment({
        publishedAt: PUBLISHED_AT,
        deletedAt: new Date(),
      }),
    });

    await expect(getPublicFile(controller)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(storageService.readStream).not.toHaveBeenCalled();
  });
});

describe('AttachmentController POST /files/info', () => {
  const info = (controller: AttachmentController) =>
    controller.getAttachmentInfo({ attachmentId: FILE_ID }, WORKSPACE, USER);

  it('hides an unpublished attachment of a controlled page from readers', async () => {
    const { controller } = makeController({
      attachment: attachment(),
      approval: READER,
    });

    await expect(info(controller)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses soft-deleted attachments to everyone', async () => {
    const { controller } = makeController({
      attachment: attachment({ deletedAt: new Date() }),
      approval: DRAFT_USER,
    });

    await expect(info(controller)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns metadata of an unpublished attachment to draft users', async () => {
    const { controller } = makeController({
      attachment: attachment(),
      approval: DRAFT_USER,
    });

    const result: any = await info(controller);

    expect(result.id).toBe(FILE_ID);
    expect(result.url).toBe(
      `https://acme.example.test/api/files/${FILE_ID}/report.pdf`,
    );
  });
});

describe('AttachmentController POST /pages/attachments', () => {
  const list = (controller: AttachmentController) =>
    controller.getPageAttachments(
      { pageId: PAGE_ID },
      { limit: 20 } as any,
      USER,
      WORKSPACE,
    );

  it('lists only published attachments to readers of a controlled page', async () => {
    const { controller, attachmentRepo } = makeController({
      approval: READER,
    });

    await list(controller);

    expect(attachmentRepo.findPageAttachments).toHaveBeenCalledWith(
      PAGE_ID,
      expect.anything(),
      { publishedOnly: true },
    );
  });

  it.each([
    ['draft users', DRAFT_USER],
    ['viewers of uncontrolled pages', UNCONTROLLED_VIEWER],
  ])('lists every attachment to %s', async (_label, approval) => {
    const { controller, attachmentRepo } = makeController({ approval });

    await list(controller);

    expect(attachmentRepo.findPageAttachments).toHaveBeenCalledWith(
      PAGE_ID,
      expect.anything(),
      { publishedOnly: false },
    );
  });
});

describe('AttachmentController POST /files/upload', () => {
  const uploadRequest = (attachmentId?: string) => ({
    file: jest.fn(async () => ({
      fields: {
        pageId: { value: PAGE_ID },
        ...(attachmentId ? { attachmentId: { value: attachmentId } } : {}),
      },
    })),
  });

  it('refuses a replace on a locked page with the lock message', async () => {
    const { controller, attachmentService } = makeController({
      state: { controlled: true, locked: true },
    });

    const error = await controller
      .uploadFile(uploadRequest(FILE_ID), fakeReply(), USER, WORKSPACE)
      .catch((err) => err);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe(PAGE_LOCKED_MESSAGE);
    expect(attachmentService.uploadFile).not.toHaveBeenCalled();
  });

  it('passes the approval state to the service for a replace', async () => {
    const { controller, attachmentService } = makeController({
      state: { controlled: true, locked: false },
    });

    await controller.uploadFile(
      uploadRequest(FILE_ID),
      fakeReply(),
      USER,
      WORKSPACE,
    );

    expect(attachmentService.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentId: FILE_ID,
        approval: expect.objectContaining({ controlled: true, locked: false }),
      }),
    );
  });

  it('skips the approval lookup for a new upload', async () => {
    const { controller, attachmentService, pageApprovalService } =
      makeController({ state: { controlled: true, locked: true } });

    await controller.uploadFile(uploadRequest(), fakeReply(), USER, WORKSPACE);

    expect(pageApprovalService.getState).not.toHaveBeenCalled();
    expect(attachmentService.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ attachmentId: undefined, approval: null }),
    );
  });
});
