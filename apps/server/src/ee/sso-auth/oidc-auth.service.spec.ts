import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as client from 'openid-client';
import { OidcAuthService, isSafeRedirectPath } from './oidc-auth.service';
import { AuthProviderRepo } from '../sso/auth-provider.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { SessionService } from '../../core/session/session.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { encodeOidcState } from './oidc-state.util';

jest.mock('openid-client', () => {
  const actual = jest.requireActual('openid-client');
  return {
    ...actual,
    discovery: jest.fn(),
    authorizationCodeGrant: jest.fn(),
  };
});

describe('OidcAuthService.buildAuthorizationUrl', () => {
  let service: OidcAuthService;
  let authProviderRepo: { findById: jest.Mock };

  beforeEach(async () => {
    authProviderRepo = { findById: jest.fn() };
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
