import { Injectable, Logger } from '@nestjs/common';
import { IntegrationRegistry } from '../registry/integration-registry';
import { IntegrationConnectionRepo } from '../repos/integration-connection.repo';
import { IntegrationRepo } from '../repos/integration.repo';
import { OAuthService } from '../oauth/oauth.service';
import { UnfurlResult, IntegrationProvider } from '../registry/integration-provider.interface';
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
  ): Promise<UnfurlResult | null> {
    const cacheKey = this.buildCacheKey(workspaceId, url);
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

    const connection = await this.connectionRepo.findByIntegrationAndUser(
      integration.id,
      userId,
    );

    if (!connection) {
      return null;
    }

    try {
      const accessToken = await this.oauthService.getValidAccessToken(connection);

      const unfurlResult = await provider.unfurl({
        url,
        accessToken,
        match,
        patternType,
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

  private async resolveProvider(
    url: string,
    workspaceId: string,
  ): Promise<{
    provider: IntegrationProvider;
    match: RegExpMatchArray;
    patternType: string;
    integration: { id: string; isEnabled: boolean; type: string };
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

  private buildCacheKey(workspaceId: string, url: string): string {
    const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
    return `${UNFURL_CACHE_PREFIX}${workspaceId}:${hash}`;
  }
}
