import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import type { Redis } from 'ioredis';

const PRESENCE_KEY_PREFIX = 'presence:base:';
const PRESENCE_ENTRY_TTL_MS = 10_000;
const PRESENCE_KEY_TTL_S = 60;

export type PresenceEntry = {
  userId: string;
  cellId?: string | null;
  selection?: unknown;
  ts: number;
};

/*
 * Ephemeral per-base presence. No DB. `presence:base:{baseId}` is a Redis
 * HASH keyed by userId with a JSON-serialised entry. Entries older than
 * PRESENCE_ENTRY_TTL_MS are filtered on read; the key itself is refreshed
 * with a longer Redis EXPIRE on every write so unused rooms drain on
 * their own.
 */
@Injectable()
export class BasePresenceService {
  private readonly logger = new Logger(BasePresenceService.name);
  private readonly redis: Redis;

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getOrThrow();
  }

  async setPresence(
    baseId: string,
    entry: PresenceEntry,
  ): Promise<void> {
    const key = PRESENCE_KEY_PREFIX + baseId;
    await this.redis
      .multi()
      .hset(key, entry.userId, JSON.stringify(entry))
      .expire(key, PRESENCE_KEY_TTL_S)
      .exec();
  }

  async leave(baseId: string, userId: string): Promise<void> {
    const key = PRESENCE_KEY_PREFIX + baseId;
    await this.redis.hdel(key, userId);
  }

  async snapshot(baseId: string): Promise<PresenceEntry[]> {
    const key = PRESENCE_KEY_PREFIX + baseId;
    const raw = await this.redis.hgetall(key);
    const now = Date.now();
    const out: PresenceEntry[] = [];
    const stale: string[] = [];
    for (const [field, value] of Object.entries(raw)) {
      try {
        const entry = JSON.parse(value) as PresenceEntry;
        if (now - entry.ts <= PRESENCE_ENTRY_TTL_MS) {
          out.push(entry);
        } else {
          stale.push(field);
        }
      } catch {
        stale.push(field);
      }
    }
    // Opportunistic GC so the hash doesn't accumulate during long-lived
    // rooms where the key TTL keeps getting refreshed by active users.
    if (stale.length > 0) {
      this.redis.hdel(key, ...stale).catch(() => {});
    }
    return out;
  }
}
