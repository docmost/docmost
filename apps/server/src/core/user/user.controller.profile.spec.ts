import { ForbiddenException } from '@nestjs/common';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory';
import { API_KEY_SCOPE_KEY } from '../../common/decorators/api-key-scope.decorator';
import { OAUTH_SCOPE_KEY } from '../../common/decorators/oauth-scope.decorator';
import { UserController } from './user.controller';

const workspace = { id: 'ws1' } as Workspace;
const viewerWithRole = (role: string) => ({ id: 'me', role }) as User;
const dto = { userId: 'u2' };
const pagination = { limit: 20 } as PaginationOptions;

describe('UserController profile routes', () => {
  let profileService: Record<string, jest.Mock>;
  let controller: UserController;

  beforeEach(() => {
    profileService = {
      getProfile: jest.fn(),
      getSpaces: jest.fn(),
      getRecentPages: jest.fn(),
      getGroups: jest.fn(),
    };
    controller = new UserController(
      {} as any,
      {} as any,
      profileService as any,
      new WorkspaceAbilityFactory(),
    );
  });

  it('refuses group lists for members', async () => {
    await expect(
      controller.getUserGroups(
        dto,
        pagination,
        viewerWithRole('member'),
        workspace,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(profileService.getGroups).not.toHaveBeenCalled();
  });

  it.each(['admin', 'owner'])(
    'lists groups for admins and owners (%s)',
    async (role) => {
      await controller.getUserGroups(
        dto,
        pagination,
        viewerWithRole(role),
        workspace,
      );

      expect(profileService.getGroups).toHaveBeenCalledWith(
        'u2',
        { userId: 'me', workspaceId: 'ws1', canManageMembers: true },
        pagination,
      );
    },
  );

  it('passes member viewers without manage rights', async () => {
    await controller.getUserProfile(dto, viewerWithRole('member'), workspace);

    expect(profileService.getProfile).toHaveBeenCalledWith('u2', {
      userId: 'me',
      workspaceId: 'ws1',
      canManageMembers: false,
    });
  });

  it('marks profile routes with the read API key scope and no OAuth scope', () => {
    const handlers = [
      'getUserProfile',
      'getUserSpaces',
      'getUserRecentPages',
      'getUserGroups',
    ] as const;

    for (const name of handlers) {
      const handler = UserController.prototype[name];
      expect(Reflect.getMetadata(API_KEY_SCOPE_KEY, handler)).toBe('read');
      expect(Reflect.getMetadata(OAUTH_SCOPE_KEY, handler)).toBeUndefined();
    }
    expect(Reflect.getMetadata(OAUTH_SCOPE_KEY, UserController)).toBeUndefined();
  });
});
