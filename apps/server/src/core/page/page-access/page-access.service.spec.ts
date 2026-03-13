import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PageAccessService } from './page-access.service';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { SpaceRole } from '../../../common/helpers/types/permission';

describe('PageAccessService', () => {
  let service: PageAccessService;
  let spaceMemberRepo: jest.Mocked<SpaceMemberRepo>;
  let pagePermissionRepo: jest.Mocked<PagePermissionRepo>;

  const mockUser = { id: 'user-1' } as any;
  const mockPage = { id: 'page-1', spaceId: 'space-1' } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PageAccessService,
        SpaceAbilityFactory,
        {
          provide: SpaceMemberRepo,
          useValue: {
            getUserSpaceRoles: jest.fn(),
          },
        },
        {
          provide: PagePermissionRepo,
          useValue: {
            canUserAccessPage: jest.fn(),
            canUserEditPage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PageAccessService);
    spaceMemberRepo = module.get(SpaceMemberRepo);
    pagePermissionRepo = module.get(PagePermissionRepo);
  });

  function setRole(role: SpaceRole) {
    spaceMemberRepo.getUserSpaceRoles.mockResolvedValue([{ role }] as any);
  }

  function setPageNoRestrictions() {
    pagePermissionRepo.canUserAccessPage.mockResolvedValue(true);
    pagePermissionRepo.canUserEditPage.mockResolvedValue({
      hasAnyRestriction: false,
      canAccess: true,
      canEdit: false,
    } as any);
  }

  function setPageWithRestrictions(canAccess: boolean, canEdit: boolean) {
    pagePermissionRepo.canUserAccessPage.mockResolvedValue(canAccess);
    pagePermissionRepo.canUserEditPage.mockResolvedValue({
      hasAnyRestriction: true,
      canAccess,
      canEdit,
    } as any);
  }

  // ─── validateCanComment ───────────────────────────────────────────

  describe('validateCanComment', () => {
    describe('READER role', () => {
      beforeEach(() => setRole(SpaceRole.READER));

      it('allows commenting on an accessible page', async () => {
        setPageNoRestrictions();
        await expect(
          service.validateCanComment(mockPage, mockUser),
        ).resolves.toBeUndefined();
      });

      it('throws if page has restrictions and user cannot access', async () => {
        pagePermissionRepo.canUserAccessPage.mockResolvedValue(false);
        await expect(
          service.validateCanComment(mockPage, mockUser),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('WRITER role', () => {
      beforeEach(() => setRole(SpaceRole.WRITER));

      it('allows commenting', async () => {
        setPageNoRestrictions();
        await expect(
          service.validateCanComment(mockPage, mockUser),
        ).resolves.toBeUndefined();
      });
    });

    describe('ADMIN role', () => {
      beforeEach(() => setRole(SpaceRole.ADMIN));

      it('allows commenting', async () => {
        setPageNoRestrictions();
        await expect(
          service.validateCanComment(mockPage, mockUser),
        ).resolves.toBeUndefined();
      });
    });
  });

  // ─── validateCanEdit (regression) ─────────────────────────────────

  describe('validateCanEdit', () => {
    describe('READER role', () => {
      beforeEach(() => setRole(SpaceRole.READER));

      it('throws ForbiddenException — READERs still cannot edit', async () => {
        setPageNoRestrictions();
        pagePermissionRepo.canUserEditPage.mockResolvedValue({
          hasAnyRestriction: false,
          canAccess: true,
          canEdit: false,
        } as any);
        await expect(
          service.validateCanEdit(mockPage, mockUser),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('WRITER role', () => {
      beforeEach(() => setRole(SpaceRole.WRITER));

      it('allows editing', async () => {
        setPageNoRestrictions();
        const result = await service.validateCanEdit(mockPage, mockUser);
        expect(result).toEqual({ hasRestriction: false });
      });
    });

    describe('ADMIN role', () => {
      beforeEach(() => setRole(SpaceRole.ADMIN));

      it('allows editing', async () => {
        setPageNoRestrictions();
        const result = await service.validateCanEdit(mockPage, mockUser);
        expect(result).toEqual({ hasRestriction: false });
      });
    });
  });

  // ─── validateCanViewWithPermissions ───────────────────────────────

  describe('validateCanViewWithPermissions', () => {
    describe('READER role', () => {
      beforeEach(() => setRole(SpaceRole.READER));

      it('returns canEdit=false, canComment=true', async () => {
        setPageNoRestrictions();
        const result = await service.validateCanViewWithPermissions(
          mockPage,
          mockUser,
        );
        expect(result.canEdit).toBe(false);
        expect(result.canComment).toBe(true);
      });
    });

    describe('WRITER role', () => {
      beforeEach(() => setRole(SpaceRole.WRITER));

      it('returns canEdit=true, canComment=true', async () => {
        setPageNoRestrictions();
        const result = await service.validateCanViewWithPermissions(
          mockPage,
          mockUser,
        );
        expect(result.canEdit).toBe(true);
        expect(result.canComment).toBe(true);
      });
    });

    describe('READER with page-level restriction (no access)', () => {
      beforeEach(() => setRole(SpaceRole.READER));

      it('throws ForbiddenException', async () => {
        setPageWithRestrictions(false, false);
        await expect(
          service.validateCanViewWithPermissions(mockPage, mockUser),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('READER with page-level restriction (has access)', () => {
      beforeEach(() => setRole(SpaceRole.READER));

      it('returns canEdit based on page permission, canComment=true', async () => {
        setPageWithRestrictions(true, false);
        const result = await service.validateCanViewWithPermissions(
          mockPage,
          mockUser,
        );
        expect(result.canEdit).toBe(false);
        expect(result.canComment).toBe(true);
        expect(result.hasRestriction).toBe(true);
      });
    });
  });

  // ─── validateCanView (regression) ─────────────────────────────────

  describe('validateCanView', () => {
    describe('READER role', () => {
      beforeEach(() => setRole(SpaceRole.READER));

      it('allows viewing accessible pages', async () => {
        pagePermissionRepo.canUserAccessPage.mockResolvedValue(true);
        await expect(
          service.validateCanView(mockPage, mockUser),
        ).resolves.toBeUndefined();
      });

      it('throws for inaccessible pages', async () => {
        pagePermissionRepo.canUserAccessPage.mockResolvedValue(false);
        await expect(
          service.validateCanView(mockPage, mockUser),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });
});
