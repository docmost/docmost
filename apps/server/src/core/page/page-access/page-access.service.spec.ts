import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PageAccessService } from './page-access.service';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import { buildApprovalState } from '../approval/page-approval.utils';
import { ApprovalState } from '../approval/page-approval.types';

const USER = { id: 'user-1' } as any;
const PAGE = { id: 'page-1', spaceId: 'space-1', isBase: false } as any;

const UNRESTRICTED = { hasAnyRestriction: false, canAccess: true, canEdit: true };
const RESTRICTED_NO_ACCESS = {
  hasAnyRestriction: true,
  canAccess: false,
  canEdit: false,
};
const RESTRICTED_READER = {
  hasAnyRestriction: true,
  canAccess: true,
  canEdit: false,
};
const RESTRICTED_WRITER = {
  hasAnyRestriction: true,
  canAccess: true,
  canEdit: true,
};

const UNCONTROLLED = buildApprovalState({ isBase: false });
const IN_REVIEW = buildApprovalState({
  isBase: false,
  verificationId: 'verification-1',
  verificationType: 'qms',
  verificationStatus: 'in_approval',
  readerVersionId: 'history-1',
});
const UNPUBLISHED = buildApprovalState({
  isBase: false,
  spaceSettings: { approval: { enabled: true, approverIds: [] } },
});

function makeService(
  opts: {
    role?: 'admin' | 'writer' | 'reader';
    restriction?: typeof UNRESTRICTED;
    hidden?: boolean;
    state?: ApprovalState;
    approver?: boolean;
    allowViewerComments?: boolean;
  } = {},
) {
  const role = 'role' in opts ? opts.role : 'writer';
  const restriction = opts.restriction ?? UNRESTRICTED;

  const spaceMemberRepo = {
    getUserSpaceRoles: jest.fn(async () =>
      role ? [{ userId: USER.id, role }] : undefined,
    ),
  };
  const pagePermissionRepo = {
    canUserEditPage: jest.fn(async () => restriction),
  };
  const spaceRepo = {
    findById: jest.fn(async () => ({
      settings: { comments: { allowViewerComments: !!opts.allowViewerComments } },
    })),
  };
  const pageApprovalService = {
    isHiddenFromUser: jest.fn(async () => !!opts.hidden),
    getState: jest.fn(async () => opts.state ?? UNCONTROLLED),
    isEffectiveApprover: jest.fn(async () => !!opts.approver),
    canAccessDraft: jest.fn(async () => true),
  };

  const service = new PageAccessService(
    pagePermissionRepo as any,
    new SpaceAbilityFactory(spaceMemberRepo as any),
    spaceRepo as any,
    pageApprovalService as any,
  );

  return {
    service,
    pageApprovalService,
    spaceMemberRepo,
    pagePermissionRepo,
    spaceRepo,
  };
}

