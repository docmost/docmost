import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { IntegrationRegistry } from '../registry/integration-registry';
import { IntegrationRepo } from '../repos/integration.repo';
import { IntegrationConnectionRepo } from '../repos/integration-connection.repo';
import { encryptToken, decryptToken } from '../crypto/token-crypto';
import { IntegrationConnection } from '@docmost/db/types/entity.types';
import { OAuthConfig } from '../registry/integration-provider.interface';
import * as crypto from 'crypto';

type OAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

export type OAuthStatePayload = {
  integrationId: string;
  userId: string;
  workspaceId: string;
  exp: number;
};

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly registry: IntegrationRegistry,
    private readonly integrationRepo: IntegrationRepo,
    private readonly connectionRepo: IntegrationConnectionRepo,
  ) {}

  async getAuthorizationUrl(
    integrationId: string,
    workspaceId: string,
    userId: string,
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

    const state = this.createSignedState({
      integrationId,
      userId,
      workspaceId,
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
    integrationId: string,
    userId: string,
    workspaceId: string,
  ): Promise<IntegrationConnection> {
    const provider = this.registry.getProvider(type);
    if (!provider || !provider.definition.oauth) {
      throw new BadRequestException('Integration does not support OAuth');
    }

    const integration = await this.integrationRepo.findById(integrationId);
    const settings = (integration?.settings as Record<string, any>) ?? {};

    const oauthConfig = provider.getOAuthConfig
      ? provider.getOAuthConfig(settings)
      : provider.definition.oauth;

    const tokenResponse = await this.requestTokens(
      oauthConfig,
      type,
      code,
    );

    const appSecret = this.environmentService.getAppSecret();
    const encryptedAccessToken = encryptToken(
      tokenResponse.access_token,
      appSecret,
    );
    const encryptedRefreshToken = tokenResponse.refresh_token
      ? encryptToken(tokenResponse.refresh_token, appSecret)
      : null;

    const tokenExpiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    const connection = await this.connectionRepo.upsert({
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
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        providerUserId: '',
        metadata: {},
      });
    }

    return connection;
  }

  async getValidAccessToken(
    connection: IntegrationConnection,
  ): Promise<string> {
    const appSecret = this.environmentService.getAppSecret();
    const accessToken = decryptToken(connection.accessToken, appSecret);

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
    const appSecret = this.environmentService.getAppSecret();
    const refreshToken = decryptToken(connection.refreshToken, appSecret);

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
      const response = await fetch(oauthConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: params.toString(),
      });

      if (!response.ok) {
        this.logger.error(
          `Token refresh failed for ${integration.type}: ${response.status}`,
        );
        throw new BadRequestException('Token refresh failed');
      }

      const data: OAuthTokenResponse = await response.json();
      const encryptedAccessToken = encryptToken(data.access_token, appSecret);
      const encryptedRefreshToken = data.refresh_token
        ? encryptToken(data.refresh_token, appSecret)
        : connection.refreshToken;
      const tokenExpiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null;

      await this.connectionRepo.update(connection.id, {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
      });

      return data.access_token;
    } catch (err) {
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

    const response = await fetch(oauthConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params.toString(),
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
