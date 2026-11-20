import { User, Workspace } from '@docmost/db/types/entity.types';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory';
import { API_KEY_SCOPE_KEY } from '../../common/decorators/api-key-scope.decorator';
import { OAUTH_SCOPE_KEY } from '../../common/decorators/oauth-scope.decorator';
import { UserController } from './user.controller';

const workspace = { id: 'ws1' } as Workspace;
const viewerWithRole = (role: string) => ({ id: 'me', role }) as User;
const dto = { userId: 'u2' };

describe('UserController profile routes', () => {
  let profileService: Record<string, jest.Mock>;
  let controller: UserController;

  beforeEach(() => {
    profileService = {
      getProfile: jest.fn(),
      getSpaces: jest.fn(),
      getRecentPages: jest.fn(),
    };
    controller = new UserController(
      {} as any,
      {} as any,
      profileService as any,
      new WorkspaceAbilityFactory(),
    );
  });

  it.each(['admin', 'owner'])(
    'passes admin and owner viewers with manage rights (%s)',
    async (role) => {
      await controller.getUserProfile(dto, viewerWithRole(role), workspace);

      expect(profileService.getProfile).toHaveBeenCalledWith('u2', {
        userId: 'me',
        workspaceId: 'ws1',
        canManageMembers: true,
      });
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
    ] as const;

    for (const name of handlers) {
      const handler = UserController.prototype[name];
      expect(Reflect.getMetadata(API_KEY_SCOPE_KEY, handler)).toBe('read');
      expect(Reflect.getMetadata(OAUTH_SCOPE_KEY, handler)).toBeUndefined();
    }
    expect(Reflect.getMetadata(OAUTH_SCOPE_KEY, UserController)).toBeUndefined();
  });
});
