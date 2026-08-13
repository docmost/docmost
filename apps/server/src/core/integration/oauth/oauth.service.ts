import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { DomainService } from '../../../integrations/environment/domain.service';
import { IntegrationRegistry } from '../registry/integration-registry';
import { IntegrationRepo } from '../repos/integration.repo';
import { IntegrationConnectionRepo } from '../repos/integration-connection.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { EncryptionService } from '../../../integrations/encryption/encryption.service';
import { IntegrationConnection } from '@docmost/db/types/entity.types';
import {
  OAuthConfig,
  TokenInvalidError,
} from '../registry/integration-provider.interface';
import { proxyFetch } from '../../../common/proxy-fetch';
import * as crypto from 'crypto';

const OAUTH_HTTP_TIMEOUT_MS = 10_000;

type OAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

export type OAuthStatePayload = {
  // For "authorize-only" flows (per-user OAuth on an already-installed
  // integration) integrationId is set; for "install-and-authorize" flows
  // (workspace-scoped providers like Slack) it's null until the callback
  // resolves-or-creates the row atomically with token exchange success.
  integrationId: string | null;
  type: string;
  userId: string;
  workspaceId: string;
  // Workspace's canonical URL at authorize time. Cloud workspaces are routed
  // through a single central OAuth callback (the only redirect_uri Slack/etc.
  // accept), and this lets the callback redirect the user back to their own
  // workspace host (subdomain or custom domain) after token exchange.
  returnUrl: string;
  // Settings page (relative to returnUrl) to land on after the callback.
  // Derived server-side from the flow that started it, never from user input.
  returnPath?: string;
  exp: number;
};

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly domainService: DomainService,
    private readonly registry: IntegrationRegistry,
    private readonly integrationRepo: IntegrationRepo,
    private readonly connectionRepo: IntegrationConnectionRepo,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly encryptionService: EncryptionService,
  ) {}

  async getAuthorizationUrl(
    integrationId: string,
    workspaceId: string,
    userId: string,
    returnPathOverride?: string,
  ): Promise<{ authorizationUrl: string }> {
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

    const callbackUrl = this.buildCallbackUrl(integration.type);

    const workspace = await this.workspaceRepo.findById(workspaceId);
    const returnUrl = this.domainService.getWorkspaceUrl(
      workspace ?? { hostname: null, customDomain: null },
    );

    // Per-user connects are initiated from the account connections page;
    // workspace-scoped authorizes from the admin integrations page. A connect
    // started elsewhere (e.g. an editor connect card) passes its own path.
    const returnPath =
      returnPathOverride ??
      ((provider.definition.oauth.connectionScope ?? 'user') === 'workspace'
        ? '/settings/integrations'
        : '/settings/account/connections');

    const state = this.createSignedState({
      integrationId,
      type: integration.type,
      userId,
      workspaceId,
      returnUrl,
      returnPath,
      exp: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: this.getClientId(integration.type),
      redirect_uri: callbackUrl,
      response_type: 'code',
      state,
    });

    const scope = oauthConfig.scopes
      .map((s) => encodeURIComponent(s))
      .join('%20');

    return {
      authorizationUrl: `${oauthConfig.authUrl}?${params.toString()}&scope=${scope}`,
    };
  }

  /**
   * Install-and-authorize: the install flow for every OAuth provider.
   *
   * Skips creating the integration row up front. The callback persists it
   * only after a successful token exchange, so a cancelled consent screen or
   * misconfigured client credentials leave nothing half-installed. Refusing
   * the already-installed case here keeps the install button idempotent.
   */
  async getInstallAuthorizationUrl(
    type: string,
    workspaceId: string,
    userId: string,
  ): Promise<{ authorizationUrl: string }> {
    const provider = this.registry.getProvider(type);
    if (!provider || !provider.definition.oauth) {
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

    const state = this.createSignedState({
      integrationId: null,
      type,
      userId,
      workspaceId,
      returnUrl,
      returnPath: '/settings/integrations',
      exp: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: this.getClientId(type),
      redirect_uri: callbackUrl,
      response_type: 'code',
      state,
    });

    const scope = oauthConfig.scopes
      .map((s) => encodeURIComponent(s))
      .join('%20');

    return {
      authorizationUrl: `${oauthConfig.authUrl}?${params.toString()}&scope=${scope}`,
    };
  }

  verifySignedState(state: string): OAuthStatePayload | null {
    const dotIndex = state.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const data = state.substring(0, dotIndex);
    const signature = state.substring(dotIndex + 1);

    const secret = this.environmentService.getAppSecret();
    const expected = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64url');

    if (signature !== expected) return null;

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
    integrationId: string | null,
    userId: string,
    workspaceId: string,
  ): Promise<IntegrationConnection> {
    const provider = this.registry.getProvider(type);
    if (!provider || !provider.definition.oauth) {
      throw new BadRequestException('Integration does not support OAuth');
    }

    // Install flow: no row yet; persisted only after the token exchange succeeds.
    let integration = integrationId
      ? await this.integrationRepo.findById(integrationId)
      : null;

    const settings = (integration?.settings as Record<string, any>) ?? {};

    const oauthConfig = provider.getOAuthConfig
      ? provider.getOAuthConfig(settings)
      : provider.definition.oauth;

    const tokenResponse = await this.requestTokens(
      oauthConfig,
      type,
      code,
    );

    if (!integration) {
      integration = await this.integrationRepo.insertOrRestore({
        type,
        workspaceId,
        installedById: userId,
      });
      integrationId = integration.id;
    }

    const encryptedAccessToken = this.encryptionService.encrypt(
      tokenResponse.access_token,
    );
    const encryptedRefreshToken = tokenResponse.refresh_token
      ? this.encryptionService.encrypt(tokenResponse.refresh_token)
      : null;

    const tokenExpiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    const connectionScope =
      provider.definition.oauth?.connectionScope ?? 'user';

    const connection =
      connectionScope === 'workspace'
        ? await this.connectionRepo.upsertWorkspaceConnection({
            integrationId,
            userId,
            workspaceId,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            tokenExpiresAt,
            scopes: tokenResponse.scope ?? null,
          })
        : await this.connectionRepo.upsert({
            integrationId,
            userId,
            workspaceId,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            tokenExpiresAt,
            scopes: tokenResponse.scope ?? null,
          });

    if (provider.onConnected) {
      await provider.onConnected({
        integrationId,
        workspaceId,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        userId,
        metadata: tokenResponse,
      });
    }

    return connection;
  }

  async getValidAccessToken(
    connection: IntegrationConnection,
  ): Promise<string> {
    if (connection.invalidatedAt) {
      throw new TokenInvalidError();
    }
    const accessToken = this.encryptionService.decrypt(connection.accessToken);

    const needsRefresh =
      connection.tokenExpiresAt &&
      connection.refreshToken &&
      new Date(connection.tokenExpiresAt).getTime() - Date.now() < 5 * 60 * 1000;

    if (!needsRefresh) {
      return accessToken;
    }

    return this.refreshAccessToken(connection);
  }

  private async refreshAccessToken(
    connection: IntegrationConnection,
  ): Promise<string> {
    const refreshToken = this.encryptionService.decrypt(
      connection.refreshToken,
    );

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

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.getClientId(integration.type),
      client_secret: this.getClientSecret(integration.type),
      refresh_token: refreshToken,
    });

    try {
      const response = await proxyFetch(oauthConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: params.toString(),
        signal: AbortSignal.timeout(OAUTH_HTTP_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.error(
          `Token refresh failed for ${integration.type}: ${response.status}`,
        );
        // 400/401 from the token endpoint means invalid_grant/invalid_client:
        // the refresh token is dead, not a transient failure.
        if (response.status === 400 || response.status === 401) {
          throw new TokenInvalidError(
            `Refresh token rejected for ${integration.type}`,
          );
        }
        throw new BadRequestException('Token refresh failed');
      }

      const data: OAuthTokenResponse = await response.json();
      const encryptedAccessToken = this.encryptionService.encrypt(
        data.access_token,
      );
      const encryptedRefreshToken = data.refresh_token
        ? this.encryptionService.encrypt(data.refresh_token)
        : connection.refreshToken;
      const tokenExpiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null;

      await this.connectionRepo.update(connection.id, {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        invalidatedAt: null,
      });

      return data.access_token;
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
  ): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.getClientId(type),
      client_secret: this.getClientSecret(type),
      code,
      redirect_uri: this.buildCallbackUrl(type),
    });

    const response = await proxyFetch(oauthConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params.toString(),
      signal: AbortSignal.timeout(OAUTH_HTTP_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Token exchange failed for ${type}: ${response.status} ${body}`);
      throw new BadRequestException('OAuth token exchange failed');
    }

    return response.json();
  }

  buildCallbackUrl(type: string): string {
    const appUrl = this.environmentService.getAppUrl();
    return `${appUrl}/api/integrations/oauth/${type}/callback`;
  }

  private createSignedState(payload: OAuthStatePayload): string {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const secret = this.environmentService.getAppSecret();
    const signature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64url');
    return `${data}.${signature}`;
  }

  private getClientId(type: string): string {
    const envKey = `INTEGRATION_${type.toUpperCase()}_CLIENT_ID`;
    const value = process.env[envKey];
    if (!value) {
      throw new BadRequestException(
        `Missing environment variable: ${envKey}`,
      );
    }
    return value;
  }

  private getClientSecret(type: string): string {
    const envKey = `INTEGRATION_${type.toUpperCase()}_CLIENT_SECRET`;
    const value = process.env[envKey];
    if (!value) {
      throw new BadRequestException(
        `Missing environment variable: ${envKey}`,
      );
    }
    return value;
  }
}
