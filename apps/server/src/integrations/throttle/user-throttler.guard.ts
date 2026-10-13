import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

type AuthedRequest = {
  user?: { user?: { id?: string } } | null;
  socket?: { remoteAddress?: string };
};

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: AuthedRequest): Promise<string> {
    const userId = req.user?.user?.id;
    if (userId) return `user:${userId}`;
    const ip = await super.getTracker(
      req as Parameters<ThrottlerGuard['getTracker']>[0],
    );
    return ip || req.socket?.remoteAddress || 'unknown';
  }
}