describe('PageAccessService', () => {
  describe('validateCanView', () => {
    it('rejects with NotFoundException when the page is hidden from the user', async () => {
      const { service, pageApprovalService } = makeService({
        role: 'reader',
        hidden: true,
      });

      await expect(service.validateCanView(PAGE, USER)).rejects.toThrow(
        new NotFoundException('Page not found'),
      );
      expect(pageApprovalService.isHiddenFromUser).toHaveBeenCalledWith(
        USER.id,
        PAGE,
        undefined,
      );
    });

    it('passes when the page is not hidden', async () => {
      const { service, pageApprovalService } = makeService({
        role: 'reader',
        hidden: false,
      });

      await expect(service.validateCanView(PAGE, USER)).resolves.toBeUndefined();
      expect(pageApprovalService.isHiddenFromUser).toHaveBeenCalledWith(
        USER.id,
        PAGE,
        undefined,
      );
    });

    it('keeps ForbiddenException for a restricted page without revealing whether it is hidden', async () => {
      const { service, pageApprovalService } = makeService({
        role: 'reader',
        restriction: RESTRICTED_NO_ACCESS,
        hidden: true,
      });

      await expect(service.validateCanView(PAGE, USER)).rejects.toThrow(
        ForbiddenException,
      );
      expect(pageApprovalService.isHiddenFromUser).not.toHaveBeenCalled();
    });

    it('never hides a page from a user who can edit it', async () => {
      const writer = makeService({ role: 'writer', hidden: true });
      const pageLevelWriter = makeService({
        role: 'reader',
        restriction: RESTRICTED_WRITER,
        hidden: true,
      });

      await expect(
        writer.service.validateCanView(PAGE, USER),
      ).resolves.toBeUndefined();
      await expect(
        pageLevelWriter.service.validateCanView(PAGE, USER),
      ).resolves.toBeUndefined();
      expect(writer.pageApprovalService.isHiddenFromUser).not.toHaveBeenCalled();
      expect(
        pageLevelWriter.pageApprovalService.isHiddenFromUser,
      ).not.toHaveBeenCalled();
    });

    it('checks a space writer who is only a page-level reader like a reader', async () => {
      const { service } = makeService({
        role: 'writer',
        restriction: RESTRICTED_READER,
        hidden: true,
      });

      await expect(service.validateCanView(PAGE, USER)).rejects.toThrow(
        new NotFoundException('Page not found'),
      );
    });
  });

  describe('validateCanViewWithPermissions', () => {
    it('returns approval.canAccessDraft from the approval service', async () => {
      const approver = makeService({
        role: 'reader',
        state: IN_REVIEW,
        approver: true,
      });
      const reader = makeService({
        role: 'reader',
        state: IN_REVIEW,
        approver: false,
      });

      const approverResult = await approver.service.validateCanViewWithPermissions(
        PAGE,
        USER,
      );
      const readerResult = await reader.service.validateCanViewWithPermissions(
        PAGE,
        USER,
      );

      expect(approverResult.approval.canAccessDraft).toBe(true);
      expect(readerResult.approval.canAccessDraft).toBe(false);
      expect(
        approver.pageApprovalService.isEffectiveApprover,
      ).toHaveBeenCalledWith(USER.id, PAGE, IN_REVIEW);
    });

    it('asks a reader of a controlled page only for approval rights, reusing its own permission lookups', async () => {
      const { service, pageApprovalService, spaceMemberRepo, pagePermissionRepo } =
        makeService({ role: 'reader', state: IN_REVIEW, approver: true });

      await service.validateCanViewWithPermissions(PAGE, USER);

      expect(pageApprovalService.isEffectiveApprover).toHaveBeenCalledTimes(1);
      expect(pageApprovalService.canAccessDraft).not.toHaveBeenCalled();
      expect(spaceMemberRepo.getUserSpaceRoles).toHaveBeenCalledTimes(1);
      expect(pagePermissionRepo.canUserEditPage).toHaveBeenCalledTimes(1);
    });

    it('on an uncontrolled page does not call canAccessDraft for a reader but still checks hidden ancestors', async () => {
      const { service, pageApprovalService } = makeService({
        role: 'reader',
        state: UNCONTROLLED,
      });

      const result = await service.validateCanViewWithPermissions(PAGE, USER);

      expect(result.approval.canAccessDraft).toBe(false);
      expect(pageApprovalService.canAccessDraft).not.toHaveBeenCalled();
      expect(pageApprovalService.isEffectiveApprover).not.toHaveBeenCalled();
      expect(pageApprovalService.isHiddenFromUser).toHaveBeenCalledTimes(1);
      expect(pageApprovalService.isHiddenFromUser).toHaveBeenCalledWith(
        USER.id,
        PAGE,
        UNCONTROLLED,
      );
    });

    it('rejects a reader of an uncontrolled page under an unpublished ancestor', async () => {
      const { service } = makeService({
        role: 'reader',
        state: UNCONTROLLED,
        hidden: true,
      });

      await expect(
        service.validateCanViewWithPermissions(PAGE, USER),
      ).rejects.toThrow(new NotFoundException('Page not found'));
    });

    it('rejects with NotFoundException when the page is hidden from the user', async () => {
      const { service, pageApprovalService } = makeService({
        role: 'reader',
        hidden: true,
        state: UNPUBLISHED,
      });

      await expect(
        service.validateCanViewWithPermissions(PAGE, USER),
      ).rejects.toThrow(new NotFoundException('Page not found'));
      expect(pageApprovalService.isHiddenFromUser).toHaveBeenCalledWith(
        USER.id,
        PAGE,
        UNPUBLISHED,
      );
    });

    it('keeps ForbiddenException for a restricted page without revealing whether it is hidden', async () => {
      const { service, pageApprovalService } = makeService({
        role: 'reader',
        restriction: RESTRICTED_NO_ACCESS,
        hidden: true,
        state: UNPUBLISHED,
      });

      await expect(
        service.validateCanViewWithPermissions(PAGE, USER),
      ).rejects.toThrow(ForbiddenException);
      expect(pageApprovalService.getState).not.toHaveBeenCalled();
      expect(pageApprovalService.isHiddenFromUser).not.toHaveBeenCalled();
    });

    it('rejects a space writer who is only a page-level reader of a hidden page', async () => {
      const { service, pageApprovalService } = makeService({
        role: 'writer',
        restriction: RESTRICTED_READER,
        hidden: true,
        state: UNPUBLISHED,
        approver: false,
      });

      await expect(
        service.validateCanViewWithPermissions(PAGE, USER),
      ).rejects.toThrow(new NotFoundException('Page not found'));
      expect(pageApprovalService.isEffectiveApprover).toHaveBeenCalledWith(
        USER.id,
        PAGE,
        UNPUBLISHED,
      );
    });

    it('returns locked only to users with draft access', async () => {
      const reader = makeService({
        role: 'reader',
        state: IN_REVIEW,
        approver: false,
      });
      const approver = makeService({
        role: 'reader',
        state: IN_REVIEW,
        approver: true,
      });

      const readerResult = await reader.service.validateCanViewWithPermissions(
        PAGE,
        USER,
      );
      const approverResult = await approver.service.validateCanViewWithPermissions(
        PAGE,
        USER,
      );

      expect(readerResult.approval).toEqual({
        controlled: true,
        canAccessDraft: false,
        locked: false,
        unpublished: false,
      });
      expect(approverResult.approval.locked).toBe(true);
      expect(approverResult.canEdit).toBe(false);
    });

    it('returns controlled and unpublished from the approval state', async () => {
      const { service } = makeService({ role: 'writer', state: UNPUBLISHED });

      const result = await service.validateCanViewWithPermissions(PAGE, USER);

      expect(result).toEqual({
        canEdit: true,
        hasRestriction: false,
        approval: {
          controlled: true,
          canAccessDraft: true,
          locked: false,
          unpublished: true,
        },
      });
    });

    it('treats editors as draft users without the approver or hidden lookups', async () => {
      const { service, pageApprovalService } = makeService({
        role: 'writer',
        state: IN_REVIEW,
        approver: false,
        hidden: true,
      });

      const result = await service.validateCanViewWithPermissions(PAGE, USER);

      expect(result.approval.canAccessDraft).toBe(true);
      expect(result.approval.locked).toBe(true);
      expect(pageApprovalService.isEffectiveApprover).not.toHaveBeenCalled();
      expect(pageApprovalService.canAccessDraft).not.toHaveBeenCalled();
      expect(pageApprovalService.isHiddenFromUser).not.toHaveBeenCalled();
    });

    it('lets an approver open a page hidden from readers', async () => {
      const { service, pageApprovalService } = makeService({
        role: 'reader',
        state: UNPUBLISHED,
        approver: true,
        hidden: true,
      });

      const result = await service.validateCanViewWithPermissions(PAGE, USER);

      expect(result.approval).toEqual({
        controlled: true,
        canAccessDraft: true,
        locked: false,
        unpublished: true,
      });
      expect(pageApprovalService.isHiddenFromUser).not.toHaveBeenCalled();
    });

    it('reports an uncontrolled page as such', async () => {
      const { service } = makeService({ role: 'reader' });

      const result = await service.validateCanViewWithPermissions(PAGE, USER);

      expect(result.canEdit).toBe(false);
      expect(result.approval).toEqual({
        controlled: false,
        canAccessDraft: false,
        locked: false,
        unpublished: false,
      });
    });
  });

  describe('getDraftAccess', () => {
    it('is edit access on an uncontrolled page, without the approver or hidden lookups', async () => {
      const reader = makeService({ role: 'reader', approver: true, hidden: true });
      const writer = makeService({ role: 'writer', approver: false });

      const readerAccess = await reader.service.getDraftAccess(PAGE, USER);
      const writerAccess = await writer.service.getDraftAccess(PAGE, USER);

      expect(readerAccess).toMatchObject({ canEdit: false, canAccessDraft: false });
      expect(readerAccess.state.controlled).toBe(false);
      expect(writerAccess).toMatchObject({ canEdit: true, canAccessDraft: true });
      expect(reader.pageApprovalService.isEffectiveApprover).not.toHaveBeenCalled();
      expect(reader.pageApprovalService.isHiddenFromUser).not.toHaveBeenCalled();
    });

    it('counts an effective approver of a controlled page without the hidden lookup', async () => {
      const { service, pageApprovalService } = makeService({
        role: 'reader',
        state: UNPUBLISHED,
        approver: true,
        hidden: true,
      });

      expect(await service.getDraftAccess(PAGE, USER)).toMatchObject({
        canEdit: false,
        canAccessDraft: true,
      });
      expect(pageApprovalService.isHiddenFromUser).not.toHaveBeenCalled();
    });
  });

  describe('validateCanEdit', () => {
    it('rejects a hidden page with NotFoundException instead of ForbiddenException', async () => {
      const { service } = makeService({ role: 'reader', hidden: true });

      await expect(service.validateCanEdit(PAGE, USER)).rejects.toThrow(
        new NotFoundException('Page not found'),
      );
    });

    it('rejects readers of a visible page with ForbiddenException', async () => {
      const { service } = makeService({ role: 'reader', hidden: false });

      await expect(service.validateCanEdit(PAGE, USER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('keeps ForbiddenException for a restricted page without revealing whether it is hidden', async () => {
      const { service, pageApprovalService } = makeService({
        role: 'writer',
        restriction: RESTRICTED_NO_ACCESS,
        hidden: true,
      });

      await expect(service.validateCanEdit(PAGE, USER)).rejects.toThrow(
        ForbiddenException,
      );
      expect(pageApprovalService.isHiddenFromUser).not.toHaveBeenCalled();
    });

    it('lets editors edit without the hidden lookup', async () => {
      const writer = makeService({ role: 'writer', hidden: true });
      const pageLevelWriter = makeService({
        role: 'reader',
        restriction: RESTRICTED_WRITER,
        hidden: true,
      });

      await expect(writer.service.validateCanEdit(PAGE, USER)).resolves.toEqual({
        hasRestriction: false,
      });
      await expect(
        pageLevelWriter.service.validateCanEdit(PAGE, USER),
      ).resolves.toEqual({ hasRestriction: true });
      expect(writer.pageApprovalService.isHiddenFromUser).not.toHaveBeenCalled();
      expect(
        pageLevelWriter.pageApprovalService.isHiddenFromUser,
      ).not.toHaveBeenCalled();
    });

    it('rejects a space writer who is only a page-level reader of a hidden page with NotFoundException', async () => {
      const { service } = makeService({
        role: 'writer',
        restriction: RESTRICTED_READER,
        hidden: true,
      });

      await expect(service.validateCanEdit(PAGE, USER)).rejects.toThrow(
        new NotFoundException('Page not found'),
      );
    });
  });

  describe('validateCanComment', () => {
    it('rejects a hidden page with NotFoundException even when viewer comments are allowed', async () => {
      const { service } = makeService({
        role: 'reader',
        hidden: true,
        allowViewerComments: true,
      });

      await expect(
        service.validateCanComment(PAGE, USER, 'workspace-1'),
      ).rejects.toThrow(new NotFoundException('Page not found'));
    });

    it('lets readers comment on a visible page when viewer comments are allowed', async () => {
      const { service } = makeService({
        role: 'reader',
        hidden: false,
        allowViewerComments: true,
      });

      await expect(
        service.validateCanComment(PAGE, USER, 'workspace-1'),
      ).resolves.toBeUndefined();
    });

    it('runs the access and hidden lookups once for a non-editor', async () => {
      const { service, pageApprovalService, spaceMemberRepo, pagePermissionRepo } =
        makeService({ role: 'reader', hidden: false, allowViewerComments: true });

      await service.validateCanComment(PAGE, USER, 'workspace-1');

      expect(pageApprovalService.isHiddenFromUser).toHaveBeenCalledTimes(1);
      expect(spaceMemberRepo.getUserSpaceRoles).toHaveBeenCalledTimes(1);
      expect(pagePermissionRepo.canUserEditPage).toHaveBeenCalledTimes(1);
    });

    it('rejects readers when viewer comments are off', async () => {
      const { service } = makeService({
        role: 'reader',
        hidden: false,
        allowViewerComments: false,
      });

      await expect(
        service.validateCanComment(PAGE, USER, 'workspace-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('keeps ForbiddenException for a restricted page without revealing whether it is hidden', async () => {
      const { service, pageApprovalService } = makeService({
        role: 'writer',
        restriction: RESTRICTED_NO_ACCESS,
        hidden: true,
        allowViewerComments: true,
      });

      await expect(
        service.validateCanComment(PAGE, USER, 'workspace-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(pageApprovalService.isHiddenFromUser).not.toHaveBeenCalled();
    });

    it('lets editors comment without the hidden lookup or the space settings', async () => {
      const { service, pageApprovalService, spaceRepo } = makeService({
        role: 'writer',
        hidden: true,
      });

      await expect(
        service.validateCanComment(PAGE, USER, 'workspace-1'),
      ).resolves.toBeUndefined();
      expect(pageApprovalService.isHiddenFromUser).not.toHaveBeenCalled();
      expect(spaceRepo.findById).not.toHaveBeenCalled();
    });
  });
});
