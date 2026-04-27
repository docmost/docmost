import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "@nestjs-labs/nestjs-ioredis";
import type { Redis } from "ioredis";

const LOCK_PREFIX = "base-formula-recompute-lock:";
const LOCK_TTL_MS = 15 * 60 * 1000; // 15 min — longer than any realistic backfill

@Injectable()
export class FormulaLockService {
  private readonly logger = new Logger(FormulaLockService.name);
  private readonly redis: Redis;

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getOrThrow();
  }

  /*
   * Returns a release token on success, or null if the lock is held. Callers
   * must pass the token back to release() to prevent cross-holder releases.
   */
  async acquire(pageId: string): Promise<string | null> {
    const token = `${Date.now()}-${Math.random()}`;
    const ok = await this.redis.set(
      LOCK_PREFIX + pageId,
      token,
      "PX",
      LOCK_TTL_MS,
      "NX",
    );
    return ok === "OK" ? token : null;
  }

  async release(pageId: string, token: string): Promise<void> {
    const lua = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(lua, 1, LOCK_PREFIX + pageId, token);
  }

  /*
   * Waits for the lock with a simple polling loop. Returns the token or null
   * on timeout. Workers call this at job start — if acquisition times out
   * the job is retried by BullMQ.
   */
  async acquireWait(pageId: string, opts: { timeoutMs: number; pollMs?: number }): Promise<string | null> {
    const deadline = Date.now() + opts.timeoutMs;
    const poll = opts.pollMs ?? 500;
    while (Date.now() < deadline) {
      const t = await this.acquire(pageId);
      if (t) return t;
      await new Promise((r) => setTimeout(r, poll));
    }
    return null;
  }
}
