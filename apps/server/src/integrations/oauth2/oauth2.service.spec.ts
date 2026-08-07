import { Oauth2Service } from './oauth2.service';

/**
 * Focused unit tests for the signed-state CSRF defense. State is
 * base64url(payload).HMAC-SHA256(payload, APP_SECRET) and verifyState must
 * reject anything that isn't a fresh, untampered state bound to the same
 * provider/user/workspace.
 */
describe('Oauth2Service signed state', () => {
  const APP_SECRET = 'unit-test-app-secret';
  const provider = 'linear';
  const userId = 'user-1';
  const workspaceId = 'ws-1';

  let service: Oauth2Service;

  // createState is private; expose it for minting valid states under test
  const mintState = (p = provider, u = userId, w = workspaceId): string =>
    (service as any).createState(p, u, w);

  beforeEach(() => {
    const environmentService = {
      getAppSecret: () => APP_SECRET,
      getAppUrl: () => 'https://app.example.com',
    };
    service = new Oauth2Service(
      environmentService as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts a freshly minted state for the matching provider/user/workspace', () => {
    expect(service.verifyState(mintState(), provider, userId, workspaceId)).toBe(
      true,
    );
  });

  it('rejects missing or malformed state', () => {
    expect(service.verifyState(undefined, provider, userId, workspaceId)).toBe(
      false,
    );
    expect(service.verifyState('', provider, userId, workspaceId)).toBe(false);
    expect(
      service.verifyState('no-dot-separator', provider, userId, workspaceId),
    ).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const [encoded] = mintState().split('.');
    const forged = `${encoded}.${Buffer.from('forged-signature').toString('base64url')}`;
    expect(service.verifyState(forged, provider, userId, workspaceId)).toBe(
      false,
    );
  });

  it('rejects a tampered payload kept with the original signature', () => {
    const [, signature] = mintState().split('.');
    const swapped = Buffer.from(
      JSON.stringify({ p: provider, u: 'attacker', w: workspaceId, n: 'x', t: Date.now() }),
    ).toString('base64url');
    expect(
      service.verifyState(`${swapped}.${signature}`, provider, userId, workspaceId),
    ).toBe(false);
  });

  it('rejects state bound to a different provider/user/workspace', () => {
    const state = mintState();
    expect(service.verifyState(state, 'github', userId, workspaceId)).toBe(false);
    expect(service.verifyState(state, provider, 'other-user', workspaceId)).toBe(
      false,
    );
    expect(service.verifyState(state, provider, userId, 'other-ws')).toBe(false);
  });

  it('rejects state past the 10-minute TTL', () => {
    const t0 = 1_000_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(t0);
    const state = mintState();

    // 10 minutes + 1ms later
    jest.spyOn(Date, 'now').mockReturnValue(t0 + 10 * 60 * 1000 + 1);
    expect(service.verifyState(state, provider, userId, workspaceId)).toBe(false);
  });

  it('still accepts state within the TTL window', () => {
    const t0 = 1_000_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(t0);
    const state = mintState();

    jest.spyOn(Date, 'now').mockReturnValue(t0 + 9 * 60 * 1000);
    expect(service.verifyState(state, provider, userId, workspaceId)).toBe(true);
  });
});
