import {
  BadRequestException,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuthCompleteAuthFilter, OAuthController } from './oauth.controller';
import { OAuthStatePayload } from './oauth.service';
import WorkspaceAbilityFactory from '../../casl/abilities/workspace-ability.factory';
import { UserRole } from '../../../common/helpers/types/permission';
import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  IdentityEmailMismatchError,
  IdentityTenantMismatchError,
  IntegrationTenantInUseError,
} from '../registry/integration-provider.interface';
import { EncryptionService } from '../../../integrations/encryption/encryption.service';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { OAuthService } from './oauth.service';
import { IntegrationConnectionService } from '../integration-connection.service';
import { IntegrationRegistry } from '../registry/integration-registry';
import { LicenseCheckService } from '../../../integrations/environment/license-check.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { UserSessionRepo } from '@docmost/db/repos/session/user-session.repo';
import { SessionActivityService } from '../../session/session-activity.service';

const workspace = { id: 'workspace-1' } as Workspace;
const encryptionService = new EncryptionService({
  getAppSecret: () => 'test-secret',
} as any);
const environmentService = {
  isHttps: () => true,
  isCloud: () => false,
  getAppUrl: () => 'https://acme.example',
  getSubdomainHost: () => undefined,
} as any;
const cloudEnvironment = {
  ...environmentService,
  isCloud: () => true,
  getAppUrl: () => 'https://app.docmost.example',
  getSubdomainHost: () => 'docmost.example',
};
const authorizationUrl = 'https://provider.example/authorize';
const fallbackRedirect = '/settings/account/connections?error=oauth_failed';

function userWithRole(role: UserRole): User {
  return { id: `user-${role}`, role } as User;
}

function cookieReply() {
  return { setCookie: jest.fn() } as any;
}

function redirectReply() {
  return { redirect: jest.fn(), clearCookie: jest.fn() } as any;
}

function buildController() {
  const getInstallAuthorizationUrl = jest
    .fn()
    .mockResolvedValue({ authorizationUrl, nonce: 'install-nonce' });
  const getAuthorizationUrl = jest
    .fn()
    .mockResolvedValue({ authorizationUrl, type: 'github', nonce: 'connect-nonce' });

  const controller = new OAuthController(
    { getInstallAuthorizationUrl, getAuthorizationUrl } as any,
    {} as any,
    new WorkspaceAbilityFactory(),
    { hasFeature: jest.fn().mockReturnValue(true) } as any,
    { getProvider: jest.fn().mockReturnValue({ definition: {} }) } as any,
    encryptionService,
    environmentService,
  );

  return { controller, getInstallAuthorizationUrl, getAuthorizationUrl };
}

const signedStatePayload: OAuthStatePayload = {
  flow: 'connect',
  integrationId: 'integration-1',
  type: 'slack',
  userId: 'user-1',
  workspaceId: 'workspace-1',
  returnUrl: 'https://acme.example',
  returnPath: '/s/general/p/roadmap',
  nonce: 'nonce-1',
  exp: Date.now() + 10 * 60_000,
};

function buildFlowController(
  state: Partial<OAuthStatePayload> = {},
  environment = environmentService,
) {
  const exchangeCodeForTokens = jest.fn().mockResolvedValue({});
  const verifySignedState = jest.fn((signed: string) =>
    signed === 'signed-state' ? { ...signedStatePayload, ...state } : null,
  );

  const controller = new OAuthController(
    { exchangeCodeForTokens, verifySignedState } as any,
    {} as any,
    new WorkspaceAbilityFactory(),
    {} as any,
    {} as any,
    encryptionService,
    environment,
  );

  return { controller, exchangeCodeForTokens };
}

function issueTicket(fields: Record<string, unknown> = {}) {
  return encryptionService.encrypt(
    JSON.stringify({
      purpose: 'oauth-completion',
      state: 'signed-state',
      code: 'auth-code',
      exp: Date.now() + 60_000,
      ...fields,
    }),
  );
}

