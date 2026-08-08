import { Injectable, Logger } from '@nestjs/common';
import { IntegrationRegistry } from '../registry/integration-registry';
import { IntegrationConnectionRepo } from '../repos/integration-connection.repo';
import { IntegrationRepo } from '../repos/integration.repo';
import { OAuthService } from '../oauth/oauth.service';
import {
  UnfurlResult,
  UnfurlNeedsConnection,
  IntegrationProvider,
} from '../registry/integration-provider.interface';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import type { Redis } from 'ioredis';
import * as crypto from 'crypto';

const UNFURL_CACHE_TTL = 300; // 5 minutes
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
    const cacheKey = this.buildCacheKey(workspaceId, userId, url);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const resolved = await this.resolveProvider(url, workspaceId);

    if (!resolved) {
      return null;
    }

    const { provider, match, patternType, integration } = resolved;

    if (!provider.unfurl) {
      return null;
    }

    // Workspace-scoped providers (Slack) share one bot connection that serves
    // every member; user-scoped providers need the requester's own token.
    const connectionScope =
      provider.definition.oauth?.connectionScope ?? 'user';
    const connection =
      connectionScope === 'workspace'
        ? await this.connectionRepo.findWorkspaceConnection(integration.id)
        : await this.connectionRepo.findByIntegrationAndUser(
            integration.id,
            userId,
          );

    if (!connection) {
      if (connectionScope === 'workspace') {
        return null;
      }
      // Not cached: the card should load as soon as the user connects.
      return this.buildNeedsConnection(
        provider,
        integration.id,
        patternType,
        match,
        url,
      );
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
      });

      await this.redis.set(
        cacheKey,
        JSON.stringify(unfurlResult),
        'EX',
        UNFURL_CACHE_TTL,
      );

      return unfurlResult;
    } catch (err) {
      this.logger.error(`Unfurl failed for ${url}: ${(err as Error).message}`);
      return null;
    }
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
      isEnabled: boolean;
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
      if (integration && integration.isEnabled) {
        return { ...staticResult, integration };
      }
    }

    const integrations =
      await this.integrationRepo.findEnabledByWorkspace(workspaceId);

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

  private buildCacheKey(workspaceId: string, userId: string, url: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(url)
      .digest('hex')
      .slice(0, 16);
    return `${UNFURL_CACHE_PREFIX}${workspaceId}:${userId}:${hash}`;
  }
}
