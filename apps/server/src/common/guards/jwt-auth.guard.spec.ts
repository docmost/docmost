import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OAUTH_SCOPE_KEY } from '../decorators/oauth-scope.decorator';
import { REQUIRE_SESSION_AUTH_KEY } from '../decorators/require-session-auth.decorator';
import { JwtType } from '../../core/auth/dto/jwt-payload';

const handlerSentinel = () => 'handler';
const classSentinel = class Controller {};

function createCtx(): ExecutionContext {
  return {
    getHandler: () => handlerSentinel,
    getClass: () => classSentinel,
  } as any;
}

function createGuard(scopeMetadata?: unknown, requireSession?: boolean) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === REQUIRE_SESSION_AUTH_KEY ? requireSession : scopeMetadata,
    ),
  } as any;
  const environmentService = {
    isCloud: jest.fn().mockReturnValue(false),
  } as any;
  const guard = new JwtAuthGuard(reflector, environmentService);
  return { guard, reflector };
}

function oauthUser(scopes: string[]) {
  return {
    user: { id: 'user_1' },
    workspace: { id: 'ws_1' },
    oauth: { grantId: 'grant_1', scopes },
  };
}

describe('JwtAuthGuard.handleRequest', () => {
  it('rethrows the strategy error', () => {
    const { guard } = createGuard();
    const err = new UnauthorizedException('bad token');

    expect(() => guard.handleRequest(err, null, null, createCtx())).toThrow(err);
  });

  it('throws UnauthorizedException when there is no user', () => {
    const { guard } = createGuard();

    expect(() => guard.handleRequest(null, null, null, createCtx())).toThrow(
      UnauthorizedException,
    );
  });

  it('returns a non-oauth user untouched without consulting scope metadata', () => {
    const { guard, reflector } = createGuard();
    const user = { user: { id: 'user_1' }, workspace: { id: 'ws_1' } };

    expect(guard.handleRequest(null, user, null, createCtx())).toBe(user);
    expect(reflector.getAllAndOverride).not.toHaveBeenCalledWith(
      OAUTH_SCOPE_KEY,
      expect.anything(),
    );
  });

  it('forbids an oauth user on a route without scope metadata', () => {
    const { guard, reflector } = createGuard(undefined);

    expect(() =>
      guard.handleRequest(null, oauthUser(['read', 'write']), null, createCtx()),
    ).toThrow(ForbiddenException);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(OAUTH_SCOPE_KEY, [
      handlerSentinel,
      classSentinel,
    ]);
  });

  it('passes read scope on a read route', () => {
    const { guard } = createGuard('read');
    const user = oauthUser(['read']);

    expect(guard.handleRequest(null, user, null, createCtx())).toBe(user);
  });

  it('forbids read scope on a write route with insufficient_scope', () => {
    const { guard } = createGuard('write');

    expect(() =>
      guard.handleRequest(null, oauthUser(['read']), null, createCtx()),
    ).toThrow('insufficient_scope');
  });

  it('passes write scope on a read route', () => {
    const { guard } = createGuard('read');
    const user = oauthUser(['write']);

    expect(guard.handleRequest(null, user, null, createCtx())).toBe(user);
  });

  it('passes write scope on a write route', () => {
    const { guard } = createGuard('write');
    const user = oauthUser(['write']);

    expect(guard.handleRequest(null, user, null, createCtx())).toBe(user);
  });

  describe('session-only routes', () => {
    const sessionUser = {
      user: { id: 'user_1' },
      workspace: { id: 'ws_1' },
      authType: JwtType.ACCESS,
    };

    it('allows a signed-in session', () => {
      const { guard } = createGuard(undefined, true);

      expect(guard.handleRequest(null, sessionUser, null, createCtx())).toBe(
        sessionUser,
      );
    });

    it('forbids an api key', () => {
      const { guard } = createGuard(undefined, true);
      const apiKeyUser = {
        user: { id: 'user_1' },
        workspace: { id: 'ws_1' },
        authType: JwtType.API_KEY,
      };

      expect(() =>
        guard.handleRequest(null, apiKeyUser, null, createCtx()),
      ).toThrow('This action requires an interactive user session');
    });

    it('forbids an oauth token even when it carries write scope', () => {
      const { guard } = createGuard('write', true);
      const user = { ...oauthUser(['write']), authType: JwtType.OAUTH_ACCESS };

      expect(() => guard.handleRequest(null, user, null, createCtx())).toThrow(
        'This action requires an interactive user session',
      );
    });

    it('leaves api keys working on routes without the marker', () => {
      const { guard } = createGuard(undefined, undefined);
      const apiKeyUser = {
        user: { id: 'user_1' },
        workspace: { id: 'ws_1' },
        authType: JwtType.API_KEY,
      };

      expect(guard.handleRequest(null, apiKeyUser, null, createCtx())).toBe(
        apiKeyUser,
      );
    });
  });

  it('lets handler metadata override class metadata', () => {
    const metadataByTarget = new Map<unknown, string>([
      [handlerSentinel, 'write'],
      [classSentinel, 'read'],
    ]);
    const reflector = {
      getAllAndOverride: jest.fn((key: string, targets: unknown[]) => {
        if (key === REQUIRE_SESSION_AUTH_KEY) {
          return undefined;
        }
        for (const target of targets) {
          if (metadataByTarget.has(target)) {
            return metadataByTarget.get(target);
          }
        }
        return undefined;
      }),
    } as any;
    const environmentService = { isCloud: jest.fn().mockReturnValue(false) } as any;
    const guard = new JwtAuthGuard(reflector, environmentService);

    expect(() =>
      guard.handleRequest(null, oauthUser(['read']), null, createCtx()),
    ).toThrow('insufficient_scope');
  });
});
