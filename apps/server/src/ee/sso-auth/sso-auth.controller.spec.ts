import { Test } from '@nestjs/testing';
import { SsoAuthController } from './sso-auth.controller';
import { SsoAuthService } from './sso-auth.service';
import { OidcAuthService } from './oidc-auth.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';

describe('SsoAuthController.oidcLogin', () => {
  it('sets the oidc_state cookie and redirects to the authorization url', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SsoAuthController],
      providers: [
        { provide: SsoAuthService, useValue: {} },
        {
          provide: OidcAuthService,
          useValue: {
            buildAuthorizationUrl: jest.fn().mockResolvedValue({
              url: 'https://idp.example.com/authorize?foo=bar',
              stateCookie: 'signed-state-cookie',
            }),
          },
        },
        {
          provide: EnvironmentService,
          useValue: { getAppUrl: () => 'http://localhost:3000' },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SsoAuthController);
    const oidcAuthService = moduleRef.get(OidcAuthService);
    const res: any = { setCookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };

    await controller.oidcLogin(
      'p1',
      '/dashboard',
      { id: 'ws1' } as any,
      res,
    );

    expect(oidcAuthService.buildAuthorizationUrl).toHaveBeenCalledWith(
      'p1',
      'ws1',
      '/dashboard',
    );
    expect(res.setCookie).toHaveBeenCalledWith(
      'oidc_state',
      'signed-state-cookie',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      'https://idp.example.com/authorize?foo=bar',
    );
  });
});

describe('SsoAuthController.oidcCallback', () => {
  it('redirects to /login?error=sso_failed when the state cookie is missing', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SsoAuthController],
      providers: [
        { provide: SsoAuthService, useValue: {} },
        { provide: OidcAuthService, useValue: { handleCallback: jest.fn() } },
        {
          provide: EnvironmentService,
          useValue: { getAppUrl: () => 'http://localhost:3000' },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SsoAuthController);
    const res: any = { setCookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };
    const req: any = { cookies: {} };

    await controller.oidcCallback('p1', 'code1', 'state1', { id: 'ws1' } as any, res, req);

    expect(res.clearCookie).toHaveBeenCalledWith('oidc_state', { path: '/' });
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost:3000/login?error=sso_failed',
    );
  });

  it('sets authToken cookie and redirects to the app on success', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SsoAuthController],
      providers: [
        { provide: SsoAuthService, useValue: {} },
        {
          provide: OidcAuthService,
          useValue: {
            handleCallback: jest.fn().mockResolvedValue({
              authToken: 'jwt-token',
              redirect: '/dashboard',
            }),
          },
        },
        {
          provide: EnvironmentService,
          useValue: {
            getAppUrl: () => 'http://localhost:3000',
            getCookieExpiresIn: () => new Date('2030-01-01'),
            isHttps: () => false,
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SsoAuthController);
    const oidcAuthService = moduleRef.get(OidcAuthService);
    const res: any = { setCookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };
    const req: any = { cookies: { oidc_state: 'signed-state-cookie' } };

    await controller.oidcCallback('p1', 'code1', 'state1', { id: 'ws1' } as any, res, req);

    expect(oidcAuthService.handleCallback).toHaveBeenCalledWith({
      code: 'code1',
      state: 'state1',
      stateCookie: 'signed-state-cookie',
      workspaceId: 'ws1',
    });
    expect(res.setCookie).toHaveBeenCalledWith(
      'authToken',
      'jwt-token',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith('oidc_state', { path: '/' });
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/dashboard');
  });
});

describe('SsoAuthController - singleton Entra ID routes', () => {
  it('oidcEntraLogin calls buildAuthorizationUrl with providerId undefined', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SsoAuthController],
      providers: [
        { provide: SsoAuthService, useValue: {} },
        {
          provide: OidcAuthService,
          useValue: {
            buildAuthorizationUrl: jest.fn().mockResolvedValue({
              url: 'https://login.microsoftonline.com/authorize',
              stateCookie: 'signed-state-cookie',
            }),
          },
        },
        {
          provide: EnvironmentService,
          useValue: { getAppUrl: () => 'http://localhost:3000' },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SsoAuthController);
    const oidcAuthService = moduleRef.get(OidcAuthService);
    const res: any = { setCookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };

    await controller.oidcEntraLogin('/dashboard', { id: 'ws1' } as any, res);

    expect(oidcAuthService.buildAuthorizationUrl).toHaveBeenCalledWith(
      undefined,
      'ws1',
      '/dashboard',
    );
    expect(res.redirect).toHaveBeenCalledWith(
      'https://login.microsoftonline.com/authorize',
    );
  });

  it('oidcEntraCallback behaves identically to the providerId-scoped callback', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SsoAuthController],
      providers: [
        { provide: SsoAuthService, useValue: {} },
        {
          provide: OidcAuthService,
          useValue: {
            handleCallback: jest.fn().mockResolvedValue({
              authToken: 'jwt-token',
              redirect: '/dashboard',
            }),
          },
        },
        {
          provide: EnvironmentService,
          useValue: {
            getAppUrl: () => 'http://localhost:3000',
            getCookieExpiresIn: () => new Date('2030-01-01'),
            isHttps: () => false,
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SsoAuthController);
    const oidcAuthService = moduleRef.get(OidcAuthService);
    const res: any = { setCookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };
    const req: any = { cookies: { oidc_state: 'signed-state-cookie' } };

    await controller.oidcEntraCallback('code1', 'state1', { id: 'ws1' } as any, res, req);

    expect(oidcAuthService.handleCallback).toHaveBeenCalledWith({
      code: 'code1',
      state: 'state1',
      stateCookie: 'signed-state-cookie',
      workspaceId: 'ws1',
    });
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/dashboard');
  });
});
