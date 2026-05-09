import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

type AuthedRequest = { user?: { id?: string } };

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: AuthedRequest): Promise<string> {
    const userId = req.user?.id;
    if (userId) return `user:${userId}`;
    return super.getTracker(req as Parameters<ThrottlerGuard['getTracker']>[0]);
  }
}
