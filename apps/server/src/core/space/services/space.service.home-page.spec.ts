import { BadRequestException } from '@nestjs/common';
import { SpaceService } from './space.service';

const SPACE_ID = '019a1f00-0000-7000-8000-000000000001';
const OTHER_SPACE_ID = '019a1f00-0000-7000-8000-000000000002';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000003';
const USER_ID = '019a1f00-0000-7000-8000-000000000004';
const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000005';

const livePage = {
  id: PAGE_ID,
  slugId: 'welcome01',
  title: 'Welcome',
  icon: '👋',
  spaceId: SPACE_ID,
  deletedAt: null,
};

describe('SpaceService home page', () => {
  const trx = {};

  function makeService(options: {
    page?: Record<string, unknown> | null;
    homePageId?: string | null;
    canAccess?: boolean;
  }) {
    const page = options.page === undefined ? livePage : options.page;
    const spaceRepo = {
      findById: jest.fn(async () => ({
        id: SPACE_ID,
        settings: {},
        homePageId: options.homePageId ?? null,
      })),
      updateSpace: jest.fn(async () => ({ id: SPACE_ID })),
    };
    const pageRepo = { findById: jest.fn(async () => page) };
    const pagePermissionRepo = {
      canUserAccessPage: jest.fn(async () => options.canAccess ?? true),
    };
    const auditService = { log: jest.fn() };
    const db = {
      transaction: () => ({
        execute: (callback: (t: unknown) => Promise<unknown>) => callback(trx),
      }),
    };

    const service = new SpaceService(
      spaceRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      db as any,
      {} as any,
      auditService as any,
      {} as any,
      pageRepo as any,
      pagePermissionRepo as any,
    );

    return { service, spaceRepo, pageRepo, pagePermissionRepo, auditService };
  }

  describe('getHomePage', () => {
    it('returns the page summary for a live, viewable page in the space', async () => {
      const { service } = makeService({ homePageId: PAGE_ID });

      await expect(
        service.getHomePage({ id: SPACE_ID, homePageId: PAGE_ID }, USER_ID),
      ).resolves.toEqual({
        id: PAGE_ID,
        slugId: 'welcome01',
        title: 'Welcome',
        icon: '👋',
      });
    });

    it('makes no queries when the space has no home page', async () => {
      const { service, pageRepo, pagePermissionRepo } = makeService({});

      await expect(
        service.getHomePage({ id: SPACE_ID, homePageId: null }, USER_ID),
      ).resolves.toBeNull();
      expect(pageRepo.findById).not.toHaveBeenCalled();
      expect(pagePermissionRepo.canUserAccessPage).not.toHaveBeenCalled();
    });

    it.each([
      ['the page is missing', { page: null }],
      [
        'the page is in another space',
        { page: { ...livePage, spaceId: OTHER_SPACE_ID } },
      ],
      ['the page is trashed', { page: { ...livePage, deletedAt: new Date() } }],
      ['the user cannot access the page', { canAccess: false }],
    ])('returns null when %s', async (_name, options) => {
      const { service } = makeService({ homePageId: PAGE_ID, ...options });

      await expect(
        service.getHomePage({ id: SPACE_ID, homePageId: PAGE_ID }, USER_ID),
      ).resolves.toBeNull();
    });
  });

  describe('updateSpace', () => {
    it.each([
      ['missing', { page: null }],
      ['in another space', { page: { ...livePage, spaceId: OTHER_SPACE_ID } }],
      ['trashed', { page: { ...livePage, deletedAt: new Date() } }],
    ])('rejects a home page that is %s', async (_name, options) => {
      const { service, spaceRepo } = makeService(options);

      await expect(
        service.updateSpace(
          { spaceId: SPACE_ID, homePageId: PAGE_ID } as any,
          WORKSPACE_ID,
        ),
      ).rejects.toThrow(
        new BadRequestException('Home page must be a page in this space'),
      );
      expect(spaceRepo.updateSpace).not.toHaveBeenCalled();
    });

    it('sets the home page and audits the change with titles', async () => {
      const { service, spaceRepo, auditService } = makeService({});

      await service.updateSpace(
        { spaceId: SPACE_ID, homePageId: PAGE_ID } as any,
        WORKSPACE_ID,
      );

      expect(spaceRepo.updateSpace).toHaveBeenCalledWith(
        expect.objectContaining({ homePageId: PAGE_ID }),
        SPACE_ID,
        WORKSPACE_ID,
        trx,
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: {
            before: { homePageId: null, homePageTitle: null },
            after: { homePageId: PAGE_ID, homePageTitle: 'Welcome' },
          },
        }),
      );
    });

    it('clears the home page and audits the change with titles', async () => {
      const { service, spaceRepo, auditService } = makeService({
        homePageId: PAGE_ID,
      });

      await service.updateSpace(
        { spaceId: SPACE_ID, homePageId: null } as any,
        WORKSPACE_ID,
      );

      expect(spaceRepo.updateSpace).toHaveBeenCalledWith(
        expect.objectContaining({ homePageId: null }),
        SPACE_ID,
        WORKSPACE_ID,
        trx,
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: {
            before: { homePageId: PAGE_ID, homePageTitle: 'Welcome' },
            after: { homePageId: null, homePageTitle: null },
          },
        }),
      );
    });

    it('writes the stored id when the request id differs only in case', async () => {
      const { service, spaceRepo, auditService } = makeService({
        homePageId: PAGE_ID,
      });

      await service.updateSpace(
        { spaceId: SPACE_ID, homePageId: PAGE_ID.toUpperCase() } as any,
        WORKSPACE_ID,
      );

      expect(spaceRepo.updateSpace).toHaveBeenCalledWith(
        expect.objectContaining({ homePageId: PAGE_ID }),
        SPACE_ID,
        WORKSPACE_ID,
        trx,
      );
      const changes = auditService.log.mock.calls[0]?.[0]?.changes;
      const keys = [
        ...Object.keys(changes?.before ?? {}),
        ...Object.keys(changes?.after ?? {}),
      ];
      expect(keys.filter((key) => key.startsWith('homePage'))).toEqual([]);
    });

    it('leaves the home page untouched when it is not in the request', async () => {
      const { service, spaceRepo, auditService } = makeService({
        homePageId: PAGE_ID,
      });

      await service.updateSpace(
        { spaceId: SPACE_ID, name: 'New name' } as any,
        WORKSPACE_ID,
      );

      expect(spaceRepo.updateSpace).toHaveBeenCalledWith(
        expect.objectContaining({ homePageId: undefined }),
        SPACE_ID,
        WORKSPACE_ID,
        trx,
      );
      const changes = auditService.log.mock.calls[0]?.[0]?.changes;
      const keys = [
        ...Object.keys(changes?.before ?? {}),
        ...Object.keys(changes?.after ?? {}),
      ];
      expect(keys.filter((key) => key.startsWith('homePage'))).toEqual([]);
    });
  });
});
