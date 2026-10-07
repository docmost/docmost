import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { DomainService } from '../../../integrations/environment/domain.service';
import { IntegrationRegistry } from '../registry/integration-registry';
import { IntegrationRepo } from '../repos/integration.repo';
import { IntegrationConnectionRepo } from '../repos/integration-connection.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { EncryptionService } from '../../../integrations/encryption/encryption.service';
import { IntegrationConnection } from '@docmost/db/types/entity.types';
import {
  IdentityEmailMismatchError,
  IntegrationProvider,
  OAuthConfig,
  TokenExpiredError,
  TokenInvalidError,
} from '../registry/integration-provider.interface';
import { proxyFetch } from '../../../common/proxy-fetch';
import { readCappedResponse } from '../utils/provider-fetch';
import { isUserDisabled } from '../../../common/helpers/utils';
import { credentialEnvKey } from './credential-env';
import { supportsOAuthConnect } from './oauth-connect';
import WorkspaceAbilityFactory from '../../casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../casl/interfaces/workspace-ability.type';
import * as crypto from 'crypto';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service';
import {
  AuditEvent,
  AuditResource,
} from '../../../common/events/audit-events';

const OAUTH_HTTP_TIMEOUT_MS = 10_000;

const CONNECT_UNSUPPORTED_MESSAGE =
  'This integration does not support linking your account from Docmost';

export type OAuthFlow = 'install' | 'connect';

// RFC 6749 token charset; a control character would make undici echo the token in a header error.
const isWellFormedToken = (token: unknown): token is string =>
  typeof token === 'string' && /^[\x21-\x7e]+$/.test(token);

// Only the error code is safe to log; the rest of the body can name the tenant, app and user.
async function readTokenErrorCode(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return typeof body?.error === 'string' && /^[a-z_]{1,40}$/.test(body.error)
    ? body.error
    : '';
}

type OAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

