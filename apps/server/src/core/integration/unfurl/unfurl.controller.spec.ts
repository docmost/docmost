import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { UnfurlController } from './unfurl.controller';
import { UserThrottlerGuard } from '../../../integrations/throttle/user-throttler.guard';
import {
  AUTH_THROTTLER,
  UNFURL_THROTTLER,
} from '../../../integrations/throttle/throttler-names';

describe('UnfurlController throttling', () => {
  let storage: ThrottlerStorageService;
  let guard: UserThrottlerGuard;

  beforeEach(async () => {
    storage = new ThrottlerStorageService();
    guard = new UserThrottlerGuard(
      {
        throttlers: [
          { name: AUTH_THROTTLER, ttl: 60_000, limit: 10 },
          { name: UNFURL_THROTTLER, ttl: 60_000, limit: 120 },
        ],
      },
      storage,
      new Reflector(),
    );
    await guard.onModuleInit();
  });

  afterEach(() => storage.onApplicationShutdown());

  function contextFor(userId: string): ExecutionContext {
    const req = { ip: '10.0.0.1', headers: {}, user: { user: { id: userId } } };
    const res = { header: jest.fn() };
    return {
      getHandler: () => UnfurlController.prototype.unfurl,
      getClass: () => UnfurlController,
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ExecutionContext;
  }

  async function hit(userId: string, times: number) {
    for (let i = 0; i < times; i++) {
      await guard.canActivate(contextFor(userId));
    }
  }

  it('allows 120 requests per user per minute and rejects the next one', async () => {
    await hit('user-a', 120);
    await expect(guard.canActivate(contextFor('user-a'))).rejects.toThrow(
      ThrottlerException,
    );
  });

  it('tracks users separately when they share an IP', async () => {
    await hit('user-a', 120);
    await expect(guard.canActivate(contextFor('user-b'))).resolves.toBe(true);
  });
});
