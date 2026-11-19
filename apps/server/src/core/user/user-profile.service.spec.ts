import { NotFoundException } from '@nestjs/common';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { UserProfileService } from './user-profile.service';
import { ProfileViewer } from './user.types';

const member: ProfileViewer = {
  userId: 'viewer',
  workspaceId: 'ws1',
  canManageMembers: false,
};
const admin: ProfileViewer = { ...member, canManageMembers: true };
const pagination = { limit: 20 } as PaginationOptions;
const createdAt = new Date('2026-01-05T10:00:00Z');
const disabledAt = new Date('2026-10-01T10:00:00Z');

const paginated = <T>(items: T[]) => ({
  items,
  meta: {
    limit: 20,
    hasNextPage: false,
    hasPrevPage: false,
    nextCursor: null,
    prevCursor: null,
  },
});

async function expectUserNotFound(promise: Promise<unknown>) {
  await expect(promise).rejects.toBeInstanceOf(NotFoundException);
  await expect(promise).rejects.toThrow('User not found');
}

describe('UserProfileService', () => {
  let target: Record<string, unknown>;
  let userRepo: { findById: jest.Mock };
  let spaceMemberRepo: {
    getSharedSpacesPaginated: jest.Mock;
    getUserRolesForSpaces: jest.Mock;
  };
  let pageRepo: { getRecentPagesByUser: jest.Mock };
  let service: UserProfileService;

  beforeEach(() => {
    target = {
      id: 'u2',
      name: 'Ada Lovelace',
      avatarUrl: null,
      email: 'ada@example.com',
      role: 'member',
      timezone: 'Europe/London',
      createdAt,
      deactivatedAt: null,
      deletedAt: null,
      settings: { preferences: { fullPageWidth: true } },
      locale: 'en-US',
      lastLoginAt: new Date('2026-11-15T09:00:00Z'),
      hasGeneratedPassword: false,
    };
    userRepo = { findById: jest.fn(async () => target) };
    spaceMemberRepo = {
      getSharedSpacesPaginated: jest.fn(async () => paginated([])),
      getUserRolesForSpaces: jest.fn(),
    };
    pageRepo = { getRecentPagesByUser: jest.fn(async () => paginated([])) };
    service = new UserProfileService(
      userRepo as any,
      spaceMemberRepo as any,
      pageRepo as any,
    );
  });

  it('returns only public profile fields', async () => {
    await expect(service.getProfile('u2', member)).resolves.toStrictEqual({
      id: 'u2',
      name: 'Ada Lovelace',
      avatarUrl: null,
      email: 'ada@example.com',
      role: 'member',
      deactivatedAt: null,
      deletedAt: null,
    });
  });

  it("looks the user up inside the viewer's workspace", async () => {
    await service.getProfile('u2', member);

    expect(userRepo.findById).toHaveBeenCalledWith('u2', 'ws1');
  });

  it('answers 404 for a user outside the workspace', async () => {
    userRepo.findById.mockResolvedValue(undefined);

    await expectUserNotFound(service.getProfile('u2', member));
  });

  it('hides deactivated users from members', async () => {
    target.deactivatedAt = disabledAt;

    await expectUserNotFound(service.getProfile('u2', member));
    await expect(service.getProfile('u2', admin)).resolves.toEqual(
      expect.objectContaining({ id: 'u2', deactivatedAt: disabledAt }),
    );
  });

  it('hides deleted users from members and blanks their email for admins', async () => {
    target.deletedAt = disabledAt;
    target.email = '5b1c7c0e@deleted.docmost.com';

    await expectUserNotFound(service.getProfile('u2', member));
    await expect(service.getProfile('u2', admin)).resolves.toEqual(
      expect.objectContaining({ email: null, deletedAt: disabledAt }),
    );
  });

  it('checks visibility before listing spaces and pages', async () => {
    target.deactivatedAt = disabledAt;

    await expectUserNotFound(service.getSpaces('u2', member, pagination));
    await expectUserNotFound(service.getRecentPages('u2', member, pagination));

    expect(spaceMemberRepo.getSharedSpacesPaginated).not.toHaveBeenCalled();
    expect(pageRepo.getRecentPagesByUser).not.toHaveBeenCalled();
  });

  it('returns only basic space details', async () => {
    spaceMemberRepo.getSharedSpacesPaginated.mockResolvedValue(
      paginated([
        { id: 's1', name: 'Design', slug: 'design', logo: null },
        { id: 's2', name: 'Docs', slug: 'docs', logo: 'logo.png' },
      ]),
    );

    const result = await service.getSpaces('u2', member, pagination);

    expect(result.items).toStrictEqual([
      { id: 's1', name: 'Design', slug: 'design', logo: null },
      { id: 's2', name: 'Docs', slug: 'docs', logo: 'logo.png' },
    ]);
    expect(spaceMemberRepo.getSharedSpacesPaginated).toHaveBeenCalledWith(
      'u2',
      'viewer',
      'ws1',
      pagination,
    );
    expect(spaceMemberRepo.getUserRolesForSpaces).not.toHaveBeenCalled();
  });

  it('lists recent pages through the viewer-scoped query', async () => {
    const pages = paginated([{ id: 'p1', title: 'Roadmap' }]);
    pageRepo.getRecentPagesByUser.mockResolvedValue(pages);

    await expect(
      service.getRecentPages('u2', member, pagination),
    ).resolves.toBe(pages);
    expect(pageRepo.getRecentPagesByUser).toHaveBeenCalledWith(
      'u2',
      'viewer',
      'ws1',
      pagination,
    );
  });
});