export type OAuthStatePayload = {
  // Only admin-gated install states may write the shared workspace connection.
  flow: OAuthFlow;
  // null for installs, since completion creates the row.
  integrationId: string | null;
  type: string;
  userId: string;
  workspaceId: string;
  // Workspace URL the central callback hands the code back to.
  returnUrl: string;
  // Path on returnUrl to land on after the callback.
  returnPath: string;
  // Bound to a cookie on the browser that started the flow.
  nonce: string;
  exp: number;
};

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly environmentService: EnvironmentService,
    private readonly domainService: DomainService,
    private readonly registry: IntegrationRegistry,
    private readonly integrationRepo: IntegrationRepo,
    private readonly connectionRepo: IntegrationConnectionRepo,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly encryptionService: EncryptionService,
    private readonly userRepo: UserRepo,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async getAuthorizationUrl(
    integrationId: string,
    workspaceId: string,
    userId: string,
    returnPathOverride?: string,
  ): Promise<{ authorizationUrl: string; type: string; nonce: string }> {
    const integration = await this.integrationRepo.findById(integrationId);
    if (!integration || integration.workspaceId !== workspaceId) {
      throw new NotFoundException('Integration not found');
    }

    const provider = this.registry.getProvider(integration.type);
    if (!provider || !provider.definition.oauth) {
      throw new BadRequestException('Integration does not support OAuth');
    }

    const oauthConfig = provider.getOAuthConfig
      ? provider.getOAuthConfig((integration.settings as Record<string, any>) ?? {})
      : provider.definition.oauth;

    if (!supportsOAuthConnect(oauthConfig)) {
      throw new BadRequestException(CONNECT_UNSUPPORTED_MESSAGE);
    }

    // Workspace-scoped providers link a member's identity instead of re-running the install.
    const identity =
      (oauthConfig.connectionScope ?? 'user') === 'workspace'
        ? oauthConfig.identity
        : undefined;

    const callbackUrl = this.buildCallbackUrl(integration.type);

    const workspace = await this.workspaceRepo.findById(workspaceId);
    const returnUrl = this.domainService.getWorkspaceUrl(
      workspace ?? { hostname: null, customDomain: null },
    );

    const returnPath = returnPathOverride ?? '/settings/account/connections';
    const nonce = crypto.randomBytes(32).toString('base64url');

    const state = this.createSignedState({
      flow: 'connect',
      integrationId,
      type: integration.type,
      userId,
      workspaceId,
      returnUrl,
      returnPath,
      nonce,
      exp: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      ...((identity ? identity.authParams : oauthConfig.authParams) ?? {}),
      client_id: this.getClientId(integration.type, oauthConfig),
      redirect_uri: callbackUrl,
      response_type: 'code',
      state,
    });

    const scope = (identity?.scopes ?? oauthConfig.scopes)
      .map((s) => encodeURIComponent(s))
      .join('%20');

    return {
      authorizationUrl: `${identity?.authUrl ?? oauthConfig.authUrl}?${params.toString()}&scope=${scope}`,
      type: integration.type,
      nonce,
    };
  }

  async getInstallAuthorizationUrl(
    type: string,
    workspaceId: string,
    userId: string,
  ): Promise<{ authorizationUrl: string; nonce: string }> {
    const provider = this.registry.getProvider(type);
    if (!provider || provider.definition.hidden) {
      throw new BadRequestException(`Unknown integration type: ${type}`);
    }
    if (!provider.definition.oauth) {
      throw new BadRequestException('Integration does not support OAuth');
    }

    const existing = await this.integrationRepo.findByWorkspaceAndType(
      workspaceId,
      type,
    );
    if (existing) {
      throw new BadRequestException(
        `Integration "${type}" is already installed`,
      );
    }

    const oauthConfig = provider.getOAuthConfig
      ? provider.getOAuthConfig({})
      : provider.definition.oauth;

    const callbackUrl = this.buildCallbackUrl(type);

    const workspace = await this.workspaceRepo.findById(workspaceId);
    const returnUrl = this.domainService.getWorkspaceUrl(
      workspace ?? { hostname: null, customDomain: null },
    );

    const nonce = crypto.randomBytes(32).toString('base64url');

    const state = this.createSignedState({
      flow: 'install',
      integrationId: null,
      type,
      userId,
      workspaceId,
      returnUrl,
      returnPath: '/settings/integrations',
      nonce,
      exp: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      ...(oauthConfig.authParams ?? {}),
      client_id: this.getClientId(type, oauthConfig),
      redirect_uri: callbackUrl,
      response_type: 'code',
      state,
    });

    const scope = oauthConfig.scopes
      .map((s) => encodeURIComponent(s))
      .join('%20');

    return {
      authorizationUrl: `${oauthConfig.authUrl}?${params.toString()}&scope=${scope}`,
      nonce,
    };
  }

  verifySignedState(state: string): OAuthStatePayload | null {
    const dotIndex = state.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const data = state.substring(0, dotIndex);
    const signature = state.substring(dotIndex + 1);

    const secret = this.stateKey();
    const expected = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      return null;
    }

    try {
      const payload: OAuthStatePayload = JSON.parse(
        Buffer.from(data, 'base64url').toString(),
      );

      if (payload.exp < Date.now()) return null;

      return payload;
    } catch {
      return null;
    }
  }

  async exchangeCodeForTokens(
    type: string,
    code: string,
    state: Pick<
      OAuthStatePayload,
      'flow' | 'integrationId' | 'type' | 'userId' | 'workspaceId'
    >,
  ): Promise<IntegrationConnection> {
    if (state.type !== type) {
      throw new BadRequestException('OAuth state does not match this provider');
    }

    const provider = this.registry.getProvider(type);
    if (!provider || !provider.definition.oauth) {
      throw new BadRequestException('Integration does not support OAuth');
    }

    if (state.flow === 'install') {
      if (provider.definition.hidden) {
        throw new BadRequestException(`Unknown integration type: ${type}`);
      }
      await this.assertCanManageWorkspace(state.userId, state.workspaceId);
      const installed = await this.completeInstall(provider, type, code, state);
      this.auditService.log({
        event: AuditEvent.INTEGRATION_INSTALLED,
        resourceType: AuditResource.INTEGRATION,
        resourceId: installed.integrationId,
        changes: { after: { provider: type } },
      });
      return installed;
    }
    const connected = await this.completeConnect(provider, type, code, state);
    this.auditService.log({
      event: AuditEvent.INTEGRATION_CONNECTED,
      resourceType: AuditResource.INTEGRATION,
      resourceId: state.integrationId,
      changes: { after: { provider: type } },
    });
    return connected;
  }


  // Catches an admin role lost between authorize and completion.
  private async assertCanManageWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const [user, workspace] = await Promise.all([
      this.userRepo.findById(userId, workspaceId),
      this.workspaceRepo.findById(workspaceId),
    ]);
    if (!user || isUserDisabled(user) || !workspace) {
      throw new ForbiddenException();
    }
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }
  }

  // The integration row is only created after a successful token exchange.
  private async completeInstall(
    provider: IntegrationProvider,
    type: string,
    code: string,
    state: Pick<OAuthStatePayload, 'integrationId' | 'userId' | 'workspaceId'>,
  ): Promise<IntegrationConnection> {
    const { userId, workspaceId } = state;
    const integration = state.integrationId
      ? await this.integrationRepo.findById(state.integrationId)
      : null;
    if (integration && integration.workspaceId !== workspaceId) {
      throw new NotFoundException('Integration not found');
    }

    const settings = (integration?.settings as Record<string, any>) ?? {};
    const oauthConfig = provider.getOAuthConfig
      ? provider.getOAuthConfig(settings)
      : provider.definition.oauth;

    const tokenResponse = await this.requestTokens(oauthConfig, type, code);

    // A failing onConnected must not leave the row and bot token behind.
    return executeTx(this.db, async (trx) => {
      const installed =
        integration ??
        (await this.integrationRepo.insertOrRestore(
          { type, workspaceId, installedById: userId },
          trx,
        ));

      const connection = await this.storeConnection(
        installed.id,
        userId,
        workspaceId,
        tokenResponse,
        provider.definition.oauth?.connectionScope ?? 'user',
        trx,
      );

      // Only the install flow fires onConnected.
      if (provider.onConnected) {
        await provider.onConnected({
          integrationId: installed.id,
          workspaceId,
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          userId,
          metadata: tokenResponse,
          trx,
        });
      }

      return connection;
    });
  }

  // Writes only the caller's own row, never the shared workspace connection.
  private async completeConnect(
    provider: IntegrationProvider,
    type: string,
    code: string,
    state: Pick<OAuthStatePayload, 'integrationId' | 'userId' | 'workspaceId'>,
  ): Promise<IntegrationConnection> {
    const { userId, workspaceId } = state;
    const integration = state.integrationId
      ? await this.integrationRepo.findById(state.integrationId)
      : null;
    if (!integration || integration.workspaceId !== workspaceId) {
      throw new NotFoundException('Integration not found');
    }

    const settings = (integration.settings as Record<string, any>) ?? {};
    const oauthConfig = provider.getOAuthConfig
      ? provider.getOAuthConfig(settings)
      : provider.definition.oauth;
    if (!supportsOAuthConnect(oauthConfig)) {
      throw new BadRequestException(CONNECT_UNSUPPORTED_MESSAGE);
    }

    if ((oauthConfig.connectionScope ?? 'user') === 'user') {
      const tokenResponse = await this.requestTokens(oauthConfig, type, code);
      return this.storeConnection(
        integration.id,
        userId,
        workspaceId,
        tokenResponse,
        'user',
      );
    }

    const identity = oauthConfig.identity;
    if (!identity || !provider.resolveIdentity) {
      throw new BadRequestException(CONNECT_UNSUPPORTED_MESSAGE);
    }
    const tokenResponse = await this.requestTokens(
      oauthConfig,
      type,
      code,
      identity.tokenUrl,
    );
    const resolved = await provider.resolveIdentity({
      integrationId: integration.id,
      workspaceId,
      userId,
      tokenResponse,
      settings,
    });
    // Stops a phished completion from binding someone else's provider account.
    if (resolved.email) {
      const user = await this.userRepo.findById(userId, workspaceId);
      const userEmail = user?.email?.trim().toLowerCase();
      if (!userEmail || userEmail !== resolved.email.trim().toLowerCase()) {
        throw new IdentityEmailMismatchError();
      }
    }
    // Checked up front so a rebind gets a clear error, not a unique-index violation.
    const existingLink = await this.connectionRepo.findUserLink(
      integration.id,
      resolved.providerUserId,
    );
    if (existingLink && existingLink.userId !== userId) {
      throw new BadRequestException(
        'This account is already connected to a different Docmost user. Disconnect it there first.',
      );
    }

    return this.connectionRepo.upsertUserLink({
      integrationId: integration.id,
      workspaceId,
      userId,
      providerUserId: resolved.providerUserId,
      metadata: resolved.metadata ?? {},
    });
  }

  private async storeConnection(
    integrationId: string,
    userId: string,
    workspaceId: string,
    tokenResponse: OAuthTokenResponse,
    connectionScope: 'workspace' | 'user',
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection> {
    const encryptedAccessToken = this.encryptionService.encrypt(
      tokenResponse.access_token,
    );
    const encryptedRefreshToken = tokenResponse.refresh_token
      ? this.encryptionService.encrypt(tokenResponse.refresh_token)
      : null;

    const tokenExpiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    const values = {
      integrationId,
      userId,
      workspaceId,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt,
      scopes: tokenResponse.scope ?? null,
    };

    return connectionScope === 'workspace'
      ? this.connectionRepo.upsertWorkspaceConnection(values, trx)
      : this.connectionRepo.upsert(values, trx);
  }

  async getValidAccessToken(
    connection: IntegrationConnection,
  ): Promise<string> {
    if (connection.invalidatedAt) {
      throw new TokenInvalidError();
    }

    // Not every provider answers an expired token with a 401.
    if (
      connection.tokenExpiresAt &&
      new Date(connection.tokenExpiresAt).getTime() < Date.now()
    ) {
      if (!connection.refreshToken) {
        throw new TokenInvalidError(
          'Access token expired and cannot be refreshed',
        );
      }
      throw new TokenExpiredError();
    }

    return this.encryptionService.decrypt(connection.accessToken);
  }

  // Takes no lock, so only the scheduled refresh job may call this.
  async refreshAccessToken(connection: IntegrationConnection): Promise<void> {
    const integration = await this.integrationRepo.findById(
      connection.integrationId,
    );
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    const provider = this.registry.getProvider(integration.type);
    if (!provider || !provider.definition.oauth) {
      throw new BadRequestException('Integration does not support OAuth');
    }

    const oauthConfig = provider.getOAuthConfig
      ? provider.getOAuthConfig((integration.settings as Record<string, any>) ?? {})
      : provider.definition.oauth;

    const clientId = this.getClientId(integration.type, oauthConfig);
    const clientSecret = this.getClientSecret(integration.type, oauthConfig);

    try {
      const current = await this.connectionRepo.findById(connection.id);
      // Gone, retired, refreshed or reconnected since the caller read it.
      if (
        !current?.refreshToken ||
        current.invalidatedAt ||
        current.accessToken !== connection.accessToken
      ) {
        return;
      }
      // A reconnect or another refresh meanwhile turns the writes below into no-ops.
      const expected = { refreshToken: current.refreshToken };

      const basicAuth = oauthConfig.clientAuth === 'basic';
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        ...(basicAuth ? {} : { client_id: clientId, client_secret: clientSecret }),
        refresh_token: this.encryptionService.decrypt(current.refreshToken),
      });
      if (oauthConfig.scopeOnRefresh) {
        params.set('scope', oauthConfig.scopes.join(' '));
      }

      const response = await this.postTokenRequest(
        integration.type,
        oauthConfig.refreshUrl ?? oauthConfig.tokenUrl,
        params,
        basicAuth ? { clientId, clientSecret } : undefined,
      );

      if (!response.ok) {
        if (oauthConfig.retireOnInvalidGrantOnly) {
          const errorCode = await readTokenErrorCode(response);
          this.logger.error(
            `Token refresh failed for ${integration.type}: ${response.status} ${errorCode}`.trimEnd(),
          );
          if (
            errorCode === 'invalid_grant' ||
            errorCode === 'interaction_required'
          ) {
            await this.connectionRepo.invalidate(current.id, expected);
            throw new TokenInvalidError(
              `Refresh token rejected for ${integration.type}`,
            );
          }
          throw new BadRequestException('Token refresh failed');
        }

        this.logger.error(
          `Token refresh failed for ${integration.type}: ${response.status}`,
        );
        if (response.status === 400 || response.status === 401) {
          await this.connectionRepo.invalidate(current.id, expected);
          throw new TokenInvalidError(
            `Refresh token rejected for ${integration.type}`,
          );
        }
        throw new BadRequestException('Token refresh failed');
      }

      // A parse error would quote the body.
      const data: OAuthTokenResponse | null = await response
        .json()
        .catch(() => null);
      if (!data) {
        this.logger.error(
          `Token refresh for ${integration.type} returned a response that is not JSON`,
        );
        throw new BadRequestException('Token refresh failed');
      }
      if (
        !isWellFormedToken(data.access_token) ||
        (data.refresh_token && !isWellFormedToken(data.refresh_token))
      ) {
        this.logger.error(
          `Token refresh for ${integration.type} returned a malformed token`,
        );
        throw new BadRequestException('Token refresh failed');
      }
      const encryptedAccessToken = this.encryptionService.encrypt(
        data.access_token,
      );
      const encryptedRefreshToken = data.refresh_token
        ? this.encryptionService.encrypt(data.refresh_token)
        : current.refreshToken;
      const tokenExpiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null;

      await this.connectionRepo.updateIfTokensMatch(current.id, expected, {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        invalidatedAt: null,
      });
    } catch (err) {
      if (err instanceof TokenInvalidError) {
        throw err;
      }
      this.logger.error(`Token refresh error: ${(err as Error).message}`);
      throw new BadRequestException('Failed to refresh token');
    }
  }

  private async requestTokens(
    oauthConfig: OAuthConfig,
    type: string,
    code: string,
    tokenUrl = oauthConfig.tokenUrl,
  ): Promise<OAuthTokenResponse> {
    const clientId = this.getClientId(type, oauthConfig);
    const clientSecret = this.getClientSecret(type, oauthConfig);
    const basicAuth = oauthConfig.clientAuth === 'basic';
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      ...(basicAuth ? {} : { client_id: clientId, client_secret: clientSecret }),
      code,
      redirect_uri: this.buildCallbackUrl(type),
    });

    const response = await this.postTokenRequest(
      type,
      tokenUrl,
      params,
      basicAuth ? { clientId, clientSecret } : undefined,
    );

    if (!response.ok) {
      const errorCode = await readTokenErrorCode(response);
      this.logger.error(
        `Token exchange failed for ${type}: ${response.status} ${errorCode}`.trimEnd(),
      );
      throw new BadRequestException('OAuth token exchange failed');
    }

    // A parse error would quote the body.
    const data: OAuthTokenResponse | null = await response
      .json()
      .catch(() => null);
    if (!data) {
      this.logger.error(
        `Token exchange for ${type} returned a response that is not JSON`,
      );
      throw new BadRequestException('OAuth token exchange failed');
    }
    if (!data.access_token) {
      this.logger.error(`Token exchange for ${type} returned no access token`);
      throw new BadRequestException('OAuth token exchange failed');
    }
    if (
      !isWellFormedToken(data.access_token) ||
      (data.refresh_token && !isWellFormedToken(data.refresh_token))
    ) {
      this.logger.error(`Token exchange for ${type} returned a malformed token`);
      throw new BadRequestException('OAuth token exchange failed');
    }
    return data;
  }

  private async postTokenRequest(
    type: string,
    tokenUrl: string,
    params: URLSearchParams,
    basicAuth?: { clientId: string; clientSecret: string },
  ): Promise<Response> {
    const response = await proxyFetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        ...(basicAuth
          ? {
              Authorization: `Basic ${Buffer.from(`${basicAuth.clientId}:${basicAuth.clientSecret}`).toString('base64')}`,
            }
          : {}),
      },
      body: params.toString(),
      // Never follow: a 3xx would re-POST the client secret and code to the Location target.
      redirect: 'manual',
      signal: AbortSignal.timeout(OAUTH_HTTP_TIMEOUT_MS),
    });
    return readCappedResponse(`${type} token endpoint`, response);
  }

  buildCallbackUrl(type: string): string {
    const appUrl = this.environmentService.getAppUrl();
    return `${appUrl}/api/integrations/oauth/${type}/callback`;
  }

  // State gets its own key so a signature made with APP_SECRET for anything else never verifies here.
  private stateKey(): Buffer {
    return Buffer.from(
      crypto.hkdfSync(
        'sha256',
        this.environmentService.getAppSecret(),
        '',
        'integration-oauth-state',
        32,
      ),
    );
  }

  private createSignedState(payload: OAuthStatePayload): string {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const secret = this.stateKey();
    const signature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64url');
    return `${data}.${signature}`;
  }

  private getClientId(type: string, oauthConfig: OAuthConfig): string {
    return this.requireEnv(credentialEnvKey('CLIENT_ID', type, oauthConfig));
  }

  private getClientSecret(type: string, oauthConfig: OAuthConfig): string {
    return this.requireEnv(
      credentialEnvKey('CLIENT_SECRET', type, oauthConfig),
    );
  }

  private requireEnv(envKey: string): string {
    const value = process.env[envKey];
    if (!value) {
      throw new BadRequestException(
        `Missing environment variable: ${envKey}`,
      );
    }
    return value;
  }
}
