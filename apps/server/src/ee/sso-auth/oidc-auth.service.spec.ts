import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OidcAuthService } from './oidc-auth.service';
import { AuthProviderRepo } from '../sso/auth-provider.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { SessionService } from '../../core/session/session.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { encodeOidcState } from './oidc-state.util';

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

  it('throws BadRequestException when state does not match the cookie', async () => {
    const stateCookie = encodeOidcState(
      { providerId: 'p1', nonce: 'n1', state: 's1' },
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
});
