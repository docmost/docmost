import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { SessionService } from '../session/session.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { User, Workspace } from '@docmost/db/types/entity.types';

describe('AuthController.getAuthMode', () => {
  it.each([true, false])('returns ldapOnly=%s without exposing settings', (ldapOnly) => {
    const controller = Object.create(AuthController.prototype) as AuthController;
    Object.defineProperty(controller, 'environmentService', {
      value: { isLdapEnabled: () => ldapOnly },
    });

    expect(controller.getAuthMode()).toEqual({ ldapOnly });
  });
});

describe('AuthController LDAP login', () => {
  const user = {
    id: 'user-1',
    workspaceId: 'workspace-1',
    role: 'member',
  } as User;
  const workspace = { id: 'workspace-1' } as Workspace;

  function createController(ldapEnabled: boolean) {
    const controller = Object.create(AuthController.prototype) as AuthController;
    Object.defineProperties(controller, {
      environmentService: {
        value: {
          isLdapEnabled: () => ldapEnabled,
          getCookieExpiresIn: () => new Date('2030-01-01T00:00:00Z'),
          isHttps: () => true,
        } as unknown as EnvironmentService,
      },
      authService: {
        value: {
          loginLdap: jest.fn().mockResolvedValue(user),
        } as unknown as AuthService,
      },
      sessionService: {
        value: {
          createSessionAndToken: jest.fn().mockResolvedValue('session-jwt'),
        } as unknown as SessionService,
      },
      moduleRef: { value: { get: jest.fn() } },
    });
    return controller;
  }

  it('creates the normal session cookie after LDAP authentication', async () => {
    const controller = createController(true);
    const response = { setCookie: jest.fn() };

    await controller.ldapLogin(
      { username: 'alice', password: 'secret' },
      workspace,
      response as any,
    );

    expect(response.setCookie).toHaveBeenCalledWith(
      'authToken',
      'session-jwt',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
      }),
    );
  });

  it('rejects password login when LDAP mode is enabled, including direct calls', async () => {
    const controller = createController(true);

    await expect(
      controller.login(
        workspace,
        { setCookie: jest.fn() } as any,
        { email: 'alice@example.com', password: 'secret' },
      ),
    ).rejects.toThrow('Password authentication is disabled');
  });
});
