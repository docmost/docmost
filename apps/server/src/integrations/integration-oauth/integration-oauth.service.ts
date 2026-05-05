import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import {
  encryptString,
  decryptString,
} from '../../common/helpers/encryption.helper';
import { EnvironmentService } from '../environment/environment.service';
import {
  IntegrationManifest,
  resolveBaseUrl,
} from './manifest.types';
import { IntegrationOAuthRegistry } from './manifest.registry';
import { IntegrationOAuthTokenRepo } from './integration-oauth-token.repo';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const STATE_PREFIX = 'integration-oauth:state:';
const TOKEN_ENCRYPTION_INFO = 'integration-oauth-token-v1';

interface OAuthState {
  userId: string;
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
    private readonly environmentService: EnvironmentService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** Builds the authorize redirect URL and stashes one-shot state in Redis. */
  async startAuthorize(args: {
    integrationId: string;
    userId: string;
    returnTo?: string;
  }): Promise<{ url: string }> {
    const manifest = this.registry.require(args.integrationId);
    const clientId = this.requireClientId(manifest);

    const stateToken = randomBytes(32).toString('hex');
    const params: Record<string, string> = {
      client_id: clientId,
      redirect_uri: this.callbackUrl(manifest.id),
      response_type: 'code',
      scope: manifest.scopes.join(manifest.scopeSeparator ?? ' '),
      state: stateToken,
      ...(manifest.extraAuthParams ?? {}),
    };

    let codeVerifier: string | undefined;
    if (manifest.pkce) {
      codeVerifier = randomBytes(32).toString('base64url');
      const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
      params.code_challenge = challenge;
      params.code_challenge_method = 'S256';
    }

    const stateValue: OAuthState = {
      userId: args.userId,
      integrationId: manifest.id,
      codeVerifier,
      returnTo: args.returnTo,
    };
    await this.cache.set(STATE_PREFIX + stateToken, stateValue, STATE_TTL_MS);

    const url = `${resolveBaseUrl(manifest)}${manifest.authorizePath}?${new URLSearchParams(params).toString()}`;
    return { url };
  }

  /** Validates+consumes the state token, exchanges the code, persists tokens. */
  async completeCallback(args: {
    integrationId: string;
    code: string;
    stateToken: string;
  }): Promise<{ userId: string; returnTo?: string }> {
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

    const manifest = this.registry.require(args.integrationId);
    const tokens = await this.exchangeCodeForTokens(manifest, args.code, state.codeVerifier);
    await this.persistTokens(state.userId, manifest.id, tokens);
    return { userId: state.userId, returnTo: state.returnTo };
  }

  /** Decrypted tokens for the user/integration pair, or null if not connected. */
  async getTokens(userId: string, integrationId: string): Promise<DecryptedTokens | null> {
    const row = await this.tokenRepo.findByUserAndIntegration(userId, integrationId);
    if (!row) return null;
    const secret = this.environmentService.getAppSecret();
    return {
      accessToken: decryptString(row.accessTokenEncrypted, secret, TOKEN_ENCRYPTION_INFO),
      refreshToken: row.refreshTokenEncrypted
        ? decryptString(row.refreshTokenEncrypted, secret, TOKEN_ENCRYPTION_INFO)
        : undefined,
      expiresAt: row.expiresAt ? new Date(row.expiresAt) : undefined,
      scopes: row.scopes,
      needsReconnect: row.needsReconnect,
    };
  }

  /** RFC 6749 refresh-token grant. Throws on rejection — caller marks needs-reconnect. */
  async refreshTokens(userId: string, integrationId: string): Promise<DecryptedTokens> {
    const current = await this.getTokens(userId, integrationId);
    if (!current?.refreshToken) {
      throw new Error('No refresh token stored for this connection');
    }

    const manifest = this.registry.require(integrationId);
    const clientId = this.requireClientId(manifest);
    const clientSecret = this.maybeClientSecret(manifest);

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: current.refreshToken,
      client_id: clientId,
    });
    if (clientSecret) body.set('client_secret', clientSecret);

    const resp = await fetch(`${resolveBaseUrl(manifest)}${manifest.tokenPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Refresh token exchange failed (${resp.status}): ${text}`);
    }
    const tokens = (await resp.json()) as TokenResponse;
    await this.persistTokens(userId, integrationId, tokens, current.refreshToken);
    return (await this.getTokens(userId, integrationId))!;
  }

  async markNeedsReconnect(userId: string, integrationId: string): Promise<void> {
    await this.tokenRepo.markNeedsReconnect(userId, integrationId);
  }

  async disconnect(userId: string, integrationId: string): Promise<void> {
    await this.tokenRepo.delete(userId, integrationId);
  }

  callbackUrl(integrationId: string): string {
    return `${this.environmentService.getAppUrl()}/api/integrations/oauth/${integrationId}/callback`;
  }

  // ---- internals ----

  private async exchangeCodeForTokens(
    manifest: IntegrationManifest,
    code: string,
    codeVerifier?: string,
  ): Promise<TokenResponse> {
    const clientId = this.requireClientId(manifest);
    const clientSecret = this.maybeClientSecret(manifest);
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.callbackUrl(manifest.id),
      client_id: clientId,
    });
    if (clientSecret) body.set('client_secret', clientSecret);
    if (codeVerifier) body.set('code_verifier', codeVerifier);

    const resp = await fetch(`${resolveBaseUrl(manifest)}${manifest.tokenPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`OAuth token exchange failed (${resp.status}): ${text}`);
    }
    return (await resp.json()) as TokenResponse;
  }

  private async persistTokens(
    userId: string,
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
      integrationId,
      accessTokenEncrypted: encryptString(tokens.access_token, secret, TOKEN_ENCRYPTION_INFO),
      refreshTokenEncrypted: refreshToken
        ? encryptString(refreshToken, secret, TOKEN_ENCRYPTION_INFO)
        : null,
      expiresAt,
      scopes: tokens.scope ?? '',
      needsReconnect: false,
    });
  }

  private requireClientId(manifest: IntegrationManifest): string {
    const v = this.configService.get<string>(manifest.clientIdEnv);
    if (!v) {
      throw new Error(
        `Missing OAuth client_id env var ${manifest.clientIdEnv} for integration ${manifest.id}`,
      );
    }
    return v;
  }

  private maybeClientSecret(manifest: IntegrationManifest): string | undefined {
    if (!manifest.clientSecretEnv) return undefined;
    return this.configService.get<string>(manifest.clientSecretEnv) || undefined;
  }
}
