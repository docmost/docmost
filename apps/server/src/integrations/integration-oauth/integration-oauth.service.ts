import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { createHash, randomBytes } from 'node:crypto';
import {
  encryptString,
  decryptString,
} from '../../common/helpers/encryption.helper';
import { EnvironmentService } from '../environment/environment.service';
import { outboundFetch, readOutboundBody } from './outbound-url-guard';
import { IntegrationManifest } from './manifest.types';
import { IntegrationOAuthRegistry } from './manifest.registry';
import { IntegrationOAuthTokenRepo } from './integration-oauth-token.repo';
import {
  IntegrationOAuthConnectionService,
  ResolvedIntegrationOAuthConnection,
} from './integration-oauth-connection.service';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const STATE_PREFIX = 'integration-oauth:state:';
const TOKEN_ENCRYPTION_INFO = 'integration-oauth-token-v1';

interface OAuthState {
  userId: string;
  workspaceId: string;
  integrationId: string;
  codeVerifier?: string;
  returnTo?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export interface DecryptedTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string;
  needsReconnect: boolean;
}

@Injectable()
export class IntegrationOAuthService {
  private readonly logger = new Logger(IntegrationOAuthService.name);

  constructor(
    private readonly registry: IntegrationOAuthRegistry,
    private readonly tokenRepo: IntegrationOAuthTokenRepo,
    private readonly connectionService: IntegrationOAuthConnectionService,
    private readonly environmentService: EnvironmentService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** Builds the authorize redirect URL and stashes one-shot state in Redis. */
  async startAuthorize(args: {
    integrationId: string;
    workspaceId: string;
    userId: string;
    returnTo?: string;
  }): Promise<{ url: string }> {
    const manifest = this.registry.requireForIntegrationId(args.integrationId);
    const connection = await this.connectionService.requireEnabled(
      args.workspaceId,
      args.integrationId,
    );

    const stateToken = randomBytes(32).toString('hex');
    const params: Record<string, string> = {
      client_id: connection.oauthClientId,
      redirect_uri: this.callbackUrl(connection.integrationId),
      response_type: 'code',
      scope: manifest.scopes.join(manifest.scopeSeparator ?? ' '),
      state: stateToken,
      ...(manifest.extraAuthParams ?? {}),
    };

    let codeVerifier: string | undefined;
    if (manifest.pkce) {
      codeVerifier = randomBytes(32).toString('base64url');
      const challenge = createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      params.code_challenge = challenge;
      params.code_challenge_method = 'S256';
    }

    const stateValue: OAuthState = {
      userId: args.userId,
      workspaceId: args.workspaceId,
      integrationId: connection.integrationId,
      codeVerifier,
      returnTo: args.returnTo,
    };
    await this.cache.set(STATE_PREFIX + stateToken, stateValue, STATE_TTL_MS);

    const url = `${connection.baseUrl}${manifest.authorizePath}?${new URLSearchParams(params).toString()}`;
    return { url };
  }

  /** Validates+consumes the state token, exchanges the code, persists tokens. */
  async completeCallback(args: {
    integrationId: string;
    code: string;
    stateToken: string;
  }): Promise<{ userId: string; workspaceId: string; returnTo?: string }> {
    const stateKey = STATE_PREFIX + args.stateToken;
    const state = (await this.cache.get<OAuthState>(stateKey)) ?? null;
    if (!state) {
      throw new Error('Invalid or expired OAuth state');
    }
    // One-shot — drop the state immediately to prevent replay.
    await this.cache.del(stateKey);

    if (state.integrationId !== args.integrationId) {
      throw new Error('OAuth state does not match callback integration');
    }

    const manifest = this.registry.requireForIntegrationId(args.integrationId);
    const connection = await this.connectionService.requireEnabled(
      state.workspaceId,
      args.integrationId,
    );
    const tokens = await this.exchangeCodeForTokens(
      manifest,
      connection,
      args.code,
      state.codeVerifier,
    );
    await this.persistTokens(
      state.userId,
      state.workspaceId,
      args.integrationId,
      tokens,
    );
    return {
      userId: state.userId,
      workspaceId: state.workspaceId,
      returnTo: state.returnTo,
    };
  }

  /** Decrypted tokens for the user/workspace/integration tuple, or null if not connected. */
  async getTokens(
    userId: string,
    workspaceId: string,
    integrationId: string,
  ): Promise<DecryptedTokens | null> {
    const row = await this.tokenRepo.findByUserWorkspaceAndIntegration(
      userId,
      workspaceId,
      integrationId,
    );
    if (!row) return null;
    const secret = this.environmentService.getAppSecret();
    return {
      accessToken: decryptString(
        row.accessTokenEncrypted,
        secret,
        TOKEN_ENCRYPTION_INFO,
      ),
      refreshToken: row.refreshTokenEncrypted
        ? decryptString(
            row.refreshTokenEncrypted,
            secret,
            TOKEN_ENCRYPTION_INFO,
          )
        : undefined,
      expiresAt: row.expiresAt ? new Date(row.expiresAt) : undefined,
      scopes: row.scopes,
      needsReconnect: row.needsReconnect,
    };
  }

  /** RFC 6749 refresh-token grant. Throws on rejection — caller marks needs-reconnect. */
  async refreshTokens(
    userId: string,
    workspaceId: string,
    integrationId: string,
  ): Promise<DecryptedTokens> {
    const current = await this.getTokens(userId, workspaceId, integrationId);
    if (!current?.refreshToken) {
      throw new Error('No refresh token stored for this connection');
    }

    const manifest = this.registry.requireForIntegrationId(integrationId);
    const connection = await this.connectionService.requireEnabled(
      workspaceId,
      integrationId,
    );
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: current.refreshToken,
      client_id: connection.oauthClientId,
    });
    if (connection.oauthClientSecret)
      body.set('client_secret', connection.oauthClientSecret);

