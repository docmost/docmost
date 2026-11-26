import { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserThrottlerGuard } from '../throttle/user-throttler.guard';
import {
  ALL_NAMED_THROTTLERS_SKIPPED,
  LINK_PREVIEW_THROTTLER,
} from '../throttle/throttler-names';
import { LinkPreviewController } from './link-preview.controller';

describe('LinkPreviewController', () => {
  it('requires a session and limits each user', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        LinkPreviewController.prototype.preview,
      ),
    ).toEqual([JwtAuthGuard, UserThrottlerGuard]);
  });

  it('passes url and refresh to the service and returns its result as is', async () => {
    const preview = { title: 'Example' };
    const getPreview = jest.fn(async () => preview);
    const controller = new LinkPreviewController({ getPreview } as any);

    await expect(
      controller.preview({ url: 'https://example.com/a', refresh: true }),
    ).resolves.toBe(preview);
    expect(getPreview).toHaveBeenCalledWith('https://example.com/a', {
      refresh: true,
    });
  });

  it('returns null when the service has no preview', async () => {
    const getPreview = jest.fn(async () => null);
    const controller = new LinkPreviewController({ getPreview } as any);

    await expect(
      controller.preview({ url: 'https://example.com/a' }),
    ).resolves.toBeNull();
    expect(getPreview).toHaveBeenCalledWith('https://example.com/a', {
      refresh: undefined,
    });
  });
});

describe('LinkPreviewController throttling', () => {
  let storage: ThrottlerStorageService;
  let guard: UserThrottlerGuard;
  let res: { header: jest.Mock };

  beforeEach(async () => {
    storage = new ThrottlerStorageService();
    // Every throttler defaults to one request a second, so only the route's own limits allow more.
    guard = new UserThrottlerGuard(
      {
        throttlers: Object.keys(ALL_NAMED_THROTTLERS_SKIPPED).map((name) => ({
          name,
          ttl: 1_000,
          limit: 1,
        })),
      },
      storage,
      new Reflector(),
    );
    await guard.onModuleInit();
  });

  afterEach(() => storage.onApplicationShutdown());

  function contextFor(userId: string): ExecutionContext {
    const req = { ip: '10.0.0.1', headers: {}, user: { user: { id: userId } } };
    res = { header: jest.fn() };
    return {
      getHandler: () => LinkPreviewController.prototype.preview,
      getClass: () => LinkPreviewController,
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ExecutionContext;
  }

  async function hit(userId: string, times: number) {
    for (let i = 0; i < times; i++) {
      await guard.canActivate(contextFor(userId));
    }
  }

  it('allows 30 requests per user per minute and rejects the next one', async () => {
    await hit('user-a', 30);
    await expect(guard.canActivate(contextFor('user-a'))).rejects.toThrow(
      ThrottlerException,
    );
  });

  it('tracks users separately when they share an IP', async () => {
    await hit('user-a', 30);
    await expect(guard.canActivate(contextFor('user-b'))).resolves.toBe(true);
  });

  it('counts only the link preview throttler, over 60 seconds', async () => {
    await hit('user-a', 1);
    expect(res.header.mock.calls).toEqual([
      [`X-RateLimit-Limit-${LINK_PREVIEW_THROTTLER}`, 30],
      [`X-RateLimit-Remaining-${LINK_PREVIEW_THROTTLER}`, 29],
      [`X-RateLimit-Reset-${LINK_PREVIEW_THROTTLER}`, 60],
    ]);
  });
});
