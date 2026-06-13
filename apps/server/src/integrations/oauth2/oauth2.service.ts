import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { EnvironmentService } from '../environment/environment.service';
import { IntegrationConnectionRepo } from '@docmost/db/repos/integration/integration-connection.repo';
import { IntegrationSettingsRepo } from '@docmost/db/repos/integration/integration-settings.repo';
import { IntegrationConnection } from '@docmost/db/types/entity.types';
import {
  decryptSecret,
  encryptSecret,
} from '../../common/helpers/encryption.helper';
import { Oauth2ProviderRegistry } from './oauth2-provider.registry';
import { OAuth2Provider, OAuth2TokenResponse } from './oauth2.types';

const STATE_TTL_MS = 10 * 60 * 1000;
// refresh the access token when it is within this window of expiring
const EXPIRY_SKEW_MS = 60 * 1000;

interface AppCredentials {
  clientId: string;
  clientSecret: string;
}

interface StatePayload {
  p: string;
  u: string;
  w: string;
  n: string;
  t: number;
}

// Provider-agnostic OAuth2 lifecycle: per-workspace app credentials, per-user
// connect/callback/refresh/disconnect, and token retrieval. Providers are
// described by OAuth2Provider implementations in the Oauth2ProviderRegistry.
@Injectable()
export class Oauth2Service {
  private readonly logger = new Logger(Oauth2Service.name);

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly registry: Oauth2ProviderRegistry,
    private readonly integrationConnectionRepo: IntegrationConnectionRepo,
    private readonly integrationSettingsRepo: IntegrationSettingsRepo,
  ) {}

  hasProvider(providerKey: string): boolean {
    return this.registry.has(providerKey);
  }

  getProviderOrThrow(providerKey: string): OAuth2Provider {
    const provider = this.registry.get(providerKey);
    if (!provider) {
      throw new NotFoundException(`Unknown integration: ${providerKey}`);
    }
    return provider;
  }

  getRedirectUri(providerKey: string): string {
    return `${this.environmentService.getAppUrl()}/api/integrations/oauth2/${providerKey}/callback`;
  }

  // ----- admin app configuration (per workspace + provider) -----

  async setAppConfig(
    workspaceId: string,
    providerKey: string,
    clientId: string,
    clientSecret: string,
  ): Promise<void> {
    await this.integrationSettingsRepo.upsert({
      workspaceId,
      provider: providerKey,
      clientId,
      clientSecret: encryptSecret(
        clientSecret,
        this.environmentService.getAppSecret(),
      ),
      enabled: true,
    });
  }

  async getAppConfig(
    workspaceId: string,
    providerKey: string,
  ): Promise<{ configured: boolean; clientId?: string; redirectUri: string }> {
    // the authoritative callback URL admins must register with the provider,
    // derived from APP_URL so the client never has to reconstruct (and risk
    // drifting from) it
    const redirectUri = this.getRedirectUri(providerKey);
    const settings =
      await this.integrationSettingsRepo.findByWorkspaceAndProvider(
        workspaceId,
        providerKey,
      );
    if (!settings) return { configured: false, redirectUri };
    return { configured: true, clientId: settings.clientId, redirectUri };
  }

  async deleteAppConfig(
    workspaceId: string,
    providerKey: string,
  ): Promise<void> {
    await this.integrationSettingsRepo.deleteByWorkspaceAndProvider(
      workspaceId,
      providerKey,
    );
  }

  async isConfigured(
    workspaceId: string,
    providerKey: string,
  ): Promise<boolean> {
    return (await this.getAppCredentials(workspaceId, providerKey)) !== null;
  }

  private async getAppCredentials(
    workspaceId: string,
    providerKey: string,
  ): Promise<AppCredentials | null> {
    const settings =
      await this.integrationSettingsRepo.findByWorkspaceAndProvider(
        workspaceId,
        providerKey,
      );
    if (!settings || !settings.enabled) return null;
    return {
      clientId: settings.clientId,
      clientSecret: decryptSecret(
        settings.clientSecret,
        this.environmentService.getAppSecret(),
      ),
    };
  }

  // ----- signed state (CSRF + binds provider/user/workspace) -----

  private createState(
    providerKey: string,
    userId: string,
    workspaceId: string,
  ): string {
    const payload: StatePayload = {
      p: providerKey,
      u: userId,
      w: workspaceId,
      n: randomBytes(8).toString('hex'),
      t: Date.now(),
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.signState(encoded)}`;
  }

  private signState(encoded: string): string {
    return createHmac('sha256', this.environmentService.getAppSecret())
      .update(encoded)
      .digest('base64url');
  }

  verifyState(
    state: string | undefined,
    providerKey: string,
    userId: string,
    workspaceId: string,
  ): boolean {
    if (!state) return false;
    const [encoded, signature] = state.split('.');
    if (!encoded || !signature) return false;

    const expected = Buffer.from(this.signState(encoded));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return false;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as StatePayload;
      return (
        payload.p === providerKey &&
        payload.u === userId &&
        payload.w === workspaceId &&
        Date.now() - payload.t <= STATE_TTL_MS
      );
    } catch {
      return false;
    }
  }

  // ----- connect / callback / status / disconnect -----

  async buildAuthorizeUrl(
    providerKey: string,
    userId: string,
    workspaceId: string,
  ): Promise<string | null> {
    const credentials = await this.getAppCredentials(workspaceId, providerKey);
    if (!credentials) return null;
    const provider = this.getProviderOrThrow(providerKey);

    const params = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: this.getRedirectUri(providerKey),
      response_type: 'code',
      scope: provider.scopes,
      state: this.createState(providerKey, userId, workspaceId),
      ...(provider.authorizeExtraParams ?? {}),
    });
    return `${provider.authorizeUrl}?${params.toString()}`;
  }

  async handleCallback(
    providerKey: string,
    code: string,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const provider = this.getProviderOrThrow(providerKey);
    const credentials = await this.getAppCredentials(workspaceId, providerKey);
    if (!credentials) {
      throw new Error(`${provider.displayName} is not configured`);
    }

    const token = await this.exchangeToken(provider, credentials, code);
    const identity = await provider.fetchIdentity(token.access_token);
    const appSecret = this.environmentService.getAppSecret();

    await this.integrationConnectionRepo.upsert({
      userId,
      workspaceId,
      provider: providerKey,
      accessToken: encryptSecret(token.access_token, appSecret),
      refreshToken: token.refresh_token
        ? encryptSecret(token.refresh_token, appSecret)
        : null,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
      externalId: identity.id,
      externalName: identity.name,
      scope: token.scope ?? provider.scopes,
    });
  }

  async getStatus(
    providerKey: string,
    userId: string,
    workspaceId: string,
  ): Promise<{ connected: boolean; accountName?: string | null }> {
    const connection =
      await this.integrationConnectionRepo.findByUserAndProvider(
        userId,
        workspaceId,
        providerKey,
      );
    if (!connection) return { connected: false };

    // connected only if we can produce a usable token, so status agrees with
    // the data endpoints instead of reporting a dead connection as connected.
    // Reuse the row we just loaded rather than refetching it via getAccessToken.
    const token = await this.resolveAccessToken(connection);
    return { connected: token !== null, accountName: connection.externalName };
  }

  async disconnect(
    providerKey: string,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const provider = this.getProviderOrThrow(providerKey);
    const connection =
      await this.integrationConnectionRepo.findByUserAndProvider(
        userId,
        workspaceId,
        providerKey,
      );
    if (!connection) return;

    if (provider.revokeUrl) {
      try {
        const accessToken = decryptSecret(
          connection.accessToken,
          this.environmentService.getAppSecret(),
        );
        await this.revokeToken(provider, accessToken);
      } catch (err) {
        this.logger.warn(
          `Failed to revoke ${providerKey} token: ${(err as Error)?.message}`,
        );
      }
    }

    await this.integrationConnectionRepo.deleteByUserAndProvider(
      userId,
      workspaceId,
      providerKey,
    );
  }

  // Returns a valid decrypted access token, refreshing near expiry. Null when
  // not connected, or when the token is expired and refresh failed.
  async getAccessToken(
    providerKey: string,
    userId: string,
    workspaceId: string,
  ): Promise<string | null> {
    const connection =
      await this.integrationConnectionRepo.findByUserAndProvider(
        userId,
        workspaceId,
        providerKey,
      );
    if (!connection) return null;
    return this.resolveAccessToken(connection);
  }

  // Token logic for an already-loaded connection, so callers that hold the row
  // (e.g. getStatus) don't refetch it. Refreshes near expiry; returns null when
  // the token is expired and the refresh failed.
  private async resolveAccessToken(
    connection: IntegrationConnection,
  ): Promise<string | null> {
    const { userId, workspaceId, provider: providerKey } = connection;
    const appSecret = this.environmentService.getAppSecret();
    const accessToken = decryptSecret(connection.accessToken, appSecret);

    const expiresAt = connection.expiresAt
      ? new Date(connection.expiresAt).getTime()
      : null;
    const isExpiring =
      expiresAt !== null && expiresAt - Date.now() < EXPIRY_SKEW_MS;
    if (!isExpiring || !connection.refreshToken) {
      return accessToken;
    }

    const credentials = await this.getAppCredentials(workspaceId, providerKey);
    if (!credentials) return accessToken;

    try {
      const provider = this.getProviderOrThrow(providerKey);
      const refreshToken = decryptSecret(connection.refreshToken, appSecret);
      const token = await this.refreshAccessToken(
        provider,
        credentials,
        refreshToken,
      );

      await this.integrationConnectionRepo.update(
        {
          accessToken: encryptSecret(token.access_token, appSecret),
          refreshToken: token.refresh_token
            ? encryptSecret(token.refresh_token, appSecret)
            : connection.refreshToken,
          expiresAt: token.expires_in
            ? new Date(Date.now() + token.expires_in * 1000)
            : null,
          scope: token.scope ?? connection.scope,
          updatedAt: new Date(),
        },
        userId,
        workspaceId,
        providerKey,
      );
      return token.access_token;
    } catch (err) {
      this.logger.warn(
        `Failed to refresh ${providerKey} token, treating as disconnected: ${(err as Error)?.message}`,
      );
      // expired and unrefreshable; signal reconnect rather than hand back a
      // token the provider will reject
      return null;
    }
  }

  // ----- token endpoint calls -----

  private async exchangeToken(
    provider: OAuth2Provider,
    credentials: AppCredentials,
    code: string,
  ): Promise<OAuth2TokenResponse> {
    return this.postToken(provider, {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: this.getRedirectUri(provider.key),
      code,
      grant_type: 'authorization_code',
    });
  }

  private async refreshAccessToken(
    provider: OAuth2Provider,
    credentials: AppCredentials,
    refreshToken: string,
  ): Promise<OAuth2TokenResponse> {
    return this.postToken(provider, {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  private async postToken(
    provider: OAuth2Provider,
    params: Record<string, string>,
  ): Promise<OAuth2TokenResponse> {
    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`${provider.key} token request failed: ${text}`);
      throw new Error(`${provider.displayName} token request failed`);
    }
    return response.json() as Promise<OAuth2TokenResponse>;
  }

  private async revokeToken(
    provider: OAuth2Provider,
    accessToken: string,
  ): Promise<void> {
    if (!provider.revokeUrl) return;
    await fetch(provider.revokeUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
}
