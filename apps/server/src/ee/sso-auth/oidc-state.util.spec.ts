import { encodeOidcState, decodeOidcState } from './oidc-state.util';

describe('oidc state util', () => {
  const secret = 'test-secret';

  it('round-trips a valid payload', () => {
    const token = encodeOidcState(
      { providerId: 'p1', nonce: 'n1', state: 's1', redirect: '/home' },
      secret,
    );
    const decoded = decodeOidcState(token, secret);
    expect(decoded).toEqual({ providerId: 'p1', nonce: 'n1', state: 's1', redirect: '/home' });
  });

  it('round-trips a payload including codeVerifier (PKCE)', () => {
    const token = encodeOidcState(
      {
        providerId: 'p1',
        nonce: 'n1',
        state: 's1',
        redirect: '/home',
        codeVerifier: 'verifier-123',
      },
      secret,
    );
    const decoded = decodeOidcState(token, secret);
    expect(decoded).toEqual({
      providerId: 'p1',
      nonce: 'n1',
      state: 's1',
      redirect: '/home',
      codeVerifier: 'verifier-123',
    });
    expect(decoded?.codeVerifier).toBe('verifier-123');
  });

  it('rejects a tampered token', () => {
    const token = encodeOidcState({ providerId: 'p1', nonce: 'n1', state: 's1' }, secret);
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    expect(decodeOidcState(tampered, secret)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = encodeOidcState({ providerId: 'p1', nonce: 'n1', state: 's1' }, secret);
    expect(decodeOidcState(token, 'other-secret')).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = encodeOidcState(
      { providerId: 'p1', nonce: 'n1', state: 's1' },
      secret,
      -1, // ttlSeconds in the past
    );
    expect(decodeOidcState(token, secret)).toBeNull();
  });
});
