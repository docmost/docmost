import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as client from 'openid-client';
import { OidcAuthService, isSafeRedirectPath } from './oidc-auth.service';
import { AuthProviderRepo } from '../sso/auth-provider.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { SessionService } from '../../core/session/session.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { encodeOidcState, decodeOidcState } from './oidc-state.util';

jest.mock('openid-client', () => {
  const actual = jest.requireActual('openid-client');
  return {
    ...actual,
    discovery: jest.fn(),
    authorizationCodeGrant: jest.fn(),
    buildAuthorizationUrl: jest.fn(),
  };
});

describe('OidcAuthService.buildAuthorizationUrl', () => {
  let service: OidcAuthService;
  let authProviderRepo: { findById: jest.Mock; findEntraProvider: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    authProviderRepo = { findById: jest.fn(), findEntraProvider: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OidcAuthService,
        { provide: AuthProviderRepo, useValue: authProviderRepo },
        { provide: UserRepo, useValue: {} },
        { provide: SessionService, useValue: {} },
        {
          provide: EnvironmentService,
          useValue: {
            getAppSecret: () => 'test-secret',
            getAppUrl: () => 'http://localhost:3000',
            isHttps: () => false,
          },
        },
      ],
    }).compile();
    service = moduleRef.get(OidcAuthService);
  });

  it('throws NotFoundException when provider is missing', async () => {
    authProviderRepo.findById.mockResolvedValue(undefined);
    await expect(
      service.buildAuthorizationUrl('p1', 'ws1'),
    ).rejects.toThrow(NotFoundException);
    expect(authProviderRepo.findEntraProvider).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when oidcIssuer is not configured', async () => {
    authProviderRepo.findById.mockResolvedValue({
      id: 'p1',
      type: 'oidc',
      isEnabled: true,
      oidcIssuer: null,
      oidcClientId: 'cid',
      oidcClientSecret: 'secret',
    });
    await expect(
      service.buildAuthorizationUrl('p1', 'ws1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('resolves via findEntraProvider (not findById) when providerId is omitted', async () => {
    authProviderRepo.findEntraProvider.mockResolvedValue(undefined);
    await expect(
      service.buildAuthorizationUrl(undefined, 'ws1'),
    ).rejects.toThrow(NotFoundException);
    expect(authProviderRepo.findEntraProvider).toHaveBeenCalledWith('ws1');
    expect(authProviderRepo.findById).not.toHaveBeenCalled();
  });

  it('accepts a provider with type "azure-ad" and issues a singleton redirect_uri', async () => {
    authProviderRepo.findEntraProvider.mockResolvedValue({
      id: 'entra-1',
      type: 'azure-ad',
      isEnabled: true,
      oidcIssuer: 'https://login.microsoftonline.com/tenant-id/v2.0',
      oidcClientId: 'cid',
      oidcClientSecret: 'secret',
    });
    (client.discovery as jest.Mock).mockResolvedValue({});
    (client.buildAuthorizationUrl as jest.Mock).mockReturnValue(
      new URL('https://login.microsoftonline.com/authorize?x=1'),
    );

    const result = await service.buildAuthorizationUrl(undefined, 'ws1');

    expect(client.buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        redirect_uri: 'http://localhost:3000/api/sso/oidc/callback',
      }),
    );
    const decoded = decodeOidcState(result.stateCookie, 'test-secret');
    expect(decoded?.providerId).toBe('entra-1');
    expect(decoded?.singleton).toBe(true);
  });

  it('rejects a resolved provider whose type is neither "oidc" nor "azure-ad"', async () => {
    authProviderRepo.findEntraProvider.mockResolvedValue({
      id: 'p2',
      type: 'saml',
      isEnabled: true,
      oidcIssuer: 'https://issuer.example.com',
      oidcClientId: 'cid',
      oidcClientSecret: 'secret',
    });
    await expect(
      service.buildAuthorizationUrl(undefined, 'ws1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('uses the providerId-scoped redirect_uri for the generic OIDC flow', async () => {
    authProviderRepo.findById.mockResolvedValue({
      id: 'p1',
      type: 'oidc',
      isEnabled: true,
      oidcIssuer: 'https://issuer.example.com',
      oidcClientId: 'cid',
      oidcClientSecret: 'secret',
    });
    (client.discovery as jest.Mock).mockResolvedValue({});
    (client.buildAuthorizationUrl as jest.Mock).mockReturnValue(
      new URL('https://issuer.example.com/authorize?x=1'),
    );

    const result = await service.buildAuthorizationUrl('p1', 'ws1');

    expect(client.buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        redirect_uri: 'http://localhost:3000/api/sso/oidc/p1/callback',
      }),
    );
    const decoded = decodeOidcState(result.stateCookie, 'test-secret');
    expect(decoded?.singleton).toBeFalsy();
  });
});