describe('OAuthController install authorization', () => {
  it('refuses a workspace member', async () => {
    const { controller, getInstallAuthorizationUrl } = buildController();
    const res = cookieReply();

    await expect(
      controller.installAndAuthorize(
        { type: 'slack' } as any,
        userWithRole(UserRole.MEMBER),
        workspace,
        res,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(getInstallAuthorizationUrl).not.toHaveBeenCalled();
    expect(res.setCookie).not.toHaveBeenCalled();
  });

  it.each([UserRole.ADMIN, UserRole.OWNER])('allows a workspace %s', async (role) => {
    const { controller, getInstallAuthorizationUrl } = buildController();

    await expect(
      controller.installAndAuthorize(
        { type: 'slack' } as any,
        userWithRole(role),
        workspace,
        cookieReply(),
      ),
    ).resolves.toEqual({ authorizationUrl });

    expect(getInstallAuthorizationUrl).toHaveBeenCalledWith(
      'slack',
      workspace.id,
      `user-${role}`,
    );
  });
});

describe('OAuthController nonce cookie', () => {
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/integrations/oauth',
  };

  it('binds a connect flow to the browser that started it', async () => {
    const { controller } = buildController();
    const res = cookieReply();

    await expect(
      controller.authorize(
        { integrationId: 'integration-1' } as any,
        userWithRole(UserRole.MEMBER),
        workspace,
        res,
      ),
    ).resolves.toEqual({ authorizationUrl });

    expect(res.setCookie).toHaveBeenCalledWith(
      'integration_oauth_github',
      'connect-nonce',
      expect.objectContaining(cookieOptions),
    );
    const { expires } = res.setCookie.mock.calls[0][2];
    expect(expires.getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
    expect(expires.getTime() - Date.now()).toBeLessThanOrEqual(10 * 60_000);
  });

  it('binds an install flow to the browser that started it', async () => {
    const { controller } = buildController();
    const res = cookieReply();

    await controller.installAndAuthorize(
      { type: 'slack' } as any,
      userWithRole(UserRole.ADMIN),
      workspace,
      res,
    );

    expect(res.setCookie).toHaveBeenCalledWith(
      'integration_oauth_slack',
      'install-nonce',
      expect.objectContaining(cookieOptions),
    );
  });
});

describe('OAuthController callback', () => {
  let warn: jest.SpyInstance;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('hands the code to the workspace host instead of exchanging it', async () => {
    const { controller, exchangeCodeForTokens } = buildFlowController();
    const res = redirectReply();
    const before = Date.now();

    await controller.callback('slack', 'auth-code', 'signed-state', res);

    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
    const [location, status] = res.redirect.mock.calls[0];
    expect(status).toBe(302);
    const url = new URL(location);
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://acme.example/api/integrations/oauth/complete',
    );
    const ticket = JSON.parse(
      encryptionService.decrypt(url.searchParams.get('ticket') ?? ''),
    );
    expect(ticket).toEqual({
      purpose: 'oauth-completion',
      state: 'signed-state',
      code: 'auth-code',
      exp: expect.any(Number),
    });
    expect(ticket.exp).toBeGreaterThanOrEqual(before + 60_000);
    expect(ticket.exp).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  it('sends a cancelled consent back with oauth_failed', async () => {
    const { controller, exchangeCodeForTokens } = buildFlowController();
    const res = redirectReply();

    await controller.callback('slack', undefined, 'signed-state', res);

    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      'https://acme.example/s/general/p/roadmap?error=oauth_failed',
      302,
    );
  });

  it("logs the provider's error code and the first line of its description when no code comes back", async () => {
    const { controller } = buildFlowController();
    const res = redirectReply();
    warn.mockClear();

    await controller.callback(
      'slack',
      undefined,
      'signed-state',
      res,
      'invalid_client',
      "AADSTS650052: The app needs access to a service that your organization hasn't subscribed to.\r\nTrace ID: 1f2e\r\nCorrelation ID: 9a8b",
    );

    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0][0] as string;
    expect(line).toContain('slack');
    expect(line).toContain('invalid_client');
    expect(line).toContain(
      "AADSTS650052: The app needs access to a service that your organization hasn't subscribed to.",
    );
    expect(line).not.toContain('Trace ID');
    expect(line).not.toContain('Correlation ID');
    expect(res.redirect).toHaveBeenCalledWith(
      'https://acme.example/s/general/p/roadmap?error=oauth_failed',
      302,
    );
  });

  it('logs only a printable, bounded line from the provider error', async () => {
    const { controller } = buildFlowController();
    const res = redirectReply();
    warn.mockClear();

    await controller.callback(
      'slack',
      undefined,
      'signed-state',
      res,
      'Access_Denied\nforged',
      `denied\u001b[31m‮${'x'.repeat(1000)}`,
    );

    const line = warn.mock.calls[0][0] as string;
    expect(line).not.toContain('Access_Denied');
    expect(line).not.toMatch(/[^\x20-\x7e]/);
    expect(line).toContain('denied[31m');
    expect(line.length).toBeLessThan(400);
  });

  it('logs a cancelled consent that carries no error at all', async () => {
    const { controller } = buildFlowController();
    const res = redirectReply();
    warn.mockClear();

    await controller.callback('slack', undefined, 'signed-state', res);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('slack');
  });

  it('refuses a state signed for a different provider', async () => {
    const { controller, exchangeCodeForTokens } = buildFlowController();
    const res = redirectReply();

    await controller.callback('github', 'auth-code', 'signed-state', res);

    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledTimes(1);
    expect(res.redirect).toHaveBeenCalledWith(
      'https://acme.example/s/general/p/roadmap?error=oauth_failed',
      302,
    );
  });

  it('rejects a state that does not verify', async () => {
    const { controller } = buildFlowController();
    const res = redirectReply();

    await expect(
      controller.callback('slack', 'auth-code', 'forged-state', res),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(res.redirect).not.toHaveBeenCalled();
  });

  describe('return host', () => {
    let encrypt: jest.SpyInstance;

    beforeEach(() => {
      warn.mockClear();
      encrypt = jest.spyOn(encryptionService, 'encrypt');
    });

    afterEach(() => {
      encrypt.mockRestore();
    });

    it.each([
      ['a custom domain', cloudEnvironment, 'https://wiki.tenant.example'],
      ['a lookalike of the cloud domain', cloudEnvironment, 'https://acmedocmost.example'],
      ['a userinfo trick', cloudEnvironment, 'https://acme.docmost.example@evil.example'],
      [
        'a subdomain while self-hosted',
        { ...environmentService, getSubdomainHost: () => 'docmost.example' },
        'https://acme.docmost.example',
      ],
      [
        'any host when the subdomain host is unset',
        { ...cloudEnvironment, getSubdomainHost: () => undefined },
        'https://acme.undefined',
      ],
      ['a malformed return URL', cloudEnvironment, 'not a url'],
    ])('refuses to hand a ticket to %s', async (_label, environment, returnUrl) => {
      const { controller, exchangeCodeForTokens } = buildFlowController(
        { returnUrl },
        environment,
      );
      const res = redirectReply();

      await controller.callback('slack', 'auth-code', 'signed-state', res);

      expect(encrypt).not.toHaveBeenCalled();
      expect(exchangeCodeForTokens).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledTimes(1);
      expect(res.redirect).toHaveBeenCalledWith(
        `${returnUrl}/s/general/p/roadmap?error=oauth_failed`,
        302,
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('is not a Docmost host'),
      );
    });

    it.each([
      ['the APP_URL host', environmentService, 'https://acme.example'],
      ['the APP_URL host on cloud', cloudEnvironment, 'https://app.docmost.example'],
      ['a cloud workspace subdomain', cloudEnvironment, 'https://acme.docmost.example'],
      [
        'a cloud workspace subdomain with a port',
        {
          ...cloudEnvironment,
          getAppUrl: () => 'http://localhost:3000',
          getSubdomainHost: () => 'localhost:3000',
        },
        'http://acme.localhost:3000',
      ],
    ])('hands the ticket to %s', async (_label, environment, returnUrl) => {
      const { controller } = buildFlowController({ returnUrl }, environment);
      const res = redirectReply();

      await controller.callback('slack', 'auth-code', 'signed-state', res);

      expect(encrypt).toHaveBeenCalledTimes(1);
      const url = new URL(res.redirect.mock.calls[0][0]);
      expect(`${url.origin}${url.pathname}`).toBe(
        `${returnUrl}/api/integrations/oauth/complete`,
      );
      expect(url.searchParams.get('ticket')).toBeTruthy();
    });
  });
});

describe('OAuthController complete', () => {
  const sessionUser = { id: 'user-1' } as User;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  async function complete(
    options: {
      ticket?: string;
      user?: User;
      sessionWorkspace?: Workspace;
      cookies?: Record<string, string>;
      state?: Partial<OAuthStatePayload>;
    } = {},
  ) {
    const {
      user = sessionUser,
      sessionWorkspace = workspace,
      cookies = { integration_oauth_slack: 'nonce-1' },
      state = {},
    } = options;
    const ticket = 'ticket' in options ? options.ticket : issueTicket();
    const { controller, exchangeCodeForTokens } = buildFlowController(state);
    const res = redirectReply();

    await controller.complete(
      ticket,
      user,
      sessionWorkspace,
      { cookies } as any,
      res,
    );

    return { res, exchangeCodeForTokens };
  }

  it('exchanges the code for the user who started the flow', async () => {
    const { controller, exchangeCodeForTokens } = buildFlowController();
    const callbackRes = redirectReply();
    await controller.callback('slack', 'auth-code', 'signed-state', callbackRes);
    const ticket = new URL(callbackRes.redirect.mock.calls[0][0]).searchParams.get('ticket');
    const res = redirectReply();

    await controller.complete(
      ticket,
      sessionUser,
      workspace,
      { cookies: { integration_oauth_slack: 'nonce-1' } } as any,
      res,
    );

    expect(exchangeCodeForTokens).toHaveBeenCalledWith(
      'slack',
      'auth-code',
      expect.objectContaining({ type: 'slack', userId: 'user-1', workspaceId: 'workspace-1' }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith('integration_oauth_slack', {
      path: '/api/integrations/oauth',
    });
    expect(res.redirect).toHaveBeenCalledWith('/s/general/p/roadmap', 302);
  });

  it.each([
    ['a different user', { user: { id: 'user-2' } as User }],
    ['a different workspace', { sessionWorkspace: { id: 'workspace-2' } as Workspace }],
    ['a missing nonce cookie', { cookies: {} }],
    ['a wrong nonce cookie', { cookies: { integration_oauth_slack: 'nonce-2' } }],
    ['a nonce cookie of a different length', { cookies: { integration_oauth_slack: 'nonce-10' } }],
    ['a nonce cookie for another provider', { cookies: { integration_oauth_github: 'nonce-1' } }],
    ['a state without a nonce', { state: { nonce: undefined } }],
    ['a state without a nonce and no cookie', { state: { nonce: undefined }, cookies: {} }],
  ])('refuses %s', async (_label, options) => {
    const { res, exchangeCodeForTokens } = await complete(options);

    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/s/general/p/roadmap?error=oauth_failed', 302);
  });

  it.each([
    ['an expired ticket', () => issueTicket({ exp: Date.now() - 1 })],
    ['an undecryptable ticket', () => 'not-a-ticket'],
    [
      'a ticket sealed with another secret',
      () =>
        new EncryptionService({ getAppSecret: () => 'other-secret' } as any).encrypt(
          JSON.stringify({
            purpose: 'oauth-completion',
            state: 'signed-state',
            code: 'auth-code',
            exp: Date.now() + 60_000,
          }),
        ),
    ],
    ['a ticket whose state does not verify', () => issueTicket({ state: 'forged-state' })],
    ['a ticket without a code', () => issueTicket({ code: undefined })],
    ['a ticket without an expiry', () => issueTicket({ exp: undefined })],
    ['a ticket without a purpose', () => issueTicket({ purpose: undefined })],
    ['a ticket minted for another purpose', () => issueTicket({ purpose: 'session' })],
    ['a ticket that is not an object', () => encryptionService.encrypt('null')],
    ['a missing ticket', () => undefined],
  ])('refuses %s', async (_label, ticket) => {
    const { res, exchangeCodeForTokens } = await complete({ ticket: ticket() });

    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(fallbackRedirect, 302);
  });

  it.each([
    [IdentityEmailMismatchError, 'identity_mismatch'],
    [IdentityTenantMismatchError, 'tenant_mismatch'],
    [IntegrationTenantInUseError, 'tenant_in_use'],
    [Error, 'oauth_failed'],
  ])('reports %p as %s', async (ErrorClass, code) => {
    const { controller, exchangeCodeForTokens } = buildFlowController();
    exchangeCodeForTokens.mockRejectedValue(new ErrorClass());
    const res = redirectReply();

    await controller.complete(
      issueTicket(),
      sessionUser,
      workspace,
      { cookies: { integration_oauth_slack: 'nonce-1' } } as any,
      res,
    );

    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(res.redirect).toHaveBeenCalledWith(
      `/s/general/p/roadmap?error=${code}`,
      302,
    );
  });
});

describe('OAuthController complete without a session', () => {
  let warn: jest.SpyInstance;

  beforeAll(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    warn.mockClear();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it.each([new UnauthorizedException(), new ForbiddenException()])(
    'logs and sends the browser back into the app on %p',
    (exception) => {
      const res = redirectReply();
      const req = {
        host: 'acme.example',
        url: '/api/integrations/oauth/complete?ticket=sealed-ticket',
      };

      new OAuthCompleteAuthFilter().catch(exception, {
        switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      } as any);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('acme.example');
      expect(warn.mock.calls[0][0]).not.toContain('sealed-ticket');
      expect(res.redirect).toHaveBeenCalledTimes(1);
      expect(res.redirect).toHaveBeenCalledWith(fallbackRedirect, 302);
    },
  );

  it('redirects instead of returning 401 through the Fastify pipeline', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OAuthController],
      providers: [
        JwtStrategy,
        {
          provide: EnvironmentService,
          useValue: { ...environmentService, getAppSecret: () => 'test-secret' },
        },
        { provide: EncryptionService, useValue: encryptionService },
        { provide: WorkspaceAbilityFactory, useValue: {} },
        ...[
          OAuthService,
          IntegrationConnectionService,
          LicenseCheckService,
          IntegrationRegistry,
          UserRepo,
          WorkspaceRepo,
          UserSessionRepo,
          SessionActivityService,
        ].map((provide) => ({ provide, useValue: {} })),
      ],
    }).compile();
    const app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    try {
      const response = await app.inject({
        method: 'GET',
        url: `/integrations/oauth/complete?ticket=${encodeURIComponent(issueTicket())}`,
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(fallbackRedirect);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('refused without a usable session'),
      );
    } finally {
      await app.close();
    }
  });
});
