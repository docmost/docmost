import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import {
  AuthProvider,
  User,
  Workspace,
} from '@docmost/db/types/entity.types';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { WorkspaceService } from '../../core/workspace/services/workspace.service';
import { SessionService } from '../../core/session/session.service';
import { TokenService } from '../../core/auth/services/token.service';
import { validateAllowedEmail } from '../../core/auth/auth.util';
import { DomainService } from '../../integrations/environment/domain.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { isUserDisabled, nanoIdGen } from '../../common/helpers';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';

type OpenIdClientModule = typeof import('openid-client');

type OidcSessionState = {
  codeVerifier: string;
  issuedAt: number;
  nonce: string;
  providerId: string;
  redirectTo: string;
  state: string;
  workspaceId: string;
};

type OidcClaims = Record<string, any>;
type OidcProviderSettings = {
  oidcScope?: string | null;
};
type ConfiguredOidcProvider = AuthProvider & {
  oidcClientId: string;
  oidcClientSecret: string;
  oidcIssuer: string;
};
type UserWithMfa = User & {
  mfa?: {
    isEnabled?: boolean | null;
  } | null;
};

export type OidcLoginStart = {
  authorizationUrl: string;
  stateCookie: string;
};

export type OidcLoginResult = {
  authToken: string;
  authTokenTtlMs?: number;
  redirectUrl: string;
};

const DEFAULT_POST_LOGIN_PATH = '/home';
const LOGIN_PATH = '/login';
const MFA_CHALLENGE_PATH = '/login/mfa';
const MFA_SETUP_PATH = '/login/mfa/setup';
const DEFAULT_OIDC_SCOPE = 'openid profile email';
const OIDC_SESSION_MAX_AGE_MS = 10 * 60 * 1000;

// Keep `openid-client` on a real dynamic import path so it still loads from a
// CommonJS Nest build.
// eslint-disable-next-line no-new-func
const importOpenIdClient = new Function(
  'specifier',
  'return import(specifier);',
) as (specifier: string) => Promise<OpenIdClientModule>;

