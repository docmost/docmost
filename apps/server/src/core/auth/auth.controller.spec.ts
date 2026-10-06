import { AuthController } from './auth.controller';

describe('AuthController.getAuthMode', () => {
  it.each([true, false])('returns ldapOnly=%s without exposing settings', (ldapOnly) => {
    const controller = Object.create(AuthController.prototype) as AuthController;
    Object.defineProperty(controller, 'environmentService', {
      value: { isLdapEnabled: () => ldapOnly },
    });

    expect(controller.getAuthMode()).toEqual({ ldapOnly });
  });
});
