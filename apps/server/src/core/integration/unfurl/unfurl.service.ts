import { Injectable, Logger } from '@nestjs/common';
import { IntegrationRegistry } from '../registry/integration-registry';
import { IntegrationConnectionRepo } from '../repos/integration-connection.repo';
import { IntegrationRepo } from '../repos/integration.repo';
import { OAuthService } from '../oauth/oauth.service';
import {
  UnfurlResult,
  UnfurlNeedsConnection,
  UnfurlForbiddenError,
  UnfurlNeedsConnectionError,
  TokenExpiredError,
  TokenInvalidError,
  ProviderApiError,
  IntegrationProvider,
} from '../registry/integration-provider.interface';
import { IntegrationConnection } from '@docmost/db/types/entity.types';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import type { Redis } from 'ioredis';
import * as crypto from 'crypto';

const UNFURL_CACHE_TTL = 300; // 5 minutes
// Short negative cache for transient failures; a 404 uses the normal TTL.
const UNFURL_ERROR_CACHE_TTL = 60;
const UNFURL_CACHE_PREFIX = 'unfurl:';

@Injectable()
export class UnfurlService {
  private readonly logger = new Logger(UnfurlService.name);
  private readonly redis: Redis;

  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly integrationRepo: IntegrationRepo,
    private readonly connectionRepo: IntegrationConnectionRepo,
    private readonly oauthService: OAuthService,
    private readonly redisService: RedisService,
  ) {
    this.redis = this.redisService.getOrThrow();
  }

  async unfurl(
    url: string,
    userId: string,
    workspaceId: string,
  ): Promise<UnfurlResult | UnfurlNeedsConnection | null> {
    const resolved = await this.resolveProvider(url, workspaceId);

    if (!resolved) {
      return null;
    }

    const { provider, match, patternType, integration } = resolved;

    if (!provider.unfurl) {
      return null;
    }

    // Workspace-scoped providers (Slack) unfurl through one shared bot connection.
    const connectionScope =
      provider.definition.oauth?.connectionScope ?? 'user';
    const connection =
      connectionScope === 'workspace'
        ? await this.connectionRepo.findWorkspaceConnection(integration.id)
        : await this.connectionRepo.findByIntegrationAndUser(
            integration.id,
            userId,
          );

    if (!connection || connection.invalidatedAt) {
      // Dead workspace connections need an admin re-install; members get no card.
      if (connectionScope === 'workspace') {
        return null;
      }
      // Not cached, so the card loads once the user connects.
      return this.buildNeedsConnection(
        provider,
        integration.id,
        patternType,
        match,
        url,
      );
    }

    const cacheKey = this.buildCacheKey(workspaceId, userId, connection, url);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const accessToken =
        await this.oauthService.getValidAccessToken(connection);

      const unfurlResult = await provider.unfurl({
        url,
        accessToken,
        match,
        patternType,
        settings: (integration.settings as Record<string, any>) ?? {},
        userId,
        integrationId: integration.id,
      });

      await this.redis.set(
        cacheKey,
        JSON.stringify(unfurlResult),
        'EX',
        UNFURL_CACHE_TTL,
      );

      return unfurlResult;
    } catch (err) {
      // Not cached, so the card loads once the user links their account.
      if (err instanceof UnfurlNeedsConnectionError) {
        return this.buildNeedsConnection(
          provider,
          integration.id,
          patternType,
          match,
          url,
        );
      }
      if (err instanceof UnfurlForbiddenError) {
        this.logger.debug(
          `Unfurl not authorized for ${url}: ${(err as Error).message}`,
        );
        await this.cacheNull(cacheKey, UNFURL_ERROR_CACHE_TTL);
        return null;
      }
      // Not cached, so the card loads once the refresh job renews the token.
      if (err instanceof TokenExpiredError) {
        return null;
      }
      if (err instanceof TokenInvalidError) {
        this.logger.warn(
          `Retiring connection ${connection.id}: ${(err as Error).message}`,
        );
        // Spares a connection whose token the refresh job replaced after it was read.
        await this.connectionRepo
          .invalidate(connection.id, { accessToken: connection.accessToken })
          .catch(() => undefined);
        if (connectionScope === 'workspace') {
          return null;
        }
        // Not cached, so the card loads once the user reconnects.
        return this.buildNeedsConnection(
          provider,
          integration.id,
          patternType,
          match,
          url,
        );
      }
      this.logger.error(`Unfurl failed for ${url}: ${(err as Error).message}`);
      const ttl =
        err instanceof ProviderApiError && err.status === 404
          ? UNFURL_CACHE_TTL
          : UNFURL_ERROR_CACHE_TTL;
      await this.cacheNull(cacheKey, ttl);
      return null;
    }
  }

  private async cacheNull(cacheKey: string, ttl: number): Promise<void> {
    await this.redis.set(cacheKey, 'null', 'EX', ttl);
  }

  private buildNeedsConnection(
    provider: IntegrationProvider,
    integrationId: string,
    patternType: string,
    match: RegExpMatchArray,
    url: string,
  ): UnfurlNeedsConnection {
    const described =
      provider.describeLink?.(patternType, match, url) ?? null;

    let fallbackDescription: string | undefined;
    try {
      const parsed = new URL(url);
      fallbackDescription = `${parsed.host}${parsed.pathname}`;
    } catch {
      fallbackDescription = undefined;
    }

    return {
      needsConnection: true,
      integrationId,
      integrationType: provider.definition.type,
      integrationName: provider.definition.name,
      title: described?.title ?? `${provider.definition.name} link`,
      description: described?.description ?? fallbackDescription,
    };
  }

  private async resolveProvider(
    url: string,
    workspaceId: string,
  ): Promise<{
    provider: IntegrationProvider;
    match: RegExpMatchArray;
    patternType: string;
    integration: {
      id: string;
      type: string;
      settings: unknown;
    };
  } | null> {
    const staticResult = this.registry.findUnfurlProvider(url);
    if (staticResult) {
      const integration = await this.integrationRepo.findByWorkspaceAndType(
        workspaceId,
        staticResult.provider.definition.type,
      );
      if (integration) {
        return { ...staticResult, integration };
      }
    }

    const integrations =
      await this.integrationRepo.findAllByWorkspace(workspaceId);

    for (const integration of integrations) {
      const provider = this.registry.getProvider(integration.type);
      if (!provider?.getUnfurlPatterns || !provider.unfurl) continue;

      const settings = (integration.settings as Record<string, any>) ?? {};
      const patterns = provider.getUnfurlPatterns(settings);

      for (const pattern of patterns) {
        const match = url.match(pattern.regex);
        if (match) {
          return { provider, match, patternType: pattern.type, integration };
        }
      }
    }

    return null;
  }

  // updatedAt moves on reconnect and token refresh, so another account's cards never match.
  private buildCacheKey(
    workspaceId: string,
    userId: string,
    connection: Pick<IntegrationConnection, 'id' | 'updatedAt'>,
    url: string,
  ): string {
    const hash = crypto.createHash('sha256').update(url).digest('hex');
    return `${UNFURL_CACHE_PREFIX}${workspaceId}:${userId}:${connection.id}:${connection.updatedAt.getTime()}:${hash}`;
  }
}
