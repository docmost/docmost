import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import * as crypto from 'crypto';

const REFRESH_LOCK_PREFIX = 'integration:refresh:';
// Twice the token endpoint timeout, so the lock outlives its holder's provider call.
const REFRESH_LOCK_TTL_MS = 20_000;

const RELEASE_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
`;

// Rotating providers revoke a refresh token on use, so one connection must never refresh twice at once.
export class RefreshLock {
  private readonly logger = new Logger(RefreshLock.name);

  constructor(private readonly redis: Redis) {}

  // A Redis error counts as not acquired, so nobody refreshes without the lock.
  async acquire(connectionId: string): Promise<string | null> {
    const token = crypto.randomUUID();
    try {
      const ok = await this.redis.set(
        REFRESH_LOCK_PREFIX + connectionId,
        token,
        'PX',
        REFRESH_LOCK_TTL_MS,
        'NX',
      );
      return ok === 'OK' ? token : null;
    } catch (err) {
      this.logger.warn(
        `Refresh lock unavailable for connection ${connectionId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async release(connectionId: string, token: string): Promise<void> {
    try {
      await this.redis.eval(
        RELEASE_SCRIPT,
        1,
        REFRESH_LOCK_PREFIX + connectionId,
        token,
      );
    } catch (err) {
      this.logger.warn(
        `Refresh lock release failed for connection ${connectionId}: ${(err as Error).message}`,
      );
    }
  }

  // A Redis error ends the wait early; callers re-read the row either way.
  async waitForRelease(
    connectionId: string,
    opts: { timeoutMs: number; pollMs: number },
  ): Promise<void> {
    const deadline = Date.now() + opts.timeoutMs;
    while (Date.now() < deadline) {
      const held = await this.redis
        .exists(REFRESH_LOCK_PREFIX + connectionId)
        .catch(() => 0);
      if (!held) return;
      await new Promise((resolve) => setTimeout(resolve, opts.pollMs));
    }
  }
}
