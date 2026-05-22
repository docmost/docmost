import { Injectable } from '@nestjs/common';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import type { Redis } from 'ioredis';
import { UserSessionRepo } from '@docmost/db/repos/session/user-session.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

const THROTTLE_SECONDS = 15 * 60; // 15 minutes

@Injectable()
export class SessionActivityService {
  private readonly redis: Redis;

  constructor(
    private readonly redisService: RedisService,
    private readonly userSessionRepo: UserSessionRepo,
    private readonly userRepo: UserRepo,
  ) {
    this.redis = this.redisService.getOrThrow();
  }

  trackActivity(sessionId: string, userId: string, workspaceId: string): void {
    const key = `session:activity:${sessionId}`;

    this.redis
      .set(key, '1', 'EX', THROTTLE_SECONDS, 'NX')
      .then((result) => {
        if (result === null) return; // key already exists, throttled

        this.userSessionRepo.updateLastActiveAt(sessionId).catch(() => {});
        this.userRepo
          .updateUser({ lastActiveAt: new Date() }, userId, workspaceId)
          .catch(() => {});
      })
      .catch(() => {});
  }
}
