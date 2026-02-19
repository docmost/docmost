import { Injectable } from '@nestjs/common';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import type { Redis } from 'ioredis';

const REDIS_KEY_PREFIX = 'history:contributors:';

@Injectable()
export class CollabHistoryService {
  private readonly redis: Redis;

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getOrThrow();
  }

  async addContributors(pageId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await this.redis.sadd(REDIS_KEY_PREFIX + pageId, ...userIds);
  }

  async popContributors(pageId: string): Promise<string[]> {
    const key = REDIS_KEY_PREFIX + pageId;
    const count = await this.redis.scard(key);
    if (count === 0) return [];
    return await this.redis.spop(key, count);
  }

  async clearContributors(pageId: string): Promise<void> {
    await this.redis.del(REDIS_KEY_PREFIX + pageId);
  }
}
