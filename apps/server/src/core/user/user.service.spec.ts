import * as bcrypt from 'bcrypt';
import { BadRequestException } from '@nestjs/common';
import { Workspace } from '@docmost/db/types/entity.types';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';

const workspace = { id: 'workspace-1', enforceSso: false } as Workspace;

const storedUser = {
  id: 'user-1',
  email: 'jane@example.com',
  name: 'Jane Doe',
  emailVerifiedAt: null,
  avatarUrl: null,
  role: 'member',
  workspaceId: 'workspace-1',
  locale: 'en-US',
  timezone: null,
  settings: null,
  lastLoginAt: null,
  deactivatedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  hasGeneratedPassword: false,
};

const storedPassword = bcrypt.hashSync('current-password', 4);

function makeService() {
  const userRepo = {
    findById: jest.fn(
      async (
        userId: string,
        workspaceId: string,
        opts?: { includePassword?: boolean },
      ) =>
        opts?.includePassword
          ? { ...storedUser, password: storedPassword }
          : { ...storedUser },
    ),
    findByEmail: jest.fn(async () => undefined),
    updateUser: jest.fn(async () => undefined),
    updatePreference: jest.fn(),
    updateNotificationSetting: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  const service = new UserService(userRepo as any, auditService as any);
  return { service, userRepo, auditService };
}

describe('UserService update', () => {
  it('changes the email once the password matches', async () => {
    const { service } = makeService();

    const result = await service.update(
      {
        email: 'jane.new@example.com',
        confirmPassword: 'current-password',
      } as UpdateUserDto,
      'user-1',
      workspace,
    );

    expect(result).toStrictEqual({
      ...storedUser,
      email: 'jane.new@example.com',
    });
  });

  it('refuses an email change with the wrong password', async () => {
    const { service, userRepo } = makeService();

    await expect(
      service.update(
        {
          email: 'jane.new@example.com',
          confirmPassword: 'wrong-password',
        } as UpdateUserDto,
        'user-1',
        workspace,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(userRepo.updateUser).not.toHaveBeenCalled();
  });

  it('keeps the user as is when the email is unchanged', async () => {
    const { service } = makeService();

    const result = await service.update(
      {
        email: 'jane@example.com',
        confirmPassword: 'current-password',
      } as UpdateUserDto,
      'user-1',
      workspace,
    );

    expect(result).toStrictEqual(storedUser);
  });

  it('updates the name and locale', async () => {
    const { service } = makeService();

    const result = await service.update(
      { name: 'Jane Smith', locale: 'de-DE' } as UpdateUserDto,
      'user-1',
      workspace,
    );

    expect(result).toStrictEqual({
      ...storedUser,
      name: 'Jane Smith',
      locale: 'de-DE',
    });
  });

  it('returns the saved row on a preference change', async () => {
    const { service, userRepo } = makeService();
    const row = {
      ...storedUser,
      settings: { preferences: { fullPageWidth: true } },
    };
    userRepo.updatePreference.mockResolvedValue(row);

    const result = await service.update(
      { fullPageWidth: true } as UpdateUserDto,
      'user-1',
      workspace,
    );

    expect(result).toBe(row);
  });

  it('returns the saved row on a notification setting change', async () => {
    const { service, userRepo } = makeService();
    const row = {
      ...storedUser,
      settings: { notifications: { 'page.updated': false } },
    };
    userRepo.updateNotificationSetting.mockResolvedValue(row);

    const result = await service.update(
      { notificationPageUpdates: false } as UpdateUserDto,
      'user-1',
      workspace,
    );

    expect(result).toBe(row);
  });

  it('stores the time zone without auditing', async () => {
    const { service, userRepo, auditService } = makeService();

    const result = await service.update(
      { timezone: 'Europe/Berlin' } as UpdateUserDto,
      'user-1',
      workspace,
    );

    expect(userRepo.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: 'Europe/Berlin' }),
      'user-1',
      'workspace-1',
    );
    expect(result).toEqual(
      expect.objectContaining({ timezone: 'Europe/Berlin' }),
    );
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it("loads the caller's own time zone so the response keeps it", async () => {
    const { service, userRepo } = makeService();

    await service.update(
      { name: 'Jane Smith' } as UpdateUserDto,
      'user-1',
      workspace,
    );

    expect(userRepo.findById).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
      expect.objectContaining({ includeTimezone: true }),
    );
  });
});
