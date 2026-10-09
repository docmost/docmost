import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { JwtType } from '../../core/auth/dto/jwt-payload';
import { UserThrottlerGuard } from './user-throttler.guard';

const guard = new UserThrottlerGuard(
  [],
  new ThrottlerStorageService(),
  new Reflector(),
);

function getTracker(req: Record<string, any>): Promise<string> {
  return guard['getTracker'](req);
}

describe('UserThrottlerGuard.getTracker', () => {
  it('tracks a signed-in request by its user id', async () => {
    const req = {
      ip: '203.0.113.7',
      user: {
        user: { id: 'user_1' },
        workspace: { id: 'ws_1' },
        authType: JwtType.ACCESS,
      },
    };

    await expect(getTracker(req)).resolves.toBe('user:user_1');
  });

  it('falls back to the client ip when nobody is signed in', async () => {
    const req = { ip: '203.0.113.7', user: null };

    await expect(getTracker(req)).resolves.toBe('203.0.113.7');
  });

  it('falls back to the socket address when the ip is empty', async () => {
    const req = {
      ip: '',
      user: null,
      socket: { remoteAddress: '198.51.100.4' },
    };

    await expect(getTracker(req)).resolves.toBe('198.51.100.4');
  });

  it('uses a constant tracker for an unidentifiable client', async () => {
    const req = { ip: '', user: null, socket: {} };

    await expect(getTracker(req)).resolves.toBe('unknown');
  });
});
