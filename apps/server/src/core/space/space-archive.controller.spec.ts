import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SpaceController } from './space.controller';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SpaceRole } from '../../common/helpers/types/permission';
import { JwtType } from '../auth/dto/jwt-payload';

const user = { id: 'user-1' } as any;
const workspace = { id: 'ws-1' } as any;
const dto = { spaceId: 'space-1' } as any;

const handlers = ['archiveSpace', 'unarchiveSpace'] as const;

function buildController(roles?: SpaceRole[]) {
  const spaceRepo = {
    findById: jest.fn(async (id: string) =>
      id === 'space-1' || id === 'my-slug' ? { id: 'space-1' } : undefined,
    ),
  };
  const spaceService = {
    archiveSpace: jest.fn().mockResolvedValue({ id: 'space-1' }),
    unarchiveSpace: jest.fn().mockResolvedValue({ id: 'space-1' }),
  };
  const spaceMemberRepo = {
    getUserSpaceRoles: jest
      .fn()
      .mockResolvedValue(roles?.map((role) => ({ userId: user.id, role }))),
  };
  const spaceAbility = new SpaceAbilityFactory(spaceMemberRepo as any);
  const controller = new SpaceController(
    spaceService as any,
    {} as any,
    spaceMemberRepo as any,
    spaceAbility,
    {} as any,
    spaceRepo as any,
    {} as any,
  );
  return { controller, spaceService, spaceMemberRepo, spaceRepo };
}

describe.each(handlers)('SpaceController.%s', (handler) => {
  it('hands a space admin over to the service', async () => {
    const { controller, spaceService } = buildController([SpaceRole.ADMIN]);

    const result = await controller[handler](dto, user, workspace);

    expect(result).toEqual({ id: 'space-1' });
    expect(spaceService[handler]).toHaveBeenCalled();
  });

  it.each([SpaceRole.WRITER, SpaceRole.READER])(
    'refuses a space %s with 403',
    async (role) => {
      const { controller, spaceService } = buildController([role]);

      await expect(
        controller[handler](dto, user, workspace),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(spaceService[handler]).not.toHaveBeenCalled();
    },
  );

  it('answers 404 to someone who is not a member', async () => {
    const { controller, spaceService } = buildController(undefined);

    await expect(
      controller[handler](dto, user, workspace),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(spaceService[handler]).not.toHaveBeenCalled();
  });
});

describe.each(handlers)('SpaceController.%s space resolution', (handler) => {
  it('resolves a slug to the space id for the ability check and the service', async () => {
    const { controller, spaceService, spaceMemberRepo, spaceRepo } =
      buildController([SpaceRole.ADMIN]);

    await controller[handler]({ spaceId: 'my-slug' } as any, user, workspace);

    expect(spaceRepo.findById).toHaveBeenCalledWith('my-slug', 'ws-1', {
      includeArchivedBy: true,
    });
    expect(spaceMemberRepo.getUserSpaceRoles).toHaveBeenCalledWith(
      'user-1',
      'space-1',
      undefined,
    );
    const space = { id: 'space-1' };
    expect(spaceService[handler]).toHaveBeenCalledWith(
      ...(handler === 'archiveSpace' ? [space, user] : [space]),
    );
  });

  it('answers 404 for an unknown space before the ability check', async () => {
    const { controller, spaceService, spaceMemberRepo } = buildController([
      SpaceRole.ADMIN,
    ]);

    await expect(
      controller[handler]({ spaceId: 'nope' } as any, user, workspace),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(spaceMemberRepo.getUserSpaceRoles).not.toHaveBeenCalled();
    expect(spaceService[handler]).not.toHaveBeenCalled();
  });
});

describe('JwtAuthGuard on the archive handlers', () => {
  const guard = new JwtAuthGuard(new Reflector(), {
    isCloud: () => false,
  } as any);

  const contextFor = (handler: (...args: any[]) => unknown) =>
    ({ getHandler: () => handler, getClass: () => SpaceController }) as any;

  const authenticated = (authType: JwtType, oauth?: { scopes: string[] }) => ({
    user,
    workspace,
    authType,
    ...(oauth && { oauth: { grantId: 'grant-1', ...oauth } }),
  });

  it.each(handlers)('%s refuses an OAuth token that can write', (handler) => {
    const oauthUser = authenticated(JwtType.OAUTH_ACCESS, {
      scopes: ['read', 'write'],
    });

    expect(() =>
      guard.handleRequest(
        null,
        oauthUser,
        null,
        contextFor(SpaceController.prototype[handler]),
      ),
    ).toThrow(ForbiddenException);
  });

  it('lets an OAuth token that can read through to a read route', () => {
    const oauthUser = authenticated(JwtType.OAUTH_ACCESS, { scopes: ['read'] });

    expect(
      guard.handleRequest(
        null,
        oauthUser,
        null,
        contextFor(SpaceController.prototype.getSpaceInfo),
      ),
    ).toBe(oauthUser);
  });

  it.each(handlers)(
    '%s stays open to sessions and API keys that can write',
    (handler) => {
      const callers = [
        authenticated(JwtType.ACCESS),
        {
          ...authenticated(JwtType.API_KEY),
          apiKey: { id: 'key-1', scopes: ['read', 'write'] },
        },
      ];
      for (const caller of callers) {
        expect(
          guard.handleRequest(
            null,
            caller,
            null,
            contextFor(SpaceController.prototype[handler]),
          ),
        ).toBe(caller);
      }
    },
  );

  it.each(handlers)('%s refuses a read-only API key', (handler) => {
    const caller = {
      ...authenticated(JwtType.API_KEY),
      apiKey: { id: 'key-1', scopes: ['read'] },
    };

    expect(() =>
      guard.handleRequest(
        null,
        caller,
        null,
        contextFor(SpaceController.prototype[handler]),
      ),
    ).toThrow(ForbiddenException);
  });
});