describe('OidcAuthService.handleCallback', () => {
  let service: OidcAuthService;
  let authProviderRepo: { findById: jest.Mock };
  let userRepo: { findByEmail: jest.Mock; insertUser: jest.Mock };
  let sessionService: { createSessionAndToken: jest.Mock };

  const provider = {
    id: 'p1',
    type: 'oidc',
    isEnabled: true,
    oidcIssuer: 'https://issuer.example.com',
    oidcClientId: 'cid',
    oidcClientSecret: 'secret',
    allowSignup: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    authProviderRepo = { findById: jest.fn().mockResolvedValue(provider) };
    userRepo = {
      findByEmail: jest.fn().mockResolvedValue({ id: 'u1', email: 'user@example.com' }),
      insertUser: jest.fn(),
    };
    sessionService = {
      createSessionAndToken: jest.fn().mockResolvedValue('session-token'),
    };
    (client.discovery as jest.Mock).mockResolvedValue({});

    const moduleRef = await Test.createTestingModule({
      providers: [
        OidcAuthService,
        { provide: AuthProviderRepo, useValue: authProviderRepo },
        { provide: UserRepo, useValue: userRepo },
        { provide: SessionService, useValue: sessionService },
        {
          provide: EnvironmentService,
          useValue: {
            getAppSecret: () => 'test-secret',
            getAppUrl: () => 'http://localhost:3000',
            isHttps: () => false,
          },
        },
      ],
    }).compile();
    service = moduleRef.get(OidcAuthService);
  });

  it('throws BadRequestException when state does not match the cookie', async () => {
    const stateCookie = encodeOidcState(
      { providerId: 'p1', nonce: 'n1', state: 's1', codeVerifier: 'verifier-abc' },
      'test-secret',
    );

    await expect(
      service.handleCallback({
        code: 'auth-code',
        state: 's2',
        stateCookie,
        workspaceId: 'ws1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when the decoded state is missing codeVerifier', async () => {
    const stateCookie = encodeOidcState(
      { providerId: 'p1', nonce: 'n1', state: 's1' },
      'test-secret',
    );

    await expect(
      service.handleCallback({
        code: 'auth-code',
        state: 's1',
        stateCookie,
        workspaceId: 'ws1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(client.authorizationCodeGrant).not.toHaveBeenCalled();
  });

  it('passes the real pkceCodeVerifier through to authorizationCodeGrant', async () => {
    const stateCookie = encodeOidcState(
      {
        providerId: 'p1',
        nonce: 'n1',
        state: 's1',
        codeVerifier: 'verifier-abc',
      },
      'test-secret',
    );

    (client.authorizationCodeGrant as jest.Mock).mockResolvedValue({
      claims: () => ({ email: 'user@example.com', name: 'User' }),
      id_token: 'id-token',
      access_token: 'access-token',
    });

    const result = await service.handleCallback({
      code: 'auth-code',
      state: 's1',
      stateCookie,
      workspaceId: 'ws1',
    });

    expect(client.authorizationCodeGrant).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(URL),
      expect.objectContaining({
        pkceCodeVerifier: 'verifier-abc',
        expectedState: 's1',
        expectedNonce: 'n1',
      }),
    );
    expect(result.authToken).toBe('session-token');
  });

  it('falls back to / for an unsafe redirect and passes through a safe one', async () => {
    const stateCookie = encodeOidcState(
      {
        providerId: 'p1',
        nonce: 'n1',
        state: 's1',
        codeVerifier: 'verifier-abc',
        redirect: '@evil.com',
      },
      'test-secret',
    );

    (client.authorizationCodeGrant as jest.Mock).mockResolvedValue({
      claims: () => ({ email: 'user@example.com', name: 'User' }),
      id_token: 'id-token',
      access_token: 'access-token',
    });

    const result = await service.handleCallback({
      code: 'auth-code',
      state: 's1',
      stateCookie,
      workspaceId: 'ws1',
    });

    expect(result.redirect).toBe('/');
  });

  it('reconstructs the singleton redirect_uri when the cycle was started via the Entra ID login route', async () => {
    const stateCookie = encodeOidcState(
      {
        providerId: 'p1',
        nonce: 'n1',
        state: 's1',
        codeVerifier: 'verifier-abc',
        singleton: true,
      },
      'test-secret',
    );

    (client.authorizationCodeGrant as jest.Mock).mockResolvedValue({
      claims: () => ({ email: 'user@example.com', name: 'User' }),
      id_token: 'id-token',
      access_token: 'access-token',
    });

    await service.handleCallback({
      code: 'auth-code',
      state: 's1',
      stateCookie,
      workspaceId: 'ws1',
    });

    const [, currentUrl] = (client.authorizationCodeGrant as jest.Mock).mock
      .calls[0];
    expect((currentUrl as URL).origin + (currentUrl as URL).pathname).toBe(
      'http://localhost:3000/api/sso/oidc/callback',
    );
  });

  it('reconstructs the providerId-scoped redirect_uri when singleton is not set', async () => {
    const stateCookie = encodeOidcState(
      {
        providerId: 'p1',
        nonce: 'n1',
        state: 's1',
        codeVerifier: 'verifier-abc',
      },
      'test-secret',
    );

    (client.authorizationCodeGrant as jest.Mock).mockResolvedValue({
      claims: () => ({ email: 'user@example.com', name: 'User' }),
      id_token: 'id-token',
      access_token: 'access-token',
    });

    await service.handleCallback({
      code: 'auth-code',
      state: 's1',
      stateCookie,
      workspaceId: 'ws1',
    });

    const [, currentUrl] = (client.authorizationCodeGrant as jest.Mock).mock
      .calls[0];
    expect((currentUrl as URL).origin + (currentUrl as URL).pathname).toBe(
      'http://localhost:3000/api/sso/oidc/p1/callback',
    );
  });
});

describe('isSafeRedirectPath', () => {
  it('accepts a normal relative path', () => {
    expect(isSafeRedirectPath('/dashboard')).toBe(true);
  });

  it('rejects protocol-relative urls', () => {
    expect(isSafeRedirectPath('//evil.com')).toBe(false);
  });

  it('rejects userinfo-style hosts', () => {
    expect(isSafeRedirectPath('@evil.com')).toBe(false);
  });

  it('rejects values containing a scheme', () => {
    expect(isSafeRedirectPath('http://evil.com')).toBe(false);
  });

  it('rejects paths containing a backslash', () => {
    expect(isSafeRedirectPath('/\\evil.com')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isSafeRedirectPath(undefined)).toBe(false);
  });
});
