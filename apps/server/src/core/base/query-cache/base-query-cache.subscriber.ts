import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import {
  createRetryStrategy,
  parseRedisUrl,
} from '../../../common/helpers/utils';
import { QueryCacheConfigProvider } from './query-cache.config';
import { BaseQueryCacheService } from './base-query-cache.service';
import { ChangeEnvelope } from './query-cache.types';

const CHANNEL_PATTERN = 'base-query-cache:changes:*';

/*
 * Dedicated ioredis subscriber that forwards change envelopes to the local
 * BaseQueryCacheService. A separate connection is required because ioredis
 * puts subscribing clients into subscriber-only mode and the shared client
 * from RedisService is used for normal commands elsewhere in the app.
 * When the query-cache is disabled we do not open a Redis connection at all.
 */
@Injectable()
export class BaseQueryCacheSubscriber
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(BaseQueryCacheSubscriber.name);
  private client: Redis | null = null;

  constructor(
    private readonly configProvider: QueryCacheConfigProvider,
    private readonly env: EnvironmentService,
    private readonly cacheService: BaseQueryCacheService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.configProvider.config.enabled) return;

    const redisUrl = this.env.getRedisUrl();
    const { family } = parseRedisUrl(redisUrl);

    this.client = new Redis(redisUrl, {
      family,
      retryStrategy: createRetryStrategy(),
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Subscriber client error: ${err.message}`);
    });

    this.client.on('pmessage', (_pattern, channel, message) => {
      this.handleMessage(channel, message).catch((err) => {
        const error = err as Error;
        this.logger.warn(
          `Unhandled error applying change from ${channel}: ${error.message}`,
        );
      });
    });

    try {
      await this.client.psubscribe(CHANNEL_PATTERN);
      this.logger.log(`Subscribed to ${CHANNEL_PATTERN}`);
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Failed to psubscribe: ${error.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.quit();
    } catch (err) {
      const error = err as Error;
      this.logger.warn(
        `Failed to close subscriber client cleanly: ${error.message}`,
      );
    }
    this.client = null;
  }

  private async handleMessage(
    channel: string,
    message: string,
  ): Promise<void> {
    let envelope: ChangeEnvelope;
    try {
      envelope = JSON.parse(message) as ChangeEnvelope;
    } catch (err) {
      const error = err as Error;
      this.logger.warn(
        `Dropping malformed cache-change message on ${channel}: ${error.message}`,
      );
      return;
    }

    try {
      await this.cacheService.applyChange(envelope);
    } catch (err) {
      const error = err as Error;
      this.logger.warn(
        `applyChange failed for ${envelope.baseId}: ${error.message}`,
      );
      if (error.stack) this.logger.warn(error.stack);
    }
  }
}