    const resp = await outboundFetch(
      `${connection.baseUrl}${manifest.tokenPath}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );
    if (!resp.ok) {
      const text = await readOutboundBody(resp).catch(() => '');
      throw new Error(
        `Refresh token exchange failed (${resp.status}): ${text}`,
      );
    }
    const tokens = JSON.parse(await readOutboundBody(resp)) as TokenResponse;
    await this.persistTokens(
      userId,
      workspaceId,
      integrationId,
      tokens,
      current.refreshToken,
    );
    return (await this.getTokens(userId, workspaceId, integrationId))!;
  }

  async markNeedsReconnect(
    userId: string,
    workspaceId: string,
    integrationId: string,
  ): Promise<void> {
    await this.tokenRepo.markNeedsReconnect(userId, workspaceId, integrationId);
  }

  async disconnect(
    userId: string,
    workspaceId: string,
    integrationId: string,
  ): Promise<void> {
    await this.tokenRepo.delete(userId, workspaceId, integrationId);
  }

  callbackUrl(integrationId: string): string {
    return this.connectionService.callbackUrl(integrationId);
  }

  // ---- internals ----

  private async exchangeCodeForTokens(
    manifest: IntegrationManifest,
    connection: ResolvedIntegrationOAuthConnection,
    code: string,
    codeVerifier?: string,
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.callbackUrl(connection.integrationId),
      client_id: connection.oauthClientId,
    });
    if (connection.oauthClientSecret)
      body.set('client_secret', connection.oauthClientSecret);
    if (codeVerifier) body.set('code_verifier', codeVerifier);

    const resp = await outboundFetch(
      `${connection.baseUrl}${manifest.tokenPath}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );
    if (!resp.ok) {
      const text = await readOutboundBody(resp).catch(() => '');
      throw new Error(`OAuth token exchange failed (${resp.status}): ${text}`);
    }
    return JSON.parse(await readOutboundBody(resp)) as TokenResponse;
  }

  private async persistTokens(
    userId: string,
    workspaceId: string,
    integrationId: string,
    tokens: TokenResponse,
    fallbackRefreshToken?: string,
  ): Promise<void> {
    if (!tokens.access_token) {
      throw new Error('Token response missing access_token');
    }
    const secret = this.environmentService.getAppSecret();
    // Providers that don't rotate (e.g. Google) only return a refresh token
    // on the first exchange. Fall back to the existing one to avoid
    // locking the user out on the next refresh.
    const refreshToken = tokens.refresh_token ?? fallbackRefreshToken;
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    await this.tokenRepo.upsert({
      userId,
      workspaceId,
      integrationId,
      accessTokenEncrypted: encryptString(
        tokens.access_token,
        secret,
        TOKEN_ENCRYPTION_INFO,
      ),
      refreshTokenEncrypted: refreshToken
        ? encryptString(refreshToken, secret, TOKEN_ENCRYPTION_INFO)
        : null,
      expiresAt,
      scopes: tokens.scope ?? '',
      needsReconnect: false,
    });
  }
}
