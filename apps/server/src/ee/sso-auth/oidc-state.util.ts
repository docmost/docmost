import { createHmac, timingSafeEqual } from 'crypto';

interface OidcStatePayload {
  providerId: string;
  nonce: string;
  state: string;
  redirect?: string;
  codeVerifier?: string;
  /**
   * True when this cycle was started via the singleton (no-providerId)
   * Entra ID login route, whose fixed redirect_uri must be reconstructed
   * identically at token-exchange time - the OAuth spec requires the
   * callback's redirect_uri to exactly match the one sent in the
   * authorization request, so this must survive the round-trip alongside
   * providerId rather than being re-derived from it.
   */
  singleton?: boolean;
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function encodeOidcState(
  payload: OidcStatePayload,
  secret: string,
  ttlSeconds = 600,
): string {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const json = Buffer.from(JSON.stringify(body)).toString('base64url');
  const signature = sign(json, secret);
  return `${json}.${signature}`;
}

export function decodeOidcState(
  token: string,
  secret: string,
): OidcStatePayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [json, signature] = parts;

  const expectedSignature = sign(json, secret);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const body = JSON.parse(Buffer.from(json, 'base64url').toString('utf8'));
    if (typeof body.exp !== 'number' || body.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    const { providerId, nonce, state, redirect, codeVerifier, singleton } = body;
    if (!providerId || !nonce || !state) return null;
    return { providerId, nonce, state, redirect, codeVerifier, singleton };
  } catch {
    return null;
  }
}
