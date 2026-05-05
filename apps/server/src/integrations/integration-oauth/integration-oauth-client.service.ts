import { Injectable, Logger } from '@nestjs/common';
import {
  IntegrationManifest,
  resolveBaseUrl,
} from './manifest.types';
import { IntegrationOAuthRegistry } from './manifest.registry';
import {
  DecryptedTokens,
  IntegrationOAuthService,
} from './integration-oauth.service';

export class IntegrationReconnectRequiredError extends Error {
  constructor(integrationId: string) {
    super(`Reconnect required for integration: ${integrationId}`);
    this.name = 'IntegrationReconnectRequiredError';
  }
}

export class IntegrationNotConnectedError extends Error {
  constructor(integrationId: string) {
    super(`Integration not connected: ${integrationId}`);
    this.name = 'IntegrationNotConnectedError';
  }
}

interface RequestOptions {
  method?: string;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
  /** Skip the 30s LRU cache for this call. Defaults to true for non-GET. */
  skipCache?: boolean;
}

interface CacheEntry {
  expiresAt: number;
  body: unknown;
  status: number;
}

/**
 * Per-user authenticated outbound HTTP. Refreshes the access token on a
 * 401 (once); per-(user, integration) mutex prevents concurrent refreshes
 * racing each other. 30s in-memory LRU on GETs absorbs the herd when a
 * page has many embeds. Returns the parsed JSON body.
 */
@Injectable()
export class IntegrationOAuthClientService {
  private readonly logger = new Logger(IntegrationOAuthClientService.name);

  private readonly refreshLocks = new Map<string, Promise<DecryptedTokens>>();
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 30_000;
  private readonly cacheMaxSize = 1024;

  constructor(
    private readonly registry: IntegrationOAuthRegistry,
    private readonly oauthService: IntegrationOAuthService,
  ) {}

  async request<T = unknown>(
    integrationId: string,
    userId: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const manifest = this.registry.require(integrationId);
    const method = (options.method ?? 'GET').toUpperCase();
    const cacheable = method === 'GET' && !options.skipCache;

    const cacheKey = cacheable
      ? this.buildCacheKey(userId, integrationId, method, path, options.query)
      : null;
    if (cacheKey) {
      const hit = this.cacheGet(cacheKey);
      if (hit) return hit as T;
    }

    let tokens = await this.requireTokens(integrationId, userId);

    let resp = await this.send(manifest, path, method, tokens.accessToken, options);
    if (resp.status === 401) {
      tokens = await this.refreshOnce(integrationId, userId);
      resp = await this.send(manifest, path, method, tokens.accessToken, options);
      if (resp.status === 401) {
        await this.oauthService.markNeedsReconnect(userId, integrationId);
        throw new IntegrationReconnectRequiredError(integrationId);
      }
    }

    const body = await this.parseBody(resp);
    if (!resp.ok) {
      const err = new Error(
        `Integration ${integrationId} request failed (${resp.status})`,
      );
      (err as Error & { status?: number; body?: unknown }).status = resp.status;
      (err as Error & { status?: number; body?: unknown }).body = body;
      throw err;
    }

    if (cacheKey) {
      this.cacheSet(cacheKey, { expiresAt: Date.now() + this.cacheTtlMs, body, status: resp.status });
    }
    return body as T;
  }

  /** Convenience wrapper for callers that want a typed JSON response. */
  async get<T = unknown>(
    integrationId: string,
    userId: string,
    path: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    return this.request<T>(integrationId, userId, path, { method: 'GET', query });
  }

  // ---- internals ----

  private async requireTokens(
    integrationId: string,
    userId: string,
  ): Promise<DecryptedTokens> {
    const tokens = await this.oauthService.getTokens(userId, integrationId);
    if (!tokens) {
      throw new IntegrationNotConnectedError(integrationId);
    }
    if (tokens.needsReconnect) {
      throw new IntegrationReconnectRequiredError(integrationId);
    }
    // Proactive refresh saves a guaranteed 401 round-trip.
    if (tokens.expiresAt && tokens.expiresAt.getTime() <= Date.now() && tokens.refreshToken) {
      return this.refreshOnce(integrationId, userId);
    }
    return tokens;
  }

  private async refreshOnce(
    integrationId: string,
    userId: string,
  ): Promise<DecryptedTokens> {
    const lockKey = `${userId}::${integrationId}`;
    const existing = this.refreshLocks.get(lockKey);
    if (existing) return existing;

    const promise = (async () => {
      try {
        return await this.oauthService.refreshTokens(userId, integrationId);
      } catch (err) {
        await this.oauthService.markNeedsReconnect(userId, integrationId);
        this.logger.warn(
          `Refresh failed for integration=${integrationId} user=${userId}: ${(err as Error).message}`,
        );
        throw new IntegrationReconnectRequiredError(integrationId);
      } finally {
        this.refreshLocks.delete(lockKey);
      }
    })();
    this.refreshLocks.set(lockKey, promise);
    return promise;
  }

  private async send(
    manifest: IntegrationManifest,
    path: string,
    method: string,
    accessToken: string,
    options: RequestOptions,
  ): Promise<Response> {
    const url = new URL(`${resolveBaseUrl(manifest)}${path}`);
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(options.headers ?? {}),
    };
    let body: string | undefined;
    if (options.body !== undefined && method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    return fetch(url.toString(), { method, headers, body });
  }

  private async parseBody(resp: Response): Promise<unknown> {
    const ct = resp.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      return resp.json().catch(() => null);
    }
    return resp.text();
  }

  private buildCacheKey(
    userId: string,
    integrationId: string,
    method: string,
    path: string,
    query?: Record<string, string | number | undefined>,
  ): string {
    const q = query
      ? Object.entries(query)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${String(v)}`)
          .join('&')
      : '';
    return `${userId}::${integrationId}::${method}::${path}?${q}`;
  }

  private cacheGet(key: string): unknown | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    // Move-to-end for LRU.
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.body;
  }

  private cacheSet(key: string, entry: CacheEntry): void {
    if (this.cache.size >= this.cacheMaxSize) {
      // Drop the oldest (first inserted) entry.
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, entry);
  }
}