@Injectable()
export class OidcAuthService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly userRepo: UserRepo,
    private readonly groupUserRepo: GroupUserRepo,
    private readonly workspaceService: WorkspaceService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly domainService: DomainService,
    private readonly environmentService: EnvironmentService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async beginLogin(
    workspace: Workspace,
    providerId: string,
    redirectTo?: string,
  ): Promise<OidcLoginStart> {
    const provider = await this.getProvider(workspace.id, providerId);
    const client = await importOpenIdClient('openid-client');
    const config = await this.discoverProvider(client, provider);
    const redirectUri = this.getCallbackUrl(workspace, provider.id);
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    const authorizationUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: this.getRequestedScope(provider),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });

    const stateCookie = this.encodeSessionState({
      codeVerifier,
      issuedAt: Date.now(),
      nonce,
      providerId: provider.id,
      redirectTo: this.sanitizeRedirectPath(redirectTo, workspace),
      state,
      workspaceId: workspace.id,
    });

    return {
      authorizationUrl: authorizationUrl.href,
      stateCookie,
    };
  }

  async finishLogin(
    workspace: Workspace,
    providerId: string,
    currentUrl: URL,
    stateCookie?: string,
  ): Promise<OidcLoginResult> {
    if (!stateCookie) {
      throw new BadRequestException('OIDC authentication session is missing');
    }

    const sessionState = this.decodeSessionState(stateCookie);
    if (
      sessionState.providerId !== providerId ||
      sessionState.workspaceId !== workspace.id
    ) {
      throw new BadRequestException(
        'OIDC authentication session does not match this workspace or provider',
      );
    }

    const provider = await this.getProvider(workspace.id, providerId);
    const client = await importOpenIdClient('openid-client');
    const config = await this.discoverProvider(client, provider);

    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: sessionState.codeVerifier,
      expectedState: sessionState.state,
      expectedNonce: sessionState.nonce,
      idTokenExpected: true,
    });

    const idTokenClaims = tokens.claims?.() ?? {};
    const providerUserId = this.getStringClaim(idTokenClaims, ['sub']);

    if (!providerUserId) {
      throw new BadRequestException(
        'OIDC provider did not return a valid subject claim',
      );
    }

    let userInfo: OidcClaims = {};
    if (tokens.access_token) {
      userInfo = (await client.fetchUserInfo(
        config,
        tokens.access_token,
        providerUserId,
      )) as OidcClaims;
    }

    const claims = {
      ...idTokenClaims,
      ...userInfo,
    };

    const user = await this.resolveUser(workspace, provider, claims);
    await this.userRepo.updateLastLogin(user.id, workspace.id);

    const userHasMfa = this.hasMfaEnabled(user);
    const requiresMfaSetup = workspace.enforceMfa === true && !userHasMfa;
    const baseUrl = this.domainService.getUrl(workspace.hostname);
    const redirectTo = sessionState.redirectTo || DEFAULT_POST_LOGIN_PATH;

    this.auditService.logWithContext(
      {
        event: AuditEvent.USER_LOGIN,
        resourceType: AuditResource.USER,
        resourceId: user.id,
        metadata: {
          source: 'oidc',
          providerId: provider.id,
          providerType: provider.type,
        },
      },
      {
        workspaceId: workspace.id,
        actorId: user.id,
        actorType: 'user',
      },
    );

    if (userHasMfa || requiresMfaSetup) {
      const authToken = await this.tokenService.generateMfaToken(
        user,
        workspace.id,
      );

      return {
        authToken,
        authTokenTtlMs: 5 * 60 * 1000,
        redirectUrl: this.buildFrontendUrl(
          baseUrl,
          requiresMfaSetup ? MFA_SETUP_PATH : MFA_CHALLENGE_PATH,
          redirectTo,
        ),
      };
    }

    const authToken = await this.sessionService.createSessionAndToken(user);

    return {
      authToken,
      redirectUrl: this.buildFrontendUrl(baseUrl, redirectTo),
    };
  }

  buildLoginErrorUrl(
    workspace: Workspace,
    message: string,
    stateCookie?: string,
  ): string {
    let redirectTo = DEFAULT_POST_LOGIN_PATH;

    if (stateCookie) {
      const parsed = this.tryDecodeSessionState(stateCookie);
      if (parsed?.workspaceId === workspace.id) {
        redirectTo = parsed.redirectTo || DEFAULT_POST_LOGIN_PATH;
      }
    }

    const loginUrl = new URL(LOGIN_PATH, this.domainService.getUrl(workspace.hostname));
    if (redirectTo && redirectTo !== DEFAULT_POST_LOGIN_PATH) {
      loginUrl.searchParams.set('redirect', redirectTo);
    }
    loginUrl.searchParams.set('ssoError', message);

    return loginUrl.toString();
  }

  getCallbackUrl(workspace: Workspace, providerId: string): string {
    return `${this.domainService.getUrl(workspace.hostname)}/api/sso/oidc/${providerId}/callback`;
  }

  private async discoverProvider(
    client: OpenIdClientModule,
    provider: ConfiguredOidcProvider,
  ) {
    try {
      return await client.discovery(
        new URL(provider.oidcIssuer),
        provider.oidcClientId,
        provider.oidcClientSecret,
      );
    } catch (error) {
      throw new BadRequestException('Failed to discover OIDC provider metadata');
    }
  }

  private async resolveUser(
    workspace: Workspace,
    provider: AuthProvider,
    claims: OidcClaims,
  ): Promise<User> {
    const providerUserId = this.getStringClaim(claims, ['sub']);

    if (!providerUserId) {
      throw new BadRequestException(
        'OIDC provider did not return a stable subject identifier',
      );
    }

    const linkedAccount = await this.db
      .selectFrom('authAccounts')
      .select(['id', 'userId', 'providerUserId'])
      .where('workspaceId', '=', workspace.id)
      .where('authProviderId', '=', provider.id)
      .where('providerUserId', '=', providerUserId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (linkedAccount) {
      const linkedUser = await this.userRepo.findById(
        linkedAccount.userId,
        workspace.id,
        {
          includeUserMfa: true,
        },
      );

      if (!linkedUser || isUserDisabled(linkedUser)) {
        throw new UnauthorizedException('User account is unavailable');
      }

      await this.updateUserProfileFromClaims(linkedUser, workspace.id, claims);
      return this.userRepo.findById(linkedUser.id, workspace.id, {
        includeUserMfa: true,
      });
    }

    const email = this.getEmailClaim(claims);

    if (!email) {
      throw new BadRequestException(
        'OIDC provider did not return an email address. Ensure the provider grants the email claim.',
      );
    }

    if (claims.email_verified === false) {
      throw new ForbiddenException(
        'OIDC provider returned an unverified email address',
      );
    }

    validateAllowedEmail(email, workspace);

    const existingUser = await this.userRepo.findByEmail(email, workspace.id, {
      includeUserMfa: true,
    });

    if (existingUser && isUserDisabled(existingUser)) {
      throw new UnauthorizedException('User account is disabled');
    }

    if (existingUser) {
      await this.linkAuthAccount(
        existingUser.id,
        provider.id,
        workspace.id,
        providerUserId,
      );
      await this.updateUserProfileFromClaims(existingUser, workspace.id, claims);
      return this.userRepo.findById(existingUser.id, workspace.id, {
        includeUserMfa: true,
      });
    }

    if (!provider.allowSignup) {
      throw new ForbiddenException(
        'SSO signup is disabled for this provider',
      );
    }

    const user = await this.createUserFromClaims(
      workspace,
      provider,
      providerUserId,
      claims,
    );

    return this.userRepo.findById(user.id, workspace.id, {
      includeUserMfa: true,
    });
  }

  private async createUserFromClaims(
    workspace: Workspace,
    provider: ConfiguredOidcProvider,
    providerUserId: string,
    claims: OidcClaims,
  ): Promise<User> {
    const email = this.getEmailClaim(claims);
    if (!email) {
      throw new BadRequestException(
        'OIDC provider did not return an email address. Ensure the provider grants the email claim.',
      );
    }

    const name =
      this.getStringClaim(claims, ['name', 'preferred_username', 'nickname']) ??
      email.split('@')[0];
    const avatarUrl = this.getStringClaim(claims, ['picture']);
    const generatedPassword = `${nanoIdGen()}${nanoIdGen()}${nanoIdGen()}`;

    const user = await executeTx(this.db, async (trx) => {
      const createdUser = await this.userRepo.insertUser(
        {
          name,
          email,
          password: generatedPassword,
          avatarUrl,
          emailVerifiedAt: new Date(),
          hasGeneratedPassword: true,
          workspaceId: workspace.id,
        },
        trx,
      );

      await this.workspaceService.addUserToWorkspace(
        createdUser.id,
        workspace.id,
        undefined,
        trx,
      );

      await this.groupUserRepo.addUserToDefaultGroup(
        createdUser.id,
        workspace.id,
        trx,
      );

      await this.insertAuthAccount(
        createdUser.id,
        provider.id,
        workspace.id,
        providerUserId,
        trx,
      );

      return createdUser;
    });

    this.auditService.logWithContext(
      {
        event: AuditEvent.USER_CREATED,
        resourceType: AuditResource.USER,
        resourceId: user.id,
        changes: {
          after: {
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
        metadata: {
          source: 'oidc',
          providerId: provider.id,
        },
      },
      {
        workspaceId: workspace.id,
        actorId: user.id,
        actorType: 'user',
      },
    );

    return user;
  }

  private async updateUserProfileFromClaims(
    user: User,
    workspaceId: string,
    claims: OidcClaims,
  ): Promise<void> {
    const updates: Record<string, any> = {};
    const email = this.getEmailClaim(claims);

    if (!user.emailVerifiedAt && (email || claims.email_verified === true)) {
      updates.emailVerifiedAt = new Date();
    }

    const picture = this.getStringClaim(claims, ['picture']);
    if (!user.avatarUrl && picture) {
      updates.avatarUrl = picture;
    }

    const name = this.getStringClaim(claims, [
      'name',
      'preferred_username',
      'nickname',
    ]);
    if (!user.name && name) {
      updates.name = name;
    }

    if (Object.keys(updates).length === 0) {
      return;
    }

    await this.userRepo.updateUser(updates, user.id, workspaceId);
  }

  private async linkAuthAccount(
    userId: string,
    authProviderId: string,
    workspaceId: string,
    providerUserId: string,
  ): Promise<void> {
    const existingLink = await this.db
      .selectFrom('authAccounts')
      .select(['id', 'providerUserId'])
      .where('userId', '=', userId)
      .where('authProviderId', '=', authProviderId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!existingLink) {
      await this.insertAuthAccount(
        userId,
        authProviderId,
        workspaceId,
        providerUserId,
      );
      return;
    }

    if (existingLink.providerUserId === providerUserId) {
      return;
    }

    await this.db
      .updateTable('authAccounts')
      .set({
        providerUserId,
        updatedAt: new Date(),
      })
      .where('id', '=', existingLink.id)
      .execute();
  }

  private async insertAuthAccount(
    userId: string,
    authProviderId: string,
    workspaceId: string,
    providerUserId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = trx ?? this.db;

    await db
      .insertInto('authAccounts')
      .values({
        userId,
        authProviderId,
        workspaceId,
        providerUserId,
      })
      .execute();
  }

  private async getProvider(
    workspaceId: string,
    providerId: string,
  ): Promise<ConfiguredOidcProvider> {
    const provider = await this.db
      .selectFrom('authProviders')
      .selectAll()
      .where('id', '=', providerId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!provider || provider.type !== 'oidc') {
      throw new BadRequestException('OIDC provider not found');
    }

    if (!provider.isEnabled) {
      throw new BadRequestException('OIDC provider is disabled');
    }

    if (
      !provider.oidcIssuer ||
      !provider.oidcClientId ||
      !provider.oidcClientSecret
    ) {
      throw new BadRequestException(
        'OIDC provider is missing issuer, client ID, or client secret',
      );
    }

    return provider as ConfiguredOidcProvider;
  }

  private getEmailClaim(claims: OidcClaims): string | null {
    const email = this.getStringClaim(claims, ['email']);
    if (email) {
      return email.toLowerCase();
    }

    const preferredUsername = this.getStringClaim(claims, ['preferred_username']);
    if (preferredUsername?.includes('@')) {
      return preferredUsername.toLowerCase();
    }

    return null;
  }

  private getRequestedScope(provider: AuthProvider): string {
    const configuredScope = this.getProviderSettings(provider).oidcScope;
    if (!configuredScope) {
      return DEFAULT_OIDC_SCOPE;
    }

    const scopes = [...new Set(configuredScope.split(/\s+/).filter(Boolean))];
    if (scopes.length === 0) {
      return DEFAULT_OIDC_SCOPE;
    }

    if (!scopes.includes('openid')) {
      scopes.unshift('openid');
    }

    return scopes.join(' ');
  }

  private getProviderSettings(provider: AuthProvider): OidcProviderSettings {
    if (
      !provider.settings ||
      typeof provider.settings !== 'object' ||
      Array.isArray(provider.settings)
    ) {
      return {};
    }

    const settings = provider.settings as Record<string, unknown>;
    return {
      oidcScope:
        typeof settings.oidcScope === 'string'
          ? settings.oidcScope.trim()
          : undefined,
    };
  }

  private getStringClaim(
    claims: OidcClaims,
    keys: string[],
  ): string | null {
    for (const key of keys) {
      const value = claims?.[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return null;
  }

  private sanitizeRedirectPath(
    redirectTo: string | undefined,
    workspace: Workspace,
  ): string {
    if (!redirectTo) {
      return DEFAULT_POST_LOGIN_PATH;
    }

    try {
      const baseUrl = this.domainService.getUrl(workspace.hostname);
      const resolved = new URL(redirectTo, baseUrl);
      const base = new URL(baseUrl);

      if (resolved.origin !== base.origin) {
        return DEFAULT_POST_LOGIN_PATH;
      }

      return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    } catch {
      return DEFAULT_POST_LOGIN_PATH;
    }
  }

  private buildFrontendUrl(
    baseUrl: string,
    path: string,
    redirectTo?: string,
  ): string {
    const url = new URL(path, baseUrl);

    if (
      redirectTo &&
      path !== redirectTo &&
      path !== DEFAULT_POST_LOGIN_PATH &&
      redirectTo !== DEFAULT_POST_LOGIN_PATH
    ) {
      url.searchParams.set('redirect', redirectTo);
    }

    return url.toString();
  }

  private encodeSessionState(state: OidcSessionState): string {
    const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
    const signature = this.signStatePayload(payload);
    return `${payload}.${signature}`;
  }

  private decodeSessionState(value: string): OidcSessionState {
    const [payload, signature] = value.split('.');
    if (!payload || !signature) {
      throw new BadRequestException('OIDC authentication session is invalid');
    }

    const expectedSignature = this.signStatePayload(payload);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new BadRequestException('OIDC authentication session is invalid');
    }

    let parsed: OidcSessionState;
    try {
      parsed = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as OidcSessionState;
    } catch {
      throw new BadRequestException('OIDC authentication session is invalid');
    }

    if (
      !parsed?.codeVerifier ||
      !parsed?.providerId ||
      !parsed?.workspaceId ||
      !parsed?.state ||
      !parsed?.nonce ||
      typeof parsed?.issuedAt !== 'number'
    ) {
      throw new BadRequestException('OIDC authentication session is invalid');
    }

    if (Date.now() - parsed.issuedAt > OIDC_SESSION_MAX_AGE_MS) {
      throw new BadRequestException('OIDC authentication session has expired');
    }

    return parsed;
  }

  private tryDecodeSessionState(value?: string): OidcSessionState | null {
    if (!value) {
      return null;
    }

    try {
      return this.decodeSessionState(value);
    } catch {
      return null;
    }
  }

  private signStatePayload(payload: string): string {
    return createHmac('sha256', this.environmentService.getAppSecret())
      .update(payload)
      .digest('hex');
  }

  private hasMfaEnabled(user: User | null | undefined): boolean {
    return Boolean((user as UserWithMfa | null | undefined)?.mfa?.isEnabled);
  }
}
